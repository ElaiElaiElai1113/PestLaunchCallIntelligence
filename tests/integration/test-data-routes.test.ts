import { beforeEach, expect, it, vi } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { Identity, CallRecord } from "@/lib/domain/types";
const state = vi.hoisted(() => ({
  admin: {} as Record<string, unknown>,
  identity: {
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  } as Identity,
  anonymous: false,
}));
vi.mock("@/lib/supabase/server", () => ({ adminClient: () => state.admin }));
vi.mock("@/lib/server/auth", () => {
  class AppError extends Error {
    constructor(
      readonly code: string,
      readonly status = 400,
    ) {
      super(code);
    }
  }
  return {
    AppError,
    checkOrigin: vi.fn(),
    requireIdentity: async () => {
      if (state.anonymous) throw new AppError("SIGN_IN_REQUIRED", 401);
      return state.identity;
    },
    requireOwner: (identity: Identity) => {
      if (identity.role !== "owner") throw new AppError("OWNER_REQUIRED", 403);
    },
  };
});
import * as route from "@/app/api/test-data/route";
import { Repository } from "@/lib/server/repository";
let calls: CallRecord[],
  tombstones: { call_id: string; workspace_id: string }[],
  receipts: number,
  inventoryFails: boolean,
  objects: Map<string, Set<string>>;
beforeEach(() => {
  state.anonymous = false;
  state.identity.role = "owner";
  const call = sampleCall("service", "fictional-call");
  call.mode = "live";
  call.sourceKind = "synthetic";
  call.sourcePath = `${call.workspaceId}/${call.id}.wav`;
  call.sanitizedPath = call.sourcePath;
  const other = structuredClone(call);
  other.id = "other-workspace-call";
  other.workspaceId = "other-workspace";
  calls = [call, other];
  tombstones = [
    { call_id: "historical-deleted", workspace_id: call.workspaceId },
  ];
  receipts = 0;
  inventoryFails = true;
  objects = new Map(
    ["call-source", "call-sanitized"].map((bucket) => [
      bucket,
      new Set([call.sourcePath!]),
    ]),
  );
  state.admin = {
    from: (table: string) => {
      let field = "",
        value = "";
      const q = {
        select: () => q,
        eq: (key: string, val: string) => {
          field = key;
          value = val;
          return q;
        },
        order: () => q,
        upsert: async (row: { call_id: string; workspace_id: string }) => {
          if (!tombstones.some((x) => x.call_id === row.call_id))
            tombstones.push(row);
          return { error: null };
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            error: null,
            data:
              table === "calls"
                ? calls
                    .filter(
                      (x) =>
                        field !== "workspace_id" || x.workspaceId === value,
                    )
                    .map((x) => ({ payload: structuredClone(x) }))
                : tombstones.filter(
                    (x) => field !== "workspace_id" || x.workspace_id === value,
                  ),
          }).then(resolve),
      };
      return q;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string) =>
          inventoryFails
            ? { error: { message: "fictional inventory failure" }, data: null }
            : {
                error: null,
                data: [...objects.get(bucket)!]
                  .filter((x) => x.startsWith(prefix + "/"))
                  .map((path) => ({
                    id: "fictional-object",
                    name: path.slice(prefix.length + 1),
                  })),
              },
        remove: async (paths: string[]) => {
          paths.forEach((path) => objects.get(bucket)!.delete(path));
          return { error: null };
        },
      }),
    },
    rpc: async (
      _name: string,
      params: { p_id: string; p_workspace: string },
    ) => {
      const before = calls.length;
      calls = calls.filter(
        (c) => c.id !== params.p_id || c.workspaceId !== params.p_workspace,
      );
      if (before !== calls.length) receipts++;
      return { error: null };
    },
  };
});
const request = (body: unknown = { confirmation: "DELETE" }) =>
  new Request("http://localhost/api/test-data", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("bulk retry includes retained tombstones while ordinary access stays hidden", async () => {
  const first = await route.DELETE(request());
  expect(first.status).toBe(503);
  expect(await first.json()).toEqual({ error: "DELETE_STORAGE_FAILED" });
  expect(receipts).toBe(0);
  expect(calls).toHaveLength(2);
  const repo = new Repository(state.identity);
  expect(await repo.list()).toEqual([]);
  await expect(repo.get("fictional-call")).rejects.toThrow("CALL_NOT_FOUND");
  inventoryFails = false;
  const second = await route.DELETE(request());
  expect(second.status).toBe(200);
  expect(await second.json()).toMatchObject({ deleted: 1 });
  expect(calls.map((x) => x.id)).toEqual(["other-workspace-call"]);
  expect(receipts).toBe(1);
  for (const bucket of objects.values()) expect(bucket.size).toBe(0);
  expect(await (await route.DELETE(request())).json()).toMatchObject({
    deleted: 0,
  });
  expect(receipts).toBe(1);
});
it("owner summary counts retained pending rows only and is no-store", async () => {
  await route.DELETE(request());
  const result = await route.GET();
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ retained: 1, pendingDeletion: 1 });
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("continuing inventory failure cannot turn into a successful empty deletion", async () => {
  expect((await route.DELETE(request())).status).toBe(503);
  expect((await route.DELETE(request())).status).toBe(503);
  expect(receipts).toBe(0);
});
it("owner summary and deletion reject reviewers and anonymous callers", async () => {
  state.identity.role = "reviewer";
  expect((await route.GET()).status).toBe(403);
  expect((await route.DELETE(request())).status).toBe(403);
  await expect(
    new Repository(state.identity).retentionSummary(),
  ).rejects.toThrow("OWNER_REQUIRED");
  state.anonymous = true;
  expect((await route.GET()).status).toBe(401);
  expect((await route.DELETE(request())).status).toBe(401);
});
it.each([{}, null, { confirmation: "delete" }])(
  "invalid confirmation never deletes: %j",
  async (body) => {
    expect((await route.DELETE(request(body))).status).toBe(400);
    expect(receipts).toBe(0);
  },
);
