import type { CallRecord } from "../domain/types";
import {
  analysisCurrent,
  activeProcessing,
  preparedTranscriptBlock,
} from "../domain/source-review";
import { assessmentContext } from "../domain/assessment-guards";
import { buildAnalysisRequest } from "./analysis-request";
// Pure admission only: no provider/client is constructed and no source is changed.
function transcriptAdmission(call: CallRecord, realAllowed: boolean) {
  let budget: "admitted" | "exceeded" | "invalid" = "invalid";
  try {
    buildAnalysisRequest(call.segments, assessmentContext(call));
    budget = "admitted";
  } catch (error) {
    if (error instanceof Error && error.message === "ANALYSIS_BUDGET_EXCEEDED")
      budget = "exceeded";
  }
  const blockedReason =
    preparedTranscriptBlock(call, realAllowed) ??
    (budget === "exceeded"
      ? "ANALYSIS_BUDGET_EXCEEDED"
      : budget === "invalid"
        ? "INVALID_TRANSCRIPT"
        : null);
  return { eligible: blockedReason === null, budget, blockedReason };
}
export function analysisRecovery(call: CallRecord, realAllowed: boolean) {
  const input = transcriptAdmission(call, realAllowed);
  const blockedReason = activeProcessing(call)
    ? "PROCESSING_ACTIVE"
    : analysisCurrent(call)
      ? "REANALYSIS_UNAVAILABLE"
      : input.blockedReason;
  return { ...input, eligible: blockedReason === null, blockedReason };
}
export function providerInputAdmission(call: CallRecord, realAllowed: boolean) {
  const held =
    call.status === "privacy_review" ||
    ["UPLOAD_PENDING", "PRIVACY_REVIEW_REQUIRED"].includes(
      call.errorCode ?? "",
    ) ||
    (call.sourceKind !== "synthetic" && !realAllowed);
  if (held)
    return {
      eligible: false,
      budget: "not_required" as const,
      blockedReason: "PRIVACY_APPROVAL_REQUIRED",
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
  return { ...transcriptAdmission(call, realAllowed), restoreOnly: false };
}
