import type { CallRecord } from "./types";
export function pendingProcessing(call: CallRecord): boolean {
  return Boolean(
    call.processingAttempt?.id && call.processingAttempt.state === "pending",
  );
}
export function retryAvailable(call: CallRecord): boolean {
  if (call.processingAttempt?.state === "running") return false;
  return (
    pendingProcessing(call) ||
    call.status === "failed" ||
    ["AI_NOT_CONFIGURED", "PRIVACY_APPROVAL_REQUIRED"].includes(
      call.errorCode ?? "",
    )
  );
}
export function ownsProcessing(
  call: CallRecord,
  attemptId: string | undefined,
  runId: string | undefined,
): boolean {
  if (!attemptId) return !call.processingAttempt;
  return (
    call.processingAttempt?.id === attemptId &&
    call.processingAttempt.state === "running" &&
    call.processingAttempt.runId === runId
  );
}
