alter table public.tracks
add column if not exists cover_thumb_storage_path text;

alter table public.albums
add column if not exists cover_thumb_storage_path text;

-- Extend storage read policies to include thumbnail objects once columns exist.
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
      from public.tracks
      where tracks.cover_thumb_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_thumb_storage_path = storage.objects.name
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
      from public.tracks
      where tracks.cover_thumb_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.albums
      where albums.cover_thumb_storage_path = storage.objects.name
    )
  )
);
