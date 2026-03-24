drop policy if exists "Authenticated users can update own albums" on public.albums;
create policy "Authenticated users can update own albums"
on public.albums
for update
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role in ('uploader', 'admin')
  )
);
