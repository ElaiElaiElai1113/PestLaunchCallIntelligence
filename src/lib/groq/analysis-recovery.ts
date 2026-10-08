import type { CallRecord } from "../domain/types";
import { analysisCurrent, sourceReviewBlock } from "../domain/source-review";
import { assessmentContext } from "../domain/assessment-guards";
import { buildAnalysisRequest } from "./analysis-request";
// Pure admission only: no provider/client is constructed and no source is changed.
export function analysisRecovery(call: CallRecord, realAllowed: boolean) {
  let budget: "admitted" | "exceeded" | "invalid" = "invalid";
  try {
    buildAnalysisRequest(call.segments, assessmentContext(call));
    budget = "admitted";
  } catch (error) {
    if (error instanceof Error && error.message === "ANALYSIS_BUDGET_EXCEEDED")
      budget = "exceeded";
  }
  const blockedReason =
    sourceReviewBlock(call, realAllowed) ??
    (analysisCurrent(call)
      ? "REANALYSIS_UNAVAILABLE"
      : budget === "exceeded"
        ? "ANALYSIS_BUDGET_EXCEEDED"
        : budget === "invalid"
          ? "INVALID_TRANSCRIPT"
          : null);
  return { eligible: blockedReason === null, budget, blockedReason };
}
