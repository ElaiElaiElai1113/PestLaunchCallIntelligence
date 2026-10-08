import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { GroqProvider } from "../src/lib/groq/provider";
import { sampleCall } from "../src/lib/samples/fixtures";
import {
  buildAnalysisRequest,
  buildScoringRequest,
} from "../src/lib/groq/analysis-request";
import { extractionSchema } from "../src/lib/groq/staged-contract";
import { computeScore } from "../src/lib/scoring/engine";
import { fingerprint } from "./groq-renewal-controls";
import {
  assertProbeDestination,
  reserveProbe,
  tokenResetMs,
  writeArtifact,
} from "./groq-probe-ledger";
import {
  acquireStoppedPhaseCase,
  admitSemanticRepair,
  assertDiagnosticHash,
  retainProbeFailure,
} from "./groq-probe-retention";

// One dormant revised fictional pair. No root/case/request overrides, old cache,
// customer processing, parent reopening, optional case or new six-call allowance.
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
assert.ok(
  !process.env.GROQ_BASE_URL ||
    process.env.GROQ_BASE_URL === "https://api.groq.com",
  "PROBE_DESTINATION_REFUSED",
);
const parentRoot = ".private/qa/groq-demo-validation-20261009";
const diagnosticRoot = parentRoot + "/diagnostics/exact-scoring-once";
const root = parentRoot + "/repairs/one-time-semantic";
const parentHash =
  "fd4d928d64f6b48f5f08f286857a23a4c8ef65c33689d9d5bb246d0eb12635bd";
const diagnosticHash =
  "5467893e469ee7f1f1913bbf7cf25484d6daf7434bd6d147eef18680198ece92";
const sourceHash =
  "e9cdf158b84e46ec0ac09f1c38db4457e2182b80652fa38a7100f49fdad6a165";
const requestHashes = [
  "eb6b4af0a9300d3c3e5a92a1249159e7f6fe02e805e549d601661eb81049b915",
  "511514aac21518317aa380350602e535d2548a2d79671fe4ff84027897655db3",
];
const lease = await acquireStoppedPhaseCase(parentRoot, root, 2);
let requests = 0;
try {
  async function parents() {
    const p = await readFile(parentRoot + "/ledger.json"),
      d = await readFile(diagnosticRoot + "/ledger.json");
    assertDiagnosticHash(p, parentHash);
    assertDiagnosticHash(d, diagnosticHash);
    return {
      parent: JSON.parse(p.toString("utf8")),
      diagnostic: JSON.parse(d.toString("utf8")),
    };
  }
  const { parent, diagnostic } = await parents();
  let own = { requests: [] as unknown[], notBefore: 0 };
  try {
    own = JSON.parse(await readFile(root + "/ledger.json", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  admitSemanticRepair(parent, diagnostic, own.requests.length);
  const fixture = sampleCall("one-time", "fictional-live-renewal");
  const source = {
    segments: fixture.segments,
    context: { transcriptComplete: true },
  };
  assertDiagnosticHash(JSON.stringify(source), sourceHash);
  const expected = [
    buildAnalysisRequest(source.segments, source.context).request,
    buildScoringRequest(source.segments, source.context, "sales").request,
  ];
  expected.forEach((request, index) =>
    assertDiagnosticHash(JSON.stringify(request), requestHashes[index]),
  );
  const config = await readFile(".env.local", "utf8");
  const apiKey = config
    .match(/^GROQ_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  assert.ok(apiKey, "Server-only key required");
  const provider = new GroqProvider({
    apiKey,
    fetch: async (input, init) => {
      assertProbeDestination(input);
      const body = JSON.parse(String(init?.body));
      assert.ok(requests < 2, "PROBE_REQUEST_CAP");
      assertDiagnosticHash(JSON.stringify(body), requestHashes[requests]);
      await parents();
      while (true) {
        try {
          own = JSON.parse(await readFile(root + "/ledger.json", "utf8"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const notBefore = Math.max(
          parent.notBefore ?? 0,
          diagnostic.notBefore ?? 0,
          own.notBefore ?? 0,
        );
        if (notBefore <= Date.now()) break;
        console.log(
          JSON.stringify({
            quotaWaitSeconds: Math.ceil((notBefore - Date.now()) / 1000),
          }),
        );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30000, notBefore - Date.now())),
        );
      }
      await parents();
      const reserved = await reserveProbe(root, "one-time-semantic-repair", 2);
      requests++;
      let stop: string | undefined,
        notBefore = Date.now() + 65000;
      try {
        await writeArtifact(reserved.folder, "request.json", body);
        const response = await fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(60000),
        });
        const returned = await response.clone().json();
        const retained = response.ok
          ? {
              choices: returned.choices.map(
                (c: {
                  finish_reason: string;
                  message: { content: string };
                }) => ({
                  finish_reason: c.finish_reason,
                  message: { content: c.message.content },
                }),
              ),
              usage: returned.usage,
            }
          : retainProbeFailure(returned, true);
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
          providerCode: returned.error?.code ?? null,
          reportedTokens: returned.usage?.total_tokens ?? null,
          stage: body.response_format.json_schema.name,
          requestHash: fingerprint(JSON.stringify(body)),
          sourceHash,
          revision: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          aggregateRequests: 3 + requests,
        };
        await writeArtifact(reserved.folder, "metadata.json", metadata);
        console.log(JSON.stringify(metadata));
        if (!response.ok) stop = "provider_failure";
        if (response.ok && requests === 1) {
          const parsed = extractionSchema(source.segments).parse(
            JSON.parse(returned.choices[0].message.content),
          );
          if (parsed.purpose !== "sales") {
            stop = "extraction_purpose_rejected";
            throw new Error("EXTRACTION_PURPOSE_REJECTED");
          }
        }
        return response;
      } catch {
        stop ??= "transport_or_schema_rejection";
        throw new Error("REPAIR_REQUEST_REJECTED");
      } finally {
        await reserved.finish({
          notBefore,
          ...(stop ? { stopped: stop } : {}),
        });
      }
    },
  });
  try {
    const result = await provider.analyze(source.segments, source.context);
    assert.equal(requests, 2);
    await writeFile(
      root + "/result.json",
      JSON.stringify(
        { source, result, semanticAcceptance: "pending_review" },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        wirePublicAccepted: true,
        score: computeScore(result.effective),
        coaching: result.effective.coaching.length,
        aggregateRequests: 3 + requests,
        semanticAcceptance: "pending_review",
      }),
    );
  } catch {
    process.exitCode = 1;
    console.log(
      JSON.stringify({
        accepted: false,
        error: "REPAIR_REJECTED",
        requests,
        aggregateRequests: 3 + requests,
      }),
    );
  } finally {
    if (requests) {
      const path = root + "/ledger.json",
        ledger = JSON.parse(await readFile(path, "utf8"));
      ledger.stopped ??= process.exitCode
        ? "analysis_rejected"
        : "pair_complete_pending_review";
      await writeFile(path, JSON.stringify(ledger, null, 2));
    }
  }
} finally {
  await lease.release();
}
