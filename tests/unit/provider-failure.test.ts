import { expect, it } from "vitest";
import { providerFailureCode } from "@/lib/groq/failure-code";
it("distinguishes provider rejection, response validation and quota guards without exposing content", () => {
  expect(
    providerFailureCode(
      Object.assign(new Error("private fictional text"), { status: 400 }),
    ),
  ).toBe("PROVIDER_REQUEST_REJECTED");
  expect(
    providerFailureCode(
      Object.assign(new Error("private fictional text"), { name: "ZodError" }),
    ),
  ).toBe("CONTRACT_RESPONSE_INVALID");
  expect(providerFailureCode(new Error("RATE_LIMIT_WAIT_EXCEEDED"))).toBe(
    "RATE_LIMIT_WAIT_EXCEEDED",
  );
  expect(providerFailureCode(new Error("private fictional text"))).toBe(
    "ANALYSIS_FAILED",
  );
});
