import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { CallRecord, Identity } from "@/lib/domain/types";
const state = vi.hoisted(() => ({
  identity: {
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  } as Identity,
  list: vi.fn(),
  put: vi.fn(),
}));
vi.mock("@/lib/server/auth", async (original) => ({
  ...(await original<typeof import("@/lib/server/auth")>()),
  requireIdentity: async () => state.identity,
}));
vi.mock("@/lib/server/repository", () => ({
  Repository: class {
    list = state.list;
    put = state.put;
  },
}));
import { POST } from "@/app/api/calls/upload-intent/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  vi.stubEnv("REAL_CALL_PROCESSING_ENABLED", "false");
  state.identity = {
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  };
  state.list.mockResolvedValue([]);
  state.put.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());
const input = () => ({
  label: "Fictional metadata-only route fixture",
  sourceKind: "real",
  sanitized: true,
  bytes: 1000,
  durationMs: 1000,
  checksum: "a".repeat(64),
  extension: "wav",
  recordedAt: null,
  rep: null,
  direction: null,
});
const request = (body: unknown = input(), origin = "http://localhost") =>
  new Request("http://localhost/api/calls/upload-intent", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
it("admits owner recordings without a privacy attestation or legacy switch", async () => {
  const body: Partial<ReturnType<typeof input>> = input();
  delete body.sanitized;
  const response = await POST(request(body));
  expect(response.status).toBe(200);
  expect(state.put).toHaveBeenCalledTimes(1);
});
it("owner upload binds exact checksum/workspace without declaring privacy verification or starting AI", async () => {
  vi.stubEnv("REAL_CALL_PROCESSING_ENABLED", "true");
  const response = await POST(request());
  expect(response.status).toBe(200);
  const result = await response.json();
  const call = state.put.mock.calls[0][0] as CallRecord;
  expect(result.path).toBe(`sample-workspace/${result.callId}.wav`);
  expect(call).toMatchObject({
    workspaceId: "sample-workspace",
    sourceKind: "real",
    errorCode: "UPLOAD_PENDING",
    sourcePath: result.path,
    segments: [],
    analysis: null,
    score: null,
  });
  expect(call.sourceBinding).toMatchObject({
    checksum: input().checksum,
    boundBy: "fictional-owner",
  });
  expect(call.sourcePreparation).toBeUndefined();
  expect(state.put).toHaveBeenCalledWith(call, null);
});
it("does not guess original metadata from upload time", async () => {
  vi.stubEnv("REAL_CALL_PROCESSING_ENABLED", "true");
  await POST(request());
  const call = state.put.mock.calls[0][0] as CallRecord;
  expect(call.recordedAt).toBeNull();
  expect(call.rep).toBeNull();
  expect(call.direction).toBeNull();
});
it("fictional source admission remains available without enabling actual customer processing", async () => {
  const response = await POST(request({ ...input(), sourceKind: "synthetic" }));
  expect(response.status).toBe(200);
  expect((state.put.mock.calls[0][0] as CallRecord).sourceKind).toBe(
    "synthetic",
  );
});
it("a reviewer cannot create an upload even if customer processing is enabled", async () => {
  vi.stubEnv("REAL_CALL_PROCESSING_ENABLED", "true");
  state.identity.role = "reviewer";
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "OWNER_REQUIRED" });
  expect(state.put).not.toHaveBeenCalled();
});
it("foreign-origin input is refused before upload creation", async () => {
  const response = await POST(request(input(), "https://example.invalid"));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "INVALID_ORIGIN" });
  expect(state.put).not.toHaveBeenCalled();
});
it.each([
  { bytes: 25_000_001 },
  { durationMs: 3_600_001 },
  { sourceKind: "" },
  { extension: "exe" },
])("rejects inadmissible upload metadata %j", async (changes) => {
  vi.stubEnv("REAL_CALL_PROCESSING_ENABLED", "true");
  const response = await POST(request({ ...input(), ...changes }));
  expect(response.status).toBe(400);
  expect(state.put).not.toHaveBeenCalled();
});
