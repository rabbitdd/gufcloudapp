drop policy if exists "Authenticated users can delete own tracks" on public.tracks;
create policy "Authenticated users can delete own tracks"
on public.tracks
for delete
to authenticated
using (uploaded_by = auth.uid());

drop policy if exists "Authenticated users can delete own song objects" on storage.objects;
create policy "Authenticated users can delete own song objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'songs'
  and owner = auth.uid()
);
