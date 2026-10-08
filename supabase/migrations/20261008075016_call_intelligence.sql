-- Private, invite-only workspace. Authenticated clients can read sanitized
-- content; all writes go through the authenticated server boundary.
create table public.workspaces(id uuid primary key default gen_random_uuid(), name text not null);
create table public.workspace_members(workspace_id uuid references public.workspaces on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','reviewer')), primary key(workspace_id,user_id));
create index workspace_members_user on public.workspace_members(user_id,workspace_id);
create table public.calls(id uuid primary key, workspace_id uuid not null references public.workspaces on delete cascade, version integer not null check(version>0), uploaded_at timestamptz not null default now(), payload jsonb not null);
create index calls_workspace_uploaded on public.calls(workspace_id,uploaded_at desc);
create table public.analysis_versions(call_id uuid references public.calls on delete cascade,workspace_id uuid not null references public.workspaces on delete cascade,version integer not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(call_id,version));
create index analysis_versions_workspace on public.analysis_versions(workspace_id);
create table public.call_jobs(call_id uuid primary key references public.calls on delete cascade,workspace_id uuid not null references public.workspaces on delete cascade,run_id text,created_at timestamptz not null default now());
create table public.deletion_tombstones(call_id uuid primary key,workspace_id uuid not null references public.workspaces on delete cascade,created_at timestamptz not null default now());
create table public.deletion_receipts(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces on delete cascade,deleted_count integer not null,created_at timestamptz not null default now());
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.calls enable row level security;
alter table public.analysis_versions enable row level security;
alter table public.call_jobs enable row level security;
alter table public.deletion_tombstones enable row level security;
alter table public.deletion_receipts enable row level security;
create policy membership_self on public.workspace_members for select to authenticated using(user_id=(select auth.uid()));
create policy workspace_read on public.workspaces for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=(select auth.uid())));
create policy calls_read on public.calls for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=calls.workspace_id and m.user_id=(select auth.uid())));
create policy analyses_read on public.analysis_versions for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=analysis_versions.workspace_id and m.user_id=(select auth.uid())));
create policy receipts_owner on public.deletion_receipts for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=deletion_receipts.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));
create policy tombstone_owner_read on public.deletion_tombstones for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=deletion_tombstones.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));
revoke all on public.workspaces,public.workspace_members,public.calls,public.analysis_versions,public.call_jobs,public.deletion_tombstones,public.deletion_receipts from anon,authenticated;
grant select on public.workspaces,public.workspace_members,public.calls,public.analysis_versions,public.deletion_receipts,public.deletion_tombstones to authenticated;
grant all on public.workspaces,public.workspace_members,public.calls,public.analysis_versions,public.call_jobs,public.deletion_tombstones,public.deletion_receipts to service_role;

create function public.save_call(p_id uuid,p_workspace uuid,p_expected integer,p_payload jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare saved integer;
begin
  -- Serialize saves/deletes for a call. Tombstones outlive the content.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  if exists(select 1 from public.deletion_tombstones where call_id=p_id) then return false; end if;
  if p_payload->>'workspaceId'<>p_workspace::text or p_payload->>'id'<>p_id::text then return false; end if;
  if p_expected is null then
    insert into public.calls(id,workspace_id,version,payload) values(p_id,p_workspace,(p_payload->>'version')::integer,p_payload) on conflict do nothing;
  else
    update public.calls set version=(p_payload->>'version')::integer,payload=p_payload where id=p_id and workspace_id=p_workspace and version=p_expected;
  end if;
  get diagnostics saved=row_count;
  if saved=0 then return false; end if;
  if p_payload->'analysis'<>'null'::jsonb then insert into public.analysis_versions(call_id,workspace_id,version,payload) values(p_id,p_workspace,(p_payload->>'version')::integer,p_payload) on conflict do nothing; end if;
  return true;
end $$;
create function public.delete_call(p_id uuid,p_workspace uuid) returns void language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  insert into public.deletion_tombstones(call_id,workspace_id) values(p_id,p_workspace) on conflict do nothing;
  delete from public.calls where id=p_id and workspace_id=p_workspace;
  get diagnostics removed=row_count;
  if removed>0 then insert into public.deletion_receipts(workspace_id,deleted_count) values(p_workspace,removed); end if;
end $$;
revoke all on function public.save_call(uuid,uuid,integer,jsonb),public.delete_call(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_call(uuid,uuid,integer,jsonb),public.delete_call(uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('call-source','call-source',false,25000000,array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a']);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('call-sanitized','call-sanitized',false,25000000,array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a']);
-- Only owners may upload source files. There is no client SELECT/UPDATE/DELETE
-- source policy. Sanitized playback is mediated by the authorized server.
create policy source_owner_upload on storage.objects for insert to authenticated with check(bucket_id='call-source' and exists(select 1 from public.workspace_members m join public.calls c on c.workspace_id=m.workspace_id where m.workspace_id::text=(storage.foldername(name))[1] and c.id::text=split_part((storage.foldername(name))[2],'.',1) and m.user_id=(select auth.uid()) and m.role='owner' and not exists(select 1 from public.deletion_tombstones t where t.call_id=c.id)));
