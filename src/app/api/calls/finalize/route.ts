import { createHash } from "node:crypto";
import { start } from "workflow/api";
import { processCall } from "@/workflows/process-call";
import {
  requireIdentity,
  requireOwner,
  checkOrigin,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { Repository } from "@/lib/server/repository";
import { adminClient } from "@/lib/supabase/server";
import { validAudioHeader } from "@/lib/privacy/preflight";
import { z } from "zod";
import { processingDecision } from "@/lib/jobs/admission";
import { dispatchRetry } from "@/lib/jobs/retry-dispatch";
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    if (identity.mode !== "live")
      throw new AppError("BACKEND_NOT_CONFIGURED", 503);
    const { callId } = z
      .object({ callId: z.uuid() })
      .parse(await request.json());
    const repo = new Repository(identity),
      call = await repo.get(callId);
    if (call.errorCode !== "UPLOAD_PENDING") return { callId };
    const { data, error } = await adminClient()
      .storage.from("call-source")
      .download(call.sourcePath!);
    if (error || !data) throw new AppError("UPLOAD_NOT_FOUND");
    if (data.size > 25_000_000) throw new AppError("FILE_TOO_LARGE");
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!validAudioHeader(bytes, call.sourcePath!.split(".").at(-1)!))
      throw new AppError("INVALID_AUDIO");
    if (createHash("sha256").update(bytes).digest("hex") !== call.checksum)
      throw new AppError("UPLOAD_CHECKSUM_MISMATCH");
    const expected = call.version;
    const admission = processingDecision(
      Boolean(process.env.GROQ_API_KEY),
      process.env.REAL_CALL_PROCESSING_ENABLED === "true",
      call.sourceKind === "synthetic",
    );
    if (admission === "run") {
      try {
        await dispatchRetry(repo, call, async (id, attemptId) => {
          await start(processCall, [id, attemptId]);
        });
      } catch (error) {
        if (error instanceof Error && error.message === "CONFLICT")
          throw new AppError("CONFLICT", 409);
        if (
          error instanceof Error &&
          error.message === "PROCESSING_START_FAILED"
        )
          throw new AppError("PROCESSING_START_FAILED", 503);
        throw error;
      }
      return { callId };
    }
    call.errorCode =
      admission === "awaiting_ai"
        ? "AI_NOT_CONFIGURED"
        : "PRIVACY_APPROVAL_REQUIRED";
    call.version++;
    if (!(await repo.put(call, expected))) return { callId };
    return { callId, processing: admission };
  });
}
