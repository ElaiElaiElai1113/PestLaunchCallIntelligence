import { it, expect } from "vitest";
import { validAudioHeader } from "@/lib/privacy/preflight";
it("rejects a misleading audio extension", () => {
  expect(validAudioHeader(Buffer.from("<html>invalid</html>"), "wav")).toBe(
    false,
  );
});
it("accepts a WAV container signature", () => {
  expect(validAudioHeader(Buffer.from("RIFF0000WAVE0000"), "wav")).toBe(true);
});
