import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { CallRecord, Identity } from "@/lib/domain/types";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  identity: {
    userId: "fictional-reviewer",
    workspaceId: "sample-workspace",
    role: "reviewer",
    mode: "live",
  } as Identity,
  anonymous: false,
  deleted: false,
  put: vi.fn(),
}));
vi.mock("@/lib/server/auth", async (original) => ({
  ...(await original<typeof import("@/lib/server/auth")>()),
  requireIdentity: async () => {
    if (state.anonymous)
      throw new (await import("@/lib/server/auth")).AppError(
        "SIGN_IN_REQUIRED",
        401,
      );
    return state.identity;
  },
}));
vi.mock("@/lib/server/repository", () => ({
  Repository: class {
    constructor(readonly identity: Identity) {}
    get = async () => {
      if (
        state.deleted ||
        this.identity.workspaceId !== state.call!.workspaceId
      )
        throw new (await import("@/lib/server/auth")).AppError(
          "CALL_NOT_FOUND",
          404,
        );
      return structuredClone(state.call!);
    };
    put = state.put;
  },
}));
import { POST } from "@/app/api/calls/[callId]/source-review/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  state.anonymous = false;
  state.deleted = false;
  state.identity = {
    userId: "fictional-reviewer",
    workspaceId: "sample-workspace",
    role: "reviewer",
    mode: "live",
  };
  state.call = sampleCall("service", "fictional-call");
  state.call.mode = "live";
  state.call.sourceKind = "synthetic";
  state.call.checksum = "a".repeat(64);
  state.call.sanitizedPath = "sample-workspace/fictional-call.wav";
  state.call.sourcePreparation = {
    checksum: state.call.checksum,
    attestedBy: "fictional-owner",
    at: "2026-10-08T00:00:00Z",
    kind: "synthetic",
  };
  state.put.mockImplementation(async (next: CallRecord, expected: number) => {
    if (state.call!.version !== expected) return false;
    state.call = structuredClone(next);
    return true;
  });
});
afterEach(() => vi.unstubAllEnvs());
const body = {
  version: 1,
  roles: [{ segmentId: "seg-1", speaker: "employee" }],
  completenessVerified: true,
  qualityVerified: true,
  reason: "Reviewed the entire privately prepared fictional conversation.",
};
const request = (input: unknown = body, origin = "http://localhost") =>
  new Request("http://localhost/api/calls/fictional-call/source-review", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
const context = { params: Promise.resolve({ callId: "fictional-call" }) };
it.each(["owner", "reviewer"] as const)(
  "%s can audit prepared source with no-store and preserved originals",
  async (role) => {
    state.identity.role = role;
    const original = structuredClone(state.call!.originalAnalysis);
    const segments = structuredClone(state.call!.segments);
    const result = await POST(request(), context);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(state.call!.score!.grade).toBe(null);
    expect(state.call!.originalAnalysis).toEqual(original);
    expect(state.call!.originalSegments).toEqual(segments);
    expect(state.put).toHaveBeenCalledTimes(1);
  },
);
it.each(["anonymous", "foreign-origin", "other-workspace", "deleted"])(
  "rejects %s without mutation",
  async (kind) => {
    state.anonymous = kind === "anonymous";
    state.deleted = kind === "deleted";
    if (kind === "other-workspace") state.identity.workspaceId = "other";
    const result = await POST(
      request(
        body,
        kind === "foreign-origin" ? "http://foreign.test" : "http://localhost",
      ),
      context,
    );
    expect(result.status).toBe(
      kind === "anonymous" ? 401 : kind === "foreign-origin" ? 403 : 404,
    );
    expect(state.put).not.toHaveBeenCalled();
  },
);
it.each(["flags", "duplicates", "stale"])(
  "rejects malformed/stale %s",
  async (kind) => {
    const input =
      kind === "flags"
        ? { ...body, qualityVerified: "yes" }
        : kind === "duplicates"
          ? { ...body, roles: [body.roles[0], body.roles[0]] }
          : { ...body, version: 2 };
    expect((await POST(request(input), context)).status).toBe(
      kind === "stale" ? 409 : 400,
    );
    expect(state.put).not.toHaveBeenCalled();
  },
);
it.each(["active", "legacy"])(
  "rejects %s source verification",
  async (kind) => {
    if (kind === "active")
      state.call!.processingAttempt = {
        id: "active-attempt",
        state: "running",
        runId: "fictional-run",
      };
    if (kind === "legacy") delete state.call!.sourcePreparation;
    expect((await POST(request(), context)).status).toBe(
      kind === "active" ? 409 : 400,
    );
    expect(state.put).not.toHaveBeenCalled();
  },
);
