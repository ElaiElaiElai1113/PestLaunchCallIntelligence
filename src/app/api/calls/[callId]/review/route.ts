import { randomUUID } from "node:crypto";
import { Repository } from "@/lib/server/repository";
import { checkOrigin, requireIdentity, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { reviewSchema } from "@/lib/domain/schemas";
import { computeScore } from "@/lib/scoring/engine";
import { validateEvidence } from "@/lib/domain/evidence";
import {
  activeProcessing,
  analysisCurrent,
  sourceReviewBlock,
} from "@/lib/domain/source-review";
import {
  guardAssessment,
  assessmentContext,
  reviewedAssessmentContext,
} from "@/lib/domain/assessment-guards";
export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    const repo = new Repository(identity);
    const call = await repo.get((await context.params).callId);
    const decision = reviewSchema.parse(await request.json());
    if (call.version !== decision.version)
      throw new AppError("STALE_REVIEW", 409);
    if (activeProcessing(call)) throw new AppError("PROCESSING_ACTIVE", 409);
    if (!call.analysis) throw new AppError("NO_ANALYSIS");
    if (!analysisCurrent(call)) throw new AppError("STALE_ANALYSIS", 409);
    const checkpoint = call.analysis.assessments.find(
      (x) => x.id === decision.checkpointId,
    );
    if (!checkpoint) throw new AppError("INVALID_CHECKPOINT");
    if (decision.evidence)
      checkpoint.evidence = structuredClone(decision.evidence);
    if (decision.status === "passed" && !checkpoint.evidence.segmentIds.length)
      throw new AppError("EVIDENCE_REQUIRED");
    checkpoint.status = decision.status;
    checkpoint.reason = decision.reason;
    if (validateEvidence(call.analysis, call.segments).length)
      throw new AppError("INVALID_EVIDENCE", 400);
    call.analysis.reviewReasons = call.analysis.reviewReasons.filter(
      (x) => x !== `Checkpoint needs review: ${decision.checkpointId}`,
    );
    const inherited = reviewedAssessmentContext(call).roadmapOrderReviewed;
    const roadmapVerified =
      decision.checkpointId === "expectation_solve"
        ? decision.status === "passed"
          ? (decision.chronologyVerified ?? inherited)
          : false
        : inherited;
    {
      const guarded = guardAssessment(call.analysis, call.segments, {
        ...reviewedAssessmentContext(call),
        roadmapOrderReviewed: roadmapVerified,
      });
      if (decision.chronologyVerified) {
        if (
          decision.checkpointId !== "expectation_solve" ||
          decision.status !== "passed"
        )
          throw new AppError("INVALID_ISSUE_RESOLUTION", 400);
        guarded.reviewIssues = guarded.reviewIssues?.filter(
          (x) => x.id !== "chronology:expectation_solve",
        );
        const raw = call.latestModelAnalysis ?? call.originalAnalysis;
        if (!raw?.reviewReasons.includes("Roadmap chronology needs review."))
          guarded.reviewReasons = guarded.reviewReasons.filter(
            (x) => x !== "Roadmap chronology needs review.",
          );
      }
      if (
        decision.checkpointId === "expectation_solve" &&
        (decision.status !== "passed" ||
          guarded.assessments.find((x) => x.id === decision.checkpointId)
            ?.status === "passed")
      ) {
        guarded.reviewIssues = guarded.reviewIssues?.filter(
          (x) => x.id !== "chronology:expectation_solve",
        );
        if (
          !(
            call.latestModelAnalysis ?? call.originalAnalysis
          )?.reviewReasons.includes("Roadmap chronology needs review.")
        )
          guarded.reviewReasons = guarded.reviewReasons.filter(
            (x) => x !== "Roadmap chronology needs review.",
          );
      }
      if (
        decision.status === "passed" &&
        guarded.assessments.find((x) => x.id === decision.checkpointId)
          ?.status !== "passed"
      )
        throw new AppError(
          guarded.assessments.find((x) => x.id === decision.checkpointId)
            ?.reason === "Pre-solution roadmap order needs review."
            ? "CHRONOLOGY_REVIEW_REQUIRED"
            : "ATTRIBUTION_REVIEW_REQUIRED",
          400,
        );
      if (
        (decision.status === "passed" || decision.status === "missed") &&
        !assessmentContext(call).transcriptComplete
      )
        throw new AppError("SOURCE_VERIFICATION_REQUIRED", 400);
      if (
        call.mode === "live" &&
        (decision.status === "passed" || decision.status === "missed")
      ) {
        const blocked = sourceReviewBlock(call, true);
        if (blocked) throw new AppError(blocked, 400);
      }
      guarded.reviewReasons = [
        ...new Set([
          ...guarded.reviewReasons,
          ...(call.transcriptReviewReasons ?? []),
        ]),
      ];
      call.analysis = guarded;
    }
    call.score = computeScore(call.analysis);
    call.status =
      call.score.grade === null || call.analysis.reviewReasons.length
        ? "needs_review"
        : "ready";
    call.decisions.push({
      id: randomUUID(),
      checkpointId: decision.checkpointId,
      status: decision.status,
      reason: decision.reason,
      userId: identity.userId,
      at: new Date().toISOString(),
      previousVersion: call.version,
      sourceRevision: call.sourceRevision ?? 0,
      evidence: structuredClone(checkpoint.evidence),
      chronologyVerified:
        decision.checkpointId === "expectation_solve" ? roadmapVerified : false,
      analysisGeneration: call.analysisGeneration ?? 0,
    });
    call.version++;
    if (!(await repo.put(call, decision.version)))
      throw new AppError("STALE_REVIEW", 409);
    return { call };
  });
}
