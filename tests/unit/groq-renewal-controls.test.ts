import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  acquireRenewalCase,
  admitDemoCase,
  assertFictionalAcceptance,
  fingerprint,
  verifyClientBinding,
  type InputBinding,
  type ClientInput,
} from "../../scripts/groq-renewal-controls";
const source: ClientInput = {
  segments: [
    {
      id: "s1",
      startMs: 0,
      endMs: 1000,
      text: "Fictional service concern",
      speaker: "unknown",
    },
  ],
  context: { transcriptComplete: false },
};
const files = {
  source: Buffer.from("fictional source"),
  derivative: Buffer.from("fictional derivative"),
  transcription: JSON.stringify({ segments: source.segments }),
};
const binding = (): InputBinding => ({
  version: "client-input-binding-v1",
  sourceHash: fingerprint(files.source),
  derivativeHash: fingerprint(files.derivative),
  transcriptionHash: fingerprint(files.transcription),
  transcriptionSourceHash: fingerprint(files.derivative),
  inputHash: fingerprint(JSON.stringify(source)),
  rolesVerified: false,
  completenessVerified: false,
});
it("binds exact transmitted segments/context and every source artifact", () => {
  expect(() => verifyClientBinding(source, files, binding())).not.toThrow();
  for (const key of ["source", "derivative", "transcription"] as const)
    expect(() =>
      verifyClientBinding(
        source,
        {
          ...files,
          [key]: key === "transcription" ? "changed" : Buffer.from("changed"),
        },
        binding(),
      ),
    ).toThrow("CLIENT_INPUT_BINDING_FAILED");
  const changed = structuredClone(source);
  changed.segments[0].text = "Different fictional transcript";
  expect(() => verifyClientBinding(changed, files, binding())).toThrow(
    "CLIENT_INPUT_BINDING_FAILED",
  );
  const rebound = binding();
  rebound.inputHash = fingerprint(JSON.stringify(changed));
  expect(() => verifyClientBinding(changed, files, rebound)).toThrow(
    "CLIENT_TRANSCRIPT_SUBSTITUTION",
  );
});
it("a rehashed payload cannot promote unaudited role or completeness", () => {
  for (const kind of ["role", "complete"]) {
    const changed = structuredClone(source);
    if (kind === "role") changed.segments[0].speaker = "employee";
    else changed.context.transcriptComplete = true;
    const b = binding();
    b.inputHash = fingerprint(JSON.stringify(changed));
    expect(() => verifyClientBinding(changed, files, b)).toThrow(
      "CLIENT_SOURCE_AUDIT_REQUIRED",
    );
  }
});
it("client probes require complete explicit semantic acceptance bound to this input", () => {
  expect(() =>
    assertFictionalAcceptance({ semanticPass: true }, binding().inputHash, {
      sourceHash: "a".repeat(64),
      resultHash: "b".repeat(64),
    }),
  ).toThrow("FICTIONAL_ACCEPTANCE_REQUIRED");
  const r = {
    version: "fictional-semantic-acceptance-v1",
    status: "accepted",
    coverage: [
      "purpose",
      "outcomes",
      "followups",
      "facts",
      "checkpoints",
      "coaching",
    ],
    inputHash: binding().inputHash,
    sourceHash: "a".repeat(64),
    resultHash: "b".repeat(64),
    schemaAccepted: true,
    safetyAccepted: true,
    reviewedAt: "2026-10-09T00:00:00Z",
    artifact: "fictional-audit.json",
  };
  const known = { sourceHash: r.sourceHash, resultHash: r.resultHash };
  expect(() =>
    assertFictionalAcceptance(r, binding().inputHash, known),
  ).not.toThrow();
  expect(() =>
    assertFictionalAcceptance(
      { ...r, coverage: ["purpose"] },
      binding().inputHash,
      known,
    ),
  ).toThrow();
  expect(() => assertFictionalAcceptance(r, "c".repeat(64), known)).toThrow();
  expect(() =>
    assertFictionalAcceptance(
      { ...r, resultHash: "d".repeat(64) },
      binding().inputHash,
      known,
    ),
  ).toThrow();
});
it("holds a case lock across stage gaps and refuses an entire sequence without headroom", async () => {
  const root = ".private/qa/renewal-controls-" + randomUUID();
  await mkdir(root, { recursive: true });
  await writeFile(
    root + "/ledger.json",
    JSON.stringify({
      requests: Array.from({ length: 10 }, (_, i) => ({ ordinal: i + 1 })),
    }),
  );
  const first = await acquireRenewalCase(root, 2);
  await expect(acquireRenewalCase(root, 1)).rejects.toThrow();
  await first.release();
  await writeFile(
    root + "/ledger.json",
    JSON.stringify({
      requests: Array.from({ length: 11 }, (_, i) => ({ ordinal: i + 1 })),
    }),
  );
  await expect(acquireRenewalCase(root, 2)).rejects.toThrow(
    "PROBE_SEQUENCE_CAP",
  );
  const last = await acquireRenewalCase(root, 1);
  await last.release();
});
it("enforces a six-request phase cap before acquiring a provider sequence", async () => {
  const root = ".private/qa/demo-cap-" + randomUUID();
  await mkdir(root, { recursive: true });
  await writeFile(
    root + "/ledger.json",
    JSON.stringify({ requests: Array(5).fill({}) }),
  );
  await expect(acquireRenewalCase(root, 2, 6)).rejects.toThrow(
    "PROBE_SEQUENCE_CAP",
  );
  const last = await acquireRenewalCase(root, 1, 6);
  await last.release();
});
it("requires each prior fictional result's hash-bound six-area audit before another case", async () => {
  const root = ".private/qa/demo-audit-" + randomUUID();
  await mkdir(root, { recursive: true });
  await expect(admitDemoCase(root, "one-time")).resolves.toBeUndefined();
  await writeFile(
    root + "/ledger.json",
    JSON.stringify({ requests: [{ case: "one-time" }] }),
  );
  await expect(admitDemoCase(root, "service")).rejects.toThrow();
  const resultBytes = JSON.stringify({ source, result: { fictional: true } });
  await writeFile(root + "/one-time-result.json", resultBytes);
  await writeFile(
    root + "/one-time-acceptance.json",
    JSON.stringify({
      version: "fictional-semantic-acceptance-v1",
      status: "accepted",
      coverage: [
        "purpose",
        "outcomes",
        "followups",
        "facts",
        "checkpoints",
        "coaching",
      ],
      inputHash: fingerprint(JSON.stringify(source)),
      sourceHash: fingerprint(JSON.stringify(source)),
      resultHash: fingerprint(resultBytes),
      schemaAccepted: true,
      safetyAccepted: true,
      reviewedAt: "2026-10-09T00:00:00Z",
      artifact: "one-time-audit.json",
    }),
  );
  await expect(admitDemoCase(root, "service")).resolves.toBeUndefined();
  await expect(admitDemoCase(root, "one-time")).rejects.toThrow(
    "PROBE_CASE_ALREADY_ATTEMPTED",
  );
  await writeFile(root + "/one-time-result.json", resultBytes + " ");
  await expect(admitDemoCase(root, "service")).rejects.toThrow(
    "FICTIONAL_ACCEPTANCE_REQUIRED",
  );
});
