import { randomUUID } from "node:crypto";
import { Repository } from "@/lib/server/repository";
import { requireIdentity, checkOrigin, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { sourceReviewSchema } from "@/lib/domain/schemas";
import {
  applySourceReview,
  sourceReviewBlock,
} from "@/lib/domain/source-review";
export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity(),
      repo = new Repository(identity),
      call = await repo.get((await context.params).callId);
    const input = sourceReviewSchema.parse(await request.json());
    const blocked = sourceReviewBlock(
      call,
      process.env.REAL_CALL_PROCESSING_ENABLED === "true",
    );
    if (blocked)
      throw new AppError(blocked, blocked === "PROCESSING_ACTIVE" ? 409 : 400);
    let next;
    try {
      next = applySourceReview(call, input, {
        id: randomUUID(),
        userId: identity.userId,
        at: new Date().toISOString(),
      });
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : "INVALID_REQUEST",
        error instanceof Error && error.message === "STALE_SOURCE_REVIEW"
          ? 409
          : 400,
      );
    }
    if (!(await repo.put(next, input.version)))
      throw new AppError("STALE_SOURCE_REVIEW", 409);
    return { call: next };
  });
}
