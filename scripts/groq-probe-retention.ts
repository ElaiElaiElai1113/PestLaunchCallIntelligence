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
