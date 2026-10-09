import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
const state = vi.hoisted(() => ({
  call: null as CallRecord | null,
  start: vi.fn(),
  put: vi.fn(),
}));
vi.mock("workflow/api", () => ({ start: state.start }));
vi.mock("@/workflows/process-call", () => ({ processCall: vi.fn() }));
vi.mock("@/lib/server/repository", () => ({
  Repository: class {
    get = async () => structuredClone(state.call!);
    put = state.put;
  },
}));
vi.mock("@/lib/server/auth", () => ({
  checkOrigin: vi.fn(),
  requireOwner: vi.fn(),
  requireIdentity: async () => ({
    userId: "fictional-owner",
    workspaceId: "sample-workspace",
    role: "owner",
    mode: "live",
  }),
  AppError: class extends Error {
    constructor(
      readonly code: string,
      readonly status = 400,
    ) {
      super(code);
    }
  },
}));
import { POST as retry } from "@/app/api/calls/[callId]/retry/route";
import { POST as review } from "@/app/api/calls/[callId]/review/route";
import { POST as issueReview } from "@/app/api/calls/[callId]/issues/route";
const context = { params: Promise.resolve({ callId: "fictional-call" }) };
beforeEach(() => {
  vi.resetAllMocks();
  state.call = sampleCall("service", "fictional-call");
  Object.assign(state.call, {
    mode: "live",
    sourceKind: "synthetic",
    status: "failed",
    errorCode: "ANALYSIS_FAILED",
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription quality needs review."],
  });
  state.put.mockImplementation(async (call: CallRecord, version: number) => {
    if (state.call!.version !== version) return false;
    state.call = structuredClone(call);
    return true;
  });
});
afterEach(() => vi.unstubAllEnvs());
it("keeps issue decisions scoped to current versions and source warnings", async () => {
  state.call!.mode = "sample";
  state.call!.status = "needs_review";
  state.call!.analysis!.reviewIssues = [
    {
      id: "outcome:inspectionBooked",
      kind: "outcome",
      target: "inspectionBooked",
      message: "Outcome evidence needs review.",
    },
  ];
  state.call!.analysis!.outcomes.inspectionBooked = {
    value: null,
    evidence: { segmentIds: [], quote: "" },
  };
  state.call!.analysis!.reviewReasons.push(
    "Outcome evidence needs review.",
    "Recording coverage needs review.",
  );
  const original = structuredClone(state.call!.originalAnalysis);
  const request = (version: number, issueId = "outcome:inspectionBooked") =>
    new Request("http://localhost/api/calls/fictional-call/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        issueId,
        reason: "Confirmed this outcome remains unknown without evidence.",
      }),
    });
  expect((await issueReview(request(99), context)).status).toBe(409);
  expect(
    (await issueReview(request(state.call!.version, "privacy:all"), context))
      .status,
  ).toBe(400);
  expect(
    (await issueReview(request(state.call!.version), context)).status,
  ).toBe(200);
  expect(state.call!.analysis!.outcomes.inspectionBooked.value).toBeNull();
  expect(state.call!.analysis!.reviewReasons).toContain(
    "Recording coverage needs review.",
  );
  expect(state.call!.originalAnalysis).toEqual(original);
  expect(state.call!.issueDecisions).toHaveLength(1);
});
it("reasoned roadmap verification resolves only its current chronology issue", async () => {
  state.call!.mode = "sample";
  state.call!.status = "needs_review";
  state.call!.transcriptCompleteness = "verified";
  state.call!.transcriptReviewReasons = [];
  const old = structuredClone(state.call!.originalAnalysis);
  const checkpoint = state.call!.analysis!.assessments.find(
    (x) => x.id === "expectation_solve",
  )!;
  const staff = state.call!.segments.find(
    (s) => s.id === checkpoint.evidence.segmentIds[0],
  )!;
  state.call!.analysis!.reviewIssues = [
    {
      id: "chronology:expectation_solve",
      kind: "chronology",
      target: "expectation_solve",
      message: "Roadmap chronology needs review.",
    },
  ];
  state.call!.analysis!.reviewReasons.push(
    "Roadmap chronology needs review.",
    "Unrelated source uncertainty.",
  );
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: state.call!.version,
        checkpointId: "expectation_solve",
        status: "passed",
        chronologyVerified: true,
        reason:
          "Verified the actual roadmap precedes the solution within this source segment.",
        evidence: { segmentIds: [staff.id], quote: staff.text },
      }),
    }),
    context,
  );
  expect(result.status).toBe(200);
  expect(state.call!.analysis!.reviewReasons).not.toContain(
    "Roadmap chronology needs review.",
  );
  expect(state.call!.analysis!.reviewReasons).toContain(
    "Unrelated source uncertainty.",
  );
  expect(state.call!.originalAnalysis).toEqual(old);
  expect(state.call!.decisions.at(-1)).toMatchObject({
    chronologyVerified: true,
    analysisGeneration: 0,
  });
});
it("accepts explicit current early-roadmap verification without a pre-existing issue", async () => {
  state.call!.mode = "sample";
  state.call!.status = "needs_review";
  state.call!.transcriptCompleteness = "verified";
  state.call!.transcriptReviewReasons = [];
  state.call!.analysis!.reviewIssues = [];
  const source = state.call!.segments[2];
  const original = structuredClone(state.call!.originalAnalysis);
  const response = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: state.call!.version,
        checkpointId: "expectation_solve",
        status: "passed",
        chronologyVerified: true,
        reason:
          "Explicitly checked the current roadmap source before later solving.",
        evidence: { segmentIds: [source.id], quote: source.text },
      }),
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(state.call!.decisions.at(-1)).toMatchObject({
    chronologyVerified: true,
    evidence: { segmentIds: [source.id], quote: source.text },
  });
  expect(state.call!.originalAnalysis).toEqual(original);
});
it("dispatch failure returns a safe 503 and leaves retryable persisted state", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.start.mockRejectedValue(new Error("fictional private workflow detail"));
  const result = await retry(
    new Request("http://localhost/api/calls/fictional-call/retry", {
      method: "POST",
    }),
    context,
  );
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "PROCESSING_START_FAILED" });
  expect(state.call).toMatchObject({
    status: "failed",
    errorCode: "PROCESSING_START_FAILED",
    transcriptCompleteness: "unverified",
  });
});
it("a reviewer reason cannot certify unknown-speaker employee evidence", async () => {
  state.call!.segments.forEach((segment) => (segment.speaker = "unknown"));
  const original = structuredClone(state.call!.originalAnalysis);
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        checkpointId: "validate",
        status: "passed",
        reason: "A fictional reviewer says this is correct.",
      }),
    }),
    context,
  );
  expect(result.status).toBe(400);
  expect(await result.json()).toEqual({ error: "ATTRIBUTION_REVIEW_REQUIRED" });
  expect(state.put).not.toHaveBeenCalled();
  expect(state.call!.originalAnalysis).toEqual(original);
});
it("a supported live correction cannot clear completeness or independent quality reasons", async () => {
  const original = structuredClone(state.call!.originalAnalysis);
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        checkpointId: "validate",
        status: "passed",
        reason: "Fictional employee quote supports this checkpoint.",
      }),
    }),
    context,
  );
  expect(result.status).toBe(400);
  expect(await result.json()).toEqual({
    error: "SOURCE_VERIFICATION_REQUIRED",
  });
  expect(state.put).not.toHaveBeenCalled();
  expect(state.call!.originalAnalysis).toEqual(original);
});
it("a new owner request can redispatch the same durable pending attempt", async () => {
  vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
  state.call!.status = "analyzing";
  state.call!.errorCode = "PROCESSING_START_PENDING";
  state.call!.processingAttempt = {
    id: "pending-attempt",
    state: "pending",
    runId: null,
  };
  state.start.mockResolvedValue({ runId: "fictional-run" });
  expect(
    (
      await retry(
        new Request("http://localhost/api/calls/fictional-call/retry", {
          method: "POST",
        }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.start).toHaveBeenCalledWith(expect.anything(), [
    "fictional-call",
    "pending-attempt",
  ]);
});
it.each(["running", "untracked"] as const)(
  "%s active work cannot be arbitrarily reopened",
  async (kind) => {
    vi.stubEnv("GROQ_API_KEY", "fictional-contract-token");
    state.call!.status = "analyzing";
    state.call!.errorCode = null;
    if (kind === "running")
      state.call!.processingAttempt = {
        id: "running-attempt",
        state: "running",
        runId: "other-run",
      };
    const result = await retry(
      new Request("http://localhost/api/calls/fictional-call/retry", {
        method: "POST",
      }),
      context,
    );
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: "RETRY_UNAVAILABLE" });
    expect(state.start).not.toHaveBeenCalled();
  },
);
function trusted() {
  state.call!.status = "needs_review";
  state.call!.transcriptCompleteness = "verified";
  state.call!.transcriptReviewReasons = [];
  state.call!.checksum = "a".repeat(64);
  state.call!.sanitizedPath = "sample-workspace/fictional-call.wav";
  state.call!.sourcePreparation = {
    checksum: state.call!.checksum,
    attestedBy: "fictional-owner",
    at: "2026-10-08T00:00:00Z",
    kind: "synthetic",
  };
}
it("a verified reviewer can select actual employee evidence and preserve original/audit", async () => {
  trusted();
  const original = structuredClone(state.call!.originalAnalysis);
  const segment = state.call!.segments.find((s) => s.speaker === "employee")!;
  const result = await review(
    new Request("http://localhost/api/calls/fictional-call/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        checkpointId: "confidence",
        status: "passed",
        reason: "Verified this employee statement in the fictional source.",
        evidence: { segmentIds: [segment.id], quote: segment.text },
      }),
    }),
    context,
  );
  expect(result.status).toBe(200);
  expect(state.call!.originalAnalysis).toEqual(original);
  expect(state.call!.decisions.at(-1)).toMatchObject({
    sourceRevision: 0,
    evidence: { segmentIds: [segment.id], quote: segment.text },
  });
});
it.each(["fabricated", "customer", "stale-source", "active"])(
  "checkpoint correction rejects %s evidence/state",
  async (kind) => {
    trusted();
    if (kind === "stale-source") state.call!.sourceRevision = 1;
    if (kind === "active")
      state.call!.processingAttempt = {
        id: "active-attempt",
        state: "pending",
        runId: null,
      };
    const segment = state.call!.segments.find(
      (s) => s.speaker === (kind === "customer" ? "customer" : "employee"),
    )!;
    const result = await review(
      new Request("http://localhost/api/calls/fictional-call/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          checkpointId: "confidence",
          status: "passed",
          reason:
            "Fictional evidence correction with an explicit source check.",
          evidence: {
            segmentIds: [segment.id],
            quote:
              kind === "fabricated" ? "fabricated source text" : segment.text,
          },
        }),
      }),
      context,
    );
    expect(result.status).toBe(
      kind === "active" || kind === "stale-source" ? 409 : 400,
    );
    expect(state.put).not.toHaveBeenCalled();
  },
);
