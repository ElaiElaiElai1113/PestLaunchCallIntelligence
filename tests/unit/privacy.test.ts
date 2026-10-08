import { it, expect } from "vitest";
import { privacyRisk, validAudioHeader } from "@/lib/privacy/preflight";
it("holds spoken payment context without needing to publish digits", () => {
  expect(privacyRisk("My credit card details are next.")).toBe(true);
});
it("holds a fictional email identifier", () => {
  expect(privacyRisk("Contact example@example.invalid")).toBe(true);
});
it("retains ordinary pricing numbers", () => {
  expect(
    privacyRisk(
      "The initial visit is 299 dollars and ongoing service is 49 dollars.",
    ),
  ).toBe(false);
});
it("rejects a misleading audio extension", () => {
  expect(validAudioHeader(Buffer.from("<html>invalid</html>"), "wav")).toBe(
    false,
  );
});
it("accepts a WAV container signature", () => {
  expect(validAudioHeader(Buffer.from("RIFF0000WAVE0000"), "wav")).toBe(true);
});
