import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  start: vi.fn(),
  put: vi.fn(),
}));
vi.mock("workflow/api", () => ({ start: state.start }));
vi.mock("@/workflows/process-call", () => ({ processCall: vi.fn() }));
vi.mock("@/lib/server/repository", () => ({
  Repository: class {
    get = async () => structuredClone(state.call!);
    put = state.put;
  },
}));
vi.mock("@/lib/server/auth", () => ({
  checkOrigin: vi.fn(),
  requireOwner: vi.fn(),
  requireIdentity: async () => ({
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  }),
  AppError: class extends Error {
    constructor(
      readonly code: string,
      readonly status = 400,
    ) {
      super(code);
    }
  },
}));
import { POST as retry } from "@/app/api/calls/[callId]/retry/route";
import { POST as review } from "@/app/api/calls/[callId]/review/route";
const context = { params: Promise.resolve({ callId: "fictional-call" }) };
beforeEach(() => {
  vi.resetAllMocks();
  state.call = sampleCall("service", "fictional-call");
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    status: "failed",
    errorCode: "ANALYSIS_FAILED",
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription quality needs review."],
  });
  state.put.mockImplementation(async (call: CallRecord, version: number) => {
    if (state.call!.version !== version) return false;
    state.call = structuredClone(call);
    return true;
  });
});
afterEach(() => vi.unstubAllEnvs());
it("dispatch failure returns a safe 503 and leaves retryable persisted state", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockRejectedValue(new Error("fictional private workflow detail"));
  const result = await retry(
    new Request("http://localhost/api/calls/fictional-call/retry", {
      method: "POST",
    }),
    context,
  );
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "PROCESSING_START_FAILED" });
  expect(state.call).toMatchObject({
    status: "failed",
    errorCode: "PROCESSING_START_FAILED",
    transcriptCompleteness: "unverified",
  });
});
it("a reviewer reason cannot certify unknown-speaker employee evidence", async () => {
  state.call!.segments.forEach((segment) => (segment.speaker = "unknown"));
  const original = structuredClone(state.call!.originalAnalysis);
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        checkpointId: "validate",
        status: "passed",
        reason: "A fictional reviewer says this is correct.",
      }),
    }),
    context,
  );
  expect(result.status).toBe(400);
  expect(await result.json()).toEqual({ error: "ATTRIBUTION_REVIEW_REQUIRED" });
  expect(state.put).not.toHaveBeenCalled();
  expect(state.call!.originalAnalysis).toEqual(original);
});
it("a supported live correction cannot clear completeness or independent quality reasons", async () => {
  const original = structuredClone(state.call!.originalAnalysis);
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        checkpointId: "validate",
        status: "passed",
        reason: "Fictional employee quote supports this checkpoint.",
      }),
    }),
    context,
  );
  expect(result.status).toBe(200);
  expect(state.call!.score!.grade).toBe(null);
  expect(state.call!.analysis!.reviewReasons).toContain(
    "Transcription quality needs review.",
  );
  expect(state.call!.originalAnalysis).toEqual(original);
});
