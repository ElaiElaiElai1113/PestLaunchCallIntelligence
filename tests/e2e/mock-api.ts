import { expect, type Page } from "@playwright/test";
export async function mockApi(
  page: Page,
  respond: (
    path: string,
    method: string,
  ) => { status?: number; json: unknown } | null,
) {
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
    const response = respond(url.pathname, route.request().method());
    if (!response) {
      unexpected.push(`${route.request().method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    await route.fulfill({
      status: response.status ?? 200,
      json: response.json,
    });
  });
  return unexpected;
}
export async function checkWidths(page: Page) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
}
export const fictionalSession = (
  role: "owner" | "reviewer" = "owner",
  aiConfigured = false,
) => ({
  identity: {
    userId: `fictional-${role}`,
    workspaceId: "sample-workspace",
    role,
    mode: "live",
  },
  aiConfigured,
  processingEnabled: false,
  backendConfigured: true,
});
