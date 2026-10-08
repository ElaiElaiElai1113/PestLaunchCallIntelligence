import type { Analysis, Score } from "../domain/types";
import { OBJECTION_IDS, RUBRICS } from "./rubrics";
export function computeScore(analysis: Analysis): Score {
  if (analysis.purpose === "unknown")
    return { points: 0, denominator: 0, unresolved: 1, grade: null };
  const rubric = RUBRICS[analysis.purpose];
  const found = new Set(analysis.assessments.map((x) => x.id));
  if (
    found.size !== rubric.length ||
    analysis.assessments.length !== rubric.length ||
    rubric.some((x) => !found.has(x.id))
  )
    throw new Error("Invalid rubric checkpoints");
  let points = 0,
    unresolved = 0;
  for (const item of analysis.assessments) {
    const policy =
      analysis.purpose === "sales" &&
      OBJECTION_IDS.includes(item.id) &&
      analysis.noObjections &&
      analysis.complete;
    if (policy || item.status === "passed") points++;
    else if (
      item.status === "unknown" ||
      item.status === "not_applicable" ||
      item.status === "policy_award"
    )
      unresolved++;
  }
  const denominator = rubric.length;
  const grade =
    unresolved || !analysis.complete
      ? null
      : points === denominator
        ? "gold"
        : points >= (denominator === 17 ? 14 : 11)
          ? "green"
          : "below";
  return { points, denominator, unresolved, grade };
}
