import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { GroqProvider } from "../src/lib/groq/provider";
import { sampleCall } from "../src/lib/samples/fixtures";
import { computeScore } from "../src/lib/scoring/engine";
import { auditProbeAnalysis, optionalProbesAllowed } from "./groq-probe-audit";
import type { Segment } from "../src/lib/domain/types";
import { buildAnalysisRequest } from "../src/lib/groq/analysis-request";
import { resolveSampleRoot } from "../src/lib/server/sample-paths";
import {
  reserveProbe,
  writeArtifact,
  tokenResetMs,
  assertProbeDestination,
  type ProbeLedger,
} from "./groq-probe-ledger";

const cases = [
  "known-one-time",
  "saved-asr",
  "known-service",
  "known-retention",
  "repeat-one-time",
];
const caseName = process.argv[process.argv.indexOf("--case") + 1];
assert.ok(
  process.argv.includes("--run") && process.argv.includes("--free-confirmed"),
  "Explicit fictional Free test opt-in is required",
);
assert.ok(cases.includes(caseName), "Select an approved fictional case");
const root = resolveSampleRoot(
  process.cwd(),
  ".private/qa/groq-reference-20261009",
);
let ledger: ProbeLedger = { requests: [] };
try {
  ledger = JSON.parse(await readFile(root + "/ledger.json", "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
assert.ok(
  !ledger.stopped && ledger.requests.length < 6,
  "This round is stopped or exhausted",
);
if (ledger.requests.length < 3)
  assert.equal(
    caseName,
    cases[ledger.requests.length],
    "Initial cases must stay in reviewed order",
  );
else
  assert.ok(
    optionalProbesAllowed(ledger),
    "Initial cases have unresolved acceptance; no optional probes",
  );
while (ledger.notBefore && Date.now() < ledger.notBefore) {
  const delay = Math.min(30000, ledger.notBefore - Date.now());
  console.log(
    JSON.stringify({
      case: caseName,
      quotaWaitSeconds: Math.ceil(delay / 1000),
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}
const configuration = await readFile(".env.local", "utf8");
assert.ok(
  !/^REAL_CALL_PROCESSING_ENABLED=(?:true|"true"|'true')\s*$/m.test(
    configuration,
  ),
  "Real customer processing must remain disabled",
);
const apiKey = configuration.match(/^GROQ_API_KEY=(.*)$/m)?.[1]?.trim();
assert.ok(apiKey, "Server test key required");
const key =
  caseName === "known-service"
    ? "service"
    : caseName === "known-retention"
      ? "retention"
      : "one-time";
const fixture = sampleCall(key, "fictional-provider-probe");
const segments: Segment[] =
  caseName === "saved-asr"
    ? JSON.parse(
        await readFile(".private/qa/groq-fictional-20261009/asr.json", "utf8"),
      ).segments
    : fixture.segments;
if (caseName === "saved-asr")
  assert.ok(
    segments.every((s) => s.speaker === "unknown"),
    "Saved ASR roles must not be inferred",
  );
const context = { transcriptComplete: caseName !== "saved-asr" };
const { budget } = buildAnalysisRequest(segments, context);
const sourceHash = createHash("sha256")
  .update(JSON.stringify({ segments, context }))
  .digest("hex");
const run = await reserveProbe(root, caseName);
const metadata: Record<string, unknown> = {
  ordinal: run.entry.ordinal,
  case: caseName,
  at: run.entry.at,
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceHash,
  budget,
  transport: false,
  wirePublicAccepted: false,
  safetyAccepted: false,
  semanticPass: false,
  automatedChecksPassed: false,
  semanticAuditStatus: "not_reached",
};
let status: number | undefined,
  reset: string | null = null,
  remainingRequests: string | null = null;
let fetches = 0;
try {
  const provider = new GroqProvider({
    apiKey,
    fetch: async (input, init) => {
      assertProbeDestination(input);
      assert.equal(++fetches, 1, "No extra provider requests");
      assert.equal(typeof init?.body, "string");
      const request = JSON.parse(String(init!.body));
      assert.equal(request.model, "openai/gpt-oss-120b");
      assert.equal(request.max_completion_tokens, 3000);
      assert.equal(request.include_reasoning, false);
      metadata.requestHash = createHash("sha256")
        .update(String(init!.body))
        .digest("hex");
      metadata.schemaHash = createHash("sha256")
        .update(JSON.stringify(request.response_format))
        .digest("hex");
      await writeArtifact(run.folder, "request.json", request);
      const response = await fetch(input, { ...init, redirect: "error" });
      status = response.status;
      reset = response.headers.get("x-ratelimit-reset-tokens");
      remainingRequests = response.headers.get(
        "x-ratelimit-remaining-requests",
      );
      metadata.status = status;
      metadata.transport = response.ok;
      metadata.quota = {
        remainingTokens: response.headers.get("x-ratelimit-remaining-tokens"),
        tokenReset: reset,
        remainingRequests,
        requestReset: response.headers.get("x-ratelimit-reset-requests"),
      };
      const body = await response.clone().json();
      if (Array.isArray(body.choices))
        for (const choice of body.choices) {
          if (choice.message) delete choice.message.reasoning;
        }
      // Error generations can contain model reasoning; preserve code only there.
      if (!response.ok) {
        await writeArtifact(run.folder, "response.json", {
          error: {
            code: body.error?.code ?? null,
            type: body.error?.type ?? null,
          },
        });
      } else await writeArtifact(run.folder, "response.json", body);
      metadata.responseHash = createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
      metadata.finishReason = body.choices?.[0]?.finish_reason ?? null;
      metadata.usage = body.usage ?? null;
      metadata.providerCode = body.error?.code ?? null;
      return response;
    },
  });
  const result = await provider.analyze(segments, context);
  metadata.wirePublicAccepted = true;
  const score = computeScore(result.effective);
  assert.notEqual(result.effective.outcomes.paymentCollected.value, true);
  assert.notEqual(result.effective.outcomes.agreementSigned.value, true);
  if (caseName === "saved-asr") {
    assert.equal(result.effective.complete, false);
    assert.equal(score.grade, null);
    assert.equal(result.effective.noObjections, false);
    assert.equal(result.effective.coaching.length, 0);
  }
  metadata.safetyAccepted = true;
  const audit = auditProbeAnalysis(
    caseName,
    fixture,
    result.effective,
    segments,
  );
  metadata.purpose = result.effective.purpose;
  metadata.score = score;
  metadata.automatedChecks = audit.automated;
  metadata.automatedChecksPassed = audit.automated.passed;
  metadata.semanticAuditStatus = audit.semanticStatus;
  metadata.semanticPass = audit.semanticAccepted;
  run.entry.audit = audit;
  run.entry.sourceHash = audit.sourceHash;
  run.entry.resultHash = audit.resultHash;
  await writeArtifact(run.folder, "accepted.json", result);
  run.entry.accepted = true;
  run.entry.semanticPass = metadata.semanticPass === true;
} catch (error) {
  metadata.error =
    error instanceof Error &&
    [
      "INVALID_EVIDENCE",
      "INVALID_COACHING",
      "INCOMPLETE_ANALYSIS",
      "ANALYSIS_BUDGET_EXCEEDED",
    ].includes(error.message)
      ? error.message
      : error instanceof Error
        ? error.name
        : "ProbeFailure";
  if (error instanceof z.ZodError)
    metadata.validationIssues = error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
    }));
  run.entry.accepted = false;
  run.entry.semanticPass = false;
  process.exitCode = 1;
} finally {
  await writeArtifact(run.folder, "metadata.json", metadata);
  const stopped =
    status === 413 || status === 429
      ? "quota_stop"
      : status === 401 || status === 403
        ? "credential_or_access_stop"
        : fetches === 0
          ? "local_admission_stop"
          : status === undefined
            ? "unknown_network_state"
            : remainingRequests === "0"
              ? "daily_quota_exhausted"
              : undefined;
  await run.finish({
    notBefore: Date.now() + (tokenResetMs(reset) ?? 75000) + 2000,
    ...(stopped ? { stopped } : {}),
  });
  console.log(
    JSON.stringify({
      ordinal: run.entry.ordinal,
      case: caseName,
      status,
      wirePublicAccepted: metadata.wirePublicAccepted,
      safetyAccepted: metadata.safetyAccepted,
      automatedChecksPassed: metadata.automatedChecksPassed,
      semanticAuditStatus: metadata.semanticAuditStatus,
      semanticAccepted: metadata.semanticPass,
      error: metadata.error ?? null,
      reportedUsage: metadata.usage ?? null,
    }),
  );
}
