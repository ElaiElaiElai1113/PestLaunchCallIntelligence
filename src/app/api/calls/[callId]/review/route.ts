import { randomUUID } from "node:crypto";
import { Repository } from "@/lib/server/repository";
import { checkOrigin, requireIdentity, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { reviewSchema } from "@/lib/domain/schemas";
import { computeScore } from "@/lib/scoring/engine";
import {
  guardAssessment,
  assessmentContext,
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
    if (!call.analysis) throw new AppError("NO_ANALYSIS");
    const checkpoint = call.analysis.assessments.find(
      (x) => x.id === decision.checkpointId,
    );
    if (!checkpoint) throw new AppError("INVALID_CHECKPOINT");
    if (decision.status === "passed" && !checkpoint.evidence.segmentIds.length)
      throw new AppError("EVIDENCE_REQUIRED");
    checkpoint.status = decision.status;
    checkpoint.reason = decision.reason;
    call.analysis.reviewReasons = call.analysis.reviewReasons.filter(
      (x) => x !== `Checkpoint needs review: ${decision.checkpointId}`,
    );
    if (call.mode === "live") {
      const guarded = guardAssessment(
        call.analysis,
        call.segments,
        assessmentContext(call),
      );
      if (
        decision.status === "passed" &&
        guarded.assessments.find((x) => x.id === decision.checkpointId)
          ?.status !== "passed"
      )
        throw new AppError("ATTRIBUTION_REVIEW_REQUIRED", 400);
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
    });
    call.version++;
    if (!(await repo.put(call, decision.version)))
      throw new AppError("STALE_REVIEW", 409);
    return { call };
  });
}
