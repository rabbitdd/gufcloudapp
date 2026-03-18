-- Enable UUID generation for track IDs.
create extension if not exists "pgcrypto";

-- Create a private bucket for uploaded music files.
insert into storage.buckets (id, name, public)
values ('songs', 'songs', false)
on conflict (id) do update set public = excluded.public;

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  album text,
  duration_sec integer,
  storage_path text not null unique,
  cover_storage_path text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tracks_created_at_idx on public.tracks (created_at desc);
create index if not exists tracks_title_idx on public.tracks (title);

alter table public.tracks enable row level security;

drop policy if exists "Authenticated users can read all tracks" on public.tracks;
create policy "Authenticated users can read all tracks"
on public.tracks
for select
to authenticated
using (true);

drop policy if exists "Anon users can read all tracks" on public.tracks;
create policy "Anon users can read all tracks"
on public.tracks
for select
to anon
using (true);

drop policy if exists "Authenticated users can insert own tracks" on public.tracks;
create policy "Authenticated users can insert own tracks"
on public.tracks
for insert
to authenticated
with check (uploaded_by = auth.uid());

-- Storage policies for private bucket usage with signed URLs.
drop policy if exists "Authenticated users can read song objects" on storage.objects;
create policy "Authenticated users can read song objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'songs');

drop policy if exists "Anon users can read song objects" on storage.objects;
create policy "Anon users can read song objects"
on storage.objects
for select
to anon
using (bucket_id = 'songs');

drop policy if exists "Authenticated users can upload song objects" on storage.objects;
create policy "Authenticated users can upload song objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] in ('tracks', 'covers')
);
