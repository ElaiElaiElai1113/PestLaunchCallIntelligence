import type { Analysis } from "@/lib/domain/types";
import type { WireAnalysis } from "@/lib/groq/analysis-contract";
export function wireFromAnalysis(analysis: Analysis): WireAnalysis {
  const { coaching, ...base } = analysis;
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
  const { assessments, noObjections, ...extraction } =
    wireFromAnalysis(analysis);
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
