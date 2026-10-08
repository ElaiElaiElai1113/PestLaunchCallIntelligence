import { spawn } from "node:child_process";
// Empty overrides take precedence over Next's env files. This preview cannot
// connect to Supabase/Groq and has its own build output and port.
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      GROQ_API_KEY: "",
      REAL_CALL_PROCESSING_ENABLED: "false",
      APP_ORIGIN: "http://127.0.0.1:3001",
      PESTLAUNCH_QA_DIST_DIR: ".private/qa/next",
    },
  },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
