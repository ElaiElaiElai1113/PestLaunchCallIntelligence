import assert from "node:assert/strict";
import { readFile, unlink, mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.equal(new URL(url).hostname, "qwrukdqtuhqkbrbtnekz.supabase.co");
assert.ok(process.argv.includes("--run"), "Explicit --run is required");
assert.ok(!process.env.GROQ_API_KEY, "Cleanup requires the keyless test phase");
assert.equal(process.env.REAL_CALL_PROCESSING_ENABLED, "false");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const accountFiles = [
  ".private/app/hosted-test-accounts-first.json",
  ".private/app/hosted-test-accounts-second.json",
  ".private/app/hosted-test-accounts.json",
];
const accounts = new Map<
  string,
  { id: string; email: string; password: string }
>();
for (const file of accountFiles) {
  try {
    for (const account of JSON.parse(await readFile(file, "utf8"))) {
      assert.match(
        account.email,
        /^(owner|reviewer|outsider)-[a-f0-9-]+@pestlaunch\.example$/,
      );
      accounts.set(account.id, account);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const workspaceIds = new Set<string>();
for (const account of accounts.values()) {
  const membership = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", account.id);
  assert.ok(!membership.error);
  for (const row of membership.data ?? []) workspaceIds.add(row.workspace_id);
}
let deletedCalls = 0;
for (const workspaceId of workspaceIds) {
  const workspace = await admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();
  assert.ok(!workspace.error);
  assert.ok(
    [
      "Fictional PestLaunch acceptance",
      "Fictional isolated workspace",
    ].includes(workspace.data!.name),
  );
  const memberships = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  assert.ok(
    !memberships.error &&
      memberships.data?.every((row) => accounts.has(row.user_id)),
    "Workspace includes an unowned member; cleanup refused",
  );
  const calls = await admin
    .from("calls")
    .select("id,payload")
    .eq("workspace_id", workspaceId);
  assert.ok(!calls.error);
  for (const call of calls.data ?? []) {
    assert.equal(call.payload.sourceKind, "synthetic");
    assert.equal(call.payload.analysis, null);
    const tombstone = await admin
      .from("deletion_tombstones")
      .upsert({ call_id: call.id, workspace_id: workspaceId });
    assert.ok(!tombstone.error);
    for (const [bucket, path] of [
      ["call-source", call.payload.sourcePath],
      ["call-sanitized", call.payload.sanitizedPath],
    ] as const) {
      if (!path) continue;
      assert.ok(path.startsWith(`${workspaceId}/`));
      assert.ok(!(await admin.storage.from(bucket).remove([path])).error);
      assert.ok((await admin.storage.from(bucket).download(path)).error);
    }
    assert.ok(
      !(
        await admin.rpc("delete_call", {
          p_id: call.id,
          p_workspace: workspaceId,
        })
      ).error,
    );
    deletedCalls++;
  }
  for (const bucket of ["call-source", "call-sanitized"]) {
    const remaining = await admin.storage
      .from(bucket)
      .list(workspaceId, { limit: 1000 });
    assert.ok(
      !remaining.error && remaining.data?.length === 0,
      "Unexpected storage copies remain; cleanup refused",
    );
  }
  assert.ok(
    !(await admin.from("workspaces").delete().eq("id", workspaceId)).error,
  );
  const remaining = await admin
    .from("calls")
    .select("id")
    .eq("workspace_id", workspaceId);
  assert.ok(!remaining.error && remaining.data?.length === 0);
}
for (const account of accounts.values()) {
  const client = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const login = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (login.data.session)
    assert.ok(
      !(
        await admin.auth.admin.signOut(
          login.data.session.access_token,
          "global",
        )
      ).error,
    );
  assert.ok(!(await admin.auth.admin.deleteUser(account.id)).error);
  assert.ok((await admin.auth.admin.getUserById(account.id)).error);
}
for (const file of [
  ...accountFiles,
  ".private/app/hosted-keyless-silence.wav",
]) {
  try {
    await unlink(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
await mkdir(".private/evidence", { recursive: true });
const receipt = {
  at: new Date().toISOString(),
  project: "qwrukdqtuhqkbrbtnekz",
  deletedFictionalCalls: deletedCalls,
  deletedFictionalWorkspaces: workspaceIds.size,
  deletedFictionalUsers: accounts.size,
  storageEmpty: true,
  limitation:
    "Verified current application/database/Storage copies only; provider backup/log retention is not certified.",
};
await writeFile(
  ".private/evidence/hosted-keyless-cleanup.json",
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt));
