import { Repository } from "@/lib/server/repository";
import {
  requireIdentity,
  requireOwner,
  checkOrigin,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
export async function DELETE(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    if ((await request.json()).confirmation !== "DELETE")
      throw new AppError("CONFIRMATION_REQUIRED");
    const repo = new Repository(identity);
    const calls = await repo.list();
    for (const call of calls) await repo.delete(call.id);
    return { deleted: calls.length, at: new Date().toISOString() };
  });
}
