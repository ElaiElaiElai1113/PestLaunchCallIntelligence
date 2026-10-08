import { Repository } from "@/lib/server/repository";
import { requireIdentity, AppError } from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { adminClient } from "@/lib/supabase/server";
export async function GET(
  _request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  return respond(async () => {
    const call = await new Repository(await requireIdentity()).get(
      (await context.params).callId,
    );
    if (call.mode === "sample")
      throw new AppError("SAMPLE_AUDIO_UNAVAILABLE", 404);
    if (!call.sanitizedPath || !["ready", "needs_review"].includes(call.status))
      throw new AppError("PLAYBACK_UNAVAILABLE", 403);
    const { data, error } = await adminClient()
      .storage.from("call-sanitized")
      .createSignedUrl(call.sanitizedPath, 60);
    if (error) throw new AppError("PLAYBACK_UNAVAILABLE", 503);
    return { url: data.signedUrl };
  });
}
