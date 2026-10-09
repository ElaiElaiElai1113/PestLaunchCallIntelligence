import { cookies } from "next/headers";
import {
  requireIdentity,
  checkOrigin,
  issueSampleSession,
  sampleEnabled,
} from "@/lib/server/auth";
import { respond, json } from "@/lib/server/http";
import { hasSupabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const identity = await requireIdentity();
    return {
      identity,
      aiConfigured: Boolean(process.env.GROQ_API_KEY),
      processingEnabled: true,
      backendConfigured: hasSupabase(),
    };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    if (!sampleEnabled()) throw new Error("SAMPLE_UNAVAILABLE");
    const token = await issueSampleSession();
    (await cookies()).set("pestlaunch-sample", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 3600,
    });
    return { ok: true };
  });
}
export async function DELETE(request: Request) {
  checkOrigin(request);
  (await cookies()).delete("pestlaunch-sample");
  return json({ ok: true });
}
