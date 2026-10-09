import { Repository } from "@/lib/server/repository";
import { checkOrigin, requireIdentity, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { issueReviewSchema } from "@/lib/domain/schemas";
import { activeProcessing, analysisCurrent } from "@/lib/domain/source-review";
import { resolveIssue } from "@/lib/domain/issue-resolution";
import { computeScore } from "@/lib/scoring/engine";
export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity(),
      repo = new Repository(identity),
      call = await repo.get((await context.params).callId),
      body = issueReviewSchema.parse(await request.json());
    if (call.version !== body.version) throw new AppError("STALE_REVIEW", 409);
    if (activeProcessing(call)) throw new AppError("PROCESSING_ACTIVE", 409);
    if (call.status === "privacy_review")
      throw new AppError("PRIVACY_APPROVAL_REQUIRED", 400);
    if (!analysisCurrent(call)) throw new AppError("STALE_ANALYSIS", 409);
    let next;
    try {
      next = resolveIssue(call, body.issueId, body.reason, identity.userId);
    } catch {
      throw new AppError("INVALID_ISSUE_RESOLUTION", 400);
    }
    next.score = computeScore(next.analysis!);
    next.status =
      next.score.grade === null || next.analysis!.reviewReasons.length
        ? "needs_review"
        : "ready";
    next.version++;
    if (!(await repo.put(next, body.version)))
      throw new AppError("STALE_REVIEW", 409);
    return { call: next };
  });
}
