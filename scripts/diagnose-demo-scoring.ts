import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { acquireRenewalCase, fingerprint } from "./groq-renewal-controls";
import { reserveProbe, writeArtifact } from "./groq-probe-ledger";
import {
  admitScoringDiagnostic,
  retainProbeFailure,
} from "./groq-probe-retention";

// Dormant until independent review. One exact fictional replay, not a reopened
// phase, prompt/model/schema experiment or application result publication.
assert.ok(
  process.argv.includes("--run") &&
    process.argv.includes("--free-zdr-confirmed"),
);
const parentRoot = ".private/qa/groq-demo-validation-20261009";
const root = parentRoot + "/scoring-diagnostic";
const parentHash =
  "fd4d928d64f6b48f5f08f286857a23a4c8ef65c33689d9d5bb246d0eb12635bd";
const requestHash =
  "4ebce1741fd71aed5e8b80a5ecfcba593493fd8ae51ce2806854655b877180c5";
const lease = await acquireRenewalCase(root, 1, 6);
try {
  const parentBytes = await readFile(parentRoot + "/ledger.json");
  assert.equal(fingerprint(parentBytes), parentHash);
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
  assert.equal(fingerprint(requestBytes), requestHash);
  const request = JSON.parse(requestBytes.toString("utf8"));
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
  const reserved = await reserveProbe(root, "one-time-scoring-diagnostic", 6);
  let stop = "diagnostic_complete";
  try {
    await writeArtifact(reserved.folder, "request.json", request);
    assert.equal(
      fingerprint(await readFile(parentRoot + "/ledger.json")),
      parentHash,
    );
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify(request),
        redirect: "error",
        signal: AbortSignal.timeout(60000),
      },
    );
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
} finally {
  await lease.release();
}
