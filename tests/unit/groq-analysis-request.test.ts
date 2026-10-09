import { it, expect } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { buildAnalysisRequest, rubricGuide } from "@/lib/groq/analysis-request";
it("presents extraction source-ID enums directly without weakening their constraints", () => {
  const source = sampleCall("one-time", "fictional-enum-encoding").segments;
  const format = buildAnalysisRequest(source, { transcriptComplete: true })
    .request.response_format as {
    json_schema: { schema: Record<string, unknown> };
  };
  const schema = format.json_schema.schema;
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (typeof node.$ref === "string") {
      const key = node.$ref.split("/").at(-1)!;
      const target = (schema.$defs as Record<string, Record<string, unknown>>)[
        key
      ];
      expect(Array.isArray(target?.enum)).toBe(false);
    }
    Object.values(node).forEach(walk);
  }
  walk(schema);
  expect(JSON.stringify(schema)).toContain('"enum":["seg-1","seg-2"');
});
it("avoids outcome object unions with overlapping required keys rejected by Groq", () => {
  const schema = buildAnalysisRequest(
    sampleCall("one-time", "fictional-schema-admission").segments,
    { transcriptComplete: true },
  ).request.response_format as {
    json_schema: { schema: Record<string, unknown> };
  };
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.anyOf)) {
      const objects = node.anyOf.filter((x) => x.type === "object");
      for (let i = 0; i < objects.length; i++)
        for (let j = i + 1; j < objects.length; j++)
          expect(
            objects[i].required.filter((key: string) =>
              Object.hasOwn(objects[j].properties, key),
            ),
          ).toEqual([]);
    }
    Object.values(node).forEach(walk);
  }
  walk(schema.json_schema.schema);
});
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
    max_completion_tokens: 1600,
    reasoning_effort: "low",
    include_reasoning: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        strict: true,
        name: "call_analysis_source_refs_v5_extraction",
      },
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
it("browser-safe byte admission is identical to UTF-8 Buffer accounting", () => {
  const segments = sampleCall("service", "fictional").segments;
  segments[0].text = "Fictional café — ñ 🐜";
  const built = buildAnalysisRequest(segments, { transcriptComplete: true });
  expect(built.budget.bytes).toBe(
    Buffer.byteLength(
      JSON.stringify({
        messages: built.request.messages,
        schema:
          built.request.response_format!.type === "json_schema"
            ? built.request.response_format!.json_schema.schema
            : {},
      }),
      "utf8",
    ),
  );
});
