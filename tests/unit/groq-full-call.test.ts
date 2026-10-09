import { expect, it } from "vitest";
import {
  buildAnalysisRequest,
  buildScoringRequests,
} from "@/lib/groq/analysis-request";
import type { Segment } from "@/lib/domain/types";
import Ajv from "ajv";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { stagedFromAnalysis } from "../helpers/provider-wire";

export function fullCall(): Segment[] {
  return Array.from({ length: 112 }, (_, i) => ({
    id: `seg-${i + 1}`,
    startMs: i * 2500,
    endMs: i * 2500 + 2400,
    speaker: i % 2 ? "customer" : "employee",
    text:
      i === 111
        ? "Yes, please book the return service next Friday afternoon."
        : "Fictional dialogue about our existing service.",
  }));
}
it("admits all 112 fictional turns without dropping the end or increasing limits", () => {
  const source = fullCall(),
    before = structuredClone(source);
  const built = buildAnalysisRequest(source, { transcriptComplete: true });
  expect(built.budget.bytes).toBeLessThanOrEqual(12000);
  expect(built.budget.estimatedTotalTokens).toBeLessThanOrEqual(8000);
  const user = JSON.parse(String(built.request.messages[1].content));
  expect(user.rows).toEqual(
    source.map((s) => [s.speaker === "employee" ? "E" : "C", s.text]),
  );
  expect(source).toEqual(before);
  for (const purpose of ["sales", "general", "retention"] as const) {
    const requests = buildScoringRequests(
      source,
      { transcriptComplete: true },
      purpose,
    );
    for (const scoring of requests) {
      expect(scoring.budget.bytes).toBeLessThanOrEqual(12000);
      expect(scoring.budget.estimatedTotalTokens).toBeLessThanOrEqual(8000);
    }
  }
});
it("keeps indexed schema membership and employee-only evidence strict", () => {
  const segments = fullCall();
  const format = buildAnalysisRequest(segments, { transcriptComplete: true })
    .request.response_format;
  if (format?.type !== "json_schema") throw new Error("Expected strict schema");
  const validate = new Ajv().compile(format.json_schema.schema!);
  const legacy = stagedFromAnalysis(
    sampleCall("service", "fictional").originalAnalysis!,
  ).extraction;
  const value = {
    ...legacy,
    recap: { segmentIds: [111] },
    facts: [],
    followups: [],
    outcomes: Object.fromEntries(
      Object.keys(legacy.outcomes).map((k) => [
        k,
        { unknown: { segmentIds: [] } },
      ]),
    ),
  };
  expect(validate(value)).toBe(true);
  for (const index of [-1, 112, 1.5, "111"])
    expect(validate({ ...value, recap: { segmentIds: [index] } })).toBe(false);
  for (const purpose of ["general", "sales", "retention"] as const) {
    const groups = buildScoringRequests(
      segments,
      { transcriptComplete: true },
      purpose,
    );
    expect(
      groups.flatMap((g) => g.selectedIds ?? RUBRICS[purpose].map((c) => c.id)),
    ).toEqual(RUBRICS[purpose].map((c) => c.id));
    for (const group of groups) {
      const f = group.request.response_format;
      if (f?.type !== "json_schema") throw new Error("Expected strict schema");
      const check = new Ajv().compile(f.json_schema.schema!);
      const ids = group.selectedIds ?? RUBRICS[purpose].map((c) => c.id);
      const response = {
        noObjections: false,
        coaching: { strength: null, improvement1: null, improvement2: null },
        checkpoints: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              status: "unknown",
              reason: "Insufficient fictional evidence.",
              evidence: { segmentIds: [0] },
            },
          ]),
        ),
      };
      expect(check(response)).toBe(true);
      response.checkpoints[ids[0]].evidence.segmentIds = [1];
      expect(check(response)).toBe(false);
    }
  }
});
