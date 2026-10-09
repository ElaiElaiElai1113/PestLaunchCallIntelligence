import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { scoringSchema, extractionSchema } from "@/lib/groq/staged-contract";
import { buildScoringRequest } from "@/lib/groq/analysis-request";
import { stagedFromAnalysis } from "../helpers/provider-wire";
it("requires source evidence for every v3 non-null outcome with disjoint null branches", () => {
  const call = sampleCall("one-time", "fictional-outcome-evidence");
  const raw = stagedFromAnalysis(call.originalAnalysis!).extraction;
  const schema = extractionSchema(call.segments);
  for (const value of [true, false]) {
    const changed = structuredClone(raw);
    changed.outcomes.inspectionBooked = { value, evidence: { segmentIds: [] } };
    expect(schema.safeParse(changed).success).toBe(false);
    changed.outcomes.inspectionBooked.evidence.segmentIds = [
      call.segments[0].id,
    ];
    expect(schema.safeParse(changed).success).toBe(true);
  }
  const missing = structuredClone(raw);
  missing.outcomes.inspectionBooked = {
    value: null,
    evidence: { segmentIds: [] },
  };
  expect(schema.safeParse(missing).success).toBe(true);
});
it("keeps unknown-source coaching null and excludes unknown turns from partial employee attribution", () => {
  const call = sampleCall("one-time", "fictional-unknown-roles");
  const wire = stagedFromAnalysis(call.originalAnalysis!).scoring;
  wire.coaching = { strength: null, improvement1: null, improvement2: null };
  Object.values(wire.checkpoints).forEach((item) => (item.status = "unknown"));
  const unknown = call.segments.map((s) => ({
    ...s,
    speaker: "unknown" as const,
  }));
  expect(scoringSchema(unknown, "sales").safeParse(wire).success).toBe(true);
  wire.coaching.strength = stagedFromAnalysis(
    call.originalAnalysis!,
  ).scoring.coaching.strength;
  expect(scoringSchema(unknown, "sales").safeParse(wire).success).toBe(false);
  wire.coaching.strength = null;
  const employee = call.segments.find((s) => s.speaker === "employee")!.id;
  const partial = unknown.map((s) =>
    s.id === employee ? { ...s, speaker: "employee" as const } : s,
  );
  Object.values(wire.checkpoints).forEach(
    (item) => (item.evidence.segmentIds = [employee]),
  );
  expect(scoringSchema(partial, "sales").safeParse(wire).success).toBe(true);
  wire.checkpoints.consensus.evidence.segmentIds = [
    unknown.find((s) => s.id !== employee)!.id,
  ];
  expect(scoringSchema(partial, "sales").safeParse(wire).success).toBe(false);
});
it.each(["customer", "mixed"])(
  "rejects %s-only/mixed references for attributed employee checkpoints",
  (kind) => {
    const call = sampleCall("one-time", "fictional-citation");
    const wire = stagedFromAnalysis(call.originalAnalysis!).scoring;
    const employee = call.segments.find((s) => s.speaker === "employee")!.id;
    const customer = call.segments.find((s) => s.speaker === "customer")!.id;
    wire.checkpoints.consensus.evidence.segmentIds =
      kind === "customer" ? [customer] : [employee, customer];
    expect(scoringSchema(call.segments, "sales").safeParse(wire).success).toBe(
      false,
    );
    wire.checkpoints.consensus.evidence.segmentIds = [employee];
    expect(scoringSchema(call.segments, "sales").safeParse(wire).success).toBe(
      true,
    );
  },
);
it("limits coaching structurally to one strength and two improvements", () => {
  const source = sampleCall("one-time", "fictional-coaching-limit");
  const request = buildScoringRequest(
    source.segments,
    { transcriptComplete: true },
    "sales",
  ).request;
  const schema =
    request.response_format!.type === "json_schema"
      ? request.response_format!.json_schema.schema
      : {};
  expect(
    (schema as { properties?: { coaching?: { required?: string[] } } })
      .properties?.coaching?.required,
  ).toEqual(["strength", "improvement1", "improvement2"]);
});
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
  const coach = scoring.coaching.strength ?? scoring.coaching.improvement1!;
  const target = scoring.checkpoints[coach.checkpointId];
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
