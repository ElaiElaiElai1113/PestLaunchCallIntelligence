import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { RUBRICS } from "@/lib/scoring/rubrics";
import { scoringSchema } from "@/lib/groq/staged-contract";
import { buildScoringRequest } from "@/lib/groq/analysis-request";
import { stagedFromAnalysis } from "../helpers/provider-wire";

it.each(["one-time", "service", "retention"])("requires every exact rubric key for %s", key => {
  const source = sampleCall(key,"fictional-contract");
  const scoring = stagedFromAnalysis(source.originalAnalysis!).scoring;
  const schema = scoringSchema(source.segments, source.originalAnalysis!.purpose);
  expect(schema.safeParse(scoring).success).toBe(true);
  delete scoring.checkpoints[Object.keys(scoring.checkpoints)[0]];
  expect(schema.safeParse(scoring).success).toBe(false);
  scoring.checkpoints.fabricated = {status:"unknown",reason:"Unverified",evidence:{segmentIds:[]},coaching:null};
  expect(schema.safeParse(scoring).success).toBe(false);
});
it.each(["sales", "general", "retention"] as const)("JSON Schema requires exactly the %s rubric", purpose => {
  const source = sampleCall("one-time","fictional-schema");
  const request = buildScoringRequest(source.segments,{transcriptComplete:true},purpose).request;
  const schema = request.response_format!.type === "json_schema" ? request.response_format!.json_schema.schema : {};
  const checkpoint = (schema as {properties:{checkpoints:{required:string[];additionalProperties:boolean}}}).properties.checkpoints;
  expect(checkpoint.required).toEqual(RUBRICS[purpose].map(c=>c.id));
  expect(checkpoint.additionalProperties).toBe(false);
});
