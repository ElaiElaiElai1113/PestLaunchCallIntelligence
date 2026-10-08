import { startIsolatedSample } from "./isolated-sample-runtime.mjs";
const index = process.argv.indexOf("--port");
const port = index < 0 ? 3002 : Number(process.argv[index + 1]);
const runtime = await startIsolatedSample(port);
process.on("SIGINT", async () => {
  await runtime.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await runtime.stop();
  process.exit(0);
});
runtime.child.on("exit", async (code) => {
  await runtime.stop();
  process.exitCode = code ?? 1;
});
