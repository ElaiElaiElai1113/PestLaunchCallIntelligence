import { randomUUID } from "node:crypto";
import { Repository } from "@/lib/server/repository";
import { checkOrigin, requireIdentity, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { reviewSchema } from "@/lib/domain/schemas";
import { computeScore } from "@/lib/scoring/engine";
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
    call.score = computeScore(call.analysis);
    call.status =
      call.score.unresolved || call.analysis.reviewReasons.length
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
