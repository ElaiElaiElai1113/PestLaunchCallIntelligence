import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = "00000000-0000-0000-0000-000000000001",
  reviewer = "00000000-0000-0000-0000-000000000002",
  outsider = "00000000-0000-0000-0000-000000000003",
  workspace = "10000000-0000-0000-0000-000000000001",
  callId = "20000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;create function storage.filename(text) returns text language sql immutable as $$select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)]$$;grant usage on schema storage to authenticated;grant insert,select on storage.objects to authenticated;`,
  );
  for (const filename of (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${filename}`, "utf8"));
  await db.query("insert into auth.users values ($1),($2),($3)", [
    owner,
    reviewer,
    outsider,
  ]);
  await db.query("insert into public.workspaces(id,name) values($1,$2)", [
    workspace,
    "Fictional workspace",
  ]);
  await db.query("insert into workspace_members values($1,$2,$3),($1,$4,$5)", [
    workspace,
    owner,
    "owner",
    reviewer,
    "reviewer",
  ]);
  await db.query(
    "insert into calls(id,workspace_id,version,payload) values($1,$2,1,$3)",
    [
      callId,
      workspace,
      JSON.stringify({
        id: callId,
        workspaceId: workspace,
        version: 1,
        analysis: null,
        mode: "live",
        sourcePath: `${workspace}/${callId}.wav`,
        status: "queued",
        errorCode: "UPLOAD_PENDING",
      }),
    ],
  );
});
afterAll(async () => {
  await db.close();
});
async function asUser<T>(id: string, work: () => Promise<T>) {
  await db.exec("begin;set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  try {
    return await work();
  } finally {
    await db.exec("rollback");
  }
}
it("members read calls while other workspaces see none", async () => {
  for (const id of [owner, reviewer])
    expect(
      await asUser(
        id,
        async () => (await db.query("select * from calls")).rows.length,
      ),
    ).toBe(1);
  expect(
    await asUser(
      outsider,
      async () => (await db.query("select * from calls")).rows.length,
    ),
  ).toBe(0);
});
it("reviewers cannot upload source audio", async () => {
  await expect(
    asUser(reviewer, () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('call-source',$1)",
        [`${workspace}/${callId}.wav`],
      ),
    ),
  ).rejects.toThrow();
  await expect(
    asUser(owner, () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('call-source',$1)",
        [`${workspace}/${callId}.wav`],
      ),
    ),
  ).resolves.toBeDefined();
});
it("source uploads reject forged call, workspace and nested paths", async () => {
  for (const path of [
    `${workspace}/20000000-0000-0000-0000-000000000099.wav`,
    `10000000-0000-0000-0000-000000000099/${callId}.wav`,
    `${workspace}/nested/${callId}.wav`,
  ])
    await expect(
      asUser(owner, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('call-source',$1)",
          [path],
        ),
      ),
    ).rejects.toThrow();
});
it("source uploads reject alternative filenames for an existing call", async () => {
  for (const suffix of ["mp3", "extra.wav"])
    await expect(
      asUser(owner, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('call-source',$1)",
          [`${workspace}/${callId}.${suffix}`],
        ),
      ),
    ).rejects.toThrow();
});
it("source upload closes after finalization", async () => {
  await db.query(
    "update calls set payload=jsonb_set(payload,'{errorCode}','\"AI_NOT_CONFIGURED\"') where id=$1",
    [callId],
  );
  try {
    await expect(
      asUser(owner, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('call-source',$1)",
          [`${workspace}/${callId}.wav`],
        ),
      ),
    ).rejects.toThrow();
  } finally {
    await db.query(
      "update calls set payload=jsonb_set(payload,'{errorCode}','\"UPLOAD_PENDING\"') where id=$1",
      [callId],
    );
  }
});
it("source audio has no read policy even for members", async () => {
  await db.query(
    "insert into storage.objects(bucket_id,name) values('call-source',$1)",
    [`${workspace}/synthetic.wav`],
  );
  expect(
    await asUser(
      owner,
      async () => (await db.query("select * from storage.objects")).rows.length,
    ),
  ).toBe(0);
});
it("clients cannot edit memberships or call payloads directly", async () => {
  await expect(
    asUser(owner, () => db.exec("update workspace_members set role='owner'")),
  ).rejects.toThrow();
  await expect(
    asUser(reviewer, () => db.exec("update calls set version=5")),
  ).rejects.toThrow();
});
it("the save function rejects stale writes and deletion resurrection", async () => {
  const payload = {
    id: callId,
    workspaceId: workspace,
    version: 2,
    analysis: null,
  };
  expect(
    (
      await db.query<{ saved: boolean }>(
        "select save_call($1,$2,1,$3) as saved",
        [callId, workspace, payload],
      )
    ).rows[0].saved,
  ).toBe(true);
  expect(
    (
      await db.query<{ saved: boolean }>(
        "select save_call($1,$2,1,$3) as saved",
        [callId, workspace, payload],
      )
    ).rows[0].saved,
  ).toBe(false);
  await db.query("select delete_call($1,$2)", [callId, workspace]);
  expect(
    (
      await db.query<{ saved: boolean }>(
        "select save_call($1,$2,null,$3) as saved",
        [callId, workspace, payload],
      )
    ).rows[0].saved,
  ).toBe(false);
  await expect(
    asUser(owner, () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('call-source',$1)",
        [`${workspace}/${callId}.wav`],
      ),
    ),
  ).rejects.toThrow();
});
it("anonymous data reads and client RPC writes are denied", async () => {
  await db.exec("begin;set local role anon");
  try {
    await expect(db.query("select * from calls")).rejects.toThrow();
  } finally {
    await db.exec("rollback");
  }
  await expect(
    asUser(reviewer, () =>
      db.query("select save_call($1,$2,null,$3)", [callId, workspace, {}]),
    ),
  ).rejects.toThrow();
});
