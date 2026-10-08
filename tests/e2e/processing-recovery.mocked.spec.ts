import { test, expect } from "@playwright/test";
import { sampleCall } from "../../src/lib/samples/fixtures";
import { mockApi, checkWidths, fictionalSession } from "./mock-api";
test("pending start survives error and reload, while a claimed job hides retry", async ({
  page,
}) => {
  const call = sampleCall("service", "20000000-0000-4000-8000-000000000001");
  Object.assign(call, {
    mode: "live",
    sourceKind: "synthetic",
    status: "analyzing",
    errorCode: "PROCESSING_START_PENDING",
    analysis: null,
    originalAnalysis: null,
    score: null,
    processingAttempt: {
      id: "fictional-attempt",
      state: "pending",
      runId: null,
    },
  });
  let attempts = 0;
  const unexpected = await mockApi(page, (path, method) => {
    if (path === "/api/session" && method === "GET")
      return { json: fictionalSession("owner", true) };
    if (path === "/api/calls" && method === "GET")
      return { json: { calls: [call] } };
    if (path === `/api/calls/${call.id}` && method === "GET")
      return { json: { call } };
    if (path === `/api/calls/${call.id}/retry` && method === "POST") {
      attempts++;
      if (attempts === 1)
        return { status: 503, json: { error: "PROCESSING_START_FAILED" } };
      call.processingAttempt = {
        id: "fictional-attempt",
        state: "running",
        runId: "fictional-run",
      };
      call.errorCode = null;
      return { json: { callId: call.id } };
    }
    return null;
  });
  await page.goto(`/calls/${call.id}`);
  await expect(
    page.getByRole("heading", { name: "Waiting to start", exact: true }),
  ).toBeVisible();
  const retry = page.getByRole("button", {
    name: "Retry starting analysis",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Processing could not start." }),
  ).toHaveText("Processing could not start. Try again.");
  await page.reload();
  await expect(retry).toBeEnabled();
  await checkWidths(page);
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Your recording is being processed",
      exact: true,
    }),
  ).toBeVisible();
  await checkWidths(page);
  expect(unexpected).toEqual([]);
});
test("an untracked active call offers no arbitrary retry", async ({ page }) => {
  const call = sampleCall("service", "20000000-0000-4000-8000-000000000002");
  Object.assign(call, {
    mode: "live",
    sourceKind: "synthetic",
    status: "analyzing",
    errorCode: null,
    analysis: null,
    originalAnalysis: null,
    score: null,
  });
  const unexpected = await mockApi(page, (path, method) =>
    method === "GET"
      ? path === "/api/session"
        ? { json: fictionalSession("owner", true) }
        : path === "/api/calls"
          ? { json: { calls: [call] } }
          : path === `/api/calls/${call.id}`
            ? { json: { call } }
            : null
      : null,
  );
  await page.goto(`/calls/${call.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Your recording is being processed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Retry|Resume analysis/ }),
  ).toHaveCount(0);
  await checkWidths(page);
  expect(unexpected).toEqual([]);
});
