import { join } from "node:path";
import type { CallRecord, Identity } from "../domain/types";
import { adminClient } from "../supabase/server";
import { SampleStore } from "./store";
import { AppError } from "./auth";
const sampleStore = () =>
  new SampleStore(join(process.cwd(), ".private", "app", "samples.json"));
export class Repository {
  constructor(readonly identity: Identity) {}
  async list(includeDeleting = false): Promise<CallRecord[]> {
    if (this.identity.mode === "sample")
      return (await sampleStore().list())
        .filter((x) => x.workspaceId === this.identity.workspaceId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const { data, error } = await adminClient()
      .from("calls")
      .select("payload")
      .eq("workspace_id", this.identity.workspaceId)
      .order("uploaded_at", { ascending: false });
    if (error) throw new AppError("DATABASE_UNAVAILABLE", 503);
    if (includeDeleting) return (data ?? []).map((x) => x.payload);
    const tombstones = await adminClient()
      .from("deletion_tombstones")
      .select("call_id")
      .eq("workspace_id", this.identity.workspaceId);
    if (tombstones.error) throw new AppError("DATABASE_UNAVAILABLE", 503);
    const deleted = new Set((tombstones.data ?? []).map((x) => x.call_id));
    return (data ?? [])
      .map((x) => x.payload)
      .filter((call) => !deleted.has(call.id));
  }
  async get(id: string, includeDeleting = false) {
    const call = (await this.list(includeDeleting)).find((x) => x.id === id);
    if (!call) throw new AppError("CALL_NOT_FOUND", 404);
    return call;
  }
  async put(call: CallRecord, expectedVersion: number | null) {
    if (
      call.workspaceId !== this.identity.workspaceId ||
      call.mode !== this.identity.mode
    )
      throw new AppError("ACCESS_DENIED", 403);
    if (this.identity.mode === "sample")
      return sampleStore().put(call, expectedVersion);
    const { data, error } = await adminClient().rpc("save_call", {
      p_id: call.id,
      p_workspace: call.workspaceId,
      p_expected: expectedVersion,
      p_payload: call,
    });
    if (error) throw new AppError("DATABASE_UNAVAILABLE", 503);
    return data === true;
  }
  async delete(id: string) {
    if (this.identity.role !== "owner")
      throw new AppError("OWNER_REQUIRED", 403);
    const call = await this.get(id, true);
    if (this.identity.mode === "sample") return sampleStore().delete(id);
    const client = adminClient();
    // Tombstone first. A failed object cleanup remains visible for a safe retry.
    const { error: tombstoneError } = await client
      .from("deletion_tombstones")
      .upsert(
        { call_id: id, workspace_id: call.workspaceId },
        { onConflict: "call_id" },
      );
    if (tombstoneError) throw new AppError("DELETE_FAILED", 503);
    if (call.sourcePath) {
      const { error } = await client.storage
        .from("call-source")
        .remove([call.sourcePath]);
      if (error) throw new AppError("DELETE_STORAGE_FAILED", 503);
    }
    if (call.sanitizedPath) {
      const { error } = await client.storage
        .from("call-sanitized")
        .remove([call.sanitizedPath]);
      if (error) throw new AppError("DELETE_STORAGE_FAILED", 503);
    }
    const { error } = await client.rpc("delete_call", {
      p_id: id,
      p_workspace: call.workspaceId,
    });
    if (error) throw new AppError("DELETE_FAILED", 503);
    return true;
  }
}
export async function systemRepository(callId: string) {
  const { data, error } = await adminClient()
    .from("calls")
    .select("workspace_id")
    .eq("id", callId)
    .maybeSingle();
  if (error || !data) throw new AppError("CALL_NOT_FOUND", 404);
  return new Repository({
    userId: "workflow",
    workspaceId: data.workspace_id,
    role: "owner",
    mode: "live",
  });
}
