import { FatalError, RetryableError } from "workflow";
import { systemRepository } from "@/lib/server/repository";
import { adminClient } from "@/lib/supabase/server";
import { GroqProvider } from "@/lib/groq/provider";
import { privacyRisk } from "@/lib/privacy/preflight";
import { computeScore } from "@/lib/scoring/engine";
const provider = () => new GroqProvider({ apiKey: process.env.GROQ_API_KEY });
export async function processCall(callId: string) {
  "use workflow";
  const allowed = await transcriptionStep(callId);
  if (allowed) await analysisStep(callId);
  return { callId };
}
async function transcriptionStep(callId: string): Promise<boolean> {
  "use step";
  const repo = await systemRepository(callId),
    call = await repo.get(callId);
  if (call.errorCode === "UPLOAD_PENDING" || call.status === "privacy_review")
    return false;
  if (call.segments.length) return true;
  if (
    (call.sourceKind !== "synthetic" &&
      process.env.REAL_CALL_PROCESSING_ENABLED !== "true") ||
    !process.env.GROQ_API_KEY
  )
    throw new FatalError("PROCESSING_NOT_CONFIGURED");
  try {
    const previous = call.version;
    call.status = "transcribing";
    call.version++;
    if (!(await repo.put(call, previous))) return false;
    const client = adminClient(),
      { data, error } = await client.storage
        .from("call-source")
        .download(call.sourcePath!);
    if (error || !data) throw new Error("SOURCE_UNAVAILABLE");
    const transcript = await provider().transcribe(
      Buffer.from(await data.arrayBuffer()),
      call.sourcePath!.split(".").at(-1)!,
    );
    if (transcript.durationMs > 3_600_000)
      throw new Error("RECORDING_TOO_LONG");
    if (privacyRisk(transcript.segments.map((x) => x.text).join(" "))) {
      call.status = "privacy_review";
      call.errorCode = "PRIVACY_REVIEW_REQUIRED";
      call.version++;
      await repo.put(call, previous + 1);
      return false;
    }
    const derivative = `${call.workspaceId}/${call.id}.${call.sourcePath!.split(".").at(-1)!}`;
    await repo.get(callId); // recheck deletion after the provider request
    const { error: copyError } = await client.storage
      .from("call-sanitized")
      .upload(derivative, data, { upsert: false, contentType: data.type });
    if (copyError && !String(copyError.message).includes("already exists"))
      throw new Error("SANITIZED_MEDIA_FAILED");
    call.sanitizedPath = derivative;
    call.segments = transcript.segments;
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
    await safeFailure(callId, error);
    return false;
  }
}
async function analysisStep(callId: string) {
  "use step";
  const repo = await systemRepository(callId),
    call = await repo.get(callId);
  if (call.analysis || !call.segments.length) return { callId };
  try {
    const analysis = await provider().analyze(call.segments);
    if (call.errorCode === "TRANSCRIPT_UNCERTAIN") {
      analysis.complete = false;
      analysis.reviewReasons.push("Transcription completeness needs review.");
    }
    const previous = call.version;
    call.analysis = analysis;
    call.originalAnalysis = structuredClone(analysis);
    call.score = computeScore(analysis);
    call.status =
      call.score.grade === null || analysis.reviewReasons.length
        ? "needs_review"
        : "ready";
    call.errorCode = null;
    call.version++;
    await repo.put(call, previous);
  } catch (error) {
    await safeFailure(callId, error);
  }
  return { callId };
}
async function safeFailure(callId: string, error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status === 429 || (status && status >= 500))
    throw new RetryableError("PROVIDER_TEMPORARILY_UNAVAILABLE", {
      retryAfter: "1m",
    });
  const codes = [
    "AI_NOT_CONFIGURED",
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
  try {
    const repo = await systemRepository(callId),
      call = await repo.get(callId);
    const previous = call.version;
    call.status = "failed";
    call.errorCode = code;
    call.version++;
    await repo.put(call, previous);
  } catch {}
}
