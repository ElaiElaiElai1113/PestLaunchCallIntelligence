import { it, expect } from "vitest";
import { processingDecision } from "@/lib/jobs/admission";
it("keeps a privately uploaded recording waiting when there is no AI key", () => {
  expect(processingDecision(false, false, true)).toBe("awaiting_ai");
});
it("holds real data until privacy approval even when a key exists", () => {
  expect(processingDecision(true, false, false)).toBe("privacy_hold");
});
it("a fictional recording can use an explicitly configured provider", () => {
  expect(processingDecision(true, false, true)).toBe("run");
});
