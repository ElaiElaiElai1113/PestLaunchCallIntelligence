import { Repository } from "@/lib/server/repository";
import { checkOrigin, requireIdentity, requireOwner } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
type Context = { params: Promise<{ callId: string }> };
export async function GET(_request: Request, context: Context) {
  return respond(async () => ({
    call: await new Repository(await requireIdentity()).get(
      (await context.params).callId,
    ),
  }));
}
export async function DELETE(request: Request, context: Context) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    await new Repository(identity).delete((await context.params).callId);
    return { deleted: true };
  });
}
