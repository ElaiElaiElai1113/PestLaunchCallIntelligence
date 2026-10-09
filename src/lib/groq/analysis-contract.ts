import { z } from "zod";
import type { Analysis, Evidence, Segment } from "../domain/types";
import { analysisSchema } from "../domain/schemas";
import { RUBRICS } from "../scoring/rubrics";
import { computeScore } from "../scoring/engine";
import { validateEvidence } from "../domain/evidence";
import { guardAssessment } from "../domain/assessment-guards";

export const CONTRACT = "call_analysis_refs_v1" as const;
const checkpointIds = [
  ...new Set(Object.values(RUBRICS).flatMap((r) => r.map((c) => c.id))),
];
export function contractSchema(segments: Segment[]) {
  const ids = segments.map((s) => s.id);
  if (
    !ids.length ||
    ids.some((id) => !id.trim()) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("INVALID_TRANSCRIPT");
  const refs = z.strictObject({
    segmentIds: z.array(z.enum(ids as [string, ...string[]])).max(6),
  });
  const outcome = z.strictObject({
    value: z.boolean().nullable(),
    evidence: refs,
  });
  const coaching = analysisSchema.shape.coaching.element.omit({
    checkpointId: true,
    evidence: true,
  });
  const checkpoint = analysisSchema.shape.assessments.element.extend({
    id: z.enum(checkpointIds as [string, ...string[]]),
    reason: z.string().max(240),
    evidence: refs,
    coaching: segments.some((s) => s.speaker === "employee")
      ? coaching.nullable()
      : z.null(),
  });
  return analysisSchema
    .omit({ coaching: true, sourceRecap: true, reviewIssues: true })
    .extend({
      summary: z.string().max(800),
      outcomes: z.strictObject(
        Object.fromEntries(
          Object.keys(analysisSchema.shape.outcomes.shape).map((id) => [
            id,
            outcome,
          ]),
        ) as Record<keyof Analysis["outcomes"], typeof outcome>,
      ),
      facts: z
        .array(analysisSchema.shape.facts.element.extend({ evidence: refs }))
        .max(6),
      followups: z
        .array(
          analysisSchema.shape.followups.element.extend({ evidence: refs }),
        )
        .max(8),
      assessments: z.array(checkpoint).max(17),
    });
}
export type WireAnalysis = z.infer<ReturnType<typeof contractSchema>>;
export function resolveRefs(
  refs: { segmentIds: string[] },
  segments: Segment[],
  maxChars = 2000,
  oversizedCode = "INVALID_EVIDENCE",
): Evidence {
  const seen = new Set<string>();
  let previous = -1;
  const text = refs.segmentIds
    .map((id) => {
      const index = segments.findIndex((s) => s.id === id);
      if (index < 0 || seen.has(id) || index <= previous)
        throw new Error("INVALID_EVIDENCE");
      seen.add(id);
      previous = index;
      return segments[index].text;
    })
    .join(" ");
  if (text.length > maxChars) throw new Error(oversizedCode);
  return { segmentIds: [...refs.segmentIds], quote: text };
}
export function resolveAnalysis(
  wire: unknown,
  segments: Segment[],
  context: { transcriptComplete: boolean },
  sourceDerived = false,
) {
  const schema = contractSchema(segments);
  const parsed = (
    sourceDerived ? schema.extend({ summary: z.string().max(1800) }) : schema
  ).parse(wire);
  if (parsed.purpose === "unknown" && parsed.assessments.length)
    throw new Error("INVALID_COACHING");
  const coaching: Analysis["coaching"] = [];
  const original = analysisSchema.parse({
    ...parsed,
    outcomes: Object.fromEntries(
      Object.entries(parsed.outcomes).map(([id, item]) => [
        id,
        { ...item, evidence: resolveRefs(item.evidence, segments) },
      ]),
    ),
    facts: parsed.facts.map((item) => ({
      ...item,
      evidence: resolveRefs(item.evidence, segments),
    })),
    followups: parsed.followups.map((item) => ({
      ...item,
      evidence: resolveRefs(item.evidence, segments),
    })),
    assessments: parsed.assessments.map((item) => {
      const { coaching: coach, ...assessment } = item;
      const evidence = resolveRefs(item.evidence, segments);
      if (coach)
        coaching.push({
          ...coach,
          checkpointId: item.id,
          evidence: structuredClone(evidence),
        });
      return { ...assessment, evidence };
    }),
    coaching,
  });
  if (
    coaching.filter((c) => c.kind === "strength").length > 1 ||
    coaching.filter((c) => c.kind === "improvement").length > 2
  )
    throw new Error("INVALID_COACHING");
  if (validateEvidence(original, segments).length)
    throw new Error("INVALID_EVIDENCE");
  computeScore(original);
  return { original, effective: guardAssessment(original, segments, context) };
}
