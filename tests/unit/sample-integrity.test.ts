import { expect, it } from "vitest";
import { SAMPLE_OPTIONS, sampleCall } from "@/lib/samples/fixtures";
import { validateEvidence } from "@/lib/domain/evidence";
import {
  guardAssessment,
  assessmentContext,
} from "@/lib/domain/assessment-guards";
import { computeScore } from "@/lib/scoring/engine";
import { analysisSchema } from "@/lib/domain/schemas";
it.each(SAMPLE_OPTIONS)("$id original and effective analyses match the strict contract", (option) => {
  const call = sampleCall(option.id, `fictional-${option.id}`);
  expect(analysisSchema.safeParse(call.originalAnalysis).success).toBe(true);
  expect(analysisSchema.safeParse(call.analysis).success).toBe(true);
});
it.each(SAMPLE_OPTIONS)(
  "$id is internally accurate under production evidence guards",
  (option) => {
    const call = sampleCall(option.id, `fictional-${option.id}`);
    const original = structuredClone(call.originalAnalysis);
    expect(validateEvidence(call.analysis!, call.segments)).toEqual([]);
    const guarded = guardAssessment(
      call.analysis!,
      call.segments,
      assessmentContext(call),
    );
    expect(guarded.assessments).toEqual(call.analysis!.assessments);
    expect(guarded.coaching).toEqual(call.analysis!.coaching);
    expect(computeScore(guarded)).toEqual(call.score);
    expect(call.originalAnalysis).toEqual(original);
    expect(call.recordedAt).toBe(null);
    expect(call.rep).toBe(null);
    expect(call.direction).toBe(null);
  },
);
it("fixture final information and follow-ups match the spoken fictional text", () => {
  const service = sampleCall("service", "fictional-service");
  expect(
    service.analysis!.assessments.find((x) => x.id === "final_information")!
      .status,
  ).toBe("missed");
  expect(service.analysis!.followups[0].state).toBe("accepted");
  const one = sampleCall("one-time", "fictional-one");
  expect(one.analysis!.noObjections).toBe(false);
  expect(
    one.analysis!.assessments.find((x) => x.id === "summary")!.status,
  ).toBe("passed");
  expect(
    one.analysis!.assessments.find((x) => x.id === "final_information")!.status,
  ).toBe("missed");
  expect(one.analysis!.outcomes.paymentCollected.value).toBe(false);
  expect(one.analysis!.outcomes.agreementSigned.value).toBe(null);
  expect(
    sampleCall("retention", "fictional-retention").analysis!.followups[0].state,
  ).toBe("promised");
});
