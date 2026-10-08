import type { CallRecord } from "../domain/types";
export type RetryRepository = {
  get(id: string): Promise<CallRecord>;
  put(call: CallRecord, expectedVersion: number | null): Promise<boolean>;
};
export async function dispatchRetry(
  repo: RetryRepository,
  call: CallRecord,
  startRun: (id: string) => Promise<void>,
) {
  const previous = call.version;
  const queued: CallRecord = {
    ...structuredClone(call),
    status: call.segments.length ? "analyzing" : "queued",
    errorCode: null,
    version: previous + 1,
  };
  if (!(await repo.put(queued, previous))) throw new Error("CONFLICT");
  try {
    await startRun(call.id);
  } catch {
    try {
      const latest = await repo.get(call.id);
      if (latest.version === queued.version) {
        await repo.put(
          {
            ...latest,
            status: "failed",
            errorCode: "PROCESSING_START_FAILED",
            version: latest.version + 1,
          },
          latest.version,
        );
      }
    } catch {
      // Never reconstruct deleted/unavailable content from the dispatch snapshot.
    }
    throw new Error("PROCESSING_START_FAILED");
  }
}
