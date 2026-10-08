import { z } from "zod";
import type { Purpose, Segment } from "../domain/types";
import { RUBRICS } from "../scoring/rubrics";
import { contractSchema, resolveAnalysis } from "./analysis-contract";

export const STAGED_CONTRACT = "call_analysis_staged_v2" as const;
export function extractionSchema(segments: Segment[]) {
  return contractSchema(segments)
    .omit({ assessments: true, noObjections: true })
    .extend({
      // Keep distinct promises rather than losing the visit among other actions.
      followups: contractSchema(segments).shape.followups.max(8),
    });
}
export type Extraction = z.infer<ReturnType<typeof extractionSchema>>;
export function scoringSchema(segments: Segment[], purpose: Purpose) {
  const item = contractSchema(segments).shape.assessments.element.omit({
    id: true,
  });
  // Groq cannot disambiguate two checkpoint-object union branches with the
  // same status enum. Require source context for every attributed checkpoint,
  // including an unknown/missing step, instead of a conditional object union.
  // Unattributed sources retain nullable-free coaching and may use empty refs.
  const validatedItem = segments.some((s) => s.speaker === "employee")
    ? item.extend({
        evidence: item.shape.evidence.extend({
          segmentIds: item.shape.evidence.shape.segmentIds.min(1),
        }),
      })
    : item;
  return z.strictObject({
    noObjections: z.boolean(),
    checkpoints: z.strictObject(
      Object.fromEntries(
        (purpose === "unknown" ? [] : RUBRICS[purpose]).map((c) => [
          c.id,
          validatedItem,
        ]),
      ),
    ),
  });
}
export function validateExtraction(value: unknown, segments: Segment[]) {
  const extracted = extractionSchema(segments).parse(value);
  // Validate references/evidenced claims before spending another request.
  resolveAnalysis(
    {
      ...extracted,
      noObjections: false,
      assessments: (extracted.purpose === "unknown"
        ? []
        : RUBRICS[extracted.purpose]
      ).map((c) => ({
        id: c.id,
        status: "unknown",
        reason: "Scoring pending",
        evidence: { segmentIds: [] },
        coaching: null,
      })),
    },
    segments,
    { transcriptComplete: false },
  );
  return extracted;
}
export function resolveStaged(
  extracted: Extraction,
  value: unknown,
  segments: Segment[],
  context: { transcriptComplete: boolean },
) {
  const score = scoringSchema(segments, extracted.purpose).parse(value);
  return resolveAnalysis(
    {
      ...extracted,
      noObjections: score.noObjections,
      assessments: (extracted.purpose === "unknown"
        ? []
        : RUBRICS[extracted.purpose]
      ).map((c) => ({
        id: c.id,
        ...score.checkpoints[c.id],
      })),
    },
    segments,
    context,
  );
}
