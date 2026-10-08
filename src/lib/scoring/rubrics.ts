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
    "Recognize the customer’s situation before proposing a solution.",
  ],
  confidence: [
    "Establish confidence",
    "Validate",
    "Explain how you can help without making unsupported promises.",
  ],
  expectation_understand: [
    "Set the conversation up",
    "Understand",
    "Set an expectation that you will first understand the concern.",
  ],
  investigate: [
    "Ask useful questions",
    "Understand",
    "Discover the need and relevant context.",
  ],
  summary: [
    "Confirm your understanding",
    "Understand",
    "Summarize the need and check that it is right.",
  ],
  expectation_solve: [
    "Set a solution expectation",
    "Solve",
    "Explain the next step toward resolving the need.",
  ],
  solution: [
    "Offer a relevant solution",
    "Solve",
    "Connect the proposed service or action to the stated need.",
  ],
  consensus: [
    "Check agreement",
    "Solve",
    "Confirm the customer agrees with the proposed solution.",
  ],
  close: [
    "Ask for the next step",
    "Solve",
    "Make a clear request to proceed where appropriate.",
  ],
  pricing: [
    "Explain pricing",
    "Solve",
    "Explain initial and ongoing costs and relevant conditions.",
  ],
  objection_agree: [
    "Acknowledge the objection",
    "Solve",
    "Agree with the concern without dismissing it.",
  ],
  objection_restate: [
    "Restate the objection",
    "Solve",
    "Confirm what is preventing a decision.",
  ],
  objection_resolve: [
    "Resolve the objection",
    "Solve",
    "Address the stated barrier with a relevant response.",
  ],
  objection_reclose: [
    "Revisit the decision",
    "Solve",
    "Ask for agreement after addressing the objection.",
  ],
  conclusion: [
    "Recap the agreement",
    "Verify",
    "Confirm the agreed outcome and next steps.",
  ],
  final_information: [
    "Collect final information",
    "Verify",
    "Confirm necessary final information; backend actions may require review.",
  ],
  thank: ["Thank the customer", "Verify", "End with a clear thank-you."],
  validate_confidence: [
    "Validate and build confidence",
    "Validate",
    "Recognize the cancellation concern and establish confidence.",
  ],
  transition: [
    "Transition to understanding",
    "Understand",
    "Ask permission to explore the underlying concern.",
  ],
  research: [
    "Research the account",
    "Understand",
    "Review account context; do not infer inaudible backend work.",
  ],
  validate_summary: [
    "Validate your understanding",
    "Understand",
    "Summarize the reason for cancellation.",
  ],
  validate_expectation: [
    "Set a resolution expectation",
    "Solve",
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
      guidance: common[id][2],
    })),
  ]),
) as Record<Exclude<Purpose, "unknown">, Checkpoint[]>;
export const OBJECTION_IDS = [
  "objection_agree",
  "objection_restate",
  "objection_resolve",
  "objection_reclose",
];
