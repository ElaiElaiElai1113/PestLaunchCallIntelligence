import type { CallRecord } from "../domain/types";
import {
  analysisCurrent,
  activeProcessing,
  preparedTranscriptBlock,
} from "../domain/source-review";
import { assessmentContext } from "../domain/assessment-guards";
import { buildAnalysisRequest } from "./analysis-request";
// Pure admission only: no provider/client is constructed and no source is changed.
function transcriptAdmission(call: CallRecord) {
  let budget: "admitted" | "exceeded" | "invalid" = "invalid";
  try {
    buildAnalysisRequest(call.segments, assessmentContext(call));
    budget = "admitted";
  } catch (error) {
    if (error instanceof Error && error.message === "ANALYSIS_BUDGET_EXCEEDED")
      budget = "exceeded";
  }
  const blockedReason =
    preparedTranscriptBlock(call) ??
    (budget === "exceeded"
      ? "ANALYSIS_BUDGET_EXCEEDED"
      : budget === "invalid"
        ? "INVALID_TRANSCRIPT"
        : null);
  return { eligible: blockedReason === null, budget, blockedReason };
}
export function analysisRecovery(
  call: CallRecord,
  ...legacyArguments: boolean[]
) {
  void legacyArguments;
  const input = transcriptAdmission(call);
  const blockedReason = activeProcessing(call)
    ? "PROCESSING_ACTIVE"
    : analysisCurrent(call)
      ? "REANALYSIS_UNAVAILABLE"
      : input.blockedReason;
  return { ...input, eligible: blockedReason === null, blockedReason };
}
export function providerInputAdmission(
  call: CallRecord,
  ...legacyArguments: boolean[]
) {
  void legacyArguments;
  const held = call.errorCode === "UPLOAD_PENDING";
  if (held)
    return {
      eligible: false,
      budget: "not_required" as const,
      blockedReason: "UPLOAD_PENDING",
      restoreOnly: false,
    };
  if (analysisCurrent(call))
    return {
      eligible: call.segments.length > 0,
      budget: "not_required" as const,
      blockedReason: call.segments.length ? null : "INVALID_TRANSCRIPT",
      restoreOnly: true,
    };
  // Initial audio resumption keeps existing validated-upload/transcription
  // admission; no derivative or transcript budget exists at that stage.
  if (!call.segments.length)
    return {
      eligible: true,
      budget: "not_required" as const,
      blockedReason: null,
      restoreOnly: false,
    };
  return { ...transcriptAdmission(call), restoreOnly: false };
}
