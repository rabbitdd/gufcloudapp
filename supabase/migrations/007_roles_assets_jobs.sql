create extension if not exists "pgcrypto";

-- Simple role model for app-level authorization.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('viewer', 'uploader', 'admin');
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'uploader',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.profiles (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Track processing readiness for background ingestion.
alter table public.tracks
add column if not exists processing_status text not null default 'pending'
check (processing_status in ('pending', 'ready', 'failed'));

update public.tracks
set processing_status = 'ready'
where processing_status is distinct from 'ready';

create table if not exists public.track_assets (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  asset_kind text not null default 'original',
  storage_path text not null unique,
  mime_type text,
  duration_sec integer,
  bitrate_kbps integer,
  is_playable boolean not null default true,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists track_assets_track_idx on public.track_assets (track_id);
create index if not exists track_assets_playable_idx on public.track_assets (track_id, is_playable, is_primary);

alter table public.track_assets enable row level security;

drop policy if exists "Authenticated users can read track assets" on public.track_assets;
create policy "Authenticated users can read track assets"
on public.track_assets
for select
to authenticated
using (true);

drop policy if exists "Anon users can read track assets" on public.track_assets;
create policy "Anon users can read track assets"
on public.track_assets
for select
to anon
using (true);

drop policy if exists "Authenticated users can insert own track assets" on public.track_assets;
create policy "Authenticated users can insert own track assets"
on public.track_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tracks
    where tracks.id = track_assets.track_id
      and tracks.uploaded_by = auth.uid()
  )
);

drop policy if exists "Authenticated users can update own track assets" on public.track_assets;
create policy "Authenticated users can update own track assets"
on public.track_assets
for update
to authenticated
using (
  exists (
    select 1
    from public.tracks
    where tracks.id = track_assets.track_id
      and tracks.uploaded_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tracks
    where tracks.id = track_assets.track_id
      and tracks.uploaded_by = auth.uid()
  )
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('extract_metadata')),
  track_id uuid not null references public.tracks(id) on delete cascade,
  asset_id uuid references public.track_assets(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists processing_jobs_status_schedule_idx
  on public.processing_jobs (status, scheduled_at, created_at);

alter table public.processing_jobs enable row level security;

drop policy if exists "Authenticated users can insert own processing jobs" on public.processing_jobs;
create policy "Authenticated users can insert own processing jobs"
on public.processing_jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tracks
    where tracks.id = processing_jobs.track_id
      and tracks.uploaded_by = auth.uid()
  )
);

drop policy if exists "Authenticated users can read own processing jobs" on public.processing_jobs;
create policy "Authenticated users can read own processing jobs"
on public.processing_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.tracks
    where tracks.id = processing_jobs.track_id
      and tracks.uploaded_by = auth.uid()
  )
);

-- Backfill canonical original assets for existing tracks.
insert into public.track_assets (track_id, asset_kind, storage_path, is_playable, is_primary)
select
  t.id,
  'original',
  t.storage_path,
  true,
  true
from public.tracks t
where not exists (
  select 1
  from public.track_assets ta
  where ta.track_id = t.id
    and ta.storage_path = t.storage_path
);

create or replace function public.enqueue_track_processing_job()
returns trigger
language plpgsql
security definer
as $$
declare
  original_asset_id uuid;
begin
  insert into public.track_assets (
    track_id,
    asset_kind,
    storage_path,
    is_playable,
    is_primary
  )
  values (
    new.id,
    'original',
    new.storage_path,
    true,
    true
  )
  on conflict (storage_path) do update
  set track_id = excluded.track_id
  returning id into original_asset_id;

  insert into public.processing_jobs (
    job_type,
    track_id,
    asset_id
  )
  values (
    'extract_metadata',
    new.id,
    original_asset_id
  );

  return new;
end;
$$;

drop trigger if exists on_track_created_enqueue_processing on public.tracks;
create trigger on_track_created_enqueue_processing
after insert on public.tracks
for each row
execute procedure public.enqueue_track_processing_job();

-- Role-aware content writes.
drop policy if exists "Authenticated users can insert own tracks" on public.tracks;
create policy "Authenticated users can insert own tracks"
on public.tracks
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);

drop policy if exists "Authenticated users can delete own tracks" on public.tracks;
create policy "Authenticated users can delete own tracks"
on public.tracks
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);

drop policy if exists "Authenticated users can insert own albums" on public.albums;
create policy "Authenticated users can insert own albums"
on public.albums
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);

drop policy if exists "Authenticated users can insert tracks to own albums" on public.album_tracks;
create policy "Authenticated users can insert tracks to own albums"
on public.album_tracks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.albums
    join public.profiles on profiles.user_id = auth.uid()
    where albums.id = album_tracks.album_id
      and albums.owner_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
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
    join public.profiles on profiles.user_id = auth.uid()
    where albums.id = album_tracks.album_id
      and albums.owner_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);

drop policy if exists "Authenticated users can upload song objects" on storage.objects;
create policy "Authenticated users can upload song objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] in ('tracks', 'covers', 'cover-thumbs', 'albums')
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);
