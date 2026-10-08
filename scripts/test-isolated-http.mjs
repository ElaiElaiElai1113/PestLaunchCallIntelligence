import { spawn } from "node:child_process";
import { startIsolatedSample } from "./isolated-sample-runtime.mjs";
const runtime = await startIsolatedSample(3002);
try {
  await runtime.ready();
  const tests = spawn(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vitest.http.config.ts",
    ],
    {
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, PESTLAUNCH_HTTP_BASE_URL: runtime.origin },
    },
  );
  process.exitCode = await new Promise((resolve) =>
    tests.once("exit", (code) => resolve(code ?? 1)),
  );
} finally {
  await runtime.stop();
}
