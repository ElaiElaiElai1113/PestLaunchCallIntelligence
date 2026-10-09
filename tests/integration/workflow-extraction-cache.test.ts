import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { stagedFromAnalysis } from "../helpers/provider-wire";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  fetch: vi.fn(),
  gets: 0,
  puts: 0,
  stepAttempt: 1,
}));
vi.mock("workflow", async (load) => ({
  ...(await load<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: "fictional-cache-run" }),
  getStepMetadata: () => ({ attempt: state.stepAttempt }),
}));
vi.mock("@/lib/server/repository", () => ({
  systemRepository: async () => ({
    get: async () => {
      state.gets++;
      if (!state.call) throw new Error("CALL_NOT_FOUND");
      return structuredClone(state.call);
    },
    put: async (call: CallRecord, expected: number) => {
      if (!state.call || state.call.version !== expected) return false;
      state.call = structuredClone(call);
      state.puts++;
      return true;
    },
  }),
}));
vi.mock("@/lib/groq/provider", async (load) => {
  const real = await load<typeof import("@/lib/groq/provider")>();
  return {
    GroqProvider: class extends real.GroqProvider {
      constructor(config: ConstructorParameters<typeof real.GroqProvider>[0]) {
        super({ ...config, fetch: state.fetch });
      }
    },
  };
});
import { processCall } from "@/workflows/process-call";
beforeEach(() => {
  vi.resetAllMocks();
  state.gets = 0;
  state.puts = 0;
  state.stepAttempt = 1;
  state.call = sampleCall("service", "fictional-cache");
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    analysis: null,
    originalAnalysis: null,
    latestModelAnalysis: null,
    score: null,
    status: "analyzing",
    transcriptCompleteness: "verified",
    transcriptReviewReasons: [],
    processingAttempt: {
      id: "cache-attempt",
      state: "running",
      runId: "fictional-cache-run",
    },
  });
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
});
afterEach(() => vi.unstubAllEnvs());
it("resumes scoring after429 without retransmitting extraction or returning content", async () => {
  const reply = stagedFromAnalysis(
    sampleCall("service", "fictional-cache").originalAnalysis!,
  );
  let extraction = 0,
    scoring = 0;
  state.fetch.mockImplementation(async (_url, init) => {
    const body = JSON.parse(
      _url instanceof Request ? await _url.clone().text() : String(init?.body),
    );
    const stage = body.response_format.json_schema.name;
    if (stage.endsWith("extraction")) {
      extraction++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(reply.extraction) },
          },
        ],
      });
    }
    scoring++;
    return scoring === 1
      ? Response.json(
          {
            error: { code: "rate_limit_exceeded", message: "Fictional quota" },
          },
          { status: 429 },
        )
      : Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(reply.scoring) },
            },
          ],
        });
  });
  await expect(processCall("fictional-cache", "cache-attempt")).rejects.toThrow(
    "PROVIDER_TEMPORARILY_UNAVAILABLE",
  );
  expect(state.call?.analysis).toBeNull();
  const result = await processCall("fictional-cache", "cache-attempt");
  expect(result).toEqual({ callId: "fictional-cache" });
  expect(extraction).toBe(1);
  expect(scoring).toBe(2);
  expect(state.call?.originalProviderOutput?.content).toContain(
    JSON.stringify(reply.extraction).replaceAll('"', '\\"'),
  );
  expect(state.call?.analysis).not.toBeNull();
});
it.each(["source", "attempt", "version", "request"])(
  "does not reuse extraction after %s changes",
  async (kind) => {
    const reply = stagedFromAnalysis(
      sampleCall("service", "fictional-cache").originalAnalysis!,
    );
    let extraction = 0,
      scoring = 0;
    state.fetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(
        _url instanceof Request
          ? await _url.clone().text()
          : String(init?.body),
      );
      if (body.response_format.json_schema.name.endsWith("extraction")) {
        extraction++;
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(reply.extraction) },
            },
          ],
        });
      }
      scoring++;
      return scoring === 1
        ? Response.json(
            {
              error: {
                code: "rate_limit_exceeded",
                message: "Fictional quota",
              },
            },
            { status: 429 },
          )
        : Response.json({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(reply.scoring) },
              },
            ],
          });
    });
    await expect(
      processCall("fictional-cache", "cache-attempt"),
    ).rejects.toThrow("PROVIDER_TEMPORARILY_UNAVAILABLE");
    let attempt = "cache-attempt";
    if (kind === "source") {
      state.call!.sourceRevision = (state.call!.sourceRevision ?? 0) + 1;
      state.call!.segments[0].text += " Fictional clarification.";
      state.call!.version++;
    }
    if (kind === "version") state.call!.version++;
    if (kind === "request")
      state.call!.pendingExtraction!.output.requestHash = "0".repeat(64);
    if (kind === "attempt") {
      attempt = "next-attempt";
      state.call!.processingAttempt = {
        id: attempt,
        state: "running",
        runId: "fictional-cache-run",
      };
    }
    await processCall("fictional-cache", attempt);
    expect(extraction).toBe(2);
    expect(scoring).toBe(2);
    expect(state.call?.pendingExtraction).toBeNull();
  },
);
it("deletion during extraction prevents cache storage and scoring", async () => {
  const reply = stagedFromAnalysis(
    sampleCall("service", "fictional-cache").originalAnalysis!,
  );
  state.fetch.mockImplementation(async (wire: Request) => {
    const receipt = state.call!.providerDispatches?.at(-1);
    expect(receipt?.requestHash).toBe(
      createHash("sha256")
        .update(Buffer.from(await wire.clone().arrayBuffer()))
        .digest("hex"),
    );
    expect(receipt?.sourceHash).toBe(state.call!.checksum);
    expect(receipt?.stage).toBe("analysis");
    state.call = null;
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(reply.extraction) },
        },
      ],
    });
  });
  expect(await processCall("fictional-cache", "cache-attempt")).toEqual({
    callId: "fictional-cache",
  });
  expect(state.fetch).toHaveBeenCalledTimes(1);
  // Only the before-send metadata reservation exists; no cache/result save.
  expect(state.puts).toBe(1);
});
it("exhausted provider retries finish the attempt with a truthful recoverable failure", async () => {
  const reply = stagedFromAnalysis(
    sampleCall("service", "fictional-cache").originalAnalysis!,
  );
  let extraction = 0,
    scoring = 0;
  state.fetch.mockImplementation(async (_url, init) => {
    const body = JSON.parse(
      _url instanceof Request ? await _url.clone().text() : String(init?.body),
    );
    if (body.response_format.json_schema.name.endsWith("extraction")) {
      extraction++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(reply.extraction) },
          },
        ],
      });
    }
    scoring++;
    return Response.json(
      { error: { code: "rate_limit_exceeded", message: "Fictional quota" } },
      { status: 429 },
    );
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    state.stepAttempt = attempt;
    await expect(
      processCall("fictional-cache", "cache-attempt"),
    ).rejects.toThrow("PROVIDER_TEMPORARILY_UNAVAILABLE");
  }
  state.stepAttempt = 4;
  expect(await processCall("fictional-cache", "cache-attempt")).toEqual({
    callId: "fictional-cache",
  });
  expect(extraction).toBe(1);
  expect(scoring).toBe(4);
  expect(state.call?.status).toBe("failed");
  expect(state.call?.processingAttempt?.state).toBe("finished");
  expect(state.call?.errorCode).toBe("PROVIDER_TEMPORARILY_UNAVAILABLE");
  expect(state.call?.analysis).toBeNull();
});
