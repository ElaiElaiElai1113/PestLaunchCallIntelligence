import type { Purpose } from "../domain/types";
type Checkpoint = {
  id: string;
  label: string;
  group: string;
  guidance: string;
};
const common: Record<string, [string, string, string]> = {
  validate: [
    "Acknowledge the concern",
    "Validate",
    "Acknowledge the reported concern. Responsive affirmations such as I understand or that makes sense count; repeating the pest name is not required. A greeting alone does not count.",
  ],
  confidence: [
    "Establish confidence",
    "Validate",
    "Explicitly reassure the customer that you can help with the concern. A greeting or an offer alone is not a confidence statement.",
  ],
  expectation_understand: [
    "Set the conversation up",
    "Validate",
    "Explicitly explain that you will first ask questions to understand the concern. Asking a question or greeting alone does not set this expectation.",
  ],
  investigate: [
    "Ask useful questions",
    "Understand",
    "Discover the need and relevant context.",
  ],
  summary: [
    "Confirm your understanding",
    "Understand",
    "Summarize the customer's need and check that your understanding is right; a summary without an explicit check does not meet both parts.",
  ],
  expectation_solve: [
    "Set a solution expectation",
    "Understand",
    "Before presenting the solution, explain the roadmap for presenting it and checking agreement. A later booking question is not this roadmap.",
  ],
  solution: [
    "Offer a relevant solution",
    "Solve",
    "Connect the proposed service or action to the stated need.",
  ],
  consensus: [
    "Check agreement",
    "Solve",
    "Check understanding of the presented service or invite questions before closing. A booking/permission-to-proceed question alone meets close, not this separate consensus checkpoint.",
  ],
  close: [
    "Ask for the next step",
    "Solve",
    "Make a clear request to proceed where appropriate.",
  ],
  pricing: [
    "Explain pricing",
    "Solve",
    "Explain applicable price and conditions. A one-time treatment requires its one-time price; do not require recurring fees for a declined recurring plan or invent missing fees.",
  ],
  objection_agree: [
    "Acknowledge the objection",
    "Solve",
    "Agree with the concern without dismissing it.",
  ],
  objection_restate: [
    "Restate the objection",
    "Solve",
    "Restate the barrier after the objection in your own words; a faithful paraphrase counts, not only verbatim repetition.",
  ],
  objection_resolve: [
    "Resolve the objection",
    "Solve",
    "After the customer states the objection, address that barrier with a relevant response. An offer made before the objection cannot resolve it.",
  ],
  objection_reclose: [
    "Revisit the decision",
    "Solve",
    "Ask to proceed after addressing the objection; cite the employee's post-objection request, not an earlier offer or customer answer.",
  ],
  conclusion: [
    "Recap the agreement",
    "Verify",
    "Confirm the agreed outcome and next steps.",
  ],
  final_information: [
    "Offer future-service information",
    "Verify",
    "Tell the customer to contact the company for future pest-control needs.",
  ],
  thank: ["Thank the customer", "Verify", "End with a clear thank-you."],
  validate_confidence: [
    "Validate and build confidence",
    "Validate",
    "Recognize the cancellation concern and establish confidence.",
  ],
  transition: [
    "Transition to understanding",
    "Validate",
    "Ask permission to explore the underlying concern.",
  ],
  research: [
    "Research the account",
    "Validate",
    "Review account context; do not infer inaudible backend work.",
  ],
  validate_summary: [
    "Validate your understanding",
    "Understand",
    "Summarize the reason for cancellation.",
  ],
  validate_expectation: [
    "Set a resolution expectation",
    "Understand",
    "Explain the next step toward addressing the concern.",
  ],
  repeat: [
    "Revisit an unresolved concern",
    "Solve",
    "Repeat only where needed; ambiguous applicability requires review.",
  ],
  teaser: [
    "Leave the door open",
    "Verify",
    "Give an appropriate reason to consider future service when cancelling.",
  ],
};
const ids = {
  sales: [
    "validate",
    "confidence",
    "expectation_understand",
    "investigate",
    "summary",
    "expectation_solve",
    "solution",
    "consensus",
    "close",
    "pricing",
    "objection_agree",
    "objection_restate",
    "objection_resolve",
    "objection_reclose",
    "conclusion",
    "final_information",
    "thank",
  ],
  general: [
    "validate",
    "confidence",
    "expectation_understand",
    "investigate",
    "summary",
    "expectation_solve",
    "solution",
    "consensus",
    "close",
    "conclusion",
    "thank",
    "final_information",
  ],
  retention: [
    "validate_confidence",
    "transition",
    "research",
    "investigate",
    "validate_summary",
    "validate_expectation",
    "solution",
    "consensus",
    "repeat",
    "conclusion",
    "thank",
    "teaser",
  ],
};
export const RUBRICS: Record<
  Exclude<Purpose, "unknown">,
  Checkpoint[]
> = Object.fromEntries(
  Object.entries(ids).map(([purpose, values]) => [
    purpose,
    values.map((id) => ({
      id,
      label: common[id][0],
      group: common[id][1],
      guidance:
        purpose === "sales" && id === "final_information"
          ? "Tell the customer to contact the company for future pest-control needs and explain the referral program."
          : common[id][2],
    })),
  ]),
) as Record<Exclude<Purpose, "unknown">, Checkpoint[]>;
export const OBJECTION_IDS = [
  "objection_agree",
  "objection_restate",
  "objection_resolve",
  "objection_reclose",
];
