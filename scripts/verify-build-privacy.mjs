import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// Read deployment trace metadata only; never read traced private files.
const root = resolve(process.env.PESTLAUNCH_QA_DIST_DIR || ".next");
let traces = 0;
let forbidden = 0;
async function inspect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (entry.name.endsWith(".nft.json")) {
      traces++;
      const trace = JSON.parse(await readFile(path, "utf8"));
      const paths = [
        ...(trace.files || []),
        ...Object.values(trace.additionalRoots || {}).flatMap(
          (r) => r.files || [],
        ),
      ];
      forbidden += paths.filter((p) =>
        /(^|[/\\])(?:\.private(?:[/\\]|$)|\.env(?:$|\.))/.test(p),
      ).length;
    }
  }
}
await inspect(root);
if (!traces || forbidden) {
  console.error(
    `Build privacy check failed: ${traces} traces, ${forbidden} private/environment references.`,
  );
  process.exitCode = 1;
} else
  console.log(
    `Build privacy check passed: ${traces} traces, zero private/environment references.`,
  );
