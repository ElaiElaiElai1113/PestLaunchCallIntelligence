-- Admission is limited to the exact path registered for this pending upload.
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
      and c.payload->>'sourcePath' = name
      and c.payload->>'mode' = 'live'
      and c.payload->>'status' = 'queued'
      and c.payload->>'errorCode' = 'UPLOAD_PENDING'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and not exists (
        select 1 from public.deletion_tombstones t where t.call_id = c.id
      )
  )
);
