import type { Analysis } from "@/lib/domain/types";
import type { WireAnalysis } from "@/lib/groq/analysis-contract";
export function wireFromAnalysis(analysis: Analysis): WireAnalysis {
  const { coaching, ...base } = analysis;
  delete base.sourceRecap;
  const refs = (evidence: { segmentIds: string[] }) => ({
    segmentIds: [...evidence.segmentIds],
  });
  return {
    ...base,
    outcomes: Object.fromEntries(
      Object.entries(base.outcomes).map(([id, item]) => [
        id,
        { value: item.value, evidence: refs(item.evidence) },
      ]),
    ) as WireAnalysis["outcomes"],
    facts: base.facts.map((item) => ({
      ...item,
      evidence: refs(item.evidence),
    })),
    followups: base.followups.map((item) => ({
      ...item,
      evidence: refs(item.evidence),
    })),
    assessments: base.assessments.map((item) => {
      if (item.status === "policy_award")
        throw new Error("Wire fixtures cannot award policy points");
      const coach = coaching.find((c) => c.checkpointId === item.id);
      return {
        ...item,
        status: item.status,
        evidence: refs(item.evidence),
        coaching: coach
          ? {
              kind: coach.kind,
              title: coach.title,
              detail: coach.detail,
              suggestedResponse: coach.suggestedResponse,
            }
          : null,
      };
    }),
  };
}

export function stagedFromAnalysis(analysis: Analysis) {
  const { assessments, noObjections, ...legacyExtraction } =
    wireFromAnalysis(analysis);
  const refs =
    legacyExtraction.facts.find((f) => f.evidence.segmentIds.length)?.evidence
      .segmentIds ??
    assessments.find((a) => a.evidence.segmentIds.length)?.evidence
      .segmentIds ??
    [];
  const {
    purpose,
    secondaryIntents,
    title,
    outcomes,
    followups,
    complete,
    reviewReasons,
  } = legacyExtraction;
  const extraction = {
    purpose,
    secondaryIntents,
    title,
    outcomes: Object.fromEntries(
      Object.entries(outcomes).map(([key, outcome]) => [
        key,
        outcome.value === null
          ? { unknown: outcome.evidence }
          : { claimed: outcome },
      ]),
    ) as Record<
      keyof typeof outcomes,
      | { claimed: { value: boolean; evidence: { segmentIds: string[] } } }
      | { unknown: { segmentIds: string[] } }
    >,
    followups,
    complete,
    reviewReasons,
    recap: { segmentIds: [...refs] },
    facts: legacyExtraction.facts.map((f) => ({
      kind: "other" as const,
      evidence: f.evidence,
    })),
  };
  const coach = (kind: "strength" | "improvement", index: number) => {
    const found = analysis.coaching.filter((c) => c.kind === kind)[index];
    return found
      ? {
          checkpointId: found.checkpointId,
          title: found.title,
          detail: found.detail,
          suggestedResponse: found.suggestedResponse,
        }
      : null;
  };
  return {
    extraction,
    scoring: {
      noObjections,
      coaching: {
        strength: coach("strength", 0),
        improvement1: coach("improvement", 0),
        improvement2: coach("improvement", 1),
      },
      checkpoints: Object.fromEntries(
        assessments.map(({ id, status, reason, evidence }) => [
          id,
          {
            status,
            reason,
            evidence: evidence.segmentIds.length
              ? evidence
              : {
                  segmentIds: [
                    ...(assessments.find((a) => a.id === "thank")?.evidence
                      .segmentIds ?? []),
                  ],
                },
          },
        ]),
      ),
    },
  };
}
