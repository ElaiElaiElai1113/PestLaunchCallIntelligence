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
it("does not turn a generic return visit into an inspection booking", () => {
  const original = analysis();
  const visit = {
    ...employee,
    text: "Would you like a return visit on Friday afternoon?",
  };
  original.outcomes.inspectionBooked = {
    value: true,
    evidence: {
      segmentIds: [visit.id, customer.id],
      quote: visit.text + " " + customer.text,
    },
  };
  const result = guardAssessment(original, [visit, customer], {
    transcriptComplete: true,
  });
  expect(result.outcomes.inspectionBooked.value).toBeNull();
  expect(original.outcomes.inspectionBooked.value).toBe(true);
  expect(result.reviewIssues).toContainEqual({
    id: "outcome:inspectionBooked",
    kind: "outcome",
    target: "inspectionBooked",
    message: "Inspection booking needs explicit source evidence.",
  });
  visit.text = "Would you like an inspection on Friday afternoon?";
  original.outcomes.inspectionBooked.evidence.quote =
    visit.text + " " + customer.text;
  expect(
    guardAssessment(original, [visit, customer], { transcriptComplete: true })
      .outcomes.inspectionBooked.value,
  ).toBe(true);
});
it("does not turn employee payment terms into a customer payment promise", () => {
  const terms = {
    ...employee,
    text: "Payment is due at the visit; none has been collected.",
  };
  const original = analysis();
  original.followups = [
    {
      text: "Payment due at visit",
      state: "promised",
      dueText: "at the visit",
      evidence: { segmentIds: [terms.id], quote: terms.text },
    },
  ];
  const effective = guardAssessment(original, [terms, customer], {
    transcriptComplete: true,
  });
  expect(effective.followups[0].state).toBe("unknown");
  expect(effective.reviewIssues).toContainEqual({
    id: "followup:0",
    kind: "followup",
    target: "0",
    message: "Payment commitment needs review.",
  });
  expect(original.followups[0].state).toBe("promised");
  const capability = {
    ...customer,
    text: "I can pay, but I have not agreed yet.",
  };
  original.followups[0].evidence.segmentIds.push(capability.id);
  original.followups[0].evidence.quote += " " + capability.text;
  expect(
    guardAssessment(original, [terms, capability], { transcriptComplete: true })
      .followups[0].state,
  ).toBe("unknown");
});
it("preserves an explicit attributed customer payment promise", () => {
  const terms = { ...employee, text: "Payment is due at the visit." };
  const commitment = { ...customer, text: "I will pay at the visit." };
  const original = analysis();
  original.followups = [
    {
      text: "Payment due at visit",
      state: "promised",
      dueText: "at the visit",
      evidence: {
        segmentIds: [terms.id, commitment.id],
        quote: terms.text + " " + commitment.text,
      },
    },
  ];
  expect(
    guardAssessment(original, [terms, commitment], { transcriptComplete: true })
      .followups[0].state,
  ).toBe("promised");
  commitment.speaker = "unknown";
  expect(
    guardAssessment(original, [terms, commitment], { transcriptComplete: true })
      .followups[0].state,
  ).toBe("unknown");
});
it("withholds unverified all-inclusive price assurances but preserves explicit source terms", () => {
  const original = analysis();
  original.coaching = [
    {
      kind: "improvement",
      title: "Pricing",
      detail: "Clarify the price",
      suggestedResponse: "That is the total, with no extra charges.",
      checkpointId: "pricing",
      evidence: {
        segmentIds: ["s1"],
        quote: "The treatment costs two hundred dollars.",
      },
    },
  ];
  const quoted = {
    ...employee,
    text: "The treatment costs two hundred dollars.",
  };
  expect(
    guardAssessment(original, [quoted, customer], { transcriptComplete: true })
      .coaching,
  ).toEqual([]);
  const explicit = {
    ...quoted,
    text: "That is the total, with no extra charges.",
  };
  original.coaching[0].evidence.quote = explicit.text;
  expect(
    guardAssessment(original, [explicit, customer], {
      transcriptComplete: true,
    }).coaching,
  ).toHaveLength(1);
});
it.each(["later", "same", "earlier"])(
  "reviews ambiguous/later roadmap evidence: %s",
  (kind) => {
    const c = sampleCall("one-time", "fictional-roadmap");
    const a = structuredClone(c.originalAnalysis!);
    const roadmap = a.assessments.find((x) => x.id === "expectation_solve")!;
    const solution = a.assessments.find((x) => x.id === "solution")!;
    const pricing = a.assessments.find((x) => x.id === "pricing")!;
    roadmap.status = "passed";
    solution.status = "passed";
    pricing.status = "unknown";
    const staff = c.segments.filter((s) => s.speaker === "employee");
    const first = staff[0],
      last = staff.at(-1)!;
    const anchor = kind === "later" ? staff[1] : last;
    solution.evidence = { segmentIds: [anchor.id], quote: anchor.text };
    const chosen = kind === "earlier" ? first : last;
    roadmap.evidence = { segmentIds: [chosen.id], quote: chosen.text };
    const before = structuredClone(a);
    const effective = guardAssessment(a, c.segments, {
      transcriptComplete: true,
    });
    expect(
      effective.assessments.find((x) => x.id === "expectation_solve")!.status,
    ).toBe(kind === "earlier" ? "passed" : "unknown");
    expect(a).toEqual(before);
  },
);
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
it("complete coarse evidence keeps policy awards but withholds unproven roadmap order", () => {
  const original = analysis();
  original.noObjections = true;
  original.assessments
    .filter((x) => x.id.startsWith("objection_"))
    .forEach((x) => (x.status = "unknown"));
  const effective = guardAssessment(original, [employee, customer], {
    transcriptComplete: true,
  });
  expect(computeScore(effective)).toMatchObject({
    points: 16,
    denominator: 17,
    grade: null,
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
