import { it, expect } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { buildAnalysisRequest, rubricGuide } from "@/lib/groq/analysis-request";
it("compact guidance preserves every authoritative checkpoint and purpose override", () => {
  const guide = rubricGuide();
  for (const [purpose, rubric] of Object.entries(RUBRICS)) {
    expect(guide.purposes[purpose]).toEqual(rubric.map((c) => c.id));
    for (const checkpoint of rubric)
      expect(
        guide.overrides[purpose]?.[checkpoint.id] ??
          guide.guidance[checkpoint.id],
      ).toBe(checkpoint.guidance);
  }
});
it("builds a reference-only strict request inside the Free heuristic budget", () => {
  const built = buildAnalysisRequest(
    sampleCall("one-time", "fictional").segments,
    { transcriptComplete: true },
  );
  expect(built.request).toMatchObject({
    model: "openai/gpt-oss-120b",
    max_completion_tokens: 3000,
    reasoning_effort: "low",
    include_reasoning: false,
    response_format: {
      type: "json_schema",
      json_schema: { strict: true, name: "call_analysis_refs_v1" },
    },
  });
  expect(built.request).not.toHaveProperty("reasoning_format");
  expect(built.budget.bytes).toBeLessThanOrEqual(12000);
  expect(built.budget.estimatedTotalTokens).toBeLessThan(8000);
  const serialized = JSON.stringify(built.request.response_format);
  expect(serialized).toContain('"$defs"');
  expect(serialized).not.toContain('"quote"');
  expect(serialized).not.toContain(
    sampleCall("one-time", "fictional").segments[0].text,
  );
});
it("refuses a complete oversized input rather than truncating its ending", () => {
  const source = sampleCall("service", "fictional").segments;
  source[0].text = "Fictional ".repeat(2000);
  const before = structuredClone(source);
  expect(() =>
    buildAnalysisRequest(source, { transcriptComplete: true }),
  ).toThrow("ANALYSIS_BUDGET_EXCEEDED");
  expect(source).toEqual(before);
});
