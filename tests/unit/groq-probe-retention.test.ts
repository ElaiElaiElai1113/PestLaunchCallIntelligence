import { expect, it } from "vitest";
import {
  retainProbeFailure,
  admitScoringDiagnostic,
} from "../../scripts/groq-probe-retention";

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
