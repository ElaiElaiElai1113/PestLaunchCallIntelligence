import type {
  Analysis,
  CallRecord,
  OutcomeKey,
  Purpose,
  Segment,
} from "../domain/types";
import { RUBRICS } from "../scoring/rubrics";
import { computeScore } from "../scoring/engine";
export const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  quoteProvided: "Quote provided",
  inspectionBooked: "Inspection booked",
  treatmentAccepted: "Treatment accepted",
  agreementSigned: "Agreement signed",
  paymentCollected: "Payment collected",
  cancellationRequested: "Cancellation requested",
  cancellationAccepted: "Cancellation accepted",
  retentionSaved: "Retention saved",
};
export const SAMPLE_OPTIONS = [
  {
    id: "inspection",
    title: "An inspection, not a sale",
    description:
      "A customer books an inspection. Treatment and payment remain unconfirmed.",
  },
  {
    id: "service",
    title: "A service concern resolved",
    description: "A follow-up visit is agreed with a clear arrival window.",
  },
  {
    id: "retention",
    title: "A cancellation needing review",
    description:
      "The conversation is clear; an account action cannot be verified.",
  },
  {
    id: "one-time",
    title: "One-time treatment accepted",
    description:
      "Recurring service is declined. A one-time visit is still accepted.",
  },
];
const conversations: Record<string, [Segment["speaker"], string][]> = {
  inspection: [
    [
      "employee",
      "Thanks for calling. I can help you work out the next step. What have you noticed?",
    ],
    ["customer", "I have seen ants near the kitchen window for a few days."],
    [
      "employee",
      "I understand that is frustrating. Are they inside as well, or only at the window?",
    ],
    [
      "customer",
      "Just the window so far. I would like someone to take a look before choosing treatment.",
    ],
    [
      "employee",
      "So you want an inspection first. We can arrange a free inspection, then discuss treatment options if needed. Does that sound right?",
    ],
    ["customer", "Yes, an inspection would be helpful."],
    [
      "employee",
      "I can book an inspection for tomorrow morning. This books the inspection only; there is no treatment agreement or payment today.",
    ],
    ["customer", "Tomorrow morning works for me."],
    [
      "employee",
      "Your inspection is booked for tomorrow morning. We will confirm access details before the visit. Thank you for calling.",
    ],
  ],
  service: [
    ["employee", "Thank you for calling. How can I help today?"],
    [
      "customer",
      "We are still seeing ants after the visit. I need someone to come back.",
    ],
    [
      "employee",
      "I understand. I can help arrange a follow-up. Where are you seeing activity now?",
    ],
    ["customer", "Around the same kitchen window."],
    [
      "employee",
      "So the activity has continued in the same area. We can arrange a no-cost follow-up visit. Would tomorrow between nine and twelve work?",
    ],
    ["customer", "Yes, that works. Please use the side entrance."],
    [
      "employee",
      "I have arranged the follow-up for tomorrow between nine and twelve and noted the side entrance. Is there anything else we should know?",
    ],
    ["customer", "No, that covers it."],
    [
      "employee",
      "We will see you tomorrow between nine and twelve for the no-cost follow-up. Thank you for letting us know.",
    ],
  ],
  retention: [
    ["employee", "Thank you for calling. How can I help?"],
    [
      "customer",
      "I would like to cancel. We are moving outside the service area.",
    ],
    [
      "employee",
      "I understand. May I ask whether there is a service concern we can resolve?",
    ],
    ["customer", "No, we are happy with the service. It is just the move."],
    [
      "employee",
      "So the move is the reason. I will send the cancellation request to the account team and ask them to confirm it.",
    ],
    ["customer", "Please do. I need written confirmation."],
    [
      "employee",
      "I will ask the account team to email confirmation once they review the request. Thank you for being a customer.",
    ],
  ],
  "one-time": [
    [
      "employee",
      "Thanks for calling. I can help with your pest concern. What are you noticing?",
    ],
    ["customer", "There are ants by the patio. I only want one treatment."],
    [
      "employee",
      "I understand. Are they coming inside, and how long has this been happening?",
    ],
    ["customer", "They are outside. It started a few days ago."],
    [
      "employee",
      "So you want to address the patio ants with a single visit. The one-time treatment is two hundred dollars. We also offer recurring service.",
    ],
    ["customer", "I do not want a recurring plan."],
    [
      "employee",
      "That makes sense. You want one visit without an ongoing commitment. We can do the one-time treatment for two hundred dollars. Would you like to book it?",
    ],
    ["customer", "Yes, book the one-time visit for Friday afternoon."],
    [
      "employee",
      "The one-time treatment is booked for Friday afternoon. Payment is due at the visit; no payment has been taken today. Thank you for calling.",
    ],
  ],
};
export function sampleCall(key: string, id: string): CallRecord {
  const option = SAMPLE_OPTIONS.find((x) => x.id === key);
  if (!option) throw new Error("INVALID_SAMPLE");
  const segments = conversations[key].map(([speaker, text], i) => ({
    id: `seg-${i + 1}`,
    speaker,
    text,
    startMs: i * 14000,
    endMs: i * 14000 + 12000,
  }));
  const purpose: Exclude<Purpose, "unknown"> =
    key === "service" ? "general" : key === "retention" ? "retention" : "sales";
  const evidence = (index: number) => ({
    segmentIds: [segments[index].id],
    quote: segments[index].text,
  });
  const outcomes = Object.fromEntries(
    Object.keys(OUTCOME_LABELS).map((key) => [
      key,
      {
        value: null as boolean | null,
        evidence: { segmentIds: [] as string[], quote: "" },
      },
    ]),
  ) as Analysis["outcomes"];
  if (key === "inspection")
    outcomes.inspectionBooked = { value: true, evidence: evidence(7) };
  if (key === "one-time") {
    outcomes.treatmentAccepted = { value: true, evidence: evidence(7) };
    outcomes.quoteProvided = { value: true, evidence: evidence(6) };
    outcomes.paymentCollected = { value: false, evidence: evidence(8) };
  }
  if (key === "retention")
    outcomes.cancellationRequested = { value: true, evidence: evidence(1) };
  const unresolved =
    key === "retention"
      ? ["research", "repeat", "teaser"]
      : key === "inspection"
        ? ["pricing", "final_information"]
        : [];
  const missed = key === "one-time" ? ["summary", "expectation_solve"] : [];
  const analysis: Analysis = {
    purpose,
    title: option.title,
    summary:
      key === "inspection"
        ? "An inspection was agreed for “tomorrow morning”. No treatment purchase, signed agreement or payment is confirmed."
        : key === "service"
          ? "A no-cost follow-up was arranged for “tomorrow between nine and twelve”, with side-entrance access noted."
          : key === "retention"
            ? "The customer requested cancellation because of a move. The employee promised to send the request to the account team. Account closure is not verified."
            : "The customer accepted a one-time treatment and declined recurring service. Payment is due at the visit; no collection is confirmed.",
    secondaryIntents:
      key === "service"
        ? ["re-service", "scheduling"]
        : key === "retention"
          ? ["moving"]
          : ["scheduling", key === "inspection" ? "inspection" : "one-time"],
    outcomes,
    facts: [
      { label: "Customer need", text: segments[1].text, evidence: evidence(1) },
      {
        label: "Agreed next step",
        text: segments[segments.length - 1].text,
        evidence: evidence(segments.length - 1),
      },
    ],
    followups: [
      {
        text:
          key === "retention"
            ? "Request written cancellation confirmation from the account team."
            : "Confirm the agreed visit and necessary access details.",
        state: "promised",
        dueText:
          key === "retention"
            ? null
            : key === "one-time"
              ? "Friday afternoon"
              : "tomorrow",
        evidence: evidence(segments.length - 1),
      },
    ],
    assessments: RUBRICS[purpose].map((x, i) => ({
      id: x.id,
      status: unresolved.includes(x.id)
        ? "unknown"
        : missed.includes(x.id)
          ? "missed"
          : "passed",
      reason: unresolved.includes(x.id)
        ? "The sample does not establish this step or its applicability."
        : missed.includes(x.id)
          ? "A clear confirmation of understanding was not heard."
          : "Fictional assessment for interface testing; not an AI evaluation.",
      evidence: evidence(Math.min(i, segments.length - 1)),
    })),
    coaching: [
      {
        kind: "strength",
        title: "Make the next step explicit",
        detail:
          "The closing statement separates the agreed action from an unverified account or payment action.",
        suggestedResponse: null,
        checkpointId: "conclusion",
        evidence: evidence(segments.length - 1),
      },
      {
        kind: "improvement",
        title:
          key === "retention"
            ? "Confirm who owns the follow-up"
            : "Check understanding before proposing the next step",
        detail:
          key === "retention"
            ? "Add a specific owner and expected confirmation time without promising that an account action has already happened."
            : "Restate the customer’s need and check agreement before discussing the solution.",
        suggestedResponse:
          key === "retention"
            ? "I will send this to the account team today. They will confirm the request once it has been reviewed."
            : "You would like us to address this concern with the agreed visit. Have I understood that correctly?",
        checkpointId: purpose === "retention" ? "research" : "summary",
        evidence: evidence(Math.min(4, segments.length - 1)),
      },
    ],
    complete: true,
    noObjections: key === "inspection",
    reviewReasons: unresolved.map((x) => `Checkpoint needs review: ${x}`),
  };
  const score = computeScore(analysis);
  return {
    id,
    workspaceId: "sample-workspace",
    label: `SAMPLE-${id.slice(-4).toUpperCase()}`,
    mode: "sample",
    status: score.unresolved ? "needs_review" : "ready",
    uploadedAt: new Date().toISOString(),
    recordedAt: null,
    rep: null,
    direction: null,
    durationMs: segments.at(-1)!.endMs,
    version: 1,
    sourcePath: null,
    checksum: null,
    errorCode: null,
    segments,
    analysis,
    originalAnalysis: structuredClone(analysis),
    score,
    decisions: [],
  };
}
