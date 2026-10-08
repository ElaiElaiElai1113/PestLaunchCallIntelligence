import { expect, it, vi } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import {
  deleteCallMedia,
  type StoragePort,
} from "@/lib/server/storage-cleanup";

function setup() {
  const call = sampleCall("service", "fictional-call");
  call.sourcePath = `${call.workspaceId}/${call.id}.wav`;
  call.sanitizedPath = `${call.workspaceId}/${call.id}.wav`;
  const buckets = new Map(
    ["call-source", "call-sanitized"].map((bucket) => [
      bucket,
      new Map(
        [
          `${call.id}.wav`,
          `${call.id}.mp3`,
          `${call.id}.extra.wav`,
          "other-call.wav",
        ].map((name) => [name, "object-id" as string | null]),
      ),
    ]),
  );
  const port: StoragePort = {
    list: vi.fn(async (bucket, _prefix, offset, limit) =>
      [...buckets.get(bucket)!]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(offset, offset + limit)
        .map(([name, id]) => ({ name, id })),
    ),
    remove: vi.fn(async (bucket: string, paths: string[]) => {
      paths.forEach((path) =>
        buckets.get(bucket)!.delete(path.slice(call.workspaceId.length + 1)),
      );
    }),
  };
  return { call, buckets, port };
}
it("removes registered and alternative owned copies from both buckets only", async () => {
  const { call, port, buckets } = setup();
  await deleteCallMedia(port, call);
  for (const bucket of buckets.values())
    expect([...bucket.keys()]).toEqual(["other-call.wav"]);
});
it("inventories page two before removing copies", async () => {
  const { call, port, buckets } = setup();
  for (let i = 0; i < 110; i++)
    buckets.get("call-source")!.set(`a-other-${i}`, "object-id");
  await deleteCallMedia(port, call);
  expect(port.list).toHaveBeenCalledWith(
    "call-source",
    call.workspaceId,
    100,
    100,
  );
  expect(buckets.get("call-source")!.size).toBe(111);
});
it("propagates a remove failure rather than certifying cleanup", async () => {
  const { call, port } = setup();
  port.remove = vi.fn().mockRejectedValue(new Error("DELETE_STORAGE_FAILED"));
  await expect(deleteCallMedia(port, call)).rejects.toThrow(
    "DELETE_STORAGE_FAILED",
  );
});
it("rejects a surviving object", async () => {
  const { call, port } = setup();
  port.remove = vi.fn(async () => {});
  await expect(deleteCallMedia(port, call)).rejects.toThrow(
    "DELETE_STORAGE_FAILED",
  );
});
it("rejects a matching folder without deleting unrelated folders", async () => {
  const { call, port, buckets } = setup();
  buckets.get("call-source")!.set(call.id, null);
  await expect(deleteCallMedia(port, call)).rejects.toThrow(
    "DELETE_STORAGE_FAILED",
  );
  expect(port.remove).not.toHaveBeenCalled();
});
it("rejects registered paths outside the call workspace", async () => {
  const { call, port } = setup();
  call.sourcePath = "another-workspace/fictional-call.wav";
  await expect(deleteCallMedia(port, call)).rejects.toThrow(
    "DELETE_STORAGE_FAILED",
  );
  expect(port.remove).not.toHaveBeenCalled();
});
