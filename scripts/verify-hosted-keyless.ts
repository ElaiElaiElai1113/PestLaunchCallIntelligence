import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// This acceptance probe can mutate only the dedicated, authorized test backend.
process.loadEnvFile(".env.local");
const expectedRef = "qwrukdqtuhqkbrbtnekz";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const origin = process.env.APP_ORIGIN!;
assert.equal(new URL(url).hostname, `${expectedRef}.supabase.co`);
assert.equal(origin, "http://127.0.0.1:3000");
assert.ok(publishable && secret, "Dedicated project credentials are required");
assert.ok(!process.env.GROQ_API_KEY, "This probe requires an empty AI key");
assert.equal(process.env.REAL_CALL_PROCESSING_ENABLED, "false");
assert.ok(process.argv.includes("--run"), "Explicit --run is required");
assert.ok(
  !existsSync(".private/app/hosted-test-accounts.json"),
  "Clean up the previous fictional QA identities before starting another run",
);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const runId = randomUUID();
const users: { id: string; role: string; email: string; password: string }[] =
  [];
const workspaces: string[] = [];
const calls: string[] = [];
const results: { check: string; passed: boolean }[] = [];
const check = (name: string, condition: boolean) => {
  results.push({ check: name, passed: condition });
  assert.ok(condition, name);
  console.log(`PASS ${name}`);
};
function wav() {
  // Generated silence, explicitly fictional; no customer or speech content.
  const samples = 8000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(samples, 24);
  buffer.writeUInt32LE(samples * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
async function session(account: (typeof users)[number]) {
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishable, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const signed = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.ok(!signed.error && signed.data.user, "Test account login failed");
  return {
    client,
    request: (path: string, method = "GET", body?: unknown) =>
      fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join(
            "; ",
          ),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  };
}
try {
  for (const name of [
    "Fictional PestLaunch acceptance",
    "Fictional isolated workspace",
  ]) {
    const result = await admin
      .from("workspaces")
      .insert({ name })
      .select("id")
      .single();
    assert.ok(!result.error && result.data, "Workspace creation failed");
    workspaces.push(result.data.id);
  }
  for (const role of ["owner", "reviewer", "outsider"]) {
    const email = `${role}-${runId}@pestlaunch.example`;
    const password = randomBytes(24).toString("base64url");
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ok(
      !result.error && result.data.user,
      "Fictional account creation failed",
    );
    users.push({ id: result.data.user.id, role, email, password });
    const member = await admin.from("workspace_members").insert({
      workspace_id: role === "outsider" ? workspaces[1] : workspaces[0],
      user_id: result.data.user.id,
      role: role === "outsider" ? "owner" : role,
    });
    assert.ok(!member.error, "Protected membership creation failed");
  }
  await mkdir(".private/app", { recursive: true });
  await writeFile(
    ".private/app/hosted-test-accounts.json",
    JSON.stringify(users),
    { mode: 0o600 },
  );
  const owner = await session(users[0]);
  const reviewer = await session(users[1]);
  const outsider = await session(users[2]);
  const anonymous = createClient(url, publishable, options);
  check(
    "anonymous database read denied",
    Boolean((await anonymous.from("calls").select("id")).error),
  );
  check(
    "anonymous application API denied",
    (await fetch(origin + "/api/calls")).status === 401,
  );
  const stateResponse = await owner.request("/api/session");
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  check(
    "hosted owner identity verified",
    state.identity.role === "owner" && state.identity.mode === "live",
  );
  check(
    "AI and real-call processing disabled",
    state.aiConfigured === false && state.processingEnabled === false,
  );
  check(
    "private responses use no-store",
    stateResponse.headers.get("cache-control")?.includes("no-store") === true,
  );
  const audio = wav();
  await writeFile(".private/app/hosted-keyless-silence.wav", audio);
  const metadata = {
    label: "SYNTHETIC — generated silence for keyless upload acceptance",
    bytes: audio.length,
    durationMs: 1000,
    checksum: createHash("sha256").update(audio).digest("hex"),
    extension: "wav",
    recordedAt: null,
    rep: null,
    direction: null,
    sanitized: true,
    sourceKind: "synthetic",
  };
  check(
    "reviewer cannot admit source uploads",
    (await reviewer.request("/api/calls/upload-intent", "POST", metadata))
      .status === 403,
  );
  check(
    "real recording admission stays blocked",
    (
      await owner.request("/api/calls/upload-intent", "POST", {
        ...metadata,
        sourceKind: "real",
      })
    ).status === 403,
  );
  const intentResponse = await owner.request(
    "/api/calls/upload-intent",
    "POST",
    metadata,
  );
  assert.equal(intentResponse.status, 200);
  const intent = await intentResponse.json();
  calls.push(intent.callId);
  check(
    "owner direct private upload succeeds",
    !(
      await owner.client.storage
        .from("call-source")
        .upload(intent.path, audio, { contentType: "audio/wav" })
    ).error,
  );
  check(
    "reviewer raw source upload denied",
    Boolean(
      (
        await reviewer.client.storage
          .from("call-source")
          .upload(`${workspaces[0]}/${randomUUID()}.wav`, audio, {
            contentType: "audio/wav",
          })
      ).error,
    ),
  );
  for (const [name, client] of [
    ["owner", owner.client],
    ["reviewer", reviewer.client],
    ["outsider", outsider.client],
  ] as const)
    check(
      `${name} raw source download denied`,
      Boolean(
        (await client.storage.from("call-source").download(intent.path)).error,
      ),
    );
  const finalizedResponse = await owner.request("/api/calls/finalize", "POST", {
    callId: intent.callId,
  });
  assert.equal(finalizedResponse.status, 200);
  check(
    "keyless finalize awaits AI",
    (await finalizedResponse.json()).processing === "awaiting_ai",
  );
  const detailResponse = await reviewer.request(`/api/calls/${intent.callId}`);
  assert.equal(detailResponse.status, 200);
  const call = (await detailResponse.json()).call;
  check(
    "no fabricated transcript, analysis or grade",
    call.errorCode === "AI_NOT_CONFIGURED" &&
      call.segments.length === 0 &&
      call.analysis === null &&
      call.originalAnalysis === null &&
      call.score === null,
  );
  check(
    "missing call metadata stays missing",
    call.recordedAt === null && call.rep === null && call.direction === null,
  );
  check(
    "review cannot invent an absent assessment",
    (
      await reviewer.request(`/api/calls/${intent.callId}/review`, "POST", {
        version: call.version,
        checkpointId: "pricing",
        status: "missed",
        reason: "Fictional recording has no provider analysis yet.",
      })
    ).status === 400,
  );
  check(
    "reviewer deletion denied",
    (await reviewer.request(`/api/calls/${intent.callId}`, "DELETE")).status ===
      403,
  );
  check(
    "outsider application access denied",
    (await outsider.request(`/api/calls/${intent.callId}`)).status === 404,
  );
  const outsideRows = await outsider.client
    .from("calls")
    .select("id")
    .eq("id", intent.callId);
  check(
    "cross-workspace RLS hides call",
    !outsideRows.error && outsideRows.data?.length === 0,
  );
  check(
    "direct membership escalation denied",
    Boolean(
      (
        await reviewer.client
          .from("workspace_members")
          .update({ role: "owner" })
          .eq("user_id", users[1].id)
      ).error,
    ),
  );
  check(
    "direct call writes denied",
    Boolean(
      (
        await owner.client
          .from("calls")
          .update({ version: 999 })
          .eq("id", intent.callId)
      ).error,
    ),
  );
  check(
    "direct save RPC denied",
    Boolean(
      (
        await reviewer.client.rpc("save_call", {
          p_id: intent.callId,
          p_workspace: workspaces[0],
          p_expected: call.version,
          p_payload: call,
        })
      ).error,
    ),
  );
  const duplicate = await owner.request(
    "/api/calls/upload-intent",
    "POST",
    metadata,
  );
  assert.equal(duplicate.status, 200);
  check(
    "duplicate resolves to existing call",
    (await duplicate.json()).duplicateId === intent.callId,
  );
  check(
    "keyless retry refuses provider execution",
    (await owner.request(`/api/calls/${intent.callId}/retry`, "POST", {}))
      .status === 503,
  );
  const jobs = await admin
    .from("call_jobs")
    .select("call_id")
    .eq("call_id", intent.callId);
  check("no AI workflow dispatched", !jobs.error && jobs.data?.length === 0);
  const mediaResponse = await reviewer.request(
    `/api/calls/${intent.callId}/media`,
  );
  const mediaBody = await mediaResponse.json();
  check(
    "unprocessed recording playback unavailable",
    mediaResponse.status === 403 &&
      mediaBody.error === "PLAYBACK_UNAVAILABLE" &&
      !mediaBody.url,
  );
  check(
    "owner deletion succeeds",
    (await owner.request(`/api/calls/${intent.callId}`, "DELETE")).status ===
      200,
  );
  check(
    "old call route denies deleted content",
    (await owner.request(`/api/calls/${intent.callId}`)).status === 404,
  );
  check(
    "source object removed from hosted Storage",
    Boolean(
      (await admin.storage.from("call-source").download(intent.path)).error,
    ),
  );
  const resurrection = await admin.rpc("save_call", {
    p_id: intent.callId,
    p_workspace: workspaces[0],
    p_expected: null,
    p_payload: call,
  });
  check(
    "hosted tombstone rejects late resurrection",
    !resurrection.error && resurrection.data === false,
  );
  const versions = await admin
    .from("analysis_versions")
    .select("call_id")
    .eq("call_id", intent.callId);
  check(
    "no analysis copies remain",
    !versions.error && versions.data?.length === 0,
  );
  // Retain test identities briefly for actual browser QA; no emails are sent.
  console.log(
    "Hosted keyless checks passed. Fictional test credentials remain only in ignored private storage for UI QA.",
  );
} catch (error) {
  if (error instanceof assert.AssertionError)
    console.error(`Verification assertion: ${error.message}`);
  console.error(
    "Hosted verification stopped. See safe check results; no provider requests were made.",
  );
  process.exitCode = 1;
} finally {
  await mkdir(".private/evidence", { recursive: true });
  await writeFile(
    ".private/evidence/hosted-keyless.json",
    JSON.stringify(
      {
        project: expectedRef,
        runId,
        at: new Date().toISOString(),
        results,
        retainedFictionalUserCount: users.length,
        retainedFictionalWorkspaceCount: workspaces.length,
        createdCallIds: calls,
        limitation:
          "Local Next app against hosted Supabase. No real AI, deployed workflow, backup deletion or real-call acceptance.",
      },
      null,
      2,
    ),
  );
}
