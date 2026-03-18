alter table public.tracks
add column if not exists cover_storage_path text;

drop policy if exists "Authenticated users can upload song objects" on storage.objects;
create policy "Authenticated users can upload song objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] in ('tracks', 'covers')
);
