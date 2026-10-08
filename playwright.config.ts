import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/*.mocked.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3002", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/run-isolated-sample.mjs --port 3002",
    url: "http://127.0.0.1:3002",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
