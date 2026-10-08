import { expect, it } from "vitest";
import Ajv from "ajv";
import { inlinePrimitiveEnumReferences } from "@/lib/groq/schema-encoding";
import { buildScoringRequest } from "@/lib/groq/analysis-request";
import { sampleCall } from "@/lib/samples/fixtures";
import { stagedFromAnalysis } from "../helpers/provider-wire";

it.each(["employee", "unknown", "partial"])(
  "preserves %s schema acceptance and every original constraint",
  (mode) => {
    const call = sampleCall("one-time", "fictional-encoding");
    const segments =
      mode === "employee"
        ? call.segments
        : call.segments.map((s, i) => ({
            ...s,
            speaker:
              mode === "partial" && i === 0
                ? ("employee" as const)
                : ("unknown" as const),
          }));
    const request = buildScoringRequest(
      segments,
      { transcriptComplete: mode === "employee" },
      "sales",
    ).request;
    if (request.response_format?.type !== "json_schema")
      throw Error("Schema absent");
    const original = request.response_format.json_schema.schema!;
    const snapshot = structuredClone(original);
    const expanded = inlinePrimitiveEnumReferences(original);
    const before = new Ajv({ allErrors: true }).compile(original),
      after = new Ajv({ allErrors: true }).compile(expanded);
    const valid = stagedFromAnalysis(call.originalAnalysis!).scoring;
    if (mode !== "employee") {
      valid.coaching = {
        strength: null,
        improvement1: null,
        improvement2: null,
      };
      Object.values(valid.checkpoints).forEach((x) => {
        x.status = "unknown";
        x.evidence.segmentIds = [segments[0].id];
      });
    }
    const variations = [valid];
    const mutate = (fn: (x: typeof valid) => void) => {
      const x = structuredClone(valid);
      fn(x);
      variations.push(x);
    };
    mutate(
      (x) =>
        (x.checkpoints.consensus.evidence.segmentIds = [
          call.segments.find((s) => s.speaker === "customer")!.id,
        ]),
    );
    mutate(
      (x) =>
        (x.checkpoints.consensus.evidence.segmentIds = [
          segments[0].id,
          call.segments.find((s) => s.speaker === "customer")!.id,
        ]),
    );
    mutate((x) => (x.checkpoints.consensus.evidence.segmentIds = []));
    mutate(
      (x) =>
        (x.checkpoints.consensus.evidence.segmentIds = Array(7).fill(
          segments[0].id,
        )),
    );
    mutate((x) => (x.checkpoints.consensus.reason = "x".repeat(241)));
    mutate((x) => delete x.checkpoints.consensus);
    for (const candidate of variations)
      expect(after(candidate)).toBe(before(candidate));
    expect(after(valid)).toBe(true);
    expect(original).toEqual(snapshot);
  },
);
it("keeps reference siblings and complete primitive definitions unchanged", () => {
  const schema = {
    $defs: { id: { type: "string", enum: ["employee"], maxLength: 8 } },
    properties: {
      plain: { $ref: "#/$defs/id" },
      withSibling: { $ref: "#/$defs/id", minLength: 2 },
    },
  };
  const expanded = inlinePrimitiveEnumReferences(schema);
  expect(expanded.properties.plain).toEqual(schema.$defs.id);
  expect(expanded.properties.withSibling).toEqual(
    schema.properties.withSibling,
  );
  expect(expanded.$defs).toEqual(schema.$defs);
});
