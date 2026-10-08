import { open, unlink } from "node:fs/promises";
import { acquireRenewalCase, fingerprint } from "./groq-renewal-controls";
// Returned only to ignored private artifact storage, never console/workflow state.
export function retainProbeFailure(
  body: {
    error?: { code?: string; type?: string; failed_generation?: string };
  },
  fictional: boolean,
) {
  return {
    error: {
      code: body.error?.code,
      type: body.error?.type,
      ...(fictional && typeof body.error?.failed_generation === "string"
        ? { failed_generation: body.error.failed_generation }
        : {}),
    },
  };
}

export function assertDiagnosticHash(bytes: string | Buffer, expected: string) {
  if (fingerprint(bytes) !== expected)
    throw new Error("DIAGNOSTIC_BINDING_FAILED");
}
export async function acquireScoringDiagnosticCase(
  parent: string,
  child: string,
) {
  const path = parent + "/case.lock";
  const parentLock = await open(path, "wx");
  await parentLock.close();
  try {
    const childLock = await acquireRenewalCase(child, 1, 1);
    return {
      release: async () => {
        try {
          await childLock.release();
        } finally {
          await unlink(path);
        }
      },
    };
  } catch (error) {
    await unlink(path);
    throw error;
  }
}

export function admitScoringDiagnostic(
  parent: { stopped?: string; requests: { case: string }[] },
  diagnosticRequests: number,
) {
  if (diagnosticRequests !== 0) throw new Error("DIAGNOSTIC_ALREADY_ATTEMPTED");
  if (
    parent.stopped !== "provider_failure" ||
    parent.requests.length !== 2 ||
    parent.requests.some((r) => r.case !== "one-time")
  )
    throw new Error("DIAGNOSTIC_PARENT_REFUSED");
  if (parent.requests.length + diagnosticRequests + 1 > 6)
    throw new Error("PROBE_SEQUENCE_CAP");
}

export async function withScoringDiagnosticCase<T>(
  parent: string,
  child: string,
  operation: () => Promise<T>,
) {
  const lease = await acquireScoringDiagnosticCase(parent, child);
  try {
    return await operation();
  } finally {
    await lease.release();
  }
}
