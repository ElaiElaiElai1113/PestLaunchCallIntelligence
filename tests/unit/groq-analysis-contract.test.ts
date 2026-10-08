import { it, expect } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { analysisSchema } from "@/lib/domain/schemas";
import { contractSchema, resolveAnalysis } from "@/lib/groq/analysis-contract";

const source = () => sampleCall("service", "fictional-contract");
export function wireFixture() {
  const call = source(),
    a = call.originalAnalysis!;
  const refs = (e: { segmentIds: string[] }) => ({
    segmentIds: [...e.segmentIds],
  });
  return {
    ...a,
    coaching: undefined,
    outcomes: Object.fromEntries(
      Object.entries(a.outcomes).map(([key, value]) => [
        key,
        { value: value.value, evidence: refs(value.evidence) },
      ]),
    ),
    facts: a.facts.map((item) => ({ ...item, evidence: refs(item.evidence) })),
    followups: a.followups.map((item) => ({
      ...item,
      evidence: refs(item.evidence),
    })),
    assessments: a.assessments.map((item) => {
      const coach = a.coaching.find((c) => c.checkpointId === item.id);
      return {
        ...item,
        evidence: refs(item.evidence),
        coaching: coach
          ? {
              kind: coach.kind,
              title: coach.title,
              detail: coach.detail,
              suggestedResponse: coach.suggestedResponse,
            }
          : null,
      };
    }),
  };
}
it("materializes only selected source text and derives coaching from its parent", () => {
  const call = source(),
    wire = wireFixture();
  delete wire.coaching;
  const before = structuredClone({ wire, segments: call.segments });
  const result = resolveAnalysis(wire, call.segments, {
    transcriptComplete: true,
  });
  expect(analysisSchema.safeParse(result.original).success).toBe(true);
  for (const item of result.original.coaching) {
    const parent = result.original.assessments.find(
      (a) => a.id === item.checkpointId,
    )!;
    expect(item.evidence).toEqual(parent.evidence);
  }
  expect({ wire, segments: call.segments }).toEqual(before);
});
it("rejects legacy model-written quotes instead of repairing them", () => {
  const wire = wireFixture();
  delete wire.coaching;
  Object.assign(wire.assessments[0].evidence, {
    quote: "Words from another turn",
  });
  expect(() =>
    resolveAnalysis(wire, source().segments, { transcriptComplete: true }),
  ).toThrow();
});
it.each(["unknown", "duplicate", "reversed", "overlong"])(
  "rejects %s references without substitution",
  (kind) => {
    const call = source(),
      wire = wireFixture();
    delete wire.coaching;
    const ids = call.segments.slice(0, 2).map((s) => s.id);
    wire.assessments[0].evidence.segmentIds =
      kind === "unknown"
        ? ["fake"]
        : kind === "duplicate"
          ? [ids[0], ids[0]]
          : kind === "reversed"
            ? [ids[1], ids[0]]
            : [ids[0]];
    if (kind === "overlong") call.segments[0].text = "x".repeat(2001);
    expect(() =>
      resolveAnalysis(wire, call.segments, { transcriptComplete: true }),
    ).toThrow();
  },
);
it.each(["missing", "duplicate", "wrong"])(
  "rejects %s rubric membership",
  (kind) => {
    const call = source(),
      wire = wireFixture();
    delete wire.coaching;
    if (kind === "missing") wire.assessments.pop();
    if (kind === "duplicate") wire.assessments[1].id = wire.assessments[0].id;
    if (kind === "wrong") wire.assessments[0].id = "research";
    expect(() =>
      resolveAnalysis(wire, call.segments, { transcriptComplete: true }),
    ).toThrow();
  },
);
it("unknown source cannot provide employee coaching or an official grade", () => {
  const call = source(),
    wire = wireFixture();
  delete wire.coaching;
  call.segments.forEach((s) => (s.speaker = "unknown"));
  expect(() => contractSchema(call.segments).parse(wire)).toThrow();
  wire.assessments.forEach((a) => (a.coaching = null));
  const result = resolveAnalysis(wire, call.segments, {
    transcriptComplete: false,
  });
  expect(result.effective.coaching).toEqual([]);
  expect(result.effective.complete).toBe(false);
});
it("rejects assessments for unknown purpose", () => {
  const wire = wireFixture();
  delete wire.coaching;
  wire.purpose = "unknown";
  expect(() =>
    resolveAnalysis(wire, source().segments, { transcriptComplete: true }),
  ).toThrow();
});
it("correctly bound but irrelevant references remain a semantic review risk", () => {
  const call = source(),
    wire = wireFixture();
  delete wire.coaching;
  wire.assessments[0].evidence.segmentIds = [call.segments[8].id];
  const result = resolveAnalysis(wire, call.segments, {
    transcriptComplete: true,
  });
  expect(result.original.assessments[0].evidence.quote).toBe(
    call.segments[8].text,
  );
  // Structure does not certify that a closing statement validates the concern.
});
it("rejects empty or duplicate source IDs", () => {
  expect(() => contractSchema([])).toThrow();
  const segments = source().segments;
  segments[1].id = segments[0].id;
  expect(() => contractSchema(segments)).toThrow();
});
