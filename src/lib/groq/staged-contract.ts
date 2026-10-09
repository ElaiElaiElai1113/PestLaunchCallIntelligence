import { z } from "zod";
import type { Purpose, Segment } from "../domain/types";
import { RUBRICS } from "../scoring/rubrics";
import { analysisSchema } from "../domain/schemas";
import { contractSchema, resolveAnalysis } from "./analysis-contract";
import { DETAIL_LABELS, materializeRecap } from "./source-recap";

export const STAGED_CONTRACT = "call_analysis_source_refs_v5" as const;
export function legacyExtractionSchema(segments: Segment[]) {
  const contract = contractSchema(segments);
  const action = contract.shape.followups.element;
  return contract.omit({ assessments: true, noObjections: true }).extend({
    // Keep distinct promises rather than losing the visit among other actions.
    followups: z
      .array(
        z.strictObject({
          evidence: action.shape.evidence,
          dueText: action.shape.dueText,
          text: action.shape.text,
          state: action.shape.state,
        }),
      )
      .max(8),
  });
}
export function extractionSchema(segments: Segment[]) {
  const legacy = legacyExtractionSchema(segments);
  const ids = segments.map((s) => s.id) as [string, ...string[]];
  const nonempty = z.strictObject({
    segmentIds: z.array(z.enum(ids)).min(1).max(6),
  });
  const empty = z.strictObject({ segmentIds: z.array(z.enum(ids)).max(6) });
  // Distinct required outer keys let Groq disambiguate the branches while
  // requiring nonempty evidence for every supported boolean claim.
  const outcome = z.union([
    z.strictObject({
      claimed: z.strictObject({ evidence: nonempty, value: z.boolean() }),
    }),
    z.strictObject({ unknown: empty }),
  ]);
  return legacy.omit({ summary: true, facts: true, outcomes: true }).extend({
    recap: nonempty,
    facts: z
      .array(
        z.strictObject({
          kind: z.enum(
            Object.keys(DETAIL_LABELS) as [
              keyof typeof DETAIL_LABELS,
              ...(keyof typeof DETAIL_LABELS)[],
            ],
          ),
          evidence: nonempty,
        }),
      )
      .max(6),
    outcomes: z.strictObject(
      Object.fromEntries(
        Object.keys(analysisSchema.shape.outcomes.shape).map((key) => [
          key,
          outcome,
        ]),
      ) as Record<
        keyof typeof analysisSchema.shape.outcomes.shape,
        typeof outcome
      >,
    ),
  });
}
export type Extraction = Omit<
  z.infer<ReturnType<typeof extractionSchema>>,
  "outcomes"
> & {
  outcomes: z.infer<ReturnType<typeof legacyExtractionSchema>>["outcomes"];
};
export function scoringSchema(
  segments: Segment[],
  purpose: Purpose,
  selectedIds?: string[],
) {
  const originalItem = contractSchema(segments).shape.assessments.element.omit({
    id: true,
    coaching: true,
  });
  // Select source support and explain it before committing to a status.
  // Same validated fields, reordered for left-to-right structured generation.
  const item = z.strictObject({
    evidence: originalItem.shape.evidence,
    reason: originalItem.shape.reason,
    status: originalItem.shape.status,
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
  const allIds = purpose === "unknown" ? [] : RUBRICS[purpose].map((c) => c.id);
  if (
    selectedIds &&
    (new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some((id) => !allIds.includes(id)))
  )
    throw new Error("INVALID_ANALYSIS_SCHEMA");
  const ids = selectedIds ?? allIds;
  const coach =
    ids.length && segments.some((s) => s.speaker === "employee")
      ? analysisSchema.shape.coaching.element
          .omit({ evidence: true, kind: true })
          .extend({ checkpointId: z.enum(ids as [string, ...string[]]) })
          .nullable()
      : z.null();
  return z.strictObject({
    checkpoints: z.strictObject(
      Object.fromEntries(
        (purpose === "unknown" ? [] : RUBRICS[purpose])
          .filter((c) => ids.includes(c.id))
          .map((c) => [c.id, validatedItem]),
      ),
    ),
    noObjections: z.boolean(),
    coaching: z.strictObject({
      strength: coach,
      improvement1: coach,
      improvement2: coach,
    }),
  });
}
export function validateExtraction(value: unknown, segments: Segment[]) {
  const wire = extractionSchema(segments).parse(value);
  const extracted: Extraction = {
    ...wire,
    outcomes: Object.fromEntries(
      Object.entries(wire.outcomes).map(([key, outcome]) => [
        key,
        "claimed" in outcome
          ? outcome.claimed
          : { value: null, evidence: outcome.unknown },
      ]),
    ) as Extraction["outcomes"],
  };
  const materialized = legacyFields(extracted, segments);
  // Validate references/evidenced claims before spending another request.
  resolveAnalysis(
    {
      ...materialized,
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
    true,
  );
  return extracted;
}
function legacyFields(extracted: Extraction, segments: Segment[]) {
  const rest = Object.fromEntries(
    Object.entries(extracted).filter(
      ([key]) => key !== "recap" && key !== "facts",
    ),
  ) as Omit<Extraction, "recap" | "facts">;
  const normalized = materializeRecap(extracted, segments);
  return {
    ...rest,
    summary: normalized.summary,
    facts: normalized.facts.map((f) => ({
      ...f,
      evidence: { segmentIds: f.evidence.segmentIds },
    })),
  };
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
  const result = resolveAnalysis(
    {
      ...legacyFields(extracted, segments),
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
    true,
  );
  const snapshot = materializeRecap(extracted, segments).sourceRecap;
  result.original.sourceRecap = structuredClone(snapshot);
  result.effective.sourceRecap = structuredClone(snapshot);
  return result;
}
