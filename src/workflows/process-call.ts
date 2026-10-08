import { FatalError, RetryableError, getWorkflowMetadata } from "workflow";
import { systemRepository } from "@/lib/server/repository";
import { adminClient } from "@/lib/supabase/server";
import { GroqProvider } from "@/lib/groq/provider";
import { privacyRisk } from "@/lib/privacy/preflight";
import { computeScore } from "@/lib/scoring/engine";
import { ownsProcessing } from "@/lib/domain/processing-attempt";
import { claimProcessingAttempt } from "@/lib/jobs/processing-claim";
import type { CallRecord } from "@/lib/domain/types";
import { analysisCurrent } from "@/lib/domain/source-review";
import { assessmentContext } from "@/lib/domain/assessment-guards";
const provider = () => new GroqProvider({ apiKey: process.env.GROQ_API_KEY });
const missing = (error: unknown) =>
  error instanceof Error && error.message === "CALL_NOT_FOUND";
const unavailable = (error: unknown) =>
  error instanceof Error && error.message === "DATABASE_UNAVAILABLE";
export async function processCall(callId: string, attemptId?: string) {
  "use workflow";
  const runId = getWorkflowMetadata().workflowRunId;
  if (attemptId && !(await claimAttemptStep(callId, attemptId, runId)))
    return { callId };
  const allowed = await transcriptionStep(callId, attemptId, runId);
  if (allowed) await analysisStep(callId, attemptId, runId);
  return { callId };
}
async function claimAttemptStep(
  callId: string,
  attemptId: string,
  runId: string,
) {
  "use step";
  try {
    return await claimProcessingAttempt(
      await systemRepository(callId),
      callId,
      attemptId,
      runId,
    );
  } catch (error) {
    if (missing(error)) return false;
    if (unavailable(error))
      throw new RetryableError("DATABASE_UNAVAILABLE", { retryAfter: "10s" });
    throw new FatalError("PROCESSING_CLAIM_FAILED");
  }
}
async function ownedCall(callId: string, attemptId?: string, runId?: string) {
  try {
    const repo = await systemRepository(callId),
      call = await repo.get(callId);
    return ownsProcessing(call, attemptId, runId) ? { repo, call } : null;
  } catch (error) {
    if (missing(error)) return null;
    if (unavailable(error))
      throw new RetryableError("DATABASE_UNAVAILABLE", { retryAfter: "10s" });
    throw new FatalError("PROCESSING_STATE_UNAVAILABLE");
  }
}
function finishAttempt(call: CallRecord, attemptId?: string, runId?: string) {
  if (attemptId && ownsProcessing(call, attemptId, runId))
    call.processingAttempt = { ...call.processingAttempt!, state: "finished" };
}
async function transcriptionStep(
  callId: string,
  attemptId?: string,
  runId?: string,
): Promise<boolean> {
  "use step";
  const loaded = await ownedCall(callId, attemptId, runId);
  if (!loaded) return false;
  const { repo, call } = loaded;
  if (call.errorCode === "UPLOAD_PENDING" || call.status === "privacy_review")
    return false;
  if (call.segments.length) return true;
  try {
    if (
      call.sourceKind !== "synthetic" &&
      process.env.REAL_CALL_PROCESSING_ENABLED !== "true"
    )
      throw new Error("PRIVACY_APPROVAL_REQUIRED");
    if (!process.env.GROQ_API_KEY) throw new Error("AI_NOT_CONFIGURED");
    const previous = call.version;
    call.status = "transcribing";
    call.version++;
    if (!(await repo.put(call, previous))) return false;
    const beforeEffects = await ownedCall(callId, attemptId, runId);
    if (!beforeEffects || beforeEffects.call.version !== call.version)
      return false;
    const client = adminClient(),
      { data, error } = await client.storage
        .from("call-source")
        .download(call.sourcePath!);
    if (error || !data) throw new Error("SOURCE_UNAVAILABLE");
    const bytes = Buffer.from(await data.arrayBuffer());
    const beforeProvider = await ownedCall(callId, attemptId, runId);
    if (!beforeProvider || beforeProvider.call.version !== call.version)
      return false;
    const transcript = await provider().transcribe(
      bytes,
      call.sourcePath!.split(".").at(-1)!,
    );
    if (transcript.durationMs > 3_600_000)
      throw new Error("RECORDING_TOO_LONG");
    call.transcriptCompleteness = "unverified";
    call.transcriptReviewReasons = transcript.reviewReasons;
    const latest = await ownedCall(callId, attemptId, runId);
    if (!latest || latest.call.version !== call.version) return false;
    if (privacyRisk(transcript.segments.map((x) => x.text).join(" "))) {
      call.status = "privacy_review";
      call.errorCode = "PRIVACY_REVIEW_REQUIRED";
      finishAttempt(call, attemptId, runId);
      call.version++;
      await repo.put(call, previous + 1);
      return false;
    }
    const derivative = `${call.workspaceId}/${call.id}.${call.sourcePath!.split(".").at(-1)!}`;
    const { error: copyError } = await client.storage
      .from("call-sanitized")
      .upload(derivative, data, { upsert: false, contentType: data.type });
    if (copyError && !String(copyError.message).includes("already exists"))
      throw new Error("SANITIZED_MEDIA_FAILED");
    call.sanitizedPath = derivative;
    call.segments = transcript.segments;
    if (!call.originalSegments) {
      call.originalSegments = structuredClone(transcript.segments);
      call.originalSegmentsProvenance = "asr";
    }
    call.sourceRevision ??= 0;
    call.durationMs = transcript.durationMs;
    call.status = "analyzing";
    call.errorCode = transcript.complete ? null : "TRANSCRIPT_UNCERTAIN";
    call.version++;
    const saved = await repo.put(call, previous + 1);
    if (!saved) {
      const { data: deleted } = await client
        .from("deletion_tombstones")
        .select("call_id")
        .eq("call_id", callId)
        .maybeSingle();
      if (deleted)
        await client.storage.from("call-sanitized").remove([derivative]);
    }
    return saved;
  } catch (error) {
    await safeFailure(callId, error, attemptId, runId, call.version);
    return false;
  }
}
async function analysisStep(
  callId: string,
  attemptId?: string,
  runId?: string,
) {
  "use step";
  const loaded = await ownedCall(callId, attemptId, runId);
  if (!loaded) return { callId };
  const { repo, call } = loaded;
  if (analysisCurrent(call)) {
    if (attemptId) {
      const previous = call.version;
      call.status =
        call.score?.grade == null || call.analysis!.reviewReasons.length
          ? "needs_review"
          : "ready";
      call.errorCode = null;
      finishAttempt(call, attemptId, runId);
      call.version++;
      await repo.put(call, previous);
    }
    return { callId };
  }
  if (!call.segments.length) return { callId };
  try {
    if (
      call.sourceKind !== "synthetic" &&
      process.env.REAL_CALL_PROCESSING_ENABLED !== "true"
    )
      throw new Error("PRIVACY_APPROVAL_REQUIRED");
    const sourceRevision = call.sourceRevision ?? 0;
    const { original, effective } = await provider().analyze(
      call.segments,
      assessmentContext(call),
    );
    const latest = await ownedCall(callId, attemptId, runId);
    if (
      !latest ||
      latest.call.version !== call.version ||
      (latest.call.sourceRevision ?? 0) !== sourceRevision
    )
      return { callId };
    effective.reviewReasons = [
      ...new Set([
        ...effective.reviewReasons,
        ...(call.transcriptReviewReasons ?? []),
      ]),
    ];
    const previous = call.version;
    call.analysis = effective;
    call.originalAnalysis ??= structuredClone(original);
    call.latestModelAnalysis = structuredClone(original);
    call.analysisSourceRevision = sourceRevision;
    call.score = computeScore(effective);
    call.status =
      call.score.grade === null || effective.reviewReasons.length
        ? "needs_review"
        : "ready";
    call.errorCode = null;
    finishAttempt(call, attemptId, runId);
    call.version++;
    await repo.put(call, previous);
  } catch (error) {
    await safeFailure(callId, error, attemptId, runId, call.version);
  }
  return { callId };
}
async function safeFailure(
  callId: string,
  error: unknown,
  attemptId?: string,
  runId?: string,
  expectedVersion?: number,
) {
  const status = (error as { status?: number })?.status;
  if (error instanceof RetryableError) throw error;
  if (unavailable(error))
    throw new RetryableError("DATABASE_UNAVAILABLE", { retryAfter: "10s" });
  if (status === 429 || (status && status >= 500))
    throw new RetryableError("PROVIDER_TEMPORARILY_UNAVAILABLE", {
      retryAfter: "1m",
    });
  const codes = [
    "AI_NOT_CONFIGURED",
    "PRIVACY_APPROVAL_REQUIRED",
    "INVALID_EVIDENCE",
    "INVALID_COACHING",
    "INVALID_TRANSCRIPT",
    "INCOMPLETE_ANALYSIS",
    "TRANSCRIPT_TOO_LONG",
    "SOURCE_UNAVAILABLE",
    "RECORDING_TOO_LONG",
    "SANITIZED_MEDIA_FAILED",
  ];
  const code =
    error instanceof Error && codes.includes(error.message)
      ? error.message
      : "ANALYSIS_FAILED";
  const loaded = await ownedCall(callId, attemptId, runId);
  if (
    !loaded ||
    (expectedVersion !== undefined && loaded.call.version !== expectedVersion)
  )
    return;
  const { repo, call } = loaded,
    previous = call.version;
  call.status = "failed";
  call.errorCode = code;
  finishAttempt(call, attemptId, runId);
  call.version++;
  await repo.put(call, previous);
}
