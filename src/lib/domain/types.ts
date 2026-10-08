export type Purpose = "sales" | "general" | "retention" | "unknown";
export type AssessmentStatus =
  "passed" | "missed" | "policy_award" | "unknown" | "not_applicable";
export type Segment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: "employee" | "customer" | "unknown";
};
export type Evidence = { segmentIds: string[]; quote: string };
export type Assessment = {
  id: string;
  status: AssessmentStatus;
  reason: string;
  evidence: Evidence;
};
export type OutcomeKey =
  | "quoteProvided"
  | "inspectionBooked"
  | "treatmentAccepted"
  | "agreementSigned"
  | "paymentCollected"
  | "cancellationRequested"
  | "cancellationAccepted"
  | "retentionSaved";
export type Fact = { label: string; text: string; evidence: Evidence };
export type Analysis = {
  purpose: Purpose;
  secondaryIntents: string[];
  title: string;
  summary: string;
  outcomes: Record<OutcomeKey, { value: boolean | null; evidence: Evidence }>;
  facts: Fact[];
  followups: {
    text: string;
    state: "promised" | "accepted" | "reported_completed" | "unknown";
    dueText: string | null;
    evidence: Evidence;
  }[];
  assessments: Assessment[];
  coaching: {
    kind: "strength" | "improvement";
    title: string;
    detail: string;
    suggestedResponse: string | null;
    checkpointId: string;
    evidence: Evidence;
  }[];
  complete: boolean;
  noObjections: boolean;
  reviewReasons: string[];
};
export type Grade = "gold" | "green" | "below";
export type Score = {
  points: number;
  denominator: number;
  unresolved: number;
  grade: Grade | null;
};
export type CallRecord = {
  id: string;
  workspaceId: string;
  label: string;
  mode: "sample" | "live";
  sourceKind?: "synthetic" | "real";
  status:
    | "queued"
    | "transcribing"
    | "privacy_review"
    | "analyzing"
    | "ready"
    | "needs_review"
    | "failed";
  uploadedAt: string;
  recordedAt: string | null;
  rep: string | null;
  direction: "inbound" | "outbound" | null;
  durationMs: number;
  version: number;
  sourcePath: string | null;
  sanitizedPath?: string | null;
  checksum: string | null;
  errorCode: string | null;
  segments: Segment[];
  transcriptCompleteness?: "verified" | "unverified";
  transcriptReviewReasons?: string[];
  analysis: Analysis | null;
  originalAnalysis: Analysis | null;
  score: Score | null;
  decisions: {
    id: string;
    checkpointId: string;
    status: AssessmentStatus;
    reason: string;
    userId: string;
    at: string;
    previousVersion: number;
  }[];
};
export type Identity = {
  userId: string;
  workspaceId: string;
  role: "owner" | "reviewer";
  mode: "sample" | "live";
};
