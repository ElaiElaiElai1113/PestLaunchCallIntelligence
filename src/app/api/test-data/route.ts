import { Repository } from "@/lib/server/repository";
import {
  requireIdentity,
  requireOwner,
  checkOrigin,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const identity = await requireIdentity();
    requireOwner(identity);
    return new Repository(identity).retentionSummary();
  });
}
export async function DELETE(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    let input;
    try {
      input = await request.json();
    } catch {
      throw new AppError("CONFIRMATION_REQUIRED");
    }
    if (!input || input.confirmation !== "DELETE")
      throw new AppError("CONFIRMATION_REQUIRED");
    const repo = new Repository(identity);
    const calls = await repo.list(true);
    for (const call of calls) await repo.delete(call.id);
    return { deleted: calls.length, at: new Date().toISOString() };
  });
}
