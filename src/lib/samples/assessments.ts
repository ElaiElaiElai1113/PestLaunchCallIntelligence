import type {
  Analysis,
  AssessmentStatus,
  Purpose,
  Segment,
} from "../domain/types";
import { RUBRICS } from "../scoring/rubrics";
type Entry = [AssessmentStatus, number, string];
const maps: Record<string, Record<string, Entry>> = {
  service: {
    validate: ["passed", 2, "Acknowledges the continuing concern."],
    confidence: ["passed", 2, "Offers to help arrange a follow-up."],
    expectation_understand: [
      "passed",
      2,
      "Prepares the customer for questions.",
    ],
    investigate: ["passed", 2, "Asks where activity remains."],
    summary: ["passed", 4, "Restates continued activity in the same area."],
    expectation_solve: [
      "passed",
      4,
      "Prepares the customer for visit options.",
    ],
    solution: ["passed", 4, "Offers a relevant no-cost follow-up."],
    consensus: ["passed", 4, "Checks whether the proposed window works."],
    close: ["passed", 4, "Requests agreement to the proposed visit."],
    conclusion: [
      "passed",
      8,
      "Recaps the agreed window and no-cost follow-up.",
    ],
    thank: ["passed", 8, "Thanks the customer."],
    final_information: [
      "missed",
      8,
      "The complete fictional ending contains no invitation to contact the company for future pest-control needs.",
    ],
  },
  inspection: {
    validate: ["passed", 2, "Acknowledges frustration."],
    confidence: ["passed", 0, "Offers help finding the next step."],
    expectation_understand: [
      "passed",
      0,
      "Prepares the customer for questions.",
    ],
    investigate: ["passed", 0, "Asks what the customer has noticed."],
    summary: ["passed", 4, "Confirms the customer wants an inspection first."],
    expectation_solve: ["passed", 4, "Introduces how the inspection works."],
    solution: ["passed", 4, "Offers an inspection before treatment options."],
    consensus: ["passed", 4, "Asks whether the proposed approach is right."],
    close: ["passed", 6, "Asks to book the inspection."],
    pricing: [
      "unknown",
      6,
      "Inspection-only applicability does not establish treatment-pricing requirements.",
    ],
    objection_agree: [
      "unknown",
      4,
      "Complete attributable fictional dialogue contains no objection; the four-point policy applies.",
    ],
    objection_restate: [
      "unknown",
      4,
      "No objection is present in the complete fictional dialogue.",
    ],
    objection_resolve: [
      "unknown",
      4,
      "No objection is present in the complete fictional dialogue.",
    ],
    objection_reclose: [
      "unknown",
      4,
      "No objection is present in the complete fictional dialogue.",
    ],
    conclusion: [
      "passed",
      8,
      "Recaps inspection rather than a treatment purchase.",
    ],
    final_information: [
      "unknown",
      8,
      "The inspection-stage applicability of the Sales ending needs review; no future-service/referral guidance is given.",
    ],
    thank: ["passed", 8, "Thanks the customer."],
  },
  "one-time": {
    validate: ["passed", 2, "Acknowledges the reported concern."],
    confidence: ["passed", 0, "Offers help with the pest concern."],
    expectation_understand: [
      "passed",
      0,
      "Prepares the customer for questions.",
    ],
    investigate: ["passed", 2, "Asks location and duration of activity."],
    summary: [
      "passed",
      4,
      "Restates the patio concern and single-visit preference.",
    ],
    expectation_solve: [
      "missed",
      4,
      "The complete fictional dialogue jumps to pricing without setting an expectation for the solution discussion.",
    ],
    solution: ["passed", 4, "Offers a one-time treatment for the stated need."],
    consensus: [
      "passed",
      6,
      "Checks whether the customer wants the one-time visit.",
    ],
    close: ["passed", 6, "Asks to book the visit."],
    pricing: [
      "passed",
      6,
      "Explains the one-time price without ongoing commitment.",
    ],
    objection_agree: [
      "passed",
      6,
      "Acknowledges the recurring-plan objection.",
    ],
    objection_restate: [
      "passed",
      6,
      "Restates the preference for one visit without ongoing commitment.",
    ],
    objection_resolve: [
      "passed",
      6,
      "Offers a one-time option addressing the objection.",
    ],
    objection_reclose: [
      "passed",
      6,
      "Asks for the booking after resolving the recurring-plan concern.",
    ],
    conclusion: [
      "passed",
      8,
      "Recaps booking and explicitly distinguishes payment due from collected payment.",
    ],
    final_information: [
      "missed",
      8,
      "The complete fictional ending contains neither future-service nor Sales referral-program information.",
    ],
    thank: ["passed", 8, "Thanks the customer."],
  },
  retention: {
    validate_confidence: [
      "passed",
      2,
      "Acknowledges the request and offers help.",
    ],
    transition: ["passed", 2, "Asks permission to explore a service concern."],
    research: [
      "unknown",
      4,
      "Account research is not audible and cannot be inferred from a promised handoff.",
    ],
    investigate: [
      "passed",
      2,
      "Asks whether an underlying service concern can be resolved.",
    ],
    validate_summary: [
      "passed",
      4,
      "Confirms the move is the cancellation reason.",
    ],
    validate_expectation: ["passed", 4, "Introduces the next step."],
    solution: [
      "passed",
      4,
      "Offers a request handoff, not verified account closure.",
    ],
    consensus: ["passed", 4, "Checks agreement to that next step."],
    repeat: [
      "unknown",
      4,
      "Out-of-area cancellation leaves Repeat applicability unresolved.",
    ],
    conclusion: ["passed", 6, "Recaps promised confirmation after review."],
    thank: ["passed", 6, "Thanks the customer."],
    teaser: [
      "unknown",
      6,
      "Out-of-area cancellation leaves Teaser applicability unresolved.",
    ],
  },
};
export function sampleAssessments(
  key: string,
  purpose: Exclude<Purpose, "unknown">,
  segments: Segment[],
) {
  const entries = maps[key];
  if (!entries || Object.keys(entries).length !== RUBRICS[purpose].length)
    throw new Error("INVALID_SAMPLE_ASSESSMENTS");
  return RUBRICS[purpose].map((checkpoint) => {
    const entry = entries[checkpoint.id];
    if (!entry) throw new Error("INVALID_SAMPLE_ASSESSMENTS");
    const [status, index, reason] = entry;
    const segment = segments[index];
    return {
      id: checkpoint.id,
      status,
      reason: `Fictional example: ${reason}`,
      evidence: { segmentIds: [segment.id], quote: segment.text },
    };
  });
}
export function sampleCoaching(
  key: string,
  segments: Segment[],
): Analysis["coaching"] {
  const end = key === "retention" ? 6 : 8;
  const improvement =
    key === "service"
      ? {
          checkpointId: "final_information",
          index: 8,
          title: "Offer future-service information",
          detail:
            "The ending thanks the customer but omits an invitation for future pest-control needs.",
          suggestedResponse:
            "If another pest-control need comes up, please contact us first.",
        }
      : key === "one-time"
        ? {
            checkpointId: "expectation_solve",
            index: 4,
            title: "Introduce the solution discussion",
            detail:
              "The summary is present. Add a roadmap before moving to price and options.",
            suggestedResponse:
              "I will explain the single-visit option for that patio activity, then cover the price and next step.",
          }
        : key === "inspection"
          ? {
              checkpointId: "pricing",
              index: 6,
              title: "Keep inspection and treatment commitments separate",
              detail:
                "Explain when treatment options and pricing will be discussed without treating an inspection as a sale.",
              suggestedResponse:
                "This books the inspection only. After it, we can discuss any recommended treatment and its price.",
            }
          : {
              checkpointId: "conclusion",
              index: 6,
              title: "Make the confirmation handoff accountable",
              detail:
                "The employee promises a handoff, but no confirmation window or completed account action is verified.",
              suggestedResponse:
                "I will ask the account team when you can expect written confirmation and follow up with you.",
            };
  return [
    {
      kind: "strength",
      title: "Make the next step explicit",
      detail:
        "The closing statement states the call-level next step without implying a verified payment or account closure.",
      suggestedResponse: null,
      checkpointId: "conclusion",
      evidence: { segmentIds: [segments[end].id], quote: segments[end].text },
    },
    {
      kind: "improvement",
      ...improvement,
      evidence: {
        segmentIds: [segments[improvement.index].id],
        quote: segments[improvement.index].text,
      },
    },
  ];
}
