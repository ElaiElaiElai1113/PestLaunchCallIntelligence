import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasSupabase, userClient } from "../supabase/server";
import type { Identity } from "../domain/types";
import { originAllowed } from "./origin";
import { resolveSampleRoot } from "./sample-paths";
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}
export const sampleEnabled = () =>
  process.env.NODE_ENV === "development" && !hasSupabase();
async function sampleKey() {
  const folder = resolveSampleRoot();
  await mkdir(folder, { recursive: true });
  const path = join(folder, "sample-session-key");
  try {
    await writeFile(path, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFile(path);
}
export async function issueSampleSession() {
  if (!sampleEnabled()) throw new AppError("SAMPLE_UNAVAILABLE", 404);
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 3600000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", await sampleKey())
    .update(payload)
    .digest("base64url")}`;
}
export async function requireIdentity(): Promise<Identity> {
  const jar = await cookies();
  const token = jar.get("pestlaunch-sample")?.value;
  if (token && sampleEnabled()) {
    const [payload, signature] = token.split(".");
    try {
      const expected = createHmac("sha256", await sampleKey())
        .update(payload)
        .digest();
      const actual = Buffer.from(signature, "base64url");
      if (
        actual.length === expected.length &&
        timingSafeEqual(actual, expected) &&
        JSON.parse(Buffer.from(payload, "base64url").toString()).exp >
          Date.now()
      )
        return {
          userId: "sample-owner",
          workspaceId: "sample-workspace",
          role: "owner",
          mode: "sample",
        };
    } catch {}
  }
  if (!hasSupabase()) throw new AppError("SIGN_IN_REQUIRED", 401);
  const client = await userClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || user.is_anonymous)
    throw new AppError("SIGN_IN_REQUIRED", 401);
  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new AppError("WORKSPACE_ACCESS_REQUIRED", 403);
  return {
    userId: user.id,
    workspaceId: membership.workspace_id,
    role: membership.role,
    mode: "live",
  };
}
export function requireOwner(identity: Identity) {
  if (identity.role !== "owner") throw new AppError("OWNER_REQUIRED", 403);
}
export function checkOrigin(request: Request) {
  if (
    !originAllowed(
      request,
      process.env.APP_ORIGIN,
      process.env.NODE_ENV === "development",
    )
  )
    throw new AppError("INVALID_ORIGIN", 403);
}
