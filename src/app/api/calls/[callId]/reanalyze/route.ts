import { aiConfigured, selectedRequestLimits } from "@/lib/server/ai-provider";
import { start } from "workflow/api";
import { processCall } from "@/workflows/process-call";
import { Repository } from "@/lib/server/repository";
import {
  requireIdentity,
  requireOwner,
  checkOrigin,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { reanalysisSchema } from "@/lib/domain/schemas";
import { analysisCurrent, sourceReviewBlock } from "@/lib/domain/source-review";
import { dispatchRetry } from "@/lib/jobs/retry-dispatch";
import { analysisRecovery } from "@/lib/groq/analysis-recovery";
export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    const repo = new Repository(identity),
      call = await repo.get((await context.params).callId);
    const input = reanalysisSchema.parse(await request.json());
    if (call.version !== input.version) throw new AppError("STALE_REVIEW", 409);
    if (!aiConfigured()) throw new AppError("AI_NOT_CONFIGURED", 503);
    if (call.mode !== "live") throw new AppError("BACKEND_NOT_CONFIGURED", 503);
    const blocked = sourceReviewBlock(call);
    if (blocked)
      throw new AppError(blocked, blocked === "PROCESSING_ACTIVE" ? 409 : 400);
    if (analysisCurrent(call))
      throw new AppError("REANALYSIS_UNAVAILABLE", 400);
    const recovery = analysisRecovery(call, undefined, selectedRequestLimits());
    if (!recovery.eligible)
      throw new AppError(
        recovery.blockedReason ?? "REANALYSIS_UNAVAILABLE",
        400,
      );
    try {
      await dispatchRetry(repo, call, async (id, attemptId) => {
        await start(processCall, [id, attemptId]);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CONFLICT")
        throw new AppError("STALE_REVIEW", 409);
      if (error instanceof Error && error.message === "PROCESSING_START_FAILED")
        throw new AppError("PROCESSING_START_FAILED", 503);
      throw error;
    }
    return { callId: call.id };
  });
}
