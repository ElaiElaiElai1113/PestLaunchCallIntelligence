import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { analysis } from "../helpers/analysis";
import { guardAssessment } from "@/lib/domain/assessment-guards";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  analyze: vi.fn(),
  admin: vi.fn(),
  runId: "fictional-run",
  transcribe: vi.fn(),
  getError: "",
  beforeScoring: null as null | (() => Promise<void>),
}));
vi.mock("workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: state.runId }),
}));
vi.mock("@/lib/server/repository", () => ({
  systemRepository: async () => ({
    get: async () => {
      if (state.getError) throw new Error(state.getError);
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
    constructor(config: { beforeScoring?: () => Promise<void> }) {
      state.beforeScoring = config.beforeScoring ?? null;
    }
    analyze = state.analyze;
    transcribe = state.transcribe;
  },
}));
import { processCall } from "@/workflows/process-call";
beforeEach(() => {
  vi.resetAllMocks();
  state.getError = "";
  state.beforeScoring = null;
  state.runId = "fictional-run";
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
afterEach(() => vi.unstubAllEnvs());
const rawOutput = (content: string) => ({
  contract: "call_analysis_refs_v1" as const,
  model: "openai/gpt-oss-120b",
  content,
});
it.each(["deleted", "version", "source", "owner"])(
  "does not transmit scoring after %s during extraction",
  async (kind) => {
    state.analyze.mockImplementationOnce(async () => {
      expect(state.beforeScoring).toBeTypeOf("function");
      if (kind === "deleted") state.call = null;
      else if (kind === "version") state.call!.version++;
      else if (kind === "source")
        state.call!.sourceRevision = (state.call!.sourceRevision ?? 0) + 1;
      else
        state.call!.processingAttempt = {
          id: "new-owner",
          state: "running",
          runId: "new-run",
        };
      await expect(state.beforeScoring!()).rejects.toThrow(
        "PROCESSING_SUPERSEDED",
      );
      throw new Error("PROCESSING_SUPERSEDED");
    });
    await processCall("fictional-call");
    expect(state.call?.analysis ?? null).toBeNull();
  },
);
it("first raw response remains immutable while latest follows accepted re-analysis", async () => {
  const raw = analysis(),
    first = rawOutput(' {"fictional":1} '),
    second = rawOutput('{"fictional":2}');
  state.analyze.mockImplementationOnce(async (s, c) => ({
    original: raw,
    effective: guardAssessment(raw, s, c),
    providerOutput: first,
  }));
  await processCall("fictional-call");
  expect(state.call!.originalProviderOutput).toEqual(first);
  const original = structuredClone(state.call!.originalAnalysis);
  state.call!.sourceRevision = 1;
  state.call!.version++;
  state.analyze.mockImplementationOnce(async (s, c) => ({
    original: { ...raw, title: "New fictional result" },
    effective: guardAssessment(raw, s, c),
    providerOutput: second,
  }));
  await processCall("fictional-call");
  expect(state.call!.originalProviderOutput).toEqual(first);
  expect(state.call!.latestProviderOutput).toEqual(second);
  expect(state.call!.originalAnalysis).toEqual(original);
});
it("a legacy original is never relabelled as the newer reference response", async () => {
  const raw = analysis();
  state.call!.originalAnalysis = structuredClone(raw);
  state.analyze.mockImplementation(async (s, c) => ({
    original: raw,
    effective: guardAssessment(raw, s, c),
    providerOutput: rawOutput('{"new":true}'),
  }));
  await processCall("fictional-call");
  expect(state.call!.originalProviderOutput).toBeUndefined();
  expect(state.call!.latestProviderOutput?.content).toBe('{"new":true}');
});
it("an omitted optional raw response cannot erase existing provenance", async () => {
  const first = rawOutput('{"existing":true}');
  state.call!.originalProviderOutput = first;
  state.call!.latestProviderOutput = first;
  const raw = analysis();
  state.analyze.mockImplementation(async (s, c) => ({
    original: raw,
    effective: guardAssessment(raw, s, c),
  }));
  await processCall("fictional-call");
  expect(state.call!.originalProviderOutput).toEqual(first);
  expect(state.call!.latestProviderOutput).toEqual(first);
});
it.each(["deletion", "source", "owner"])(
  "raw provenance cannot publish after %s conflict",
  async (kind) => {
    const raw = analysis();
    state.call!.processingAttempt = {
      id: "raw-attempt",
      state: "pending",
      runId: null,
    };
    state.analyze.mockImplementation(async (s, c) => {
      if (kind === "deletion") state.call = null;
      else if (kind === "source") state.call!.sourceRevision = 1;
      else
        state.call!.processingAttempt = {
          id: "other-attempt",
          state: "running",
          runId: "other-run",
        };
      return {
        original: raw,
        effective: guardAssessment(raw, s, c),
        providerOutput: rawOutput('{"blocked":true}'),
      };
    });
    await processCall("fictional-call", "raw-attempt");
    expect(state.call?.latestProviderOutput).toBeUndefined();
    expect(state.call?.analysis ?? null).toBeNull();
  },
);
it("budget failure finishes its owner and retains source and immutable history", async () => {
  const segments = structuredClone(state.call!.segments);
  const raw = analysis();
  state.call!.originalAnalysis = raw;
  state.call!.processingAttempt = {
    id: "budget-attempt",
    state: "pending",
    runId: null,
  };
  state.analyze.mockRejectedValue(new Error("ANALYSIS_BUDGET_EXCEEDED"));
  await processCall("fictional-call", "budget-attempt");
  expect(state.call!.errorCode).toBe("ANALYSIS_BUDGET_EXCEEDED");
  expect(state.call!.status).toBe("failed");
  expect(state.call!.processingAttempt?.state).toBe("finished");
  expect(state.call!.segments).toEqual(segments);
  expect(state.call!.originalAnalysis).toEqual(raw);
});
it("a stale source revision cannot take the existing-analysis shortcut", async () => {
  const raw = analysis();
  state.call!.analysis = guardAssessment(raw, state.call!.segments, {
    transcriptComplete: false,
  });
  state.call!.originalAnalysis = structuredClone(raw);
  state.call!.sourceRevision = 1;
  state.call!.analysisSourceRevision = 0;
  state.call!.processingAttempt = {
    id: "new-source-attempt",
    state: "pending",
    runId: null,
  };
  state.analyze.mockImplementation(async (s, c) => ({
    original: { ...raw, title: "New-source fictional result" },
    effective: guardAssessment(raw, s, c),
  }));
  await processCall("fictional-call", "new-source-attempt");
  expect(state.analyze).toHaveBeenCalledTimes(1);
  expect(state.call!.originalAnalysis).toEqual(raw);
  expect(state.call!.analysisSourceRevision).toBe(1);
});
it("a source revision conflict cannot publish even if the version was not advanced", async () => {
  state.call!.sourceRevision = 0;
  state.call!.processingAttempt = {
    id: "source-attempt",
    state: "pending",
    runId: null,
  };
  const raw = analysis();
  state.analyze.mockImplementation(async (s, c) => {
    state.call!.sourceRevision = 1;
    return { original: raw, effective: guardAssessment(raw, s, c) };
  });
  await processCall("fictional-call", "source-attempt");
  expect(state.call!.analysis).toBe(null);
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
it("duplicate starts permit only one owner to analyze", async () => {
  state.call!.status = "failed";
  state.call!.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
  state.call!.errorCode = "PROCESSING_START_PENDING";
  const raw = analysis();
  state.analyze.mockImplementation(async (segments, context) => ({
    original: raw,
    effective: guardAssessment(raw, segments, context),
  }));
  state.runId = "fictional-run-a";
  const first = processCall("fictional-call", "fictional-attempt");
  state.runId = "fictional-run-b";
  const second = processCall("fictional-call", "fictional-attempt");
  await Promise.all([first, second]);
  expect(state.analyze).toHaveBeenCalledTimes(1);
  expect(state.call!.processingAttempt).toMatchObject({
    state: "finished",
    runId: "fictional-run-a",
  });
});
it("old attempts and legacy runs cannot use a newly tracked call", async () => {
  state.call!.processingAttempt = {
    id: "new-attempt",
    state: "pending",
    runId: null,
  };
  await processCall("fictional-call", "old-attempt");
  await processCall("fictional-call");
  expect(state.analyze).not.toHaveBeenCalled();
  expect(state.admin).not.toHaveBeenCalled();
});
it("duplicate starts allow one transcription owner before derivative and analysis effects", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.call!.segments = [];
  state.call!.sourcePath = "sample-workspace/fictional-call.wav";
  state.call!.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
  const upload = vi.fn(async () => ({ error: null })),
    download = vi.fn(async () => ({
      error: null,
      data: new Blob(["fictional bytes"], { type: "audio/wav" }),
    }));
  state.admin.mockReturnValue({
    storage: { from: () => ({ upload, download }) },
  });
  const segments = [
    {
      id: "s1",
      text: "Hello",
      startMs: 0,
      endMs: 1000,
      speaker: "unknown" as const,
    },
  ];
  state.transcribe.mockResolvedValue({
    segments,
    durationMs: 1000,
    complete: false,
    reviewReasons: ["Transcription completeness needs review."],
  });
  const raw = analysis();
  state.analyze.mockImplementation(async (s, c) => ({
    original: raw,
    effective: guardAssessment(raw, s, c),
  }));
  state.runId = "run-a";
  const a = processCall("fictional-call", "fictional-attempt");
  state.runId = "run-b";
  const b = processCall("fictional-call", "fictional-attempt");
  await Promise.all([a, b]);
  expect(state.transcribe).toHaveBeenCalledTimes(1);
  expect(state.analyze).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(state.call!.processingAttempt).toMatchObject({
    state: "finished",
    runId: "run-a",
  });
  expect(state.call!.transcriptCompleteness).toBe("unverified");
});
it.each(["delete", "supersede"] as const)(
  "%s during transcription blocks derivative and publication",
  async (change) => {
    vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
    state.call!.segments = [];
    state.call!.sourcePath = "sample-workspace/fictional-call.wav";
    state.call!.processingAttempt = {
      id: "fictional-attempt",
      state: "pending",
      runId: null,
    };
    const upload = vi.fn(),
      download = vi.fn(async () => ({
        error: null,
        data: new Blob(["fictional bytes"]),
      }));
    state.admin.mockReturnValue({
      storage: { from: () => ({ upload, download }) },
    });
    state.transcribe.mockImplementation(async () => {
      if (change === "delete") state.call = null;
      else {
        state.call!.processingAttempt = {
          id: "new-attempt",
          state: "pending",
          runId: null,
        };
        state.call!.version++;
      }
      return {
        segments: [
          {
            id: "s1",
            text: "Hello",
            startMs: 0,
            endMs: 1000,
            speaker: "unknown",
          },
        ],
        durationMs: 1000,
        complete: false,
        reviewReasons: [],
      };
    });
    await processCall("fictional-call", "fictional-attempt");
    expect(upload).not.toHaveBeenCalled();
    expect(state.analyze).not.toHaveBeenCalled();
  },
);
it("supersession after analysis starts blocks old result publication", async () => {
  state.call!.processingAttempt = {
    id: "old-attempt",
    state: "pending",
    runId: null,
  };
  const raw = analysis();
  state.analyze.mockImplementation(async (s, c) => {
    state.call!.processingAttempt = {
      id: "new-attempt",
      state: "pending",
      runId: null,
    };
    state.call!.version++;
    return { original: raw, effective: guardAssessment(raw, s, c) };
  });
  await processCall("fictional-call", "old-attempt");
  expect(state.call!.analysis).toBe(null);
  expect(state.call!.processingAttempt!.id).toBe("new-attempt");
});
it("an already guarded result finishes its owned attempt and restores result status", async () => {
  const fixture = sampleCall("service", "fictional-call");
  state.call!.analysis = fixture.analysis;
  state.call!.originalAnalysis = fixture.originalAnalysis;
  state.call!.score = fixture.score;
  state.call!.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
  const original = structuredClone(state.call!.originalAnalysis);
  await processCall("fictional-call", "fictional-attempt");
  expect(state.call!.status).toBe("ready");
  expect(state.call!.processingAttempt!.state).toBe("finished");
  expect(state.call!.originalAnalysis).toEqual(original);
  expect(state.analyze).not.toHaveBeenCalled();
});
it("terminal provider failure finishes the owner but temporary failure retains it", async () => {
  state.call!.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
  state.analyze.mockRejectedValueOnce(
    Object.assign(new Error("fictional unavailable"), { status: 429 }),
  );
  await expect(
    processCall("fictional-call", "fictional-attempt"),
  ).rejects.toThrow("PROVIDER_TEMPORARILY_UNAVAILABLE");
  expect(state.call!.processingAttempt!.state).toBe("running");
  state.analyze.mockRejectedValueOnce(new Error("INVALID_EVIDENCE"));
  await processCall("fictional-call", "fictional-attempt");
  expect(state.call!.processingAttempt!.state).toBe("finished");
  expect(state.call!.status).toBe("failed");
});
it("deletion during source download prevents the subsequent transcription request", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.call!.segments = [];
  state.call!.sourcePath = "sample-workspace/fictional-call.wav";
  state.call!.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
  state.admin.mockReturnValue({
    storage: {
      from: () => ({
        download: async () => {
          state.call = null;
          return { error: null, data: new Blob(["fictional bytes"]) };
        },
        upload: vi.fn(),
      }),
    },
  });
  state.transcribe.mockResolvedValue({
    segments: [],
    durationMs: 1000,
    complete: false,
    reviewReasons: [],
  });
  await processCall("fictional-call", "fictional-attempt");
  expect(state.transcribe).not.toHaveBeenCalled();
});
it.each(["CALL_NOT_FOUND", "DATABASE_UNAVAILABLE"])(
  "claim %s exits or retries before effects",
  async (code) => {
    state.call!.processingAttempt = {
      id: "fictional-attempt",
      state: "pending",
      runId: null,
    };
    state.getError = code;
    if (code === "CALL_NOT_FOUND")
      await expect(
        processCall("fictional-call", "fictional-attempt"),
      ).resolves.toEqual({ callId: "fictional-call" });
    else
      await expect(
        processCall("fictional-call", "fictional-attempt"),
      ).rejects.toThrow("DATABASE_UNAVAILABLE");
    expect(state.analyze).not.toHaveBeenCalled();
    expect(state.transcribe).not.toHaveBeenCalled();
    expect(state.admin).not.toHaveBeenCalled();
  },
);
