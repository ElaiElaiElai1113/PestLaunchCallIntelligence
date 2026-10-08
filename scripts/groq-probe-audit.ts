import type { Analysis, CallRecord, Segment } from "../src/lib/domain/types";
import { validateEvidence } from "../src/lib/domain/evidence";
import { computeScore } from "../src/lib/scoring/engine";
import type { ProbeLedger } from "./groq-probe-ledger";
import { createHash } from "node:crypto";
export const AUDIT_AREAS = [
  "purpose",
  "outcomes",
  "followups",
  "facts",
  "checkpoints",
  "coaching",
] as const;
export type ManualSemanticAudit = {
  status: "accepted" | "rejected";
  artifact: string;
  reviewedAt: string;
  coverage: (typeof AUDIT_AREAS)[number][];
  sourceHash: string;
  resultHash: string;
};
const normalized = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, " ");
// Conservative fixture assertions, not a general semantic evaluator. A human
// source/manual audit remains a separate, mandatory acceptance step.
export function auditProbeAnalysis(
  caseName: string,
  expected: CallRecord,
  actual: Analysis,
  segments: Segment[],
  manual?: ManualSemanticAudit,
) {
  const reference = expected.analysis!;
  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        segments,
        context: { transcriptComplete: caseName !== "saved-asr" },
      }),
    )
    .digest("hex");
  const resultHash = createHash("sha256")
    .update(JSON.stringify(actual))
    .digest("hex");
  const issues: string[] = [];
  if (actual.purpose !== reference.purpose)
    issues.push("Purpose differs from the known source");
  if (validateEvidence(actual, segments).length)
    issues.push("Source evidence is invalid");
  for (const [id, item] of Object.entries(reference.outcomes)) {
    const value = actual.outcomes[id as keyof Analysis["outcomes"]].value;
    if (value === item.value) continue;
    if (value === null && item.value !== null)
      issues.push(`${id} remains unresolved`);
    else if (item.value !== null)
      issues.push(`${id} contradicts the known source`);
    else
      issues.push(
        `${id} differs from the uncertain reference; manual review required`,
      );
  }
  if (
    reference.followups.some((item) => item.state === "accepted") &&
    !actual.followups.some((item) => item.state === "accepted")
  )
    issues.push("Accepted follow-up coverage is missing");
  for (const fact of reference.facts) {
    if (
      !actual.facts.some(
        (item) =>
          normalized(item.label) === normalized(fact.label) &&
          normalized(item.text) === normalized(fact.text),
      )
    )
      issues.push(
        "Expected fact content is not reference-verified; manual review required",
      );
  }
  if (
    actual.facts.some(
      (item) =>
        !reference.facts.some(
          (fact) =>
            normalized(item.label) === normalized(fact.label) &&
            normalized(item.text) === normalized(fact.text),
        ),
    )
  )
    issues.push("Additional or different fact content requires manual review");
  if (caseName === "saved-asr") {
    if (
      actual.complete ||
      actual.noObjections ||
      actual.coaching.length ||
      computeScore(actual).grade !== null
    )
      issues.push(
        "Unverified ASR must retain uncertainty without grade or employee coaching",
      );
  } else {
    for (const item of reference.assessments)
      if (
        actual.assessments.find((a) => a.id === item.id)?.status !== item.status
      )
        issues.push(`${item.id} differs from reference checkpoint assessment`);
    for (const kind of ["strength", "improvement"] as const) {
      if (
        reference.coaching.some((c) => c.kind === kind) &&
        !actual.coaching.some(
          (c) =>
            c.kind === kind &&
            c.detail.trim().length >= 10 &&
            (kind !== "improvement" || !!c.suggestedResponse?.trim()),
        )
      )
        issues.push(`Source-linked ${kind} coaching is missing or incomplete`);
    }
    for (const coach of actual.coaching) {
      const employeeText = coach.evidence.segmentIds
        .map((id) => segments.find((s) => s.id === id))
        .filter((s) => s?.speaker === "employee")
        .map((s) => s!.text)
        .join(" ");
      if (
        !coach.evidence.quote.trim() ||
        !normalized(employeeText).includes(normalized(coach.evidence.quote))
      )
        issues.push("Coaching lacks employee-source support");
    }
  }
  const completeManual =
    !!manual &&
    manual.status === "accepted" &&
    !!manual.artifact.trim() &&
    Number.isFinite(Date.parse(manual.reviewedAt)) &&
    manual.sourceHash === sourceHash &&
    manual.resultHash === resultHash &&
    AUDIT_AREAS.every((area) => manual.coverage.includes(area));
  const semanticStatus =
    manual?.status === "rejected"
      ? "rejected"
      : completeManual && issues.length === 0
        ? "accepted"
        : "pending";
  return {
    case: caseName,
    sourceHash,
    resultHash,
    version: "probe_acceptance_v2" as const,
    automated: {
      passed: issues.length === 0,
      issues: [...new Set(issues)],
      coverage: [...AUDIT_AREAS],
      meaning:
        "Conservative fixture consistency assertions; not completed semantic/manual review",
    },
    manual: manual ?? null,
    semanticStatus,
    semanticAccepted: issues.length === 0 && completeManual,
  };
}
export type ProbeAudit = ReturnType<typeof auditProbeAnalysis>;
export function optionalProbesAllowed(ledger: ProbeLedger) {
  const cases = ["known-one-time", "saved-asr", "known-service"];
  return (
    !ledger.stopped &&
    ledger.requests.length >= 3 &&
    ledger.requests.length < 6 &&
    ledger.requests
      .slice(0, 3)
      .every(
        (entry, index) =>
          entry.case === cases[index] &&
          entry.audit?.case === entry.case &&
          entry.sourceHash === entry.audit.sourceHash &&
          entry.resultHash === entry.audit.resultHash &&
          entry.accepted === true &&
          entry.audit?.version === "probe_acceptance_v2" &&
          entry.audit.automated.passed &&
          entry.audit.semanticAccepted &&
          entry.audit.semanticStatus === "accepted" &&
          entry.audit.manual?.status === "accepted" &&
          !!entry.audit.manual.artifact.trim() &&
          Number.isFinite(Date.parse(entry.audit.manual.reviewedAt)) &&
          entry.audit.manual.sourceHash === entry.sourceHash &&
          entry.audit.manual.resultHash === entry.resultHash &&
          AUDIT_AREAS.every((area) =>
            entry.audit!.manual!.coverage.includes(area),
          ),
      )
  );
}
