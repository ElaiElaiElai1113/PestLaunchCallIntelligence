import { expect, it } from "vitest";
import { RUBRICS } from "@/lib/scoring/rubrics";
it("offers future-service information, with Sales referral guidance", () => {
  for (const purpose of ["sales", "general"] as const) {
    const checkpoint = RUBRICS[purpose].find(
      (x) => x.id === "final_information",
    )!;
    expect(checkpoint.label).toBe("Offer future-service information");
    expect(checkpoint.guidance).toContain("future pest-control needs");
    expect(checkpoint.guidance).not.toContain("Collect");
  }
  expect(
    RUBRICS.sales.find((x) => x.id === "final_information")!.guidance,
  ).toContain("referral program");
  expect(
    RUBRICS.general.find((x) => x.id === "final_information")!.guidance,
  ).not.toContain("referral program");
});
it("preserves manual quadrant placement and original checkpoint counts", () => {
  for (const purpose of ["sales", "general"] as const) {
    expect(
      RUBRICS[purpose].find((x) => x.id === "expectation_understand")!.group,
    ).toBe("Validate");
    expect(
      RUBRICS[purpose].find((x) => x.id === "expectation_solve")!.group,
    ).toBe("Understand");
  }
  for (const id of ["transition", "research"])
    expect(RUBRICS.retention.find((x) => x.id === id)!.group).toBe("Validate");
  expect(
    RUBRICS.retention.find((x) => x.id === "validate_expectation")!.group,
  ).toBe("Understand");
  expect([
    RUBRICS.sales.length,
    RUBRICS.general.length,
    RUBRICS.retention.length,
  ]).toEqual([17, 12, 12]);
});
