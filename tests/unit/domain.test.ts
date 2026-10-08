import { describe, it, expect } from "vitest";
import { computeScore } from "@/lib/scoring/engine";
import { validateEvidence } from "@/lib/domain/evidence";
import type { Analysis } from "@/lib/domain/types";
const salesIds = [
  "validate",
  "confidence",
  "expectation_understand",
  "investigate",
  "summary",
  "expectation_solve",
  "solution",
  "consensus",
  "close",
  "pricing",
  "objection_agree",
  "objection_restate",
  "objection_resolve",
  "objection_reclose",
  "conclusion",
  "final_information",
  "thank",
];
const generalIds = [
  "validate",
  "confidence",
  "expectation_understand",
  "investigate",
  "summary",
  "expectation_solve",
  "solution",
  "consensus",
  "close",
  "conclusion",
  "thank",
  "final_information",
];
export function analysis(purpose: "sales" | "general" = "sales"): Analysis {
  return {
    purpose,
    title: "Fictional example",
    summary: "Fictional test",
    secondaryIntents: [],
    outcomes: {} as Analysis["outcomes"],
    facts: [],
    followups: [],
    coaching: [],
    complete: true,
    noObjections: false,
    reviewReasons: [],
    assessments: (purpose === "sales" ? salesIds : generalIds).map((id) => ({
      id,
      status: "passed",
      reason: "Observed in sample",
      evidence: { segmentIds: ["s1"], quote: "Hello" },
    })),
  };
}
describe("fixed manual scoring", () => {
  it.each([
    [13, "below"],
    [14, "green"],
    [16, "green"],
    [17, "gold"],
  ] as const)("grades %i/17 as %s", (points, grade) => {
    const a = analysis();
    a.assessments.forEach((x, i) => {
      x.status = i < points ? "passed" : "missed";
    });
    expect(computeScore(a)).toMatchObject({ points, denominator: 17, grade });
  });
  it.each([
    [10, "below"],
    [11, "green"],
    [12, "gold"],
  ] as const)("grades %i/12 as %s", (points, grade) => {
    const a = analysis("general");
    a.assessments.forEach((x, i) => {
      x.status = i < points ? "passed" : "missed";
    });
    expect(computeScore(a)).toMatchObject({ points, denominator: 12, grade });
  });
  it("withholds a grade for uncertainty without shrinking denominator", () => {
    const a = analysis();
    a.assessments[0].status = "not_applicable";
    expect(computeScore(a)).toEqual({
      points: 16,
      denominator: 17,
      unresolved: 1,
      grade: null,
    });
  });
  it("awards exactly four no-objection points only on a complete call", () => {
    const a = analysis();
    a.noObjections = true;
    a.assessments
      .filter((x) => x.id.startsWith("objection_"))
      .forEach((x) => {
        x.status = "unknown";
      });
    expect(computeScore(a)).toMatchObject({ points: 17, grade: "gold" });
    a.complete = false;
    expect(computeScore(a)).toMatchObject({ points: 13, grade: null });
  });
  it("rejects missing or duplicate checkpoints", () => {
    const a = analysis();
    a.assessments[0].id = "confidence";
    expect(() => computeScore(a)).toThrow("rubric");
  });
});
describe("evidence validation", () => {
  it("rejects a citation to a nonexistent segment", () => {
    expect(validateEvidence(analysis(), []).length).toBeGreaterThan(0);
  });
  it("rejects a fabricated quote", () => {
    const a = analysis();
    a.assessments[0].evidence.quote = "Payment collected";
    expect(
      validateEvidence(a, [
        {
          id: "s1",
          text: "Hello",
          startMs: 0,
          endMs: 1000,
          speaker: "unknown",
        },
      ]).length,
    ).toBeGreaterThan(0);
  });
  it("allows exact cited text", () => {
    expect(
      validateEvidence(analysis(), [
        {
          id: "s1",
          text: "Hello",
          startMs: 0,
          endMs: 1000,
          speaker: "unknown",
        },
      ]),
    ).toEqual([]);
  });
});
