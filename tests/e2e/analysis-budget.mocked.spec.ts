import { test, expect } from "@playwright/test";
import { sampleCall } from "../../src/lib/samples/fixtures";
import { mockApi, fictionalSession } from "./mock-api";
for (const history of [false, true]) {
  test(`budget failure explains retained source with ${history ? "previous history" : "no analysis"}`, async ({
    page,
  }) => {
    const call = sampleCall("service", "20000000-0000-4000-8000-000000000031");
    call.mode = "live";
    call.sourceKind = "synthetic";
    call.status = "failed";
    call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
    call.segments[0].text = "Fictional over-limit context. ".repeat(1000);
    if (history) {
      call.sourceRevision = 1;
      call.analysisSourceRevision = 0;
    } else {
      call.analysis = null;
      call.originalAnalysis = null;
      call.score = null;
    }
    const unexpected = await mockApi(page, (path, method) => {
      if (path === "/api/session")
        return { json: fictionalSession("owner", true) };
      if (path === "/api/calls") return { json: { calls: [call] } };
      if (path === `/api/calls/${call.id}` && method === "GET")
        return { json: { call } };
      return null;
    });
    await page.goto(`/calls/${call.id}?tab=transcript`);
    await expect(
      page.getByRole("alert").filter({
        hasText: "This transcript exceeds the current analysis limit.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(call.segments[0].text, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry processing", exact: true }),
    ).toHaveCount(0);
    if (history) {
      await expect(
        page.getByRole("heading", {
          name: "Previous analysis — source revision 0",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Re-analyze", exact: true }),
      ).toBeDisabled();
    }
    expect(unexpected).toEqual([]);
  });
}
