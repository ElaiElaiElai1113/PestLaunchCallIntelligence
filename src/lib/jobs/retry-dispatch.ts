import type { CallRecord } from "../domain/types";
import { randomUUID } from "node:crypto";
import { pendingProcessing } from "../domain/processing-attempt";
export type RetryRepository = {
  get(id: string): Promise<CallRecord>;
  put(call: CallRecord, expectedVersion: number | null): Promise<boolean>;
};
export async function dispatchRetry(
  repo: RetryRepository,
  call: CallRecord,
  startRun: (id: string, attemptId: string) => Promise<void>,
  makeAttemptId: () => string = randomUUID,
) {
  if (call.processingAttempt?.state === "running")
    throw new Error("RETRY_UNAVAILABLE");
  const attemptId = pendingProcessing(call)
    ? call.processingAttempt!.id
    : makeAttemptId();
  const previous = call.version;
  const queued: CallRecord = {
    ...structuredClone(call),
    status: call.segments.length ? "analyzing" : "queued",
    errorCode: "PROCESSING_START_PENDING",
    processingAttempt: { id: attemptId, state: "pending", runId: null },
    version: previous + 1,
  };
  if (!(await repo.put(queued, previous))) throw new Error("CONFLICT");
  try {
    await startRun(call.id, attemptId);
  } catch {
    try {
      const latest = await repo.get(call.id);
      if (
        latest.version === queued.version &&
        latest.processingAttempt?.id === attemptId &&
        pendingProcessing(latest)
      ) {
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
