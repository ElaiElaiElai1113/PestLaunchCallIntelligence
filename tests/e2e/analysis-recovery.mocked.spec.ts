import { test, expect } from "@playwright/test";
import { recoveryCall } from "../helpers/recovery-call";
import { analysisRecovery } from "../../src/lib/groq/analysis-recovery";
import { applySourceReview } from "../../src/lib/domain/source-review";
import { sourceReviewSchema } from "../../src/lib/domain/schemas";
import { mockApi, fictionalSession, checkWidths } from "./mock-api";
for (const budget of [false, true]) {
  test(`first failed analysis can recover after ${budget ? "review of an admissible source with an old budget error" : "source verification"} without fake processing`, async ({
    page,
  }) => {
    let call = recoveryCall(),
      starts = 0;
    if (budget) {
      call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
      expect(analysisRecovery(call, false).budget).toBe("admitted");
    }
    const before = structuredClone(call.segments);
    const unexpected = await mockApi(page, (path, method, input) => {
      if (path === "/api/session")
        return { json: fictionalSession("owner", true) };
      if (path === "/api/calls") return { json: { calls: [call] } };
      if (path === `/api/calls/${call.id}` && method === "GET")
        return { json: { call } };
      if (path === `/api/calls/${call.id}/media`)
        return { status: 404, json: { error: "MEDIA_UNAVAILABLE" } };
      if (path === `/api/calls/${call.id}/source-review`) {
        call = applySourceReview(call, sourceReviewSchema.parse(input), {
          id: "review",
          userId: "fictional-owner",
          at: "2026-10-09T00:00:00Z",
        });
        return { json: { call } };
      }
      if (path === `/api/calls/${call.id}/reanalyze`) {
        starts++;
        return { status: 503, json: { error: "PROCESSING_START_FAILED" } };
      }
      return null;
    });
    await page.goto(`/calls/${call.id}?tab=transcript`);
    await page
      .getByRole("button", { name: "Review transcript", exact: true })
      .click();
    if (budget)
      for (const segment of call.segments)
        await page
          .getByLabel(`Speaker ${segment.id}`, { exact: true })
          .selectOption("unknown");
    await page
      .getByLabel("Reason for transcript review")
      .fill("Fictional correction of source roles; no provider request.");
    await page
      .getByRole("button", { name: "Save transcript review", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Analyze transcript", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", {
        name: "Waiting for owner analysis",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Your recording is being processed", { exact: true }),
    ).toHaveCount(0);
    expect(starts).toBe(0);
    expect(call.analysis).toBeNull();
    expect(call.score).toBeNull();
    expect(
      call.segments.map((s) => ({
        id: s.id,
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
      })),
    ).toEqual(
      before.map((s) => ({
        id: s.id,
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
      })),
    );
    await checkWidths(page);
    await page
      .getByRole("button", { name: "Analyze transcript", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Processing could not start." }),
    ).toBeVisible();
    expect(starts).toBe(1);
    expect(call.analysis).toBeNull();
    expect(unexpected).toEqual([]);
  });
}
test("reviewer sees waiting state but cannot start first analysis", async ({
  page,
}) => {
  const call = recoveryCall();
  call.status = "needs_review";
  const unexpected = await mockApi(page, (path) =>
    path === "/api/session"
      ? { json: fictionalSession("reviewer", true) }
      : path === "/api/calls"
        ? { json: { calls: [call] } }
        : path === `/api/calls/${call.id}`
          ? { json: { call } }
          : path === `/api/calls/${call.id}/media`
            ? { status: 404, json: { error: "MEDIA_UNAVAILABLE" } }
            : null,
  );
  await page.goto(`/calls/${call.id}`);
  await expect(
    page.getByRole("button", { name: "Analyze transcript", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("A workspace owner must start analysis.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Waiting for owner analysis",
      exact: true,
    }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("a budget-admitted but source-ineligible transcript cannot use Retry processing", async ({
  page,
}) => {
  const call = recoveryCall();
  call.errorCode = "ANALYSIS_BUDGET_EXCEEDED";
  delete call.sourcePreparation;
  expect(analysisRecovery(call, false)).toMatchObject({
    budget: "admitted",
    eligible: false,
  });
  const unexpected = await mockApi(page, (path) =>
    path === "/api/session"
      ? { json: fictionalSession("owner", true) }
      : path === "/api/calls"
        ? { json: { calls: [call] } }
        : path === `/api/calls/${call.id}`
          ? { json: { call } }
          : path === `/api/calls/${call.id}/media`
            ? { status: 404, json: { error: "MEDIA_UNAVAILABLE" } }
            : null,
  );
  await page.goto(`/calls/${call.id}`);
  await expect(
    page.getByRole("button", { name: "Retry processing", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analyze transcript", exact: true }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});
