import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { CallRecord, Identity } from "@/lib/domain/types";
import { guardAssessment } from "@/lib/domain/assessment-guards";
import { applySourceReview } from "@/lib/domain/source-review";
import { recoveryCall } from "../helpers/recovery-call";
import { analysisRecovery } from "@/lib/groq/analysis-recovery";
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
import { POST as retry } from "@/app/api/calls/[callId]/retry/route";
import { POST as reviewSource } from "@/app/api/calls/[callId]/source-review/route";
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
async function saveSource(unknown = false) {
  const call = state.call!;
  return reviewSource(
    new Request("http://localhost/api/calls/fictional-call/source-review", {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: call.version,
        roles: call.segments.map((s) => ({
          segmentId: s.id,
          speaker: unknown ? "unknown" : s.speaker,
        })),
        completenessVerified: true,
        qualityVerified: true,
        reason:
          "Fictional reviewed source correction without provider request.",
      }),
    }),
    context,
  );
}
const retryRequest = () =>
  new Request("http://localhost/api/calls/fictional-call/retry", {
    method: "POST",
    headers: { Origin: "http://localhost" },
  });
it.each(["missing", "checksum", "media", "budget"])(
  "retry refuses %s input before mutation or dispatch",
  async (kind) => {
    state.call = recoveryCall();
    vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
    if (kind === "missing") delete state.call.sourcePreparation;
    if (kind === "checksum")
      state.call.sourcePreparation!.checksum = "b".repeat(64);
    if (kind === "media") state.call.sanitizedPath = null;
    if (kind === "budget")
      state.call.segments[0].text = "Fictional long context. ".repeat(1000);
    const before = structuredClone(state.call);
    state.put.mockClear();
    const response = await retry(retryRequest(), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        kind === "budget"
          ? "ANALYSIS_BUDGET_EXCEEDED"
          : "SOURCE_PREPARATION_REQUIRED",
    });
    expect(state.start).not.toHaveBeenCalled();
    expect(state.put).not.toHaveBeenCalled();
    expect(state.model).not.toHaveBeenCalled();
    expect(state.call).toEqual(before);
  },
);
it("valid transcript pending-start retry preserves its ownership intent", async () => {
  state.call = recoveryCall();
  state.call.status = "analyzing";
  state.call.errorCode = "PROCESSING_START_PENDING";
  state.call.processingAttempt = {
    id: "same-pending",
    state: "pending",
    runId: null,
  };
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockResolvedValue({ runId: "not-executed" });
  expect((await retry(retryRequest(), context)).status).toBe(200);
  expect(state.start).toHaveBeenCalledWith(expect.anything(), [
    "fictional-call",
    "same-pending",
  ]);
  expect(state.model).not.toHaveBeenCalled();
});
it("retry admission uses the revised audited transcript while preserving its pending attempt", async () => {
  state.call = recoveryCall();
  state.call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
  expect(analysisRecovery(state.call, false).budget).toBe("admitted");
  expect((await saveSource(true)).status).toBe(200);
  state.call!.status = "failed";
  state.call!.errorCode = "PROCESSING_START_FAILED";
  state.call!.processingAttempt = {
    id: "revised-pending",
    state: "pending",
    runId: null,
  };
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockResolvedValue({ runId: "not-executed" });
  expect((await retry(retryRequest(), context)).status).toBe(200);
  expect(state.start).toHaveBeenCalledWith(expect.anything(), [
    "fictional-call",
    "revised-pending",
  ]);
  expect(state.model).not.toHaveBeenCalled();
  expect(state.call!.analysis).toBeNull();
});
it("current-result retry restores status without another provider or storage effect", async () => {
  const fixture = sampleCall("service", "fictional-call");
  state.call = recoveryCall();
  state.call.analysis = fixture.analysis;
  state.call.originalAnalysis = fixture.originalAnalysis;
  state.call.score = fixture.score;
  state.call.analysisSourceRevision = 0;
  delete state.call.sourcePreparation;
  state.call.checksum = null;
  state.call.sanitizedPath = null;
  const result = structuredClone(state.call.analysis);
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  expect((await retry(retryRequest(), context)).status).toBe(200);
  expect(state.model).not.toHaveBeenCalled();
  expect(state.call!.analysis).toEqual(result);
  expect(state.call!.processingAttempt?.state).toBe("finished");
});
it("validated initial-audio resume does not require a transcript derivative or analysis budget", async () => {
  state.call = recoveryCall();
  state.call.segments = [];
  state.call.sourcePath = "sample-workspace/fictional-call.wav";
  state.call.sanitizedPath = null;
  state.call.errorCode = "AI_NOT_CONFIGURED";
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockResolvedValue({ runId: "not-executed" });
  expect((await retry(retryRequest(), context)).status).toBe(200);
  expect(state.model).not.toHaveBeenCalled();
  expect(state.call!.analysis).toBeNull();
});
it("actual source-review transition leaves first analysis startable but never auto-dispatches", async () => {
  state.call = recoveryCall();
  state.start.mockResolvedValue({ runId: "not-executed" });
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  expect((await saveSource()).status).toBe(200);
  expect(state.call!.analysis).toBeNull();
  expect(state.start).not.toHaveBeenCalled();
  expect(state.call!.status).toBe("needs_review");
  expect((await POST(request(state.call!.version), context)).status).toBe(200);
  expect(state.start).toHaveBeenCalledTimes(1);
  expect(state.model).not.toHaveBeenCalled();
  expect(state.call!.analysis).toBeNull();
  expect(state.call!.score).toBeNull();
});
it("a genuinely oversized source cannot dispatch before or after role review", async () => {
  state.call = recoveryCall();
  state.call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
  state.call.segments[0].text = "Fictional context. ".repeat(1200);
  expect(analysisRecovery(state.call, false).budget).toBe("exceeded");
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockResolvedValue({ runId: "not-executed" });
  state.put.mockClear();
  const oldSource = structuredClone(state.call);
  const refused = await POST(request(state.call.version), context);
  expect(refused.status).toBe(400);
  expect(await refused.json()).toEqual({ error: "ANALYSIS_BUDGET_EXCEEDED" });
  expect(state.start).not.toHaveBeenCalled();
  expect(state.put).not.toHaveBeenCalled();
  expect(state.call).toEqual(oldSource);
  expect((await saveSource(true)).status).toBe(200);
  expect(state.call!.errorCode).toBe("ANALYSIS_BUDGET_EXCEEDED");
  expect(state.call!.sourceReviews!.at(-1)?.previousErrorCode).toBe(
    "ANALYSIS_BUDGET_EXCEEDED",
  );
  expect((await POST(request(state.call!.version), context)).status).toBe(400);
  expect(state.start).not.toHaveBeenCalled();
  expect(state.model).not.toHaveBeenCalled();
  expect(state.call!.analysis).toBeNull();
});
it.each(["reviewer", "privacy", "preparation", "active"])(
  "first-analysis recovery preserves %s restriction",
  async (kind) => {
    state.call = recoveryCall();
    vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
    state.start.mockResolvedValue({ runId: "not-executed" });
    if (kind === "reviewer") state.identity.role = "reviewer";
    if (kind === "privacy") state.call.status = "privacy_review";
    if (kind === "preparation") state.call.sanitizedPath = null;
    if (kind === "active") state.call.status = "analyzing";
    expect((await POST(request(state.call.version), context)).status).toBe(
      kind === "reviewer" ? 403 : kind === "active" ? 409 : 400,
    );
    expect(state.start).not.toHaveBeenCalled();
    expect(state.put).not.toHaveBeenCalled();
  },
);
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
    points: 10,
    denominator: 12,
    grade: null,
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
