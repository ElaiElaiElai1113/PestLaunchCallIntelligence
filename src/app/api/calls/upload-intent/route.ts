import { randomUUID } from "node:crypto";
import {
  requireIdentity,
  requireOwner,
  checkOrigin,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { Repository } from "@/lib/server/repository";
import { uploadSchema } from "@/lib/domain/schemas";
import type { CallRecord } from "@/lib/domain/types";
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    if (identity.mode !== "live")
      throw new AppError("BACKEND_NOT_CONFIGURED", 503);
    const input = uploadSchema.parse(await request.json());
    if (
      input.sourceKind === "real" &&
      process.env.REAL_CALL_PROCESSING_ENABLED !== "true"
    )
      throw new AppError("PRIVACY_APPROVAL_REQUIRED", 403);
    const repo = new Repository(identity);
    const duplicate = (await repo.list()).find(
      (x) => x.checksum === input.checksum,
    );
    if (duplicate)
      return duplicate.errorCode === "UPLOAD_PENDING"
        ? { callId: duplicate.id, path: duplicate.sourcePath, resume: true }
        : { duplicateId: duplicate.id };
    const id = randomUUID(),
      path = `${identity.workspaceId}/${id}.${input.extension}`;
    const call: CallRecord = {
      id,
      workspaceId: identity.workspaceId,
      label: input.label,
      mode: "live",
      sourceKind: input.sourceKind,
      status: "queued",
      uploadedAt: new Date().toISOString(),
      recordedAt: input.recordedAt,
      rep: input.rep,
      direction: input.direction,
      durationMs: input.durationMs,
      version: 1,
      sourcePath: path,
      sanitizedPath: null,
      checksum: input.checksum,
      errorCode: "UPLOAD_PENDING",
      segments: [],
      analysis: null,
      originalAnalysis: null,
      score: null,
      decisions: [],
    };
    if (!(await repo.put(call, null))) throw new AppError("CONFLICT", 409);
    return { callId: id, path };
  });
}
