import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { GroqProvider } from "../src/lib/groq/provider";
import { sampleCall } from "../src/lib/samples/fixtures";
import { computeScore } from "../src/lib/scoring/engine";
import { reserveProbe, writeArtifact, tokenResetMs } from "./groq-probe-ledger";
import {
  acquireRenewalCase,
  admitDemoCase,
  assertFictionalAcceptance,
  fingerprint,
  verifyClientBinding,
} from "./groq-renewal-controls";
import { resolveSampleRoot } from "../src/lib/server/sample-paths";

// The human's overnight demo request authorizes a separate bounded Free phase.
// No option can reset or change the historical renewal's ledger/cap.
const demoPhase = process.argv.includes("--demo-validation-20261009");
const cap = demoPhase ? 6 : 12;
const root = resolveSampleRoot(
  process.cwd(),
  demoPhase
    ? ".private/qa/groq-demo-validation-20261009"
    : ".private/qa/groq-renewal-20261009",
);
const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
assert.ok(
  process.argv.includes("--run") &&
    process.argv.includes("--free-zdr-confirmed"),
);
const caseName = arg("--case");
assert.ok(
  [
    "one-time",
    "service",
    "retention",
    "client-001-asr",
    "client-001-analysis",
  ].includes(caseName),
);
assert.ok(
  !demoPhase || ["one-time", "service", "retention"].includes(caseName),
  "Demo phase is fictional only",
);
const caseLease = await acquireRenewalCase(
  root,
  caseName.endsWith("asr") ? 1 : 2,
  cap,
);
try {
  if (demoPhase) await admitDemoCase(root, caseName);
  const clientCase = caseName.startsWith("client-");
  let admittedClientSource;
  if (clientCase) {
    const review = JSON.parse(
      await readFile(root + "/source/preparation.json", "utf8"),
    );
    assert.ok(
      review.call === "CALL-001" &&
        review.privacyVerified === true &&
        review.zdrVerified === true,
    );
    const audio = await readFile(root + "/source/sanitized.wav");
    const original = await readFile(root + "/source/call-001.mp3");
    assert.equal(fingerprint(original), review.sourceHash);
    assert.equal(
      createHash("sha256").update(audio).digest("hex"),
      review.derivativeHash,
    );
    let targetHash = review.derivativeHash;
    if (caseName.endsWith("analysis")) {
      admittedClientSource = JSON.parse(
        await readFile(root + "/source/analysis-input.json", "utf8"),
      );
      const binding = JSON.parse(
        await readFile(root + "/source/input-binding.json", "utf8"),
      );
      const transcription = await readFile(root + "/source/asr.json", "utf8");
      verifyClientBinding(
        admittedClientSource,
        { source: original, derivative: audio, transcription },
        binding,
      );
      targetHash = binding.inputHash;
      assert.equal(review.inputHash, binding.inputHash);
      assert.equal(review.transcriptionHash, binding.transcriptionHash);
      assert.equal(
        review.transcriptionSourceHash,
        binding.transcriptionSourceHash,
      );
    }
    const acceptance = JSON.parse(
      await readFile(root + "/fictional-acceptance.json", "utf8"),
    );
    assert.ok(
      /^(one-time|service|retention)-result\.json$/.test(
        acceptance.resultArtifact,
      ),
      "Known fictional artifact required",
    );
    const acceptedBytes = await readFile(
      root + "/" + acceptance.resultArtifact,
      "utf8",
    );
    const accepted = JSON.parse(acceptedBytes);
    assertFictionalAcceptance(acceptance, targetHash, {
      sourceHash: fingerprint(
        JSON.stringify({
          segments: accepted.source.segments,
          context: accepted.source.context,
        }),
      ),
      resultHash: fingerprint(acceptedBytes),
    });
  }
  // Admission and full-sequence headroom precede credential reads/reservation.
  const config = await readFile(".env.local", "utf8");
  const apiKey = config
    .match(/^GROQ_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
  assert.ok(apiKey, "Server-only key required");
  const fixture = clientCase
    ? null
    : sampleCall(caseName, "fictional-live-renewal");
  const source = fixture
    ? { segments: fixture.segments, context: { transcriptComplete: true } }
    : caseName.endsWith("analysis")
      ? admittedClientSource
      : null;
  let requests = 0;
  const provider = new GroqProvider({
    apiKey,
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.ok(
        url.origin === "https://api.groq.com" &&
          !url.search &&
          !url.username &&
          !url.password,
      );
      assert.ok(
        url.pathname === "/openai/v1/chat/completions" ||
          (caseName === "client-001-asr" &&
            url.pathname === "/openai/v1/audio/transcriptions"),
      );
      while (true) {
        let ledger;
        try {
          ledger = JSON.parse(await readFile(root + "/ledger.json", "utf8"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (!ledger?.notBefore || ledger.notBefore <= Date.now()) break;
        console.log(
          JSON.stringify({
            case: caseName,
            quotaWaitSeconds: Math.ceil((ledger.notBefore - Date.now()) / 1000),
          }),
        );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30000, ledger.notBefore - Date.now())),
        );
      }
      const reserved = await reserveProbe(root, caseName, cap);
      requests++;
      const stage = url.pathname.includes("audio")
        ? "transcription"
        : JSON.parse(String(init?.body)).response_format.json_schema.name;
      await writeArtifact(
        reserved.folder,
        "request.json",
        url.pathname.includes("audio")
          ? {
              stage,
              model: "whisper-large-v3",
              sourceHash: JSON.parse(
                await readFile(root + "/source/preparation.json", "utf8"),
              ).derivativeHash,
            }
          : JSON.parse(String(init?.body)),
      );
      let stopped: string | undefined;
      let notBefore = Date.now() + 65000;
      try {
        const response = await fetch(input, { ...init, redirect: "error" });
        const body = await response.clone().json();
        const retained =
          response.ok && !url.pathname.includes("audio")
            ? {
                choices: body.choices.map(
                  (c: {
                    finish_reason: string;
                    message: { content: string };
                  }) => ({
                    finish_reason: c.finish_reason,
                    message: { content: c.message.content },
                  }),
                ),
                usage: body.usage,
              }
            : response.ok
              ? body
              : { error: { code: body.error?.code, type: body.error?.type } };
        await writeArtifact(reserved.folder, "response.json", retained);
        const reset = response.headers.get("x-ratelimit-reset-tokens");
        notBefore = Date.now() + Math.max(65000, tokenResetMs(reset) ?? 0);
        const metadata = {
          at: new Date().toISOString(),
          case: caseName,
          stage,
          revision: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          status: response.status,
          reportedTokens: body.usage?.total_tokens ?? null,
          providerCode: body.error?.code ?? null,
          remainingTokens: response.headers.get("x-ratelimit-remaining-tokens"),
          resetTokens: reset,
        };
        await writeArtifact(reserved.folder, "metadata.json", metadata);
        console.log(JSON.stringify(metadata));
        if (!response.ok) stopped = "provider_failure";
        return response;
      } catch {
        stopped = "transport_failure";
        throw new Error("PROVIDER_TRANSPORT_FAILED");
      } finally {
        await reserved.finish({ notBefore, ...(stopped ? { stopped } : {}) });
      }
    },
  });
  try {
    if (caseName === "client-001-asr") {
      const result = await provider.transcribe(
        await readFile(root + "/source/sanitized.wav"),
        "wav",
      );
      await writeFile(
        root + "/source/asr.json",
        JSON.stringify(result, null, 2),
        { flag: "wx" },
      );
      console.log(
        JSON.stringify({
          case: caseName,
          accepted: true,
          segments: result.segments.length,
          durationMs: result.durationMs,
          complete: result.complete,
          requests,
        }),
      );
    } else {
      const result = await provider.analyze(source.segments, source.context);
      await writeFile(
        root + "/" + caseName + "-result.json",
        JSON.stringify({ source, result }, null, 2),
        { flag: "wx" },
      );
      console.log(
        JSON.stringify({
          case: caseName,
          wirePublicAccepted: true,
          purpose: result.effective.purpose,
          score: computeScore(result.effective),
          coaching: result.effective.coaching.length,
          followups: result.effective.followups.length,
          requests,
          semanticAcceptance: "pending_review",
        }),
      );
    }
  } catch (error) {
    if (demoPhase && requests > 0) {
      const ledgerPath = root + "/ledger.json";
      const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
      ledger.stopped ??= "analysis_rejected";
      await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    }
    // SDK/Zod error bodies may contain customer text; only known safe categories.
    const safe =
      error instanceof Error &&
      [
        "ANALYSIS_BUDGET_EXCEEDED",
        "INVALID_EVIDENCE",
        "INVALID_COACHING",
        "INCOMPLETE_ANALYSIS",
      ].includes(error.message)
        ? error.message
        : "PROBE_REJECTED";
    console.log(
      JSON.stringify({
        case: caseName,
        accepted: false,
        error: safe,
        requests,
      }),
    );
    process.exitCode = 1;
  }
} finally {
  await caseLease.release();
}
