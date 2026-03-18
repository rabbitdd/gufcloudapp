# GufCloud Music MVP

Minimal web-native music library MVP built with:
- Next.js (App Router) + TypeScript
- Supabase Auth + Postgres + Storage
- Tailwind CSS

## What is implemented

- Auth page (`/login`) with Supabase email/password sign-in and sign-up
- Guest page (`/guest`) for listen-only access without auth
- Protected library page (`/library`) for authenticated users only
- Shared tracks library for all authenticated users
- Upload flow:
  1. upload audio file to private `songs` bucket (`tracks/<uuid>-<safe-filename>`)
  2. optional cover upload to private `songs` bucket (`covers/<uuid>-<safe-filename>`)
  3. insert metadata into `tracks` table
  4. refresh list
- Track list with optional search (client-side)
- Delete track button (trash icon) for uploaded tracks
- Mobile-first dark UI inspired by modern music apps
- Playback flow using signed URLs from server route:
  - `GET /api/stream/:id`

## Project structure

- `app/login/page.tsx`
- `app/library/page.tsx`
- `app/guest/page.tsx`
- `app/api/tracks/route.ts`
- `app/api/tracks/[id]/route.ts`
- `app/api/stream/[id]/route.ts`
- `components/login-form.tsx`
- `components/upload-song-form.tsx`
- `components/track-list.tsx`
- `components/player-bar.tsx`
- `components/library-view.tsx`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `proxy.ts`
- `types/track.ts`
- `supabase/migrations/001_init_tracks.sql`
- `supabase/migrations/002_add_track_cover.sql`
- `supabase/migrations/003_allow_track_delete.sql`
- `supabase/migrations/004_guest_read_access.sql`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` with Supabase project values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

4. Run development server:

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Supabase setup

### 1) Apply SQL migration

Open Supabase SQL editor and run:

- `supabase/migrations/001_init_tracks.sql`
- `supabase/migrations/002_add_track_cover.sql` (safe to run after 001)
- `supabase/migrations/003_allow_track_delete.sql` (safe to run after 002)
- `supabase/migrations/004_guest_read_access.sql` (safe to run after 003)

This creates:
- private storage bucket `songs`
- `tracks` table
- optional cover path in `tracks`
- indexes
- RLS
- DB and storage policies
- uploader-only delete policies for tracks and files
- guest read policies for tracks and storage objects

### 2) Confirm bucket privacy

In Supabase Dashboard -> Storage -> Buckets -> `songs`, make sure **Public bucket is OFF**.

### 3) Create users

Options:
- use app UI at `/login` in **Sign up** mode
- or create users in Supabase Dashboard -> Authentication -> Users

If email confirmation is enabled, users must confirm email before first sign-in.

## How to test upload and playback

1. Sign up (or sign in) at `/login`.
2. Open `/library`.
3. Upload an audio file (`.mp3`, `.m4a`, etc), optionally include a cover image.
4. Confirm it appears in the list.
5. Click **Play** on a track.
6. Verify audio starts and current player bar updates.
7. Click trash icon on your uploaded track and confirm deletion.
8. Sign out and log in with second user:
   - verify the same shared library is visible
   - verify playback works for previously uploaded tracks
9. Open `/guest` and verify you can listen but cannot upload/delete.

## Notes

- Storage is private; playback uses signed URLs only.
- Guest mode is read/listen only (no upload/delete actions).
- No playlists, likes, favorites, recommendations, or admin panel in this MVP.
- No service role key is required for current implementation.
