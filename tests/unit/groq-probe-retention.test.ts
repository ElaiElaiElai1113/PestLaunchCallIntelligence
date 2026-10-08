import { expect, it } from "vitest";
import {
  retainProbeFailure,
  admitScoringDiagnostic,
  acquireScoringDiagnosticCase,
  assertDiagnosticHash,
  withScoringDiagnosticCase,
} from "../../scripts/groq-probe-retention";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  acquireRenewalCase,
  fingerprint,
} from "../../scripts/groq-renewal-controls";
import { reserveProbe } from "../../scripts/groq-probe-ledger";

it("retains failed generation only for known fictional diagnostic artifacts", () => {
  const body = {
    error: {
      code: "json_validate_failed",
      type: "invalid_request_error",
      failed_generation: '{"fictional":true}',
      message: "unallowlisted detail",
      secret: "must never be retained",
    },
  };
  expect(retainProbeFailure(body, true)).toEqual({
    error: {
      code: "json_validate_failed",
      type: "invalid_request_error",
      failed_generation: '{"fictional":true}',
    },
  });
  expect(retainProbeFailure(body, false)).toEqual({
    error: { code: "json_validate_failed", type: "invalid_request_error" },
  });
});
it("releases parent and child after an asynchronous operation failure", async () => {
  const parent = ".private/qa/diagnostic-operation-" + randomUUID();
  await mkdir(parent, { recursive: true });
  await expect(
    withScoringDiagnosticCase(parent, parent + "/child", async () => {
      throw new Error("FICTIONAL_TRANSPORT_FAILED");
    }),
  ).rejects.toThrow("FICTIONAL_TRANSPORT_FAILED");
  const retry = await acquireScoringDiagnosticCase(parent, parent + "/child");
  await retry.release();
});
it("keeps the parent case exclusively owned throughout the child diagnostic", async () => {
  const parent = ".private/qa/diagnostic-lock-" + randomUUID();
  await mkdir(parent, { recursive: true });
  const other = await acquireRenewalCase(parent, 2, 6);
  await expect(
    acquireScoringDiagnosticCase(parent, parent + "/child"),
  ).rejects.toThrow();
  await other.release();
  const diagnostic = await acquireScoringDiagnosticCase(
    parent,
    parent + "/child",
  );
  await expect(acquireRenewalCase(parent, 1, 6)).rejects.toThrow();
  await expect(
    acquireScoringDiagnosticCase(parent, parent + "/other-child"),
  ).rejects.toThrow();
  await diagnostic.release();
  const next = await acquireRenewalCase(parent, 1, 6);
  await next.release();
});
it("refuses changed bound artifacts and a second reservation under hard cap one", async () => {
  const bytes = Buffer.from("fictional immutable source/request/extraction");
  expect(() => assertDiagnosticHash(bytes, fingerprint(bytes))).not.toThrow();
  expect(() =>
    assertDiagnosticHash(Buffer.from("changed"), fingerprint(bytes)),
  ).toThrow("DIAGNOSTIC_BINDING_FAILED");
  const root = ".private/qa/diagnostic-cap-" + randomUUID();
  const first = await reserveProbe(root, "fictional", 1);
  await first.finish();
  await expect(reserveProbe(root, "fictional", 1)).rejects.toThrow(
    "PROBE_REQUEST_CAP",
  );
});
it("releases its parent on child admission failure without clearing the existing child lock", async () => {
  const parent = ".private/qa/diagnostic-release-" + randomUUID();
  await mkdir(parent, { recursive: true });
  const child = parent + "/child";
  const existing = await acquireRenewalCase(child, 1, 1);
  await expect(acquireScoringDiagnosticCase(parent, child)).rejects.toThrow();
  const parentCheck = await acquireRenewalCase(parent, 1, 6);
  await parentCheck.release();
  await expect(acquireRenewalCase(child, 1, 1)).rejects.toThrow();
  await existing.release();
  const reserved = await reserveProbe(child, "fictional", 1);
  await reserved.finish();
  await expect(acquireScoringDiagnosticCase(parent, child)).rejects.toThrow(
    "PROBE_SEQUENCE_CAP",
  );
  const released = await acquireRenewalCase(parent, 1, 6);
  await released.release();
});
it("allows only one diagnostic against the exact stopped two-request fictional phase", () => {
  const parent = {
    stopped: "provider_failure",
    requests: [{ case: "one-time" }, { case: "one-time" }],
  };
  expect(() => admitScoringDiagnostic(parent, 0)).not.toThrow();
  expect(() => admitScoringDiagnostic(parent, 1)).toThrow(
    "DIAGNOSTIC_ALREADY_ATTEMPTED",
  );
  expect(() =>
    admitScoringDiagnostic({ ...parent, stopped: undefined }, 0),
  ).toThrow();
  expect(() =>
    admitScoringDiagnostic(
      {
        ...parent,
        requests: [
          { case: "client-001-analysis" },
          { case: "client-001-analysis" },
        ],
      },
      0,
    ),
  ).toThrow();
  expect(() =>
    admitScoringDiagnostic(
      { ...parent, requests: Array(6).fill({ case: "one-time" }) },
      0,
    ),
  ).toThrow();
});
