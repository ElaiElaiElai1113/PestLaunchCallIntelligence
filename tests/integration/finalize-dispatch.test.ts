import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  start: vi.fn(),
  put: vi.fn(),
  upsert: vi.fn(),
  download: vi.fn(),
}));
vi.mock("workflow/api", () => ({ start: state.start }));
vi.mock("@/workflows/process-call", () => ({ processCall: vi.fn() }));
vi.mock("@/lib/server/repository", () => ({
  Repository: class {
    get = async () => structuredClone(state.call!);
    put = state.put;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({
    storage: { from: () => ({ download: state.download }) },
    from: () => ({ upsert: state.upsert }),
  }),
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
import { POST } from "@/app/api/calls/finalize/route";
const id = "20000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  const bytes = Buffer.from("RIFF0000WAVEfictional-contract-bytes");
  state.call = sampleCall("service", id);
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    status: "queued",
    errorCode: "UPLOAD_PENDING",
    segments: [],
    analysis: null,
    originalAnalysis: null,
    score: null,
    sourcePath: `sample-workspace/${id}.wav`,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  });
  state.download.mockResolvedValue({
    error: null,
    data: new Blob([bytes], { type: "audio/wav" }),
  });
  state.put.mockImplementation(async (call: CallRecord, version: number) => {
    if (state.call!.version !== version) return false;
    state.call = structuredClone(call);
    return true;
  });
  state.upsert.mockResolvedValue({ error: null });
  state.start.mockResolvedValue({ runId: "fictional-run" });
});
afterEach(() => vi.unstubAllEnvs());
const request = () =>
  new Request("http://localhost/api/calls/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callId: id }),
  });
it("finalize persists a pending attempt before starting and does not depend on run-ID upsert", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockImplementation(async (_workflow, args) => {
    expect(state.call!.processingAttempt).toMatchObject({
      id: args[1],
      state: "pending",
      runId: null,
    });
    return { runId: "fictional-run" };
  });
  expect((await POST(request())).status).toBe(200);
  expect(state.upsert).not.toHaveBeenCalled();
  expect(state.call!.analysis).toBe(null);
});
it("failed start does not reopen source upload or erase durable pending intent", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockRejectedValue(new Error("fictional private start exception"));
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "PROCESSING_START_FAILED" });
  expect(state.call!.errorCode).not.toBe("UPLOAD_PENDING");
  expect(state.call!.processingAttempt?.state).toBe("pending");
});
it("keyless finalize invents no attempt or analysis and dispatches nothing", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  const result = await POST(request());
  expect(await result.json()).toMatchObject({ processing: "awaiting_ai" });
  expect(state.call!.processingAttempt).toBeUndefined();
  expect(state.call!.analysis).toBe(null);
  expect(state.start).not.toHaveBeenCalled();
});
it("a finalization conflict never dispatches", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.put.mockResolvedValue(false);
  expect((await POST(request())).status).toBe(409);
  expect(state.start).not.toHaveBeenCalled();
});
