import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("mobile call views, filter return, keyboard dialog and zoom remain usable", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page
    .getByRole("radio", { name: /One-time treatment accepted/ })
    .check();
  await page
    .getByRole("button", { name: "Add fictional call", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "One-time treatment accepted",
      exact: true,
    }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const tab of ["Scorecard", "Coaching", "Transcript", "Summary"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({ id: x.id, targets: x.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await mkdir(".private/evidence", { recursive: true });
  await page.screenshot({ path: ".private/evidence/mobile-call.png" });
  await page.getByRole("link", { name: "Back to calls", exact: true }).click();
  await page.getByRole("textbox", { name: "Search calls" }).fill("one-time");
  await page
    .getByRole("combobox", { name: "Filter by purpose" })
    .selectOption("sales");
  await page.locator(".call-row").first().click();
  await page.getByRole("link", { name: "Back to calls", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search calls" })).toHaveValue(
    "one-time",
  );
  await expect(
    page.getByRole("combobox", { name: "Filter by purpose" }),
  ).toHaveValue("sales");
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/overview");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.request.delete(`/api/calls/${id}`, {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
});
test("sample call, evidence, correction, history and deletion work together", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page
    .getByRole("button", { name: "Add fictional call", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "An inspection, not a sale",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Text-only fixture. No recorded customer audio."),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mkdir(".private/evidence", { recursive: true });
  await page.screenshot({ path: ".private/evidence/call-workspace.png" });
  const serious = async () => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({
          id: x.id,
          nodes: x.nodes.map((n) => ({
            target: n.target,
            data: n.any.map((a) => a.data),
          })),
        })),
    ).toEqual([]);
  };
  await serious();
  await page.getByRole("tab", { name: "Scorecard", exact: true }).click();
  await page.getByRole("button", { name: "Review Explain pricing" }).click();
  await page.getByLabel("Checkpoint decision").selectOption("missed");
  await page
    .getByLabel("Reason for this decision")
    .fill(
      "Fictional inspection-only sample does not establish treatment pricing.",
    );
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review history" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Coaching", exact: true }).click();
  await expect(page.getByText("Make the next call stronger.")).toBeVisible();
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search transcript" })
    .fill("kitchen");
  await expect(page.locator(".transcript-segment")).toHaveCount(1);
  await serious();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "An inspection, not a sale",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete call", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await page.getByRole("button", { name: "Delete data", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calls", exact: false }),
  ).toBeVisible();
});
test("no horizontal overflow or serious accessibility issues at target widths", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(
      audit.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({
          id: x.id,
          nodes: x.nodes.map((n) => ({
            target: n.target,
            data: n.any.map((a) => a.data),
          })),
        })),
    ).toEqual([]);
  }
});
