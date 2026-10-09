import { expect, it } from "vitest";
import { GroqProvider } from "@/lib/groq/provider";
import { RUBRICS } from "@/lib/scoring/rubrics";
import type { Segment } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { stagedFromAnalysis } from "../helpers/provider-wire";
import { createHash } from "node:crypto";
import { buildAnalysisRequest } from "@/lib/groq/analysis-request";
import { INDEXED_CONTRACT } from "@/lib/groq/indexed-contract";
type Captured = {
  response_format: {
    json_schema: {
      schema: {
        properties: { checkpoints?: { properties: Record<string, unknown> } };
      };
    };
  };
};

const source = (): Segment[] =>
  Array.from({ length: 112 }, (_, i) => ({
    id: `seg-${i + 1}`,
    startMs: i * 2500,
    endMs: i * 2500 + 2400,
    speaker: i % 2 ? "customer" : "employee",
    text:
      i === 111
        ? "Yes, please book the return service next Friday afternoon."
        : "Fictional dialogue about our existing service.",
  }));
function extraction() {
  const base = stagedFromAnalysis(
    sampleCall("service", "fictional").originalAnalysis!,
  ).extraction;
  return {
    ...base,
    purpose: "general",
    facts: [],
    followups: [],
    recap: { segmentIds: [111] },
    outcomes: Object.fromEntries(
      Object.keys(base.outcomes).map((key) => [
        key,
        { unknown: { segmentIds: [] } },
      ]),
    ),
  };
}
function scoring(ids: string[]) {
  return {
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
    noObjections: false,
    coaching: { strength: null, improvement1: null, improvement2: null },
  };
}
it("analyzes the complete 112-turn source through bounded groups and preserves raw index provenance", async () => {
  const segments = source(),
    before = structuredClone(segments),
    captured: Captured[] = [],
    raw: string[] = [];
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async (_url, init) => {
      const req = JSON.parse(String(init?.body));
      captured.push(req);
      const ids = Object.keys(
        req.response_format.json_schema.schema.properties.checkpoints
          ?.properties ?? {},
      );
      const content = JSON.stringify(
        captured.length === 1 ? extraction() : scoring(ids),
      );
      raw.push(content);
      return Response.json({
        choices: [{ finish_reason: "stop", message: { content } }],
      });
    },
  });
  const result = await provider.analyze(segments, { transcriptComplete: true });
  expect(captured).toHaveLength(3);
  expect(result.original.sourceRecap?.segments[0]).toEqual(segments[111]);
  expect(result.original.assessments.map((a) => a.id)).toEqual(
    RUBRICS.general.map((c) => c.id),
  );
  const output = JSON.parse(result.providerOutput.content);
  expect(output.extraction).toBe(raw[0]);
  expect(
    output.scoringGroups.map((g: { content: string }) => g.content),
  ).toEqual(raw.slice(1));
  expect(output.referenceMap).toEqual(segments.map((s) => s.id));
  expect(segments).toEqual(before);
});
it.each([-1, 112, 1.5, "111"])(
  "rejects an invalid index %s before scoring",
  async (index) => {
    let count = 0;
    const e = { ...extraction(), recap: { segmentIds: [index] } };
    const provider = new GroqProvider({
      apiKey: "fictional-contract-token",
      fetch: async () => {
        count++;
        return Response.json({
          choices: [
            { finish_reason: "stop", message: { content: JSON.stringify(e) } },
          ],
        });
      },
    });
    await expect(
      provider.analyze(source(), { transcriptComplete: true }),
    ).rejects.toThrow("INVALID_EVIDENCE");
    expect(count).toBe(1);
  },
);
it.each([
  [111, 111],
  [111, 0],
])(
  "rejects duplicate or reversed references %s before scoring",
  async (indices) => {
    let count = 0;
    const e = { ...extraction(), recap: { segmentIds: indices } };
    const provider = new GroqProvider({
      apiKey: "fictional-contract-token",
      fetch: async () => {
        count++;
        return Response.json({
          choices: [
            { finish_reason: "stop", message: { content: JSON.stringify(e) } },
          ],
        });
      },
    });
    await expect(
      provider.analyze(source(), { transcriptComplete: true }),
    ).rejects.toThrow("INVALID_EVIDENCE");
    expect(count).toBe(1);
  },
);
it("timestamp edits invalidate compact extraction reuse even when displayed rows are identical", async () => {
  const old = source().map((s) => ({ ...s, speaker: "unknown" as const }));
  const request = buildAnalysisRequest(old, {
    transcriptComplete: false,
  }).request;
  const cached = {
    contract: INDEXED_CONTRACT,
    model: "openai/gpt-oss-120b",
    content: JSON.stringify(extraction()),
    requestHash: createHash("sha256")
      .update(JSON.stringify({ request, segments: old }))
      .digest("hex"),
  };
  const changed = structuredClone(old);
  changed[0].endMs += 100;
  let count = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    cachedExtraction: cached,
    fetch: async () => {
      count++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(extraction()) },
          },
        ],
      });
    },
  });
  const result = await provider.analyze(changed, { transcriptComplete: false });
  expect(count).toBe(1);
  expect(result.effective.coaching).toEqual([]);
  expect(JSON.parse(result.providerOutput.content).scoringStatus).toBe(
    "withheld_unattributed",
  );
});
it("rechecks ownership before each group and never returns a partial accepted result", async () => {
  let count = 0,
    checks = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    beforeScoring: async () => {
      if (++checks === 2) throw new Error("PROCESSING_SUPERSEDED");
    },
    fetch: async (_url, init) => {
      const req = JSON.parse(String(init?.body));
      const ids = Object.keys(
        req.response_format.json_schema.schema.properties.checkpoints
          ?.properties ?? {},
      );
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(
                ++count === 1 ? extraction() : scoring(ids),
              ),
            },
          },
        ],
      });
    },
  });
  await expect(
    provider.analyze(source(), { transcriptComplete: true }),
  ).rejects.toThrow("PROCESSING_SUPERSEDED");
  expect(count).toBe(2);
});
it("rejects customer-only checkpoint evidence before sending another scoring group", async () => {
  let count = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async (_u, init) => {
      count++;
      const req = JSON.parse(String(init?.body));
      const ids = Object.keys(
        req.response_format.json_schema.schema.properties.checkpoints
          ?.properties ?? {},
      );
      const response = count === 1 ? extraction() : scoring(ids);
      if ("checkpoints" in response)
        for (const item of Object.values(response.checkpoints))
          item.evidence.segmentIds = [1];
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(response) },
          },
        ],
      });
    },
  });
  await expect(
    provider.analyze(source(), { transcriptComplete: true }),
  ).rejects.toThrow();
  expect(count).toBe(2);
});
