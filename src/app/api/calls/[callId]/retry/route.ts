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
    if (
      call.status !== "failed" &&
      !["AI_NOT_CONFIGURED", "PRIVACY_APPROVAL_REQUIRED"].includes(
        call.errorCode || "",
      )
    )
      throw new AppError("RETRY_UNAVAILABLE");
    const previous = call.version;
    call.status = call.segments.length ? "analyzing" : "queued";
    call.errorCode = null;
    call.version++;
    if (!(await repo.put(call, previous))) throw new AppError("CONFLICT", 409);
    await start(processCall, [call.id]);
    return { callId: call.id };
  });
}
