import { beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { guardAssessment } from "@/lib/domain/assessment-guards";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  drafts: 0,
  analyses: 0,
}));
vi.mock("workflow", async (load) => ({
  ...(await load<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: "fictional-draft-run" }),
}));
vi.mock("@/lib/server/repository", () => ({
  systemRepository: async () => ({
    get: async () => structuredClone(state.call),
    put: async (call: CallRecord, version: number) => {
      if (state.call!.version !== version) return false;
      state.call = structuredClone(call);
      return true;
    },
  }),
}));
vi.mock("@/lib/gemini/provider", () => ({
  GeminiProvider: class {
    constructor(
      readonly config: { beforeDispatch?: (request: Request) => Promise<void> },
    ) {}
    async suggestSpeakers(segments: CallRecord["segments"]) {
      state.drafts++;
      await this.config.beforeDispatch?.(
        new Request(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            body: JSON.stringify({
              model: "gemini-3.5-flash-lite",
              kind: "fictional-speaker-draft",
            }),
          },
        ),
      );
      return {
        model: "gemini-3.5-flash-lite",
        roles: segments.map((s) => ({
          segmentId: s.id,
          speaker: "employee",
          confidence: 0.95,
        })),
      };
    }
    async analyze(
      segments: CallRecord["segments"],
      context: { transcriptComplete: boolean },
    ) {
      state.analyses++;
      const original = sampleCall("service", "base").originalAnalysis!;
      return {
        original,
        effective: guardAssessment(original, segments, context),
      };
    }
  },
}));
vi.mock("@/lib/server/ai-provider", async () => {
  const { GeminiProvider } = await import("@/lib/gemini/provider");
  return {
    selectedProvider: () => "gemini",
    analysisModel: () => "gemini-3.5-flash-lite",
    aiConfigured: () => true,
    createProvider: (config: {
      beforeDispatch?: (r: Request) => Promise<void>;
    }) => new GeminiProvider(config),
  };
});
import { processCall } from "@/workflows/process-call";
beforeEach(() => {
  state.drafts = 0;
  state.analyses = 0;
  state.call = sampleCall("service", "fictional-source-draft");
  Object.assign(state.call, {
    mode: "live",
    checksum: "a".repeat(64),
    analysis: null,
    originalAnalysis: null,
    score: null,
    status: "analyzing",
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: [],
  });
  state.call!.segments.forEach((s) => (s.speaker = "unknown"));
});
it("assigns source-bound AI labels before extraction without attesting quality or completeness", async () => {
  const before = structuredClone(state.call!.segments);
  await processCall(state.call!.id);
  expect(state.drafts).toBe(1);
  expect(state.analyses).toBe(1);
  expect(
    state.call!.segments.map((s) => ({ ...s, speaker: "unknown" })),
  ).toEqual(before);
  expect(state.call!.segments.every((s) => s.speaker === "employee")).toBe(
    true,
  );
  expect(state.call!.speakerAttribution?.kind).toBe("ai");
  expect(state.call!.transcriptReviewReasons).toContain(
    "AI speaker labels need review.",
  );
  expect(state.call!.transcriptCompleteness).toBe("unverified");
  expect(state.call!.speakerProposals?.roles).toHaveLength(before.length);
  expect(state.call!.providerDispatches?.[0].stage).toBe("speaker_draft");
  expect(state.call!.score?.grade).toBeNull();
});
