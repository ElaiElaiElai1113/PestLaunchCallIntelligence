import type { CallRecord } from "../domain/types";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
type State = {
  calls: CallRecord[];
  deleted: string[];
  receipts: { at: string; count: number }[];
};
const locks = new Map<string, Promise<unknown>>();
export class SampleStore {
  constructor(readonly path: string) {}
  private async read(): Promise<State> {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { calls: [], deleted: [], receipts: [] };
      throw e;
    }
  }
  private async mutate<T>(fn: (state: State) => T): Promise<T> {
    const previous = locks.get(this.path) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const state = await this.read();
        const result = fn(state);
        await mkdir(dirname(this.path), { recursive: true });
        const temp = `${this.path}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
        await rename(temp, this.path);
        return result;
      });
    locks.set(this.path, next);
    try {
      return await next;
    } finally {
      if (locks.get(this.path) === next) locks.delete(this.path);
    }
  }
  async list(): Promise<CallRecord[]> {
    await locks.get(this.path);
    return (await this.read()).calls;
  }
  async put(
    call: CallRecord,
    expectedVersion: number | null,
  ): Promise<boolean> {
    if (call.mode !== "sample") return false;
    return this.mutate((state) => {
      const index = state.calls.findIndex((x) => x.id === call.id);
      if (state.deleted.includes(call.id)) return false;
      if (expectedVersion === null) {
        if (index >= 0) return false;
        state.calls.push(call);
      } else {
        if (index < 0 || state.calls[index].version !== expectedVersion)
          return false;
        state.calls[index] = call;
      }
      return true;
    });
  }
  async delete(id: string): Promise<boolean> {
    return this.mutate((state) => {
      const before = state.calls.length;
      state.calls = state.calls.filter((x) => x.id !== id);
      state.deleted.push(id);
      const removed = before !== state.calls.length;
      if (removed)
        state.receipts.push({ at: new Date().toISOString(), count: 1 });
      return removed;
    });
  }
}
