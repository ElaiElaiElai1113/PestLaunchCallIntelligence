export function scoringHeadroomWait(
  headers: Headers,
  required: number,
  elapsedMs: number,
) {
  const limitText = headers.get("x-ratelimit-limit-tokens");
  const remainingText = headers.get("x-ratelimit-remaining-tokens");
  // Synthetic transports and cached extraction may have no provider quota headers.
  if (limitText === null && remainingText === null) return 0;
  const limit = Number(limitText),
    remaining = Number(remainingText);
  if (
    !limitText ||
    !remainingText ||
    !Number.isFinite(limit) ||
    !Number.isFinite(remaining) ||
    limit <= 0 ||
    remaining < 0
  )
    throw new Error("INVALID_RATE_LIMIT_HEADERS");
  if (required > limit) throw new Error("ANALYSIS_RATE_LIMIT_EXCEEDED");
  const daily = headers.get("x-ratelimit-remaining-requests");
  if (daily !== null && Number(daily) === 0)
    throw new Error("RATE_LIMIT_DAILY_EXHAUSTED");
  if (remaining >= required) return 0;
  const reset = headers.get("x-ratelimit-reset-tokens");
  let resetMs = 0;
  if (reset) {
    const parts = [...reset.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)];
    if (parts.map((p) => p[0]).join("") !== reset)
      throw new Error("INVALID_RATE_LIMIT_HEADERS");
    const units: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    resetMs =
      parts.reduce((sum, p) => sum + Number(p[1]) * units[p[2]], 0) + 1000;
  }
  const wait = Math.max(0, Math.max(65000, resetMs) - Math.max(0, elapsedMs));
  if (wait > 120000) throw new Error("RATE_LIMIT_WAIT_EXCEEDED");
  return wait;
}
