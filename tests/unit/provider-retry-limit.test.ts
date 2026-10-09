import { expect, it } from "vitest";
import { providerRetryLimit } from "@/lib/groq/retry-limit";
it("retains normal bounded recovery and allows explicit zero-retry demo tests", () => {
  expect(providerRetryLimit(undefined)).toBe(3);
  expect(providerRetryLimit("0")).toBe(0);
  expect(providerRetryLimit("2")).toBe(2);
});
it("fails closed on malformed or excessive retry configuration", () => {
  for (const value of ["-1", "4", "NaN", "1.5", "", " 3 "])
    expect(providerRetryLimit(value)).toBe(0);
});
