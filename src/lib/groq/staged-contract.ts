import { z } from "zod";
import type { Purpose, Segment } from "../domain/types";
import { RUBRICS } from "../scoring/rubrics";
import { analysisSchema } from "../domain/schemas";
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
    coaching: true,
  });
  // Groq cannot disambiguate two checkpoint-object union branches with the
  // same status enum. Require source context for every attributed checkpoint,
  // including an unknown/missing step, instead of a conditional object union.
  // Unattributed sources retain nullable-free coaching and may use empty refs.
  const employeeIds = segments
    .filter((s) => s.speaker === "employee")
    .map((s) => s.id);
  const validatedItem = employeeIds.length
    ? item.extend({
        evidence: item.shape.evidence.extend({
          segmentIds: z
            .array(z.enum(employeeIds as [string, ...string[]]))
            .min(1)
            .max(6),
        }),
      })
    : item;
  const ids = purpose === "unknown" ? [] : RUBRICS[purpose].map((c) => c.id);
  const coach =
    ids.length && segments.some((s) => s.speaker === "employee")
      ? analysisSchema.shape.coaching.element
          .omit({ evidence: true, kind: true })
          .extend({ checkpointId: z.enum(ids as [string, ...string[]]) })
          .nullable()
      : z.null();
  return z.strictObject({
    noObjections: z.boolean(),
    coaching: z.strictObject({
      strength: coach,
      improvement1: coach,
      improvement2: coach,
    }),
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
  const coaches = new Map<
    string,
    {
      kind: "strength" | "improvement";
      title: string;
      detail: string;
      suggestedResponse: string | null;
    }
  >();
  for (const [slot, coach] of Object.entries(score.coaching)) {
    if (!coach) continue;
    if (coaches.has(coach.checkpointId)) throw new Error("INVALID_COACHING");
    const { checkpointId, ...item } = coach;
    coaches.set(checkpointId, {
      ...item,
      kind: slot === "strength" ? "strength" : "improvement",
    });
  }
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
        coaching: coaches.get(c.id) ?? null,
      })),
    },
    segments,
    context,
  );
}
