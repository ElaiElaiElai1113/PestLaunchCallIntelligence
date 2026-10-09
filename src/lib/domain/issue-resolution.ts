import { randomUUID } from "node:crypto";
import type { CallRecord } from "./types";
export function resolveIssue(
  input: CallRecord,
  issueId: string,
  reason: string,
  userId: string,
): CallRecord {
  const call = structuredClone(input),
    a = call.analysis;
  const issue = a?.reviewIssues?.find((x) => x.id === issueId);
  if (!a || !issue || reason.trim().length < 10)
    throw new Error("INVALID_ISSUE_RESOLUTION");
  if (
    issue.kind === "outcome" &&
    a.outcomes[issue.target as keyof typeof a.outcomes]?.value !== null
  )
    throw new Error("INVALID_ISSUE_RESOLUTION");
  if (
    issue.kind === "coaching" &&
    a.coaching.some((x) => x.checkpointId === issue.target)
  )
    throw new Error("INVALID_ISSUE_RESOLUTION");
  if (
    issue.kind === "chronology" &&
    a.assessments.find((x) => x.id === issue.target)?.status !== "unknown"
  )
    throw new Error("INVALID_ISSUE_RESOLUTION");
  a.reviewIssues = a.reviewIssues!.filter((x) => x.id !== issueId);
  const rawReasons =
    (call.latestModelAnalysis ?? call.originalAnalysis)?.reviewReasons ?? [];
  if (
    !a.reviewIssues.some((x) => x.message === issue.message) &&
    !rawReasons.includes(issue.message)
  )
    a.reviewReasons = a.reviewReasons.filter((x) => x !== issue.message);
  call.issueDecisions ??= [];
  call.issueDecisions.push({
    id: randomUUID(),
    issueId,
    reason: reason.trim(),
    userId,
    at: new Date().toISOString(),
    previousVersion: call.version,
    sourceRevision: call.sourceRevision ?? 0,
    analysisGeneration: call.analysisGeneration ?? 0,
  });
  return call;
}
