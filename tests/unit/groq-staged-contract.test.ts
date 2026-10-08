import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { scoringSchema } from "@/lib/groq/staged-contract";
import { buildScoringRequest } from "@/lib/groq/analysis-request";
import { stagedFromAnalysis } from "../helpers/provider-wire";
it("avoids Groq object unions with overlapping checkpoint status discriminators", () => {
  const source = sampleCall("one-time", "fictional-discriminator");
  const request = buildScoringRequest(
    source.segments,
    { transcriptComplete: true },
    "sales",
  ).request;
  const schema =
    request.response_format!.type === "json_schema"
      ? request.response_format!.json_schema.schema
      : {};
  let overlap = false;
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.anyOf)) {
      const discriminators = node.anyOf
        .map((branch) => branch?.properties?.status)
        .filter(Boolean)
        .map((v) => JSON.stringify(v));
      if (new Set(discriminators).size !== discriminators.length)
        overlap = true;
    }
    for (const child of Object.values(node)) walk(child);
  }
  walk(schema);
  expect(overlap).toBe(false);
});
it("includes an explicit array type beside bounded array references for Groq", () => {
  const source = sampleCall("one-time", "fictional-array-reference");
  const request = buildScoringRequest(
    source.segments,
    { transcriptComplete: true },
    "sales",
  ).request;
  const schema =
    request.response_format!.type === "json_schema"
      ? request.response_format!.json_schema.schema
      : {};
  const violations: string[] = [];
  function walk(value: unknown, path: string) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (
      node.$ref &&
      (node.minItems !== undefined || node.maxItems !== undefined) &&
      node.type !== "array"
    )
      violations.push(path);
    for (const [key, child] of Object.entries(node))
      walk(child, path + "." + key);
  }
  walk(schema, "schema");
  expect(violations).toEqual([]);
});
it("schema rejects coaching without a real parent reference before resolution", () => {
  const call = sampleCall("one-time", "fictional-empty-coaching");
  const scoring = stagedFromAnalysis(call.originalAnalysis!).scoring;
  const target = Object.values(scoring.checkpoints).find(
    (c) => c.coaching !== null,
  )!;
  target.evidence.segmentIds = [];
  expect(scoringSchema(call.segments, "sales").safeParse(scoring).success).toBe(
    false,
  );
});

it.each(["one-time", "service", "retention"])(
  "requires every exact rubric key for %s",
  (key) => {
    const source = sampleCall(key, "fictional-contract");
    const scoring = stagedFromAnalysis(source.originalAnalysis!).scoring;
    const schema = scoringSchema(
      source.segments,
      source.originalAnalysis!.purpose,
    );
    expect(schema.safeParse(scoring).success).toBe(true);
    delete scoring.checkpoints[Object.keys(scoring.checkpoints)[0]];
    expect(schema.safeParse(scoring).success).toBe(false);
    scoring.checkpoints.fabricated = {
      status: "unknown",
      reason: "Unverified",
      evidence: { segmentIds: [] },
      coaching: null,
    };
    expect(schema.safeParse(scoring).success).toBe(false);
  },
);
it.each(["sales", "general", "retention"] as const)(
  "JSON Schema requires exactly the %s rubric",
  (purpose) => {
    const source = sampleCall("one-time", "fictional-schema");
    const request = buildScoringRequest(
      source.segments,
      { transcriptComplete: true },
      purpose,
    ).request;
    const schema =
      request.response_format!.type === "json_schema"
        ? request.response_format!.json_schema.schema
        : {};
    const checkpoint = (
      schema as {
        properties: {
          checkpoints: { required: string[]; additionalProperties: boolean };
        };
      }
    ).properties.checkpoints;
    expect(checkpoint.required).toEqual(RUBRICS[purpose].map((c) => c.id));
    expect(checkpoint.additionalProperties).toBe(false);
  },
);
