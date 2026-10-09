import {
  FatalError,
  RetryableError,
  getWorkflowMetadata,
  getStepMetadata,
} from "workflow";
import { systemRepository } from "@/lib/server/repository";
import { adminClient } from "@/lib/supabase/server";
import { GroqProvider } from "@/lib/groq/provider";
import { computeScore } from "@/lib/scoring/engine";
import { ownsProcessing } from "@/lib/domain/processing-attempt";
import { claimProcessingAttempt } from "@/lib/jobs/processing-claim";
import type { CallRecord } from "@/lib/domain/types";
import { analysisCurrent } from "@/lib/domain/source-review";
import { assessmentContext } from "@/lib/domain/assessment-guards";
import { createHash } from "node:crypto";
import { STAGED_CONTRACT } from "@/lib/groq/staged-contract";
import { INDEXED_CONTRACT } from "@/lib/groq/indexed-contract";
import { providerRetryLimit } from "@/lib/groq/retry-limit";
import { providerFailureCode } from "@/lib/groq/failure-code";
const PROVIDER_RETRIES = 3;
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
  if (call.errorCode === "UPLOAD_PENDING") return false;
  if (call.segments.length) return true;
  try {
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
    const sourceRevision = call.sourceRevision ?? 0;
    const context = assessmentContext(call);
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ segments: call.segments, context }))
      .digest("hex");
    const pending = call.pendingExtraction;
    const reusable =
      pending &&
      pending.inputHash === inputHash &&
      pending.sourceRevision === sourceRevision &&
      pending.expectedVersion === call.version &&
      pending.attemptId === (attemptId ?? null) &&
      pending.runId === (runId ?? null) &&
      [STAGED_CONTRACT, INDEXED_CONTRACT].includes(
        pending.output.contract as
          typeof STAGED_CONTRACT | typeof INDEXED_CONTRACT,
      ) &&
      pending.output.model === "openai/gpt-oss-120b";
    const stagedProvider = new GroqProvider({
      apiKey: process.env.GROQ_API_KEY,
      cachedExtraction: reusable ? pending.output : undefined,
      saveExtraction: async (output) => {
        const active = await ownedCall(callId, attemptId, runId);
        if (
          !active ||
          active.call.version !== call.version ||
          (active.call.sourceRevision ?? 0) !== sourceRevision ||
          active.call.errorCode === "UPLOAD_PENDING"
        )
          throw new Error("PROCESSING_SUPERSEDED");
        const previous = call.version;
        call.version++;
        call.pendingExtraction = {
          inputHash,
          sourceRevision,
          expectedVersion: call.version,
          attemptId: attemptId ?? null,
          runId: runId ?? null,
          output,
        };
        if (!(await repo.put(call, previous)))
          throw new Error("PROCESSING_SUPERSEDED");
      },
      beforeScoring: async () => {
        const active = await ownedCall(callId, attemptId, runId);
        if (
          !active ||
          active.call.version !== call.version ||
          (active.call.sourceRevision ?? 0) !== sourceRevision ||
          active.call.errorCode === "UPLOAD_PENDING"
        )
          throw new Error("PROCESSING_SUPERSEDED");
      },
    });
    const { original, effective, providerOutput } =
      await stagedProvider.analyze(call.segments, context);
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
    call.analysisGeneration = (call.analysisGeneration ?? 0) + 1;
    if (providerOutput) {
      if (!call.originalAnalysis)
        call.originalProviderOutput ??= structuredClone(providerOutput);
      call.latestProviderOutput = structuredClone(providerOutput);
    }
    call.originalAnalysis ??= structuredClone(original);
    call.latestModelAnalysis = structuredClone(original);
    call.pendingExtraction = null;
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
    if (error instanceof Error && error.message === "PROCESSING_SUPERSEDED")
      return { callId };
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
  const providerTransient = status === 429 || !!(status && status >= 500);
  let stepAttempt = 1;
  try {
    stepAttempt = getStepMetadata().attempt;
  } catch {
    /* Offline direct invocations have no step context. */
  }
  if (
    providerTransient &&
    stepAttempt <= providerRetryLimit(process.env.GROQ_WORKFLOW_RETRIES)
  )
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
    "ANALYSIS_BUDGET_EXCEEDED",
    "SOURCE_UNAVAILABLE",
    "RECORDING_TOO_LONG",
    "SANITIZED_MEDIA_FAILED",
    "SOURCE_EXCERPT_LIMIT",
  ];
  const code = providerTransient
    ? "PROVIDER_TEMPORARILY_UNAVAILABLE"
    : error instanceof Error && codes.includes(error.message)
      ? error.message
      : providerFailureCode(error);
  const loaded = await ownedCall(callId, attemptId, runId);
  if (
    !loaded ||
    (expectedVersion !== undefined && loaded.call.version !== expectedVersion)
  )
    return;
  const { repo, call } = loaded,
    previous = call.version;
  // Identifiers and bounded codes only; never log provider messages or content.
  console.warn("pipeline_failure", {
    callId,
    errorCode: code,
    providerStatus: typeof status === "number" ? status : null,
  });
  call.status = "failed";
  call.errorCode = code;
  finishAttempt(call, attemptId, runId);
  call.version++;
  await repo.put(call, previous);
}
analysisStep.maxRetries = PROVIDER_RETRIES;
transcriptionStep.maxRetries = PROVIDER_RETRIES;
