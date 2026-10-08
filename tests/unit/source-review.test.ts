import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import {
  applySourceReview,
  analysisCurrent,
  sourceReviewBlock,
} from "@/lib/domain/source-review";
const input = {
  version: 1,
  roles: [{ segmentId: "seg-1", speaker: "unknown" as const }],
  completenessVerified: true,
  qualityVerified: false,
  reason: "Reviewed the fictional source and retained uncertainty.",
};
const actor = {
  id: "fictional-review",
  userId: "fictional-reviewer",
  at: "2026-10-08T00:00:00Z",
};
it("source review preserves text/timing/originals and audit while making analysis stale", () => {
  const call = sampleCall("service", "fictional-call");
  const original = structuredClone(call.originalAnalysis);
  const segments = structuredClone(call.segments);
  const next = applySourceReview(call, input, actor);
  expect(call.segments).toEqual(segments);
  expect(next.originalSegments).toEqual(segments);
  expect(next.originalAnalysis).toEqual(original);
  expect(next.segments[0].speaker).toBe("unknown");
  expect(next.segments.map((x) => [x.id, x.text, x.startMs, x.endMs])).toEqual(
    segments.map((x) => [x.id, x.text, x.startMs, x.endMs]),
  );
  expect(next.sourceRevision).toBe(1);
  expect(next.version).toBe(2);
  expect(analysisCurrent(next)).toBe(false);
  expect(next.score!.grade).toBe(null);
  expect(next.sourceReviews![0]).toMatchObject({
    userId: actor.userId,
    previousVersion: 1,
    qualityVerified: false,
    changes: [{ segmentId: "seg-1", previous: "employee", next: "unknown" }],
  });
  expect(next.transcriptReviewReasons).toContain(
    "Transcription quality needs review.",
  );
  expect(next.analysis!.reviewReasons).toContain(
    "Speaker attribution needs review.",
  );
});
it("verification cannot clear unrelated applicability or model-content reasons", () => {
  const call = sampleCall("inspection", "fictional-call");
  call.analysis!.reviewReasons.push("Fictional ambiguous price details.");
  const next = applySourceReview(
    call,
    { ...input, roles: [], qualityVerified: true },
    actor,
  );
  expect(next.analysis!.reviewReasons).toContain(
    "Fictional ambiguous price details.",
  );
  expect(next.analysis!.reviewReasons).toContain(
    "Checkpoint needs review: pricing",
  );
  expect(next.analysis!.reviewReasons).toContain(
    "Transcript source changed; re-analysis required.",
  );
});
it.each(["duplicate", "unknown", "stale"])(
  "rejects %s source request",
  (kind) => {
    const call = sampleCall("service", "fictional-call");
    const bad = {
      ...input,
      roles:
        kind === "duplicate"
          ? [input.roles[0], input.roles[0]]
          : kind === "unknown"
            ? [{ ...input.roles[0], segmentId: "fabricated" }]
            : input.roles,
      version: kind === "stale" ? 2 : 1,
    };
    expect(() => applySourceReview(call, bad, actor)).toThrow();
  },
);
it("legacy live source cannot be certified without prepared media/checksum attestation", () => {
  const call = sampleCall("service", "fictional-call");
  call.mode = "live";
  call.sourceKind = "real";
  expect(sourceReviewBlock(call, true)).toBe("SOURCE_PREPARATION_REQUIRED");
  call.sourceKind = "synthetic";
  call.checksum = "a".repeat(64);
  call.sanitizedPath = "sample-workspace/fictional-call.wav";
  call.sourcePreparation = {
    checksum: call.checksum,
    attestedBy: "fictional-owner",
    at: actor.at,
    kind: "synthetic",
  };
  expect(sourceReviewBlock(call, false)).toBe(null);
  const next = applySourceReview(call, input, actor);
  expect(next.originalSegmentsProvenance).toBe("legacy_snapshot");
});
it.each(["queued", "analyzing", "transcribing", "privacy_review"] as const)(
  "source review is held during %s",
  (status) => {
    const c = sampleCall("service", "fictional-call");
    c.status = status;
    expect(sourceReviewBlock(c, false)).not.toBe(null);
  },
);
