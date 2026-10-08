import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { sampleCall } from "../../src/lib/samples/fixtures";
test("fictional mocked frontend distinguishes discussion from agreement and shows withheld coaching", async ({
  page,
}) => {
  const fictional = sampleCall(
    "service",
    "20000000-0000-0000-0000-000000000001",
  );
  fictional.analysis!.followups = [];
  fictional.analysis!.coaching = [];
  const unexpected: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:3001") {
      unexpected.push(`external ${url.hostname}`);
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (route.request().method() !== "GET") {
      unexpected.push(`${route.request().method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    let body: unknown;
    if (url.pathname === "/api/session")
      body = {
        identity: {
          userId: "fictional-reviewer",
          workspaceId: fictional.workspaceId,
          role: "reviewer",
          mode: "sample",
        },
        aiConfigured: false,
        processingEnabled: false,
        backendConfigured: false,
      };
    else if (url.pathname === "/api/calls") body = { calls: [fictional] };
    else if (url.pathname === `/api/calls/${fictional.id}`)
      body = { call: fictional };
    else if (url.pathname === `/api/calls/${fictional.id}/media`) {
      await route.fulfill({
        status: 404,
        json: { error: "SAMPLE_AUDIO_UNAVAILABLE" },
      });
      return;
    } else {
      unexpected.push(url.pathname);
      await route.abort();
      return;
    }
    await route.fulfill({ status: 200, json: body });
  });
  await page.goto("/calls");
  await expect(
    page.getByText("Re-service discussed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Follow-up agreed", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: /A service concern resolved/ }).click();
  await page.getByRole("tab", { name: "Coaching", exact: true }).click();
  await expect(
    page.getByText("Employee-specific coaching needs speaker review.", {
      exact: true,
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await mkdir(".private/evidence", { recursive: true });
  await page.screenshot({
    path: ".private/evidence/remediation-mocked-coaching.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});
