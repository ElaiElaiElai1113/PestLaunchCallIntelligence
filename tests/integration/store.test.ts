import { it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SampleStore } from "@/lib/server/store";
import type { CallRecord } from "@/lib/domain/types";
let folder: string, store: SampleStore;
const call = (): CallRecord => ({
  id: "sample-1",
  workspaceId: "sample-workspace",
  label: "Fictional test",
  mode: "sample",
  status: "queued",
  uploadedAt: "2026-01-01T00:00:00Z",
  recordedAt: null,
  rep: null,
  direction: null,
  durationMs: 1000,
  version: 1,
  sourcePath: null,
  checksum: null,
  errorCode: null,
  segments: [],
  analysis: null,
  originalAnalysis: null,
  score: null,
  decisions: [],
});
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "pestlaunch-synthetic-"));
  store = new SampleStore(join(folder, "state.json"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});
it("persists across repository instances", async () => {
  expect(await store.put(call(), null)).toBe(true);
  expect((await new SampleStore(store.path).list())[0].id).toBe("sample-1");
});
it("allows only one concurrent correction of a version", async () => {
  await store.put(call(), null);
  const updated = { ...call(), version: 2 };
  const results = await Promise.all([
    store.put(updated, 1),
    store.put(updated, 1),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
});
it("a deletion tombstone prevents a late job recreating content", async () => {
  await store.put(call(), null);
  expect(await store.delete("sample-1")).toBe(true);
  expect(await store.put({ ...call(), version: 2 }, 1)).toBe(false);
  expect(await store.put(call(), null)).toBe(false);
  expect(await store.list()).toEqual([]);
});
it("refuses real call data in the fictional sample store", async () => {
  expect(await store.put({ ...call(), mode: "live" }, null)).toBe(false);
});
