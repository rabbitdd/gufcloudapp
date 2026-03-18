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
