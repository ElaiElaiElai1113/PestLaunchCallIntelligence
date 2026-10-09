import { expect, it } from "vitest";
import { GroqProvider } from "@/lib/groq/provider";
import { sampleCall } from "@/lib/samples/fixtures";
import { stagedFromAnalysis } from "../helpers/provider-wire";

const call = () => sampleCall("one-time", "fictional-staged");
it("rejects an unevidenced boolean claim before any scoring request", async () => {
  const source = call();
  const { extraction } = stagedFromAnalysis(source.originalAnalysis!);
  extraction.outcomes.cancellationRequested = {
    claimed: { value: false, evidence: { segmentIds: [] } },
  };
  let requests = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () => {
      requests++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(extraction),
            },
          },
        ],
      });
    },
  });
  await expect(
    provider.analyze(source.segments, { transcriptComplete: true }),
  ).rejects.toThrow();
  expect(requests).toBe(1);
});
it("rechecks permission before a second provider transmission", async () => {
  const { extraction } = responses();
  let requests = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    beforeScoring: async () => {
      throw new Error("PROCESSING_SUPERSEDED");
    },
    fetch: async () => {
      requests++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(extraction) },
          },
        ],
      });
    },
  });
  await expect(
    provider.analyze(call().segments, { transcriptComplete: true }),
  ).rejects.toThrow("PROCESSING_SUPERSEDED");
  expect(requests).toBe(1);
});
function responses() {
  return stagedFromAnalysis(call().originalAnalysis!);
}
it("extracts details before scoring every purpose-specific checkpoint", async () => {
  const source = call(),
    before = structuredClone(source.segments);
  const captured: Record<string, unknown>[] = [];
  const { extraction, scoring } = responses();
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async (_url, init) => {
      captured.push(JSON.parse(String(init?.body)));
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(
                captured.length === 1 ? extraction : scoring,
              ),
            },
          },
        ],
      });
    },
  });
  const result = await provider.analyze(source.segments, {
    transcriptComplete: true,
  });
  expect(captured).toHaveLength(2);
  expect(result.original.assessments).toHaveLength(17);
  expect(result.original.followups).toEqual(source.originalAnalysis!.followups);
  expect(source.segments).toEqual(before);
  expect(result.providerOutput.contract).toBe("call_analysis_source_refs_v5");
  const raw = JSON.parse(result.providerOutput.content);
  expect(raw.extraction).toBe(JSON.stringify(extraction));
  expect(raw.scoring).toBe(JSON.stringify(scoring));
  const schema = (
    captured[1].response_format as {
      json_schema: { schema: Record<string, unknown> };
    }
  ).json_schema.schema;
  expect(JSON.stringify(schema)).toContain('"objection_reclose"');
});
it("rejects incomplete second-stage membership without publishing extraction alone", async () => {
  const { extraction, scoring } = responses();
  delete scoring.checkpoints.objection_reclose;
  let count = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () => {
      count++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(count === 1 ? extraction : scoring),
            },
          },
        ],
      });
    },
  });
  await expect(
    provider.analyze(call().segments, { transcriptComplete: true }),
  ).rejects.toThrow();
  expect(count).toBe(2);
});
it("does not issue scoring after invalid extraction", async () => {
  let count = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () => {
      count++;
      return Response.json({
        choices: [{ finish_reason: "stop", message: { content: "{}" } }],
      });
    },
  });
  await expect(provider.analyze(call().segments)).rejects.toThrow();
  expect(count).toBe(1);
});
