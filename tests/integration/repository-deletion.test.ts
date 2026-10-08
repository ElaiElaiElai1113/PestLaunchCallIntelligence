import { expect, it, vi, beforeEach } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
const state = vi.hoisted(() => ({ admin: {} as Record<string, unknown> }));
vi.mock("@/lib/supabase/server", () => ({ adminClient: () => state.admin }));
vi.mock("@/lib/server/auth", () => ({
  AppError: class extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
}));
import { Repository } from "@/lib/server/repository";
beforeEach(() => vi.clearAllMocks());
it.each(["list", "remove", "survivor", "folder"])(
  "retains tombstone and row without receipt on %s cleanup failure",
  async (failure) => {
    const call = sampleCall("service", "fictional-call");
    call.mode = "live";
    call.sourcePath = `${call.workspaceId}/${call.id}.wav`;
    const tombstone = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async () => ({ error: null }));
    state.admin = {
      from: () => ({ upsert: tombstone }),
      rpc,
      storage: {
        from: () => ({
          list: async () =>
            failure === "list"
              ? { error: { message: "fictional failure" }, data: null }
              : {
                  error: null,
                  data: [
                    {
                      name: `${call.id}.wav`,
                      id: failure === "folder" ? null : "object",
                    },
                  ],
                },
          remove: async () => ({
            error:
              failure === "remove" ? { message: "fictional failure" } : null,
          }),
        }),
      },
    };
    const repo = new Repository({
      userId: "fictional-owner",
      role: "owner",
      mode: "live",
      workspaceId: call.workspaceId,
    });
    vi.spyOn(repo, "get").mockResolvedValue(call);
    await expect(repo.delete(call.id)).rejects.toThrow("DELETE_STORAGE_FAILED");
    expect(tombstone).toHaveBeenCalledWith(
      { call_id: call.id, workspace_id: call.workspaceId },
      { onConflict: "call_id" },
    );
    expect(rpc).not.toHaveBeenCalled();
  },
);
