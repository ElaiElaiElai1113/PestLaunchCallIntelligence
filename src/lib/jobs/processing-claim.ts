import { ownsProcessing } from "../domain/processing-attempt";
import type { RetryRepository } from "./retry-dispatch";
export async function claimProcessingAttempt(
  repo: RetryRepository,
  callId: string,
  attemptId: string,
  runId: string,
): Promise<boolean> {
  const call = await repo.get(callId);
  if (ownsProcessing(call, attemptId, runId)) return true;
  if (
    call.processingAttempt?.id !== attemptId ||
    call.processingAttempt.state !== "pending"
  )
    return false;
  const claimed = {
    ...call,
    processingAttempt: { id: attemptId, state: "running" as const, runId },
    errorCode: null,
    version: call.version + 1,
  };
  if (await repo.put(claimed, call.version)) return true;
  return ownsProcessing(await repo.get(callId), attemptId, runId);
}
