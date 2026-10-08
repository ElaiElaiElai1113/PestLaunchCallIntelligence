import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const cwd = resolve(import.meta.dirname, ".."),
  id = randomUUID(),
  runRoot = `.private/qa/${id}`;
const nextEnvPath = resolve(cwd, "next-env.d.ts"),
  tsPath = resolve(cwd, "tsconfig.json");
const beforeEnv = await readFile(nextEnvPath, "utf8"),
  beforeTs = await readFile(tsPath, "utf8");
try {
  const tests = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      cwd,
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, PESTLAUNCH_HARNESS_ID: id },
    },
  );
  process.exitCode = await new Promise((done) =>
    tests.once("exit", (code) => done(code ?? 1)),
  );
} finally {
  const current = await readFile(nextEnvPath, "utf8");
  const restored = current
    .split("\n")
    .map((line) =>
      line.startsWith("import ") && line.includes(`${runRoot}/next`)
        ? (beforeEnv
            .split("\n")
            .find(
              (old) =>
                old.startsWith("import ") &&
                old.split("/").at(-1) === line.split("/").at(-1),
            ) ?? line)
        : line,
    )
    .join("\n");
  if (restored !== current) await writeFile(nextEnvPath, restored);
  const currentTs = JSON.parse(await readFile(tsPath, "utf8"));
  const cleaned = {
    ...currentTs,
    include: currentTs.include.filter(
      (value) => !value.includes(`${runRoot}/next`),
    ),
  };
  if (JSON.stringify(cleaned) === JSON.stringify(JSON.parse(beforeTs)))
    await writeFile(tsPath, beforeTs);
}
