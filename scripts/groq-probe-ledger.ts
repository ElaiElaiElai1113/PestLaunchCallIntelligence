import { mkdir, open, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export type ProbeEntry = {
  ordinal: number;
  case: string;
  id: string;
  at: string;
  folder: string;
  accepted?: boolean;
  semanticPass?: boolean;
};
export function assertProbeDestination(input: RequestInfo | URL) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (
    url.origin !== "https://api.groq.com" ||
    url.pathname !== "/openai/v1/chat/completions" ||
    url.username ||
    url.password ||
    url.search
  )
    throw new Error("PROBE_DESTINATION_REFUSED");
}
export type ProbeLedger = {
  requests: ProbeEntry[];
  notBefore?: number;
  stopped?: string;
};
export async function reserveProbe(root: string, caseName: string) {
  await mkdir(root, { recursive: true });
  const lockPath = join(root, "active.lock");
  const lock = await open(lockPath, "wx");
  await lock.close();
  const ledgerPath = join(root, "ledger.json");
  let ledger: ProbeLedger;
  try {
    try {
      ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ledger = { requests: [] };
    }
    if (ledger.stopped) throw new Error("PROBE_STOPPED");
    if (ledger.requests.length >= 6) throw new Error("PROBE_REQUEST_CAP");
    if (ledger.notBefore && ledger.notBefore > Date.now())
      throw new Error("PROBE_QUOTA_WAIT");
    const entry: ProbeEntry = {
      ordinal: ledger.requests.length + 1,
      case: caseName,
      id: randomUUID(),
      at: new Date().toISOString(),
      folder: randomUUID(),
    };
    const folder = join(root, entry.folder);
    await mkdir(folder);
    ledger.requests.push(entry);
    await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    return {
      entry,
      folder,
      ledger,
      async finish(update: Partial<ProbeLedger> = {}) {
        Object.assign(ledger, update);
        await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
        await unlink(lockPath);
      },
    };
  } catch (error) {
    await unlink(lockPath);
    throw error;
  }
}
export async function writeArtifact(
  folder: string,
  name: string,
  value: unknown,
) {
  if (!/^[a-z0-9-]+\.json$/.test(name))
    throw new Error("INVALID_ARTIFACT_NAME");
  await writeFile(join(folder, name), JSON.stringify(value, null, 2), {
    flag: "wx",
  });
}
export function tokenResetMs(value: string | null) {
  if (!value) return null;
  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
  if (!parts.length) return null;
  return parts.reduce(
    (total, part) =>
      total +
      Number(part[1]) *
        { ms: 1, s: 1000, m: 60000, h: 3600000 }[
          part[2] as "ms" | "s" | "m" | "h"
        ],
    0,
  );
}
