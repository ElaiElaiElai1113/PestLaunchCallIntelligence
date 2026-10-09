const quotaGuards = new Set([
  "INVALID_RATE_LIMIT_HEADERS",
  "ANALYSIS_RATE_LIMIT_EXCEEDED",
  "RATE_LIMIT_DAILY_EXHAUSTED",
  "RATE_LIMIT_WAIT_EXCEEDED",
]);
export function providerFailureCode(error: unknown): string {
  if (error instanceof Error && quotaGuards.has(error.message))
    return error.message;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500)
    return "PROVIDER_REQUEST_REJECTED";
  if (error instanceof Error && error.name === "ZodError")
    return "CONTRACT_RESPONSE_INVALID";
  return "ANALYSIS_FAILED";
}
