import { it, expect } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import {
  guardAssessment,
  reviewedAssessmentContext,
} from "@/lib/domain/assessment-guards";
import { resolveIssue } from "@/lib/domain/issue-resolution";
it("confirms one withheld outcome without restoring claims or clearing other safeguards", () => {
  const call = sampleCall("one-time", "fictional-issue");
  const raw = structuredClone(call.originalAnalysis!);
  raw.outcomes.inspectionBooked = {
    value: false,
    evidence: { segmentIds: [], quote: "" },
  };
  raw.reviewReasons.push("Recording coverage needs review.");
  call.latestModelAnalysis = raw;
  call.analysis = guardAssessment(raw, call.segments, {
    transcriptComplete: true,
  });
  const original = structuredClone(call.originalAnalysis);
  const next = resolveIssue(
    call,
    "outcome:inspectionBooked",
    "Confirmed there is no source evidence for this outcome.",
    "fictional-reviewer",
  );
  expect(next.analysis!.outcomes.inspectionBooked.value).toBeNull();
  expect(next.analysis!.reviewReasons).toContain(
    "Recording coverage needs review.",
  );
  expect(next.originalAnalysis).toEqual(original);
  expect(next.issueDecisions).toHaveLength(1);
  expect(() =>
    resolveIssue(
      next,
      "privacy:all",
      "A reason cannot approve unrelated privacy.",
      "fictional-reviewer",
    ),
  ).toThrow();
});
it("does not reuse roadmap confirmation across model generations or source revisions", () => {
  const call = sampleCall("one-time", "fictional-generation");
  call.decisions.push({
    id: "fictional",
    checkpointId: "expectation_solve",
    status: "passed",
    reason: "Verified roadmap order in the quoted source.",
    userId: "fictional",
    at: "2026-10-09T00:00:00Z",
    previousVersion: 1,
    sourceRevision: 0,
    analysisGeneration: 0,
    chronologyVerified: true,
    evidence: structuredClone(
      call.analysis!.assessments.find((x) => x.id === "expectation_solve")!
        .evidence,
    ),
  });
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(true);
  call.analysisGeneration = 1;
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(false);
  call.analysisGeneration = 0;
  call.sourceRevision = 1;
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(false);
});
it("binds the latest roadmap verification to exact evidence and respects later reversal", () => {
  const call = sampleCall("one-time", "fictional-evidence-binding");
  const item = call.analysis!.assessments.find(
    (x) => x.id === "expectation_solve",
  )!;
  item.status = "passed";
  const decision = {
    id: "fictional",
    checkpointId: item.id,
    status: "passed" as const,
    reason: "Verified this exact roadmap citation and order.",
    userId: "fictional",
    at: "2026-10-09T00:00:00Z",
    previousVersion: 1,
    sourceRevision: 0,
    analysisGeneration: 0,
    chronologyVerified: true,
    evidence: structuredClone(item.evidence),
  };
  call.decisions.push(decision);
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(true);
  const original = structuredClone(item.evidence);
  item.evidence.segmentIds = [call.segments.at(-1)!.id];
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(false);
  item.evidence = structuredClone(original);
  item.evidence.quote += " changed";
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(false);
  item.evidence = structuredClone(original);
  call.decisions.push({
    ...decision,
    id: "other",
    checkpointId: "confidence",
    chronologyVerified: false,
  });
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(true);
  call.decisions.push({
    ...decision,
    id: "reversal",
    status: "missed",
    chronologyVerified: false,
  });
  expect(reviewedAssessmentContext(call).roadmapOrderReviewed).toBe(false);
});
