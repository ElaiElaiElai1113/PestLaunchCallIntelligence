import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  secret = process.env.SUPABASE_SECRET_KEY;
if (
  !url ||
  !secret ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error(
    "Local Supabase credentials required. This script refuses cloud targets.",
  );
const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  password = randomBytes(24).toString("base64url");
const { data: workspace, error } = await client
  .from("workspaces")
  .insert({ name: "PestLaunch local test" })
  .select("id")
  .single();
if (error) throw new Error("Local schema is not available.");
const accounts = [];
for (const role of ["owner", "reviewer"] as const) {
  const email = `${role}-${workspace.id.slice(0, 8)}@pestlaunch.example`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not seed local test user.");
  const membership = await client
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: data.user.id, role });
  if (membership.error) throw new Error("Could not seed local membership.");
  accounts.push({ email, password, role });
}
await mkdir(".private/app", { recursive: true });
await writeFile(
  ".private/app/local-test-accounts.json",
  JSON.stringify(accounts, null, 2),
  { mode: 0o600 },
);
console.log(
  "Local users created. Credentials are in ignored .private/app/local-test-accounts.json. No invitations were sent.",
);
