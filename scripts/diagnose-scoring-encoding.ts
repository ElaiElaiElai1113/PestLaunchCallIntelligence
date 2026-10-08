import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { sampleCall } from "../src/lib/samples/fixtures";
import { extractionSchema } from "../src/lib/groq/staged-contract";
import { inlinePrimitiveEnumReferences } from "../src/lib/groq/schema-encoding";
import {
  assertProbeDestination,
  reserveProbe,
  writeArtifact,
  tokenResetMs,
} from "./groq-probe-ledger";
import {
  withScoringDiagnosticCase,
  admitEncodingDiagnostic,
  assertDiagnosticHash,
  retainProbeFailure,
} from "./groq-probe-retention";

// Dormant one-call encoding hypothesis test. Captured messages/parameters remain
// unchanged; it does not use the application's revised scoring presentation.
assert.ok(
  process.argv.includes("--run") &&
    process.argv.includes("--free-zdr-confirmed"),
);
assert.ok(
  process.argv
    .slice(2)
    .every((arg) => ["--run", "--free-zdr-confirmed"].includes(arg)),
  "UNREVIEWED_ARGUMENT",
);
const parentRoot = ".private/qa/groq-demo-validation-20261009";
const diagnosticRoot = parentRoot + "/diagnostics/exact-scoring-once";
const repairRoot = parentRoot + "/repairs/one-time-semantic";
const root = parentRoot + "/diagnostics/primitive-enum-once";
const hashes = [
  "fd4d928d64f6b48f5f08f286857a23a4c8ef65c33689d9d5bb246d0eb12635bd",
  "5467893e469ee7f1f1913bbf7cf25484d6daf7434bd6d147eef18680198ece92",
  "871a268511088942b5404b0b2b305c34f7d56d2a7c0a7c2fc2d3d9d4bc41fa0a",
];
const oldRequestHash =
  "8560b7290883915ca95a8eac7af0cffd6ec6bc980e8fb8d1a4992b5c35a301a4";
const newRequestHash =
  "a65e85cb165a402cdfe33eaabacc7a9ed59678c3a761037576dcae443aa006b0";
const extractionHash =
  "a44419d57f6ddd70906bd6d7e2f34b28170c7a09102404a3ddb87dbc1ebdc4b3";
const sourceHash =
  "e9cdf158b84e46ec0ac09f1c38db4457e2182b80652fa38a7100f49fdad6a165";
const destination = "https://api.groq.com/openai/v1/chat/completions";
assertProbeDestination(destination);
await withScoringDiagnosticCase(parentRoot, root, async () => {
  async function scopes() {
    return Promise.all(
      [parentRoot, diagnosticRoot, repairRoot].map(async (path, index) => {
        const bytes = await readFile(path + "/ledger.json");
        assertDiagnosticHash(bytes, hashes[index]);
        return JSON.parse(bytes.toString("utf8"));
      }),
    );
  }
  const [parent, diagnostic, repair] = await scopes();
  let ownRequests = 0;
  try {
    ownRequests = JSON.parse(await readFile(root + "/ledger.json", "utf8"))
      .requests.length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  admitEncodingDiagnostic(parent, diagnostic, repair, ownRequests);
  const fixture = sampleCall("one-time", "fictional-live-renewal");
  assertDiagnosticHash(
    JSON.stringify({
      segments: fixture.segments,
      context: { transcriptComplete: true },
    }),
    sourceHash,
  );
  const extractionBytes = await readFile(
    repairRoot + "/" + repair.requests[0].folder + "/response.json",
  );
  assertDiagnosticHash(extractionBytes, extractionHash);
  const extraction = JSON.parse(extractionBytes.toString("utf8"));
  assert.equal(extraction.choices[0].finish_reason, "stop");
  assert.equal(
    extractionSchema(fixture.segments).parse(
      JSON.parse(extraction.choices[0].message.content),
    ).purpose,
    "sales",
  );
  const oldBytes = await readFile(
    repairRoot + "/" + repair.requests[1].folder + "/request.json",
  );
  assertDiagnosticHash(oldBytes, oldRequestHash);
  const request = JSON.parse(oldBytes.toString("utf8"));
  request.response_format.json_schema.schema = inlinePrimitiveEnumReferences(
    request.response_format.json_schema.schema,
  );
  assertDiagnosticHash(JSON.stringify(request), newRequestHash);
  const bytes = Buffer.byteLength(
    JSON.stringify({
      messages: request.messages,
      schema: request.response_format.json_schema.schema,
    }),
  );
  assert.ok(bytes <= 12000 && Math.ceil(bytes / 3) + 256 + 2400 <= 8000);
  while (true) {
    const reset = Math.max(
      parent.notBefore ?? 0,
      diagnostic.notBefore ?? 0,
      repair.notBefore ?? 0,
    );
    if (reset <= Date.now()) break;
    console.log(
      JSON.stringify({
        quotaWaitSeconds: Math.ceil((reset - Date.now()) / 1000),
      }),
    );
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(30000, reset - Date.now())),
    );
  }
  await scopes();
  const config = await readFile(".env.local", "utf8");
  const key = config
    .match(/^GROQ_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  assert.ok(key, "Server-only key required");
  const reserved = await reserveProbe(root, "primitive-enum-diagnostic", 1);
  let stop = "diagnostic_complete",
    notBefore = Date.now() + 65000;
  try {
    await writeArtifact(reserved.folder, "request.json", request);
    await scopes();
    const response = await fetch(destination, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify(request),
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    const body = await response.json();
    const retained = response.ok
      ? {
          choices: body.choices.map(
            (c: { finish_reason: string; message: { content: string } }) => ({
              finish_reason: c.finish_reason,
              message: { content: c.message.content },
            }),
          ),
          usage: body.usage,
        }
      : retainProbeFailure(body, true);
    await writeArtifact(reserved.folder, "response.json", retained);
    notBefore =
      Date.now() +
      Math.max(
        65000,
        tokenResetMs(response.headers.get("x-ratelimit-reset-tokens")) ?? 0,
      );
    const metadata = {
      at: new Date().toISOString(),
      status: response.status,
      providerCode: body.error?.code ?? null,
      reportedTokens: body.usage?.total_tokens ?? null,
      oldRequestHash,
      newRequestHash,
      sourceHash,
      extractionHash,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      aggregateRequests: 6,
    };
    await writeArtifact(reserved.folder, "metadata.json", metadata);
    console.log(JSON.stringify(metadata));
    if (!response.ok) {
      stop = "provider_failure";
      process.exitCode = 1;
    }
  } catch {
    stop = "diagnostic_failure";
    process.exitCode = 1;
    console.log(
      JSON.stringify({
        error: "ENCODING_DIAGNOSTIC_FAILED",
        aggregateRequests: 6,
      }),
    );
  } finally {
    await reserved.finish({ stopped: stop, notBefore });
  }
});
