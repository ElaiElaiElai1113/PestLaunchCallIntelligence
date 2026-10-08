-- storage.foldername excludes the filename. Keep the existing private owner,
-- workspace, live-call and deletion guards while reading the documented helper.
alter policy source_owner_upload on storage.objects
with check (
  bucket_id = 'call-source'
  and array_length(storage.foldername(name), 1) = 1
  and exists (
    select 1
    from public.workspace_members m
    join public.calls c on c.workspace_id = m.workspace_id
    where m.workspace_id::text = (storage.foldername(name))[1]
      and c.id::text = split_part(storage.filename(name), '.', 1)
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and not exists (
        select 1 from public.deletion_tombstones t where t.call_id = c.id
      )
  )
);
