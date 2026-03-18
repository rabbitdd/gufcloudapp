drop policy if exists "Anon users can read all tracks" on public.tracks;
create policy "Anon users can read all tracks"
on public.tracks
for select
to anon
using (true);

drop policy if exists "Anon users can read song objects" on storage.objects;
create policy "Anon users can read song objects"
on storage.objects
for select
to anon
using (bucket_id = 'songs');
