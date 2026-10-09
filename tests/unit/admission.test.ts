import { it, expect } from "vitest";
import { processingDecision } from "@/lib/jobs/admission";
it("keeps a privately uploaded recording waiting when there is no AI key", () => {
  expect(processingDecision(false, false, true)).toBe("awaiting_ai");
});
it("operator-supplied real recordings use a configured provider without a privacy veto", () => {
  expect(processingDecision(true, false, false)).toBe("run");
});
it("a fictional recording can use an explicitly configured provider", () => {
  expect(processingDecision(true, false, true)).toBe("run");
});
