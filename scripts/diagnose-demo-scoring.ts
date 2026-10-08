import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fingerprint } from "./groq-renewal-controls";
import {
  reserveProbe,
  writeArtifact,
  assertProbeDestination,
} from "./groq-probe-ledger";
import {
  admitScoringDiagnostic,
  retainProbeFailure,
  withScoringDiagnosticCase,
  assertDiagnosticHash,
} from "./groq-probe-retention";
import { sampleCall } from "../src/lib/samples/fixtures";
import {
  buildScoringRequest,
  buildAnalysisRequest,
} from "../src/lib/groq/analysis-request";
import { extractionSchema } from "../src/lib/groq/staged-contract";

// Dormant until independent review. One exact fictional replay, not a reopened
// phase, prompt/model/schema experiment or application result publication.
assert.ok(
  process.argv.includes("--run") &&
    process.argv.includes("--free-zdr-confirmed"),
);
const parentRoot = ".private/qa/groq-demo-validation-20261009";
const root = parentRoot + "/diagnostics/exact-scoring-once";
const parentHash =
  "fd4d928d64f6b48f5f08f286857a23a4c8ef65c33689d9d5bb246d0eb12635bd";
const requestHash =
  "4ebce1741fd71aed5e8b80a5ecfcba593493fd8ae51ce2806854655b877180c5";
const sourceHash =
  "e9cdf158b84e46ec0ac09f1c38db4457e2182b80652fa38a7100f49fdad6a165";
const extractionHash =
  "5c1410d628d4b675a9fc93209da055eda09c7acd47e5987c073fb74c4d6781d4";
const destination = "https://api.groq.com/openai/v1/chat/completions";
assertProbeDestination(destination);
await withScoringDiagnosticCase(parentRoot, root, async () => {
  const parentBytes = await readFile(parentRoot + "/ledger.json");
  assertDiagnosticHash(parentBytes, parentHash);
  const parent = JSON.parse(parentBytes.toString("utf8"));
  let ownRequests = 0;
  try {
    ownRequests = JSON.parse(await readFile(root + "/ledger.json", "utf8"))
      .requests.length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  admitScoringDiagnostic(parent, ownRequests);
  assert.ok(
    !parent.notBefore || parent.notBefore <= Date.now(),
    "PROBE_QUOTA_WAIT",
  );
  const requestBytes = await readFile(
    parentRoot + "/" + parent.requests[1].folder + "/request.json",
  );
  assertDiagnosticHash(requestBytes, requestHash);
  const request = JSON.parse(requestBytes.toString("utf8"));
  const fixture = sampleCall("one-time", "fictional-live-renewal");
  const source = {
    segments: fixture.segments,
    context: { transcriptComplete: true },
  };
  assertDiagnosticHash(JSON.stringify(source), sourceHash);
  const extractionFolder = parentRoot + "/" + parent.requests[0].folder;
  const scoringFolder = parentRoot + "/" + parent.requests[1].folder;
  const extractionBytes = await readFile(extractionFolder + "/response.json");
  assertDiagnosticHash(extractionBytes, extractionHash);
  const extractionResponse = JSON.parse(extractionBytes.toString("utf8"));
  assert.equal(extractionResponse.choices[0].finish_reason, "stop");
  const extracted = extractionSchema(source.segments).parse(
    JSON.parse(extractionResponse.choices[0].message.content),
  );
  const extractionRequest = JSON.parse(
    await readFile(extractionFolder + "/request.json", "utf8"),
  );
  assertDiagnosticHash(
    JSON.stringify(extractionRequest),
    fingerprint(
      JSON.stringify(
        buildAnalysisRequest(source.segments, source.context).request,
      ),
    ),
  );
  assertDiagnosticHash(
    JSON.stringify(request),
    fingerprint(
      JSON.stringify(
        buildScoringRequest(source.segments, source.context, extracted.purpose)
          .request,
      ),
    ),
  );
  const extractionMetadata = JSON.parse(
    await readFile(extractionFolder + "/metadata.json", "utf8"),
  );
  const scoringMetadata = JSON.parse(
    await readFile(scoringFolder + "/metadata.json", "utf8"),
  );
  assert.ok(
    extractionMetadata.status === 200 &&
      scoringMetadata.status === 400 &&
      scoringMetadata.providerCode === "json_validate_failed",
  );
  assert.ok(
    request.model === "openai/gpt-oss-120b" &&
      request.response_format.json_schema.strict === true &&
      request.response_format.json_schema.name ===
        "call_analysis_staged_v2_scoring",
  );
  const config = await readFile(".env.local", "utf8");
  const key = config
    .match(/^GROQ_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  assert.ok(key, "Server-only key required");
  const reserved = await reserveProbe(root, "one-time-scoring-diagnostic", 1);
  let stop = "diagnostic_complete";
  try {
    await writeArtifact(reserved.folder, "request.json", request);
    assert.equal(
      fingerprint(await readFile(parentRoot + "/ledger.json")),
      parentHash,
    );
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
    const metadata = {
      at: new Date().toISOString(),
      status: response.status,
      providerCode: body.error?.code ?? null,
      reportedTokens: body.usage?.total_tokens ?? null,
      requestHash,
      sourceHash,
      extractionHash,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      aggregateRequests: parent.requests.length + 1,
      failedGenerationRetained:
        typeof body.error?.failed_generation === "string",
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
        error: "DIAGNOSTIC_FAILED",
        aggregateRequests: parent.requests.length + 1,
      }),
    );
  } finally {
    await reserved.finish({ stopped: stop, notBefore: Date.now() + 65000 });
  }
});
