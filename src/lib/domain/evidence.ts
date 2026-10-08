import type { Analysis, Evidence, Segment } from "./types";
const normalize = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase();
export function validateEvidence(
  analysis: Analysis,
  segments: Segment[],
): string[] {
  const lookup = new Map(segments.map((x) => [x.id, x]));
  const issues: string[] = [];
  function check(e: Evidence, label: string, required = false) {
    if (required && (!e.segmentIds.length || !e.quote.trim()))
      issues.push(`${label}: evidence required`);
    if (e.segmentIds.some((id) => !lookup.has(id)))
      issues.push(`${label}: missing segment`);
    const text = e.segmentIds.map((id) => lookup.get(id)?.text ?? "").join(" ");
    if (e.quote && !normalize(text).includes(normalize(e.quote)))
      issues.push(`${label}: quote not found`);
  }
  analysis.assessments.forEach((x) =>
    check(x.evidence, x.id, x.status === "passed"),
  );
  Object.entries(analysis.outcomes).forEach(([key, x]) =>
    check(x.evidence, key, x.value === true),
  );
  analysis.facts.forEach((x) => check(x.evidence, x.label, true));
  analysis.followups.forEach((x) => check(x.evidence, "follow-up", true));
  analysis.coaching.forEach((x) => check(x.evidence, "coaching", true));
  return [...new Set(issues)];
}
