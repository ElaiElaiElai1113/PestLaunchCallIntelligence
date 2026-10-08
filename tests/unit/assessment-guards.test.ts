import { expect, it } from "vitest";
import { analysis } from "../helpers/analysis";
import {
  guardAssessment,
  assessmentContext,
} from "@/lib/domain/assessment-guards";
import { computeScore } from "@/lib/scoring/engine";
import { sampleCall } from "@/lib/samples/fixtures";
import type { Segment } from "@/lib/domain/types";
const employee: Segment = {
  id: "s1",
  startMs: 0,
  endMs: 1000,
  text: "Hello",
  speaker: "employee",
};
const customer: Segment = {
  id: "s2",
  startMs: 1000,
  endMs: 2000,
  text: "Yes please",
  speaker: "customer",
};
it.each([true, false])(
  "keeps unsupported %s outcomes unknown without rewriting the original",
  (value) => {
    const original = analysis();
    original.outcomes.inspectionBooked = {
      value,
      evidence: { segmentIds: [], quote: "" },
    };
    original.outcomes.paymentCollected = {
      value: false,
      evidence: { segmentIds: ["s1"], quote: "No payment has been taken." },
    };
    const spoken = { ...employee, text: "No payment has been taken." };
    const snapshot = structuredClone(original);
    const effective = guardAssessment(original, [spoken, customer], {
      transcriptComplete: true,
    });
    expect(effective.outcomes.inspectionBooked.value).toBeNull();
    expect(effective.outcomes.paymentCollected.value).toBe(false);
    expect(effective.reviewReasons).toContain("Outcome evidence needs review.");
    expect(original).toEqual(snapshot);
  },
);
it("does not infer missed employee steps through an unattributed part of the source", () => {
  const original = analysis();
  original.assessments[0].status = "missed";
  const unknown = { ...customer, speaker: "unknown" as const };
  const result = guardAssessment(original, [employee, unknown], {
    transcriptComplete: true,
  });
  expect(result.assessments[0].status).toBe("unknown");
  expect(original.assessments[0].status).toBe("missed");
});
it.each([
  "A 30-day guarantee covers this treatment.",
  "You receive a discount on your next service.",
])(
  "withholds coaching policy claims absent from the cited source: %s",
  (suggestedResponse) => {
    const original = analysis();
    original.coaching = [
      {
        kind: "improvement",
        title: "Clarify policy",
        detail: "Explain the applicable terms.",
        suggestedResponse,
        checkpointId: "pricing",
        evidence: { segmentIds: ["s1"], quote: "Hello" },
      },
    ];
    const before = structuredClone(original);
    const guarded = guardAssessment(original, [employee, customer], {
      transcriptComplete: true,
    });
    expect(guarded.coaching).toEqual([]);
    expect(guarded.reviewReasons).toContain(
      "Coaching policy details need review.",
    );
    expect(original).toEqual(before);
  },
);
it("unverified quality cannot certify reliable complete source", () => {
  const c = sampleCall("service", "fictional-call");
  c.mode = "live";
  c.transcriptCompleteness = "verified";
  c.transcriptReviewReasons = ["Transcription quality needs review."];
  expect(assessmentContext(c).transcriptComplete).toBe(false);
});
it.each(["unknown", "customer"] as const)(
  "withholds employee passes and coaching for %s-only speech",
  (speaker) => {
    const original = analysis();
    original.coaching = [
      {
        kind: "strength",
        title: "Fictional strength",
        detail: "Fictional",
        suggestedResponse: null,
        checkpointId: "validate",
        evidence: original.assessments[0].evidence,
      },
    ];
    const snapshot = JSON.stringify(original);
    const effective = guardAssessment(original, [{ ...employee, speaker }], {
      transcriptComplete: true,
    });
    expect(effective.assessments.every((x) => x.status === "unknown")).toBe(
      true,
    );
    expect(effective.coaching).toEqual([]);
    expect(computeScore(effective)).toMatchObject({
      points: 0,
      denominator: 17,
      grade: null,
    });
    expect(JSON.stringify(original)).toBe(snapshot);
  },
);
it("an unrelated employee segment cannot authorize customer-only quoted behavior", () => {
  const original = analysis();
  original.assessments[0].evidence = {
    segmentIds: ["s1", "s2"],
    quote: "Yes please",
  };
  expect(
    guardAssessment(original, [employee, customer], {
      transcriptComplete: true,
    }).assessments[0].status,
  ).toBe("unknown");
});
it("unknown attribution cannot obtain the no-objection policy points", () => {
  const original = analysis();
  original.noObjections = true;
  original.assessments.forEach((x) => (x.status = "unknown"));
  const effective = guardAssessment(
    original,
    [{ ...employee, speaker: "unknown" }],
    { transcriptComplete: true },
  );
  expect(effective.noObjections).toBe(false);
  expect(computeScore(effective)).toMatchObject({
    points: 0,
    denominator: 17,
    grade: null,
  });
});
it("explicitly complete fictional attributed speech preserves eligible points and policy awards", () => {
  const original = analysis();
  original.noObjections = true;
  original.assessments
    .filter((x) => x.id.startsWith("objection_"))
    .forEach((x) => (x.status = "unknown"));
  const effective = guardAssessment(original, [employee, customer], {
    transcriptComplete: true,
  });
  expect(computeScore(effective)).toMatchObject({
    points: 17,
    denominator: 17,
    grade: "gold",
  });
});
it("unverified completeness overrides model complete and absence-based misses", () => {
  const original = analysis();
  original.assessments[0].status = "missed";
  const effective = guardAssessment(original, [employee, customer], {
    transcriptComplete: false,
  });
  expect(effective.complete).toBe(false);
  expect(effective.assessments[0].status).toBe("unknown");
  expect(computeScore(effective).grade).toBe(null);
});
it("a legacy live call defaults to unverified source completeness", () => {
  const call = sampleCall("service", "fictional-call");
  call.mode = "live";
  expect(assessmentContext(call)).toEqual({ transcriptComplete: false });
});
