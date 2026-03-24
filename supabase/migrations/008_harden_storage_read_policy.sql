-- Tighten object read access to catalog-referenced media only.
-- This keeps guest mode working while narrowing exposure compared to bucket-wide read.

drop policy if exists "Authenticated users can read song objects" on storage.objects;
create policy "Authenticated users can read song objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'songs'
  and (
    exists (
      select 1
      from public.track_assets
      where track_assets.storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.tracks
      where tracks.cover_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_storage_path = storage.objects.name
    )
  )
);

drop policy if exists "Anon users can read song objects" on storage.objects;
create policy "Anon users can read song objects"
on storage.objects
for select
to anon
using (
  bucket_id = 'songs'
  and (
    exists (
      select 1
      from public.track_assets
      where track_assets.storage_path = storage.objects.name
        and track_assets.is_playable = true
    )
    or exists (
      select 1
      from public.tracks
      where tracks.cover_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_storage_path = storage.objects.name
    )
  )
);
