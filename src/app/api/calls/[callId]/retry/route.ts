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
import { dispatchRetry } from "@/lib/jobs/retry-dispatch";
import { retryAvailable } from "@/lib/domain/processing-attempt";
export async function POST(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    if (!process.env.GROQ_API_KEY) throw new AppError("AI_NOT_CONFIGURED", 503);
    const repo = new Repository(identity),
      call = await repo.get((await context.params).callId);
    if (
      call.sourceKind !== "synthetic" &&
      process.env.REAL_CALL_PROCESSING_ENABLED !== "true"
    )
      throw new AppError("PRIVACY_APPROVAL_REQUIRED", 403);
    if (!retryAvailable(call)) throw new AppError("RETRY_UNAVAILABLE");
    try {
      await dispatchRetry(repo, call, async (id, attemptId) => {
        await start(processCall, [id, attemptId]);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CONFLICT")
        throw new AppError("CONFLICT", 409);
      if (error instanceof Error && error.message === "PROCESSING_START_FAILED")
        throw new AppError("PROCESSING_START_FAILED", 503);
      throw error;
    }
    return { callId: call.id };
  });
}
