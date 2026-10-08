import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { CallRecord, Identity } from "@/lib/domain/types";
import { guardAssessment } from "@/lib/domain/assessment-guards";
import { applySourceReview } from "@/lib/domain/source-review";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  identity: {
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  } as Identity,
  model: vi.fn(),
  start: vi.fn(),
  runId: "first-run",
  put: vi.fn(),
}));
vi.mock("workflow", async (original) => ({
  ...(await original<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: state.runId }),
}));
vi.mock("workflow/api", () => ({ start: state.start }));
vi.mock("@/lib/server/auth", async (original) => ({
  ...(await original<typeof import("@/lib/server/auth")>()),
  requireIdentity: async () => state.identity,
}));
vi.mock("@/lib/server/repository", () => {
  class Repository {
    get = async () => {
      if (!state.call || state.call.workspaceId !== state.identity.workspaceId)
        throw new Error("CALL_NOT_FOUND");
      return structuredClone(state.call);
    };
    put = state.put;
  }
  return { Repository, systemRepository: async () => new Repository() };
});
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => {
    throw new Error("UNEXPECTED_STORAGE_EFFECT");
  },
}));
vi.mock("@/lib/groq/provider", () => ({
  GroqProvider: class {
    analyze = state.model;
  },
}));
import { processCall } from "@/workflows/process-call";
import { POST } from "@/app/api/calls/[callId]/reanalyze/route";
const context = { params: Promise.resolve({ callId: "fictional-call" }) };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  vi.stubEnv("GROQ_API_KEY", "");
  state.runId = "first-run";
  state.identity = {
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  };
  state.call = sampleCall("service", "fictional-call");
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    analysis: null,
    originalAnalysis: null,
    score: null,
    status: "analyzing",
    sourceRevision: 0,
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription completeness needs review."],
    checksum: "a".repeat(64),
    sanitizedPath: "sample-workspace/fictional-call.wav",
    sourcePreparation: {
      checksum: "a".repeat(64),
      attestedBy: "fictional-owner",
      at: "2026-10-08T00:00:00Z",
      kind: "synthetic",
    },
    processingAttempt: { id: "first-attempt", state: "pending", runId: null },
  });
  state.call!.segments.forEach((segment) => (segment.speaker = "unknown"));
  state.call!.originalSegments = structuredClone(state.call!.segments);
  state.call!.originalSegmentsProvenance = "asr";
  state.put.mockImplementation(async (next: CallRecord, expected: number) => {
    if (!state.call || state.call.version !== expected) return false;
    state.call = structuredClone(next);
    return true;
  });
  state.model.mockImplementation(async (segments, context) => {
    const raw = sampleCall("service", "raw-fixture").originalAnalysis!;
    if (state.runId === "second-run")
      raw.summary = "Verified-source fictional analysis.";
    return {
      original: raw,
      effective: guardAssessment(raw, segments, context),
    };
  });
  state.start.mockImplementation(async (_workflow, args) => {
    state.runId = "second-run";
    await processCall(args[0], args[1]);
    return { runId: state.runId };
  });
});
afterEach(() => vi.unstubAllEnvs());
const request = (version: number) =>
  new Request("http://localhost/api/calls/fictional-call/reanalyze", {
    method: "POST",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
async function verified() {
  await processCall("fictional-call", "first-attempt");
  const roles = sampleCall("service", "roles").segments.map((x) => ({
    segmentId: x.id,
    speaker: x.speaker,
  }));
  state.call = applySourceReview(
    state.call!,
    {
      version: state.call!.version,
      roles,
      completenessVerified: true,
      qualityVerified: true,
      reason: "Reviewed the entire privately prepared fictional source.",
    },
    {
      id: "fictional-review",
      userId: "fictional-reviewer",
      at: "2026-10-08T00:00:00Z",
    },
  );
}
it("unknown ASR to audited roles to provider re-analysis preserves first raw/model and source", async () => {
  await processCall("fictional-call", "first-attempt");
  expect(state.call!.score!.grade).toBe(null);
  expect(state.call!.analysis!.coaching).toEqual([]);
  const raw = structuredClone(state.call!.originalAnalysis),
    asr = structuredClone(state.call!.originalSegments);
  const roles = sampleCall("service", "roles").segments.map((x) => ({
    segmentId: x.id,
    speaker: x.speaker,
  }));
  state.call = applySourceReview(
    state.call!,
    {
      version: state.call!.version,
      roles,
      completenessVerified: true,
      qualityVerified: true,
      reason: "Verified the fictional prepared recording and transcript.",
    },
    {
      id: "fictional-review",
      userId: "fictional-reviewer",
      at: "2026-10-08T00:00:00Z",
    },
  );
  expect(state.call!.score!.grade).toBe(null);
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  const result = await POST(request(state.call!.version), context);
  expect(result.status).toBe(200);
  expect(state.model).toHaveBeenCalledTimes(2);
  expect(state.model).toHaveBeenLastCalledWith(state.call!.segments, {
    transcriptComplete: true,
  });
  expect(state.call!.score).toMatchObject({
    points: 11,
    denominator: 12,
    grade: "green",
  });
  expect(state.call!.analysis!.coaching).toHaveLength(2);
  expect(state.call!.originalAnalysis).toEqual(raw);
  expect(state.call!.originalSegments).toEqual(asr);
  expect(state.call!.latestModelAnalysis!.summary).toBe(
    "Verified-source fictional analysis.",
  );
  expect(state.call!.analysisSourceRevision).toBe(state.call!.sourceRevision);
});
it("keyless re-analysis has no dispatch/mutation or synthetic substitute", async () => {
  await verified();
  state.put.mockClear();
  const response = await POST(request(state.call!.version), context);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "AI_NOT_CONFIGURED" });
  expect(state.start).not.toHaveBeenCalled();
  expect(state.put).not.toHaveBeenCalled();
});
it("only owners can initiate re-analysis and stale versions cannot dispatch", async () => {
  await verified();
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.identity.role = "reviewer";
  expect((await POST(request(state.call!.version), context)).status).toBe(403);
  state.identity.role = "owner";
  expect((await POST(request(1), context)).status).toBe(409);
  expect(state.start).not.toHaveBeenCalled();
});
