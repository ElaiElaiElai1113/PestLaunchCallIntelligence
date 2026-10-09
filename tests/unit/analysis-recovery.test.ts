import { expect, it } from "vitest";
import { recoveryCall } from "../helpers/recovery-call";
import { sampleCall } from "@/lib/samples/fixtures";
import { applySourceReview } from "@/lib/domain/source-review";
import { analysisRecovery } from "@/lib/groq/analysis-recovery";
const review = (call: ReturnType<typeof recoveryCall>, unknown = false) =>
  applySourceReview(
    call,
    {
      version: call.version,
      roles: call.segments.map((s) => ({
        segmentId: s.id,
        speaker: unknown ? "unknown" : s.speaker,
      })),
      completenessVerified: true,
      qualityVerified: true,
      reason: "Fictional trusted source review; no provider call.",
    },
    { id: "review", userId: "fictional-reviewer", at: "2026-10-09T00:00:00Z" },
  );
it("a failed first analysis remains owner-startable after source review without creating a result", () => {
  const call = recoveryCall(),
    next = review(call);
  expect(next.status).toBe("needs_review");
  expect(next.analysis).toBeNull();
  expect(analysisRecovery(next, false)).toMatchObject({
    eligible: true,
    budget: "admitted",
  });
  expect(next.sourceReviews!.at(-1)?.previousErrorCode).toBe(
    "INVALID_EVIDENCE",
  );
});
it("a stale budget error does not block an admissible reviewed source", () => {
  const call = recoveryCall();
  call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
  const next = review(call, true);
  expect(analysisRecovery(call, false).eligible).toBe(true);
  expect(analysisRecovery(next, false).eligible).toBe(true);
  expect(next.errorCode).toBe("ANALYSIS_BUDGET_EXCEEDED");
  expect(next.analysis).toBeNull();
  expect(next.sourceReviews!.at(-1)?.previousErrorCode).toBe(
    "ANALYSIS_BUDGET_EXCEEDED",
  );
});
it.each(["active", "privacy", "preparation", "current"])(
  "keeps %s guards",
  (kind) => {
    const call = recoveryCall();
    if (kind === "active") call.status = "analyzing";
    if (kind === "privacy") call.status = "privacy_review";
    if (kind === "preparation") call.sanitizedPath = null;
    if (kind === "current") {
      call.analysis = sampleCall("service", "fictional").analysis;
      call.analysisSourceRevision = 0;
    }
    expect(analysisRecovery(call, false).eligible).toBe(false);
  },
);
