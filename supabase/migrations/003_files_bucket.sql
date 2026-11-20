-- Imported PDFs and images for notebooks (private, per-user folders)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('milonote-files', 'milonote-files', false, 104857600, array['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "milonote files own" on storage.objects;
create policy "milonote files own" on storage.objects for all to authenticated
  using (bucket_id = 'milonote-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'milonote-files' and (storage.foldername(name))[1] = auth.uid()::text);
