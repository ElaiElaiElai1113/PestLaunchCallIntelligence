export function providerRetryLimit(value: string | undefined): number {
  if (value === undefined) return 3;
  return /^[0-3]$/.test(value) ? Number(value) : 0;
}
