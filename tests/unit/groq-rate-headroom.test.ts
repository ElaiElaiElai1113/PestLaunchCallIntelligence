import { it, expect } from "vitest";
import { scoringHeadroomWait } from "@/lib/groq/rate-headroom";
const headers = (remaining = "1000", limit = "8000", reset = "7.66s") =>
  new Headers({
    "x-ratelimit-limit-tokens": limit,
    "x-ratelimit-remaining-tokens": remaining,
    "x-ratelimit-reset-tokens": reset,
  });
it("paces a second stage until a full TPM window after insufficient remaining tokens", () => {
  expect(scoringHeadroomWait(headers(), 7900, 10000)).toBe(55000);
  expect(scoringHeadroomWait(headers(), 7900, 65000)).toBe(0);
  expect(scoringHeadroomWait(headers("8000"), 7900, 0)).toBe(0);
});
it("honors a longer advertised reset and refuses an unfit request", () => {
  expect(scoringHeadroomWait(headers("0", "8000", "1m30s"), 7900, 10000)).toBe(
    81000,
  );
  expect(() => scoringHeadroomWait(headers("100", "6000"), 7900, 0)).toThrow(
    "ANALYSIS_RATE_LIMIT_EXCEEDED",
  );
  expect(() =>
    scoringHeadroomWait(headers("0", "8000", "1h"), 7900, 0),
  ).toThrow("RATE_LIMIT_WAIT_EXCEEDED");
});
it("does not invent remaining headroom from malformed headers", () => {
  expect(scoringHeadroomWait(new Headers(), 7900, 0)).toBe(0);
  expect(() => scoringHeadroomWait(headers("broken"), 7900, 0)).toThrow(
    "INVALID_RATE_LIMIT_HEADERS",
  );
});
