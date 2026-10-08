import type { Analysis, CallRecord, Evidence, Segment } from "./types";

export function assessmentContext(call: CallRecord) {
  return {
    transcriptComplete:
      (call.transcriptCompleteness ??
        (call.mode === "sample" ? "verified" : "unverified")) === "verified" &&
      !(call.transcriptReviewReasons ?? []).some(
        (reason) =>
          reason === "Transcription quality needs review." ||
          reason === "Recording coverage needs review.",
      ),
  };
}

export function guardAssessment(
  original: Analysis,
  segments: Segment[],
  context: { transcriptComplete: boolean },
): Analysis {
  const effective = structuredClone(original);
  const lookup = new Map(segments.map((x) => [x.id, x]));
  const normalize = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase();
  const employeeEvidence = (evidence: Evidence) => {
    if (
      !evidence.segmentIds.length ||
      !evidence.quote.trim() ||
      evidence.segmentIds.some((id) => !lookup.has(id))
    )
      return false;
    const employeeText = evidence.segmentIds
      .map((id) => lookup.get(id)!)
      .filter((segment) => segment.speaker === "employee")
      .map((segment) => segment.text)
      .join(" ");
    return normalize(employeeText).includes(normalize(evidence.quote));
  };
  let attributionUnresolved = false;
  for (const item of effective.assessments) {
    const unsupportedPass =
      item.status === "passed" && !employeeEvidence(item.evidence);
    const unsupportedMiss =
      item.status === "missed" &&
      (!context.transcriptComplete ||
        !segments.some((x) => x.speaker === "employee"));
    if (unsupportedPass || unsupportedMiss) {
      item.status = "unknown";
      item.reason = "Employee attribution or complete evidence needs review.";
      attributionUnresolved = true;
    }
  }
  effective.complete = original.complete && context.transcriptComplete;
  const attributableComplete =
    effective.complete &&
    segments.length > 0 &&
    segments.every((x) => x.speaker !== "unknown") &&
    segments.some((x) => x.speaker === "employee") &&
    segments.some((x) => x.speaker === "customer");
  effective.noObjections = original.noObjections && attributableComplete;
  effective.coaching = effective.coaching.filter((item) => {
    const supported = employeeEvidence(item.evidence);
    if (!supported) attributionUnresolved = true;
    return supported;
  });
  if (!effective.complete)
    effective.reviewReasons.push("Transcription completeness needs review.");
  if (attributionUnresolved)
    effective.reviewReasons.push("Speaker attribution needs review.");
  if (original.noObjections && !effective.noObjections)
    effective.reviewReasons.push(
      "No-objection policy needs complete attributable evidence.",
    );
  effective.reviewReasons = [...new Set(effective.reviewReasons)];
  return effective;
}
