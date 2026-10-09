import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { materializeRecap } from "@/lib/groq/source-recap";
it("uses exact source words, roles and timestamps and preserves snapshots", () => {
  const source = sampleCall("one-time", "fictional-recap").segments;
  const selected = [source[1].id, source[5].id];
  const before = structuredClone(source);
  const recap = materializeRecap(
    {
      recap: { segmentIds: selected },
      facts: [
        { kind: "payment_terms", evidence: { segmentIds: [source[8].id] } },
      ],
    },
    source,
  );
  expect(recap.facts[0].text).toBe(source[8].text);
  expect(recap.facts[0].text).not.toContain("$200");
  expect(recap.summary).toContain("Customer");
  expect(recap.sourceRecap.segments.map((s) => s.text)).toEqual(
    selected.map((id) => source.find((s) => s.id === id)!.text),
  );
  source[1].speaker = "unknown";
  expect(recap.sourceRecap.segments[0].speaker).toBe("customer");
  expect(before[1].text).toBe(recap.sourceRecap.segments[0].text);
});
it("rejects invented, duplicate, reversed and oversized selections without truncating", () => {
  const source = sampleCall("one-time", "fictional-recap-bound").segments;
  for (const ids of [
    ["invented"],
    [source[0].id, source[0].id],
    [source[2].id, source[0].id],
  ])
    expect(() =>
      materializeRecap({ recap: { segmentIds: ids }, facts: [] }, source),
    ).toThrow("INVALID_EVIDENCE");
  const huge = source.map((s, i) =>
    i === 0 ? { ...s, text: "x".repeat(1800) } : s,
  );
  expect(() =>
    materializeRecap(
      { recap: { segmentIds: [source[0].id] }, facts: [] },
      huge,
    ),
  ).toThrow("SOURCE_EXCERPT_LIMIT");
  expect(() =>
    materializeRecap(
      {
        recap: { segmentIds: [source[1].id] },
        facts: [{ kind: "other", evidence: { segmentIds: [source[0].id] } }],
      },
      huge,
    ),
  ).toThrow("SOURCE_EXCERPT_LIMIT");
});
it("keeps unknown speaker snapshots literal and does not derive identity", () => {
  const source = sampleCall("one-time", "fictional-unknown-recap").segments.map(
    (s) => ({ ...s, speaker: "unknown" as const }),
  );
  const result = materializeRecap(
    { recap: { segmentIds: [source[0].id] }, facts: [] },
    source,
  );
  expect(result.summary).toContain("Unknown speaker · 0:00");
  expect(result.sourceRecap.segments[0].speaker).toBe("unknown");
});
