import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import net from "node:net";
const execute = promisify(execFile);
export async function startIsolatedSample(port = 3002) {
  if (![3002, 3003].includes(port))
    throw new Error("Only isolated loopback sample ports are supported.");
  const probe = net.createServer();
  await new Promise((resolveReady, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolveReady);
  });
  await new Promise((done) => probe.close(done));
  const cwd = resolve(import.meta.dirname, ".."),
    namespace = port === 3003 ? "demo" : "qa",
    root = resolve(
      cwd,
      ".private",
      namespace,
      process.env.PESTLAUNCH_HARNESS_ID ?? randomUUID(),
    );
  if (!/^[a-f0-9-]{36}$/.test(root.split(/[\\/]/).at(-1)))
    throw new Error("INVALID_HARNESS_ID");
  await mkdir(resolve(cwd, ".private", namespace), { recursive: true });
  await mkdir(root);
  const origin = `http://127.0.0.1:${port}`,
    runRoot = relative(cwd, root).replaceAll("\\", "/");
  const nextEnvPath = resolve(cwd, "next-env.d.ts"),
    tsPath = resolve(cwd, "tsconfig.json");
  const beforeEnv = await readFile(nextEnvPath, "utf8"),
    beforeTs = await readFile(tsPath, "utf8"),
    spawnTime = Date.now();
  await writeFile(
    resolve(root, "generated-config-before.json"),
    JSON.stringify({ beforeEnv, beforeTs }),
  );
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        SUPABASE_SECRET_KEY: "",
        GROQ_API_KEY: "",
        GEMINI_API_KEY: "",
        AI_PROVIDER: "groq",
        REAL_CALL_PROCESSING_ENABLED: "false",
        APP_ORIGIN: origin,
        NEXT_TELEMETRY_DISABLED: "1",
        PESTLAUNCH_SAMPLE_ROOT: runRoot,
        PESTLAUNCH_QA_DIST_DIR: `${runRoot}/next`,
      },
    },
  );
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === "win32") {
        const command = `$plRootPid=${child.pid}; $plFloor=[DateTimeOffset]::FromUnixTimeMilliseconds(${spawnTime - 2000}).UtcDateTime; $plItems=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate; $plRoot=$plItems | Where-Object {$_.ProcessId -eq $plRootPid}; if($plRoot -and $plRoot.CreationDate.ToUniversalTime() -ge $plFloor){ $plOwned=@($plRootPid); for($plI=0;$plI -lt $plOwned.Count;$plI++){ foreach($plChild in $plItems | Where-Object {$_.ParentProcessId -eq $plOwned[$plI]}){if($plOwned -notcontains [int]$plChild.ProcessId){$plOwned+= [int]$plChild.ProcessId}} }; [array]::Reverse($plOwned); foreach($plPid in $plOwned){Stop-Process -Id $plPid -Force -ErrorAction SilentlyContinue} }`;
        await execute(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", command],
          { windowsHide: true },
        );
      } else child.kill("SIGTERM");
    }
    // Restore only known generated QA references; preserve unrelated edits.
    const nowEnv = await readFile(nextEnvPath, "utf8");
    const restored = nowEnv
      .split("\n")
      .map((line) => {
        if (!line.startsWith("import ") || !line.includes(`${runRoot}/next`))
          return line;
        const filename = line.split("/").at(-1);
        return (
          beforeEnv
            .split("\n")
            .find(
              (old) =>
                old.startsWith("import ") && old.split("/").at(-1) === filename,
            ) ?? line
        );
      })
      .join("\n");
    if (restored !== nowEnv) await writeFile(nextEnvPath, restored);
    const nowTs = JSON.parse(await readFile(tsPath, "utf8")),
      oldTs = JSON.parse(beforeTs);
    const cleaned = {
      ...nowTs,
      include: nowTs.include.filter(
        (value) => !value.includes(`${runRoot}/next`),
      ),
    };
    if (JSON.stringify(cleaned) === JSON.stringify(oldTs))
      await writeFile(tsPath, beforeTs);
  }
  async function ready() {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error("Isolated sample server exited before readiness.");
      try {
        const result = await fetch(`${origin}/login`);
        if (result.ok) return;
      } catch {}
      await new Promise((done) => setTimeout(done, 250));
    }
    throw new Error("Isolated sample server readiness timed out.");
  }
  console.log(
    `Isolated fictional sample workspace: ${origin}; fresh run root ${runRoot}. No AI/backend credentials.`,
  );
  return { child, origin, root, stop, ready };
}
