import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "remediation.mocked.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3001", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/run-isolated-preview.mjs",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
