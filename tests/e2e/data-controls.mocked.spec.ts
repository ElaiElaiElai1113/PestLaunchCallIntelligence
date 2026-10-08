import { test, expect } from "@playwright/test";
import { mockApi, checkWidths, fictionalSession } from "./mock-api";
test("pending-only deletion remains visible and retryable after failure", async ({
  page,
}) => {
  let deletes = 0;
  const unexpected = await mockApi(page, (path, method) => {
    if (method === "GET" && path === "/api/session")
      return { json: fictionalSession() };
    if (method === "GET" && path === "/api/calls")
      return { json: { calls: [] } };
    if (path === "/api/test-data" && method === "GET")
      return {
        json: {
          retained: deletes < 2 ? 1 : 0,
          pendingDeletion: deletes < 2 ? 1 : 0,
        },
      };
    if (path === "/api/test-data" && method === "DELETE") {
      deletes++;
      return deletes === 1
        ? { status: 503, json: { error: "DELETE_STORAGE_FAILED" } }
        : { json: { deleted: 1, at: "fictional-test-time" } };
    }
    return null;
  });
  await page.goto("/settings/data");
  await expect(page.locator(".retained-count")).toHaveText("1");
  const retry = page.getByRole("button", {
    name: "Retry deletion cleanup",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  await expect(
    page.getByText(/1 conversation\(s\) still need deletion cleanup/),
  ).toBeVisible();
  await retry.click();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm", exact: true })
    .fill("DELETE");
  await page.getByRole("button", { name: "Delete data", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete data", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Close deletion", exact: true })
    .click();
  await expect(
    page.getByText(
      "Some recording copies could not be removed. Retry deletion to finish cleanup.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/conversations deleted/)).toHaveCount(0);
  await expect(retry).toBeEnabled();
  await checkWidths(page);
  await retry.click();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm", exact: true })
    .fill("DELETE");
  await page.getByRole("button", { name: "Delete data", exact: true }).click();
  await expect(page.locator(".retained-count")).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Delete test data", exact: true }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});
test("unavailable owner counts show an em dash rather than zero", async ({
  page,
}) => {
  const unexpected = await mockApi(page, (path, method) =>
    method === "GET"
      ? path === "/api/session"
        ? { json: fictionalSession() }
        : path === "/api/calls"
          ? { json: { calls: [] } }
          : path === "/api/test-data"
            ? { status: 503, json: { error: "DATABASE_UNAVAILABLE" } }
            : null
      : null,
  );
  await page.goto("/settings/data");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Retained count is unavailable." }),
  ).toContainText("Retained count is unavailable.");
  await expect(page.locator(".retained-count")).toHaveText("—");
  await expect(
    page.getByRole("button", { name: "Delete test data", exact: true }),
  ).toBeDisabled();
  await checkWidths(page);
  expect(unexpected).toEqual([]);
});
test("reviewer uses available counts without requesting owner retention data", async ({
  page,
}) => {
  const unexpected = await mockApi(page, (path, method) =>
    method === "GET"
      ? path === "/api/session"
        ? { json: fictionalSession("reviewer") }
        : path === "/api/calls"
          ? { json: { calls: [] } }
          : null
      : null,
  );
  await page.goto("/settings/data");
  await expect(
    page.getByRole("heading", { name: "Available conversations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete test data", exact: true }),
  ).toHaveCount(0);
  await checkWidths(page);
  expect(unexpected).toEqual([]);
});
