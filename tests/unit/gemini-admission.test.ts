import { expect, it } from "vitest";
import {
  buildAnalysisRequest,
  buildScoringRequests,
  GEMINI_REQUEST_LIMITS,
} from "@/lib/groq/analysis-request";
it("admits a longer full source only under Gemini limits without cutting the final turn", () => {
  const segments = Array.from({ length: 140 }, (_, i) => ({
    id: `seg-${i + 1}`,
    startMs: i * 4000,
    endMs: i * 4000 + 3500,
    speaker: i % 2 ? ("customer" as const) : ("employee" as const),
    text: `Fictional turn ${i + 1}. The customer reports persistent ants and requests a follow-up service visit. Please confirm the treatment schedule and next action.`,
  }));
  expect(() =>
    buildAnalysisRequest(segments, { transcriptComplete: true }),
  ).toThrow("ANALYSIS_BUDGET_EXCEEDED");
  const result = buildAnalysisRequest(
    segments,
    { transcriptComplete: true },
    GEMINI_REQUEST_LIMITS,
  );
  expect(JSON.stringify(result.request.messages)).toContain(
    "Fictional turn 140.",
  );
  expect(result.budget.estimatedTotalTokens).toBeLessThanOrEqual(20000);
  for (const p of ["general", "sales", "retention"] as const)
    expect(
      buildScoringRequests(
        segments,
        { transcriptComplete: true },
        p,
        GEMINI_REQUEST_LIMITS,
      ).every((r) =>
        JSON.stringify(r.request.messages).includes("Fictional turn 140."),
      ),
    ).toBe(true);
});
