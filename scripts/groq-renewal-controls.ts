import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import type { Segment } from "../src/lib/domain/types";
export const fingerprint = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export type ClientInput = {
  segments: Segment[];
  context: { transcriptComplete: boolean };
};
export type InputBinding = {
  version: "client-input-binding-v1";
  sourceHash: string;
  derivativeHash: string;
  transcriptionHash: string;
  transcriptionSourceHash: string;
  inputHash: string;
  rolesVerified: false;
  completenessVerified: false;
};
export function verifyClientBinding(
  input: ClientInput,
  files: { source: Buffer; derivative: Buffer; transcription: string },
  binding: InputBinding,
) {
  if (
    binding.version !== "client-input-binding-v1" ||
    fingerprint(files.source) !== binding.sourceHash ||
    fingerprint(files.derivative) !== binding.derivativeHash ||
    fingerprint(files.transcription) !== binding.transcriptionHash ||
    binding.transcriptionSourceHash !== binding.derivativeHash ||
    fingerprint(
      JSON.stringify({ segments: input.segments, context: input.context }),
    ) !== binding.inputHash
  )
    throw new Error("CLIENT_INPUT_BINDING_FAILED");
  if (
    binding.rolesVerified !== false ||
    binding.completenessVerified !== false ||
    input.context.transcriptComplete ||
    input.segments.some((s) => s.speaker !== "unknown")
  )
    throw new Error("CLIENT_SOURCE_AUDIT_REQUIRED");
  const asr = JSON.parse(files.transcription) as { segments: Segment[] };
  const expected = asr.segments.map((s) => ({
    id: s.id,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
    speaker: "unknown",
  }));
  if (
    fingerprint(JSON.stringify(input.segments)) !==
    fingerprint(JSON.stringify(expected))
  )
    throw new Error("CLIENT_TRANSCRIPT_SUBSTITUTION");
}
export function assertFictionalAcceptance(
  receipt: unknown,
  inputHash: string,
  known: { sourceHash: string; resultHash: string },
) {
  const r = receipt as {
    version?: string;
    status?: string;
    coverage?: string[];
    inputHash?: string;
    sourceHash?: string;
    resultHash?: string;
    schemaAccepted?: boolean;
    safetyAccepted?: boolean;
    reviewedAt?: string;
    artifact?: string;
  };
  const areas = [
    "purpose",
    "outcomes",
    "followups",
    "facts",
    "checkpoints",
    "coaching",
  ];
  if (
    !r ||
    r.version !== "fictional-semantic-acceptance-v1" ||
    r.status !== "accepted" ||
    r.inputHash !== inputHash ||
    !/^[a-f0-9]{64}$/.test(r.sourceHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(r.resultHash ?? "") ||
    r.sourceHash !== known.sourceHash ||
    r.resultHash !== known.resultHash ||
    r.schemaAccepted !== true ||
    r.safetyAccepted !== true ||
    !r.reviewedAt ||
    !r.artifact ||
    areas.some((a) => !r.coverage?.includes(a))
  )
    throw new Error("FICTIONAL_ACCEPTANCE_REQUIRED");
}
export async function acquireRenewalCase(
  root: string,
  plannedRequests: number,
  cap: 1 | 2 | 6 | 12 = 12,
) {
  if (
    !Number.isInteger(plannedRequests) ||
    plannedRequests < 1 ||
    plannedRequests > 3
  )
    throw new Error("INVALID_REQUEST_SEQUENCE");
  await mkdir(root, { recursive: true });
  const path = root + "/case.lock";
  const lock = await open(path, "wx");
  await lock.close();
  try {
    let ledger: { requests: unknown[]; stopped?: string } = { requests: [] };
    try {
      ledger = JSON.parse(await readFile(root + "/ledger.json", "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (ledger.stopped) throw new Error("PROBE_STOPPED");
    if (ledger.requests.length + plannedRequests > cap)
      throw new Error("PROBE_SEQUENCE_CAP");
    return { release: () => unlink(path) };
  } catch (e) {
    await unlink(path);
    throw e;
  }
}

// Called under the whole-case lock, before credential access or reservations.
export async function admitDemoCase(root: string, caseName: string) {
  const allowed = ["one-time", "service", "retention"];
  if (!allowed.includes(caseName)) throw new Error("FICTIONAL_CASE_REQUIRED");
  let requests: { case: string }[] = [];
  try {
    requests = JSON.parse(
      await readFile(root + "/ledger.json", "utf8"),
    ).requests;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const previous = [...new Set(requests.map((r) => r.case))];
  if (previous.includes(caseName))
    throw new Error("PROBE_CASE_ALREADY_ATTEMPTED");
  for (const name of previous) {
    if (!allowed.includes(name)) throw new Error("FICTIONAL_CASE_REQUIRED");
    const bytes = await readFile(root + "/" + name + "-result.json", "utf8");
    const result = JSON.parse(bytes);
    const sourceHash = fingerprint(JSON.stringify(result.source));
    const receipt = JSON.parse(
      await readFile(root + "/" + name + "-acceptance.json", "utf8"),
    );
    assertFictionalAcceptance(receipt, sourceHash, {
      sourceHash,
      resultHash: fingerprint(bytes),
    });
  }
}
