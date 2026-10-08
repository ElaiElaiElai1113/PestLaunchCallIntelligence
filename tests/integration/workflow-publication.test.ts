import { beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { analysis } from "../helpers/analysis";
import { guardAssessment } from "@/lib/domain/assessment-guards";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  analyze: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/lib/server/repository", () => ({
  systemRepository: async () => ({
    get: async () => {
      if (!state.call) throw new Error("CALL_NOT_FOUND");
      return structuredClone(state.call);
    },
    put: async (call: CallRecord, version: number) => {
      if (!state.call || state.call.version !== version) return false;
      state.call = structuredClone(call);
      return true;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ adminClient: state.admin }));
vi.mock("@/lib/groq/provider", () => ({
  GroqProvider: class {
    analyze = state.analyze;
  },
}));
import { processCall } from "@/workflows/process-call";
beforeEach(() => {
  vi.clearAllMocks();
  state.call = sampleCall("service", "fictional-call");
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    analysis: null,
    originalAnalysis: null,
    score: null,
    status: "analyzing",
    errorCode: null,
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription quality needs review."],
  });
  state.call.segments = [
    { id: "s1", text: "Hello", startMs: 0, endMs: 1000, speaker: "unknown" },
  ];
});
it("analysis failure and retry preserve uncertainty and separate original/effective output", async () => {
  const raw = analysis();
  state.analyze
    .mockRejectedValueOnce(new Error("INVALID_EVIDENCE"))
    .mockImplementationOnce(async (segments, context) => ({
      original: structuredClone(raw),
      effective: guardAssessment(
        raw,
        segments,
        context ?? { transcriptComplete: false },
      ),
    }));
  await processCall("fictional-call");
  expect(state.call).toMatchObject({
    status: "failed",
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription quality needs review."],
  });
  state.call!.errorCode = null;
  state.call!.status = "analyzing";
  await processCall("fictional-call");
  expect(state.analyze).toHaveBeenLastCalledWith(state.call!.segments, {
    transcriptComplete: false,
  });
  expect(state.call!.originalAnalysis).toEqual(raw);
  expect(state.call!.analysis!.complete).toBe(false);
  expect(state.call!.analysis!.reviewReasons).toContain(
    "Transcription quality needs review.",
  );
  expect(state.call!.score).toMatchObject({
    denominator: 17,
    points: 0,
    grade: null,
  });
  expect(state.call!.status).toBe("needs_review");
  expect(state.admin).not.toHaveBeenCalled();
});
it("legacy live transcripts without metadata cannot inherit model completeness", async () => {
  delete state.call!.transcriptCompleteness;
  delete state.call!.transcriptReviewReasons;
  const raw = analysis();
  state.analyze.mockImplementation(async (segments, context) => ({
    original: raw,
    effective: guardAssessment(
      raw,
      segments,
      context ?? { transcriptComplete: false },
    ),
  }));
  await processCall("fictional-call");
  expect(state.call!.score?.grade).toBe(null);
  expect(state.analyze).toHaveBeenCalledWith(state.call!.segments, {
    transcriptComplete: false,
  });
});
