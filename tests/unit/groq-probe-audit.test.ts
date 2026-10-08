import { it, expect } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { wireFromAnalysis } from "../helpers/provider-wire";
import { resolveAnalysis } from "@/lib/groq/analysis-contract";
import { guardAssessment } from "@/lib/domain/assessment-guards";
import {
  auditProbeAnalysis,
  optionalProbesAllowed,
  AUDIT_AREAS,
} from "../../scripts/groq-probe-audit";

it("wrong known quote/treatment outcomes cannot pass despite a valid accepted follow-up", () => {
  const expected = sampleCall("one-time", "fictional-audit");
  const segments = structuredClone(expected.segments);
  segments.forEach((s) => (s.speaker = "unknown"));
  const wire = wireFromAnalysis(expected.originalAnalysis!);
  wire.assessments.forEach((a) => {
    a.coaching = null;
    a.status = "unknown";
  });
  wire.complete = false;
  wire.noObjections = false;
  wire.outcomes.quoteProvided.value = false;
  wire.outcomes.treatmentAccepted.value = false;
  const { effective } = resolveAnalysis(wire, segments, {
    transcriptComplete: false,
  });
  expect(effective.followups.some((f) => f.state === "accepted")).toBe(true);
  const audit = auditProbeAnalysis("saved-asr", expected, effective, segments);
  expect(audit.automated.passed).toBe(false);
  expect(audit.automated.issues).toContain(
    "quoteProvided contradicts the known source",
  );
  expect(audit.automated.issues).toContain(
    "treatmentAccepted contradicts the known source",
  );
  expect(audit.semanticAccepted).toBe(false);
});
it("legitimate partial uncertainty stays partial rather than becoming a wrong claim or acceptance", () => {
  const expected = sampleCall("one-time", "fictional-audit"),
    actual = structuredClone(expected.analysis!);
  actual.outcomes.quoteProvided.value = null;
  actual.outcomes.treatmentAccepted.value = null;
  actual.complete = false;
  actual.coaching = [];
  const segments = structuredClone(expected.segments);
  segments.forEach((s) => (s.speaker = "unknown"));
  actual.assessments.forEach((a) => (a.status = "unknown"));
  actual.noObjections = false;
  const audit = auditProbeAnalysis("saved-asr", expected, actual, segments);
  expect(audit.automated.issues).toContain("quoteProvided remains unresolved");
  expect(audit.automated.issues).not.toContain(
    "quoteProvided contradicts the known source",
  );
  expect(audit.semanticStatus).toBe("pending");
  expect(audit.semanticAccepted).toBe(false);
});
it.each(["coaching", "facts", "objection-policy"])(
  "known-source %s gaps are not hidden by matching status and outcome values",
  (kind) => {
    const expected = sampleCall(
        kind === "objection-policy" ? "one-time" : "service",
        "fictional-audit",
      ),
      actual = structuredClone(expected.analysis!);
    if (kind === "coaching") actual.coaching = [];
    else if (kind === "objection-policy") actual.noObjections = true;
    else
      actual.facts[0].text =
        "A different fictional pest claim not established by the source.";
    const audit = auditProbeAnalysis(
      "known-service",
      expected,
      actual,
      expected.segments,
    );
    expect(audit.automated.passed).toBe(false);
    expect(audit.semanticAccepted).toBe(false);
  },
);
it("matching automatic reference checks are distinct from completed manual semantic audit", () => {
  const expected = sampleCall("service", "fictional-audit");
  const audit = auditProbeAnalysis(
    "known-service",
    expected,
    expected.analysis!,
    expected.segments,
  );
  expect(audit.automated.passed).toBe(true);
  expect(audit.semanticStatus).toBe("pending");
  expect(audit.semanticAccepted).toBe(false);
});
it("a complete audit cannot override a known contradiction or a different reviewed result", () => {
  const expected = sampleCall("service", "fictional-audit"),
    actual = structuredClone(expected.analysis!);
  actual.outcomes.quoteProvided.value = true;
  const pending = auditProbeAnalysis(
    "known-service",
    expected,
    actual,
    expected.segments,
  );
  const manual = {
    status: "accepted" as const,
    artifact: "fictional audit",
    reviewedAt: "2026-10-09T00:00:00Z",
    coverage: [...AUDIT_AREAS],
    sourceHash: pending.sourceHash,
    resultHash: pending.resultHash,
  };
  const contradictory = auditProbeAnalysis(
    "known-service",
    expected,
    actual,
    expected.segments,
    manual,
  );
  expect(contradictory.semanticAccepted).toBe(false);
  expect(contradictory.semanticStatus).toBe("pending");
  const correct = expected.analysis!;
  const different = auditProbeAnalysis(
    "known-service",
    expected,
    correct,
    expected.segments,
    manual,
  );
  expect(different.semanticAccepted).toBe(false);
  expect(different.semanticStatus).toBe("pending");
});
it("legacy or limited pass booleans never authorize optional probes", () => {
  const requests = ["known-one-time", "saved-asr", "known-service"].map(
    (caseName, i) => ({
      ordinal: i + 1,
      case: caseName,
      id: `fictional-${i}`,
      folder: `fictional-${i}`,
      at: "fictional-time",
      accepted: true,
      semanticPass: true,
    }),
  );
  expect(optionalProbesAllowed({ requests })).toBe(false);
});
it("optional admission requires complete, separate manual audit after mandatory checks", () => {
  const requests = ["known-one-time", "saved-asr", "known-service"].map(
    (caseName, i) => {
      const expected = sampleCall(
        caseName === "known-service" ? "service" : "one-time",
        "fictional-audit",
      );
      const segments = structuredClone(expected.segments);
      if (caseName === "saved-asr")
        segments.forEach((segment) => (segment.speaker = "unknown"));
      const actual = guardAssessment(expected.analysis!, segments, {
        transcriptComplete: caseName !== "saved-asr",
      });
      const pending = auditProbeAnalysis(caseName, expected, actual, segments);
      const audit = auditProbeAnalysis(caseName, expected, actual, segments, {
        status: "accepted",
        artifact: "private fictional audit reference",
        reviewedAt: "2026-10-09T00:00:00Z",
        coverage: [...AUDIT_AREAS],
        sourceHash: pending.sourceHash,
        resultHash: pending.resultHash,
      });
      return {
        ordinal: i + 1,
        case: caseName,
        id: `fictional-${i}`,
        folder: `fictional-${i}`,
        at: "fictional-time",
        accepted: true,
        sourceHash: audit.sourceHash,
        resultHash: audit.resultHash,
        audit,
      };
    },
  );
  expect(optionalProbesAllowed({ requests })).toBe(true);
  requests[1].audit.manual!.coverage = ["purpose", "followups"];
  expect(optionalProbesAllowed({ requests })).toBe(false);
  expect(
    optionalProbesAllowed({ requests, stopped: "initial_acceptance_failed" }),
  ).toBe(false);
});
