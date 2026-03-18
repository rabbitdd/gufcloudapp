create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_storage_path text,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.album_tracks (
  album_id uuid not null references public.albums(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, track_id)
);

create index if not exists albums_created_at_idx on public.albums (created_at desc);
create index if not exists album_tracks_album_id_idx on public.album_tracks (album_id);
create index if not exists album_tracks_track_id_idx on public.album_tracks (track_id);

alter table public.albums enable row level security;
alter table public.album_tracks enable row level security;

drop policy if exists "Authenticated users can read all albums" on public.albums;
create policy "Authenticated users can read all albums"
on public.albums
for select
to authenticated
using (true);

drop policy if exists "Anon users can read all albums" on public.albums;
create policy "Anon users can read all albums"
on public.albums
for select
to anon
using (true);

drop policy if exists "Authenticated users can insert own albums" on public.albums;
create policy "Authenticated users can insert own albums"
on public.albums
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Authenticated users can read album tracks" on public.album_tracks;
create policy "Authenticated users can read album tracks"
on public.album_tracks
for select
to authenticated
using (true);

drop policy if exists "Anon users can read album tracks" on public.album_tracks;
create policy "Anon users can read album tracks"
on public.album_tracks
for select
to anon
using (true);

drop policy if exists "Authenticated users can insert tracks to own albums" on public.album_tracks;
create policy "Authenticated users can insert tracks to own albums"
on public.album_tracks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.albums
    where albums.id = album_tracks.album_id
      and albums.owner_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can delete tracks from own albums" on public.album_tracks;
create policy "Authenticated users can delete tracks from own albums"
on public.album_tracks
for delete
to authenticated
using (
  exists (
    select 1
    from public.albums
    where albums.id = album_tracks.album_id
      and albums.owner_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can upload song objects" on storage.objects;
create policy "Authenticated users can upload song objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] in ('tracks', 'covers', 'albums')
);
