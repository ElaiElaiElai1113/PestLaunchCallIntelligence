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
  reviewIssues?: {
    id: string;
    kind: "outcome" | "coaching" | "chronology" | "followup";
    target: string;
    message: string;
  }[];
  sourceRecap?: { version: "source_refs_v3"; segments: Segment[] };
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
export type ProcessingAttempt = {
  id: string;
  state: "pending" | "running" | "finished";
  runId: string | null;
};
export type ProviderOutput = {
  contract:
    | "call_analysis_refs_v1"
    | "call_analysis_staged_v2"
    | "call_analysis_source_refs_v3"
    | "call_analysis_source_refs_v4"
    | "call_analysis_source_refs_v5"
    | "call_analysis_index_refs_v1";
  model: string;
  content: string;
};
export type CallRecord = {
  analysisGeneration?: number;
  issueDecisions?: {
    id: string;
    issueId: string;
    reason: string;
    userId: string;
    at: string;
    previousVersion: number;
    sourceRevision: number;
    analysisGeneration: number;
  }[];
  pendingExtraction?: {
    inputHash: string;
    sourceRevision: number;
    expectedVersion: number;
    attemptId: string | null;
    runId: string | null;
    output: ProviderOutput & { requestHash: string };
  } | null;
  originalProviderOutput?: ProviderOutput | null;
  latestProviderOutput?: ProviderOutput | null;
  sourceRevision?: number;
  analysisSourceRevision?: number;
  originalSegments?: Segment[];
  originalSegmentsProvenance?: "asr" | "legacy_snapshot" | "fictional_fixture";
  latestModelAnalysis?: Analysis | null;
  sourcePreparation?: {
    checksum: string;
    attestedBy: string;
    at: string;
    kind: "synthetic" | "privately_redacted";
  };
  sourceBinding?: { checksum: string; boundBy: string; at: string };
  sourceReviews?: {
    id: string;
    sourceRevision: number;
    previousVersion: number;
    sourceChecksum: string | null;
    previousErrorCode?: string | null;
    userId: string;
    at: string;
    reason: string;
    changes: {
      segmentId: string;
      previous: Segment["speaker"];
      next: Segment["speaker"];
    }[];
    completenessVerified: boolean;
    qualityVerified: boolean;
  }[];
  processingAttempt?: ProcessingAttempt;
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
    sourceRevision?: number;
    evidence?: Evidence;
    chronologyVerified?: boolean;
    analysisGeneration?: number;
  }[];
};
export type Identity = {
  userId: string;
  workspaceId: string;
  role: "owner" | "reviewer";
  mode: "sample" | "live";
};
