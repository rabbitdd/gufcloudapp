# GufCloud — shared music library (MVP)

A minimal web music app: Next.js (App Router) + Supabase (Auth, Postgres, private Storage) with signed URLs for playback. Authenticated users share one library; guests can listen read-only.

**Stack:** Next.js · TypeScript · Tailwind CSS · Supabase (Auth / Postgres / Storage)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | Current LTS (e.g. 20+) |
| **npm** | Comes with Node |
| **Docker Desktop** (or compatible engine) | Required **only** for **local** Supabase (`npm run infra:up`) |
| **Supabase account** | Required **only** if you use a **hosted** project instead of local |

---

## Install

```bash
git clone <your-repo-url>
cd gufcloud
npm install
```

Copy environment template:

```bash
cp .env.example .env.local
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase API URL (hosted `https://…supabase.co` or local `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase **anon** (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Used by server-side signed URL hardening and required by ingestion worker |
| `WORKER_POLL_INTERVAL_MS` | No | Poll interval for ingestion worker (default `3000`) |
| `CRON_SECRET` | Recommended on Vercel | Auth for `/api/worker/ingestion-tick` cron endpoint |
| `INGESTION_TICK_BATCH_SIZE` | No | Jobs processed per Vercel cron tick (default `5`) |

Fill `.env.local` using **one** of the flows below.

---

## Local development (recommended): Supabase CLI

Migrations use `auth.users`, `storage.buckets`, and RLS — **plain Postgres alone is not enough**. This repo uses the **Supabase CLI**, which starts Postgres + Auth + Storage + Studio in Docker.

### Start infrastructure

```bash
npm run infra:up
```

First run downloads Docker images (can take a few minutes).

### Point the app at local Supabase

```bash
npm run env:local
```

You should see **both** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon JWT used by the browser).

If you also want worker/server hardening keys, run:

```bash
npm run env:local:all
```

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<long JWT from env:local>
```

**If you only see `DB_URL` and a line like `Stopped services: [supabase_auth_… supabase_kong_…]`** — Auth/API containers are not running. The anon key is **not** available until they are. Fix:

```bash
npm run infra:down
npm run infra:up
```

Wait until the command finishes without listing stopped services, then run `npm run env:local` again. You can also run `npm run infra:status` (pretty output) and copy **Project URL** + **anon** / **publishable** key from the **Authentication keys** section.

### Apply database schema / migrations

Migrations run automatically on a fresh DB when you reset:

```bash
npm run db:reset
```

This reapplies `supabase/migrations/*.sql` in order and runs `supabase/seed.sql` (empty by default — safe to extend).

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run ingestion worker (recommended for metadata pipeline)

```bash
npm run worker:ingestion
```

This worker consumes `processing_jobs` and marks new tracks as `ready` after ingestion tasks complete.

### Vercel-only mode (no persistent worker process)

If you deploy only on Vercel, ingestion can run via cron ticks:

1. Keep `vercel.json` in repo (already added) with:
   - `path: /api/worker/ingestion-tick`
   - `schedule: * * * * *`
2. Set Vercel env vars:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (strong random string)
   - optional `INGESTION_TICK_BATCH_SIZE` (default `5`)
3. Vercel cron calls the endpoint every minute and processes pending jobs in small batches.

**Useful URLs (local):**

- **Studio (DB + Auth + Storage UI):** [http://127.0.0.1:54323](http://127.0.0.1:54323)
- **Inbucket (test emails):** [http://127.0.0.1:54324](http://127.0.0.1:54324) (if enabled in CLI)

### Stop infrastructure

```bash
npm run infra:down
```

### Reset local database only

```bash
npm run db:reset
```

### Check status (ports, keys)

```bash
npm run infra:status
```

### Makefile (optional)

```bash
make install
make infra-up
make db-reset
make dev
make stop
```

---

## Alternative: hosted Supabase (no local Docker)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API:** copy **Project URL** and **anon public** key into `.env.local`.
3. **Run migrations** in the SQL Editor, **in order** (same files as local):

   - `supabase/migrations/001_init_tracks.sql`
   - `supabase/migrations/002_add_track_cover.sql`
   - `supabase/migrations/003_allow_track_delete.sql`
   - `supabase/migrations/004_guest_read_access.sql`
   - `supabase/migrations/005_albums.sql`
   - `supabase/migrations/006_album_track_delete_policy.sql`
   - `supabase/migrations/007_roles_assets_jobs.sql`
   - `supabase/migrations/008_harden_storage_read_policy.sql`
   - `supabase/migrations/009_cover_thumbnail_paths.sql`
   - `supabase/migrations/010_album_update_policy.sql`

4. Confirm **Storage → Buckets:** `songs` exists and is **private** (not public).

No `npm run infra:*` needed for this path.

---

## Seed / test data

- **Local:** edit `supabase/seed.sql`, then `npm run db:reset`.
- **Hosted:** run SQL manually in the Dashboard if you add seed statements.

There is no default seed data — sign up via `/login` or create users in the Dashboard.

---

## What you must still do manually (Supabase)

Whether **local** or **hosted**:

- **Users:** sign up in the app (`/login`) or create users under **Authentication → Users**.
- **Email confirmation:** if enabled on the project, users must confirm before first sign-in. Local CLI often has confirmations off — check **Authentication → Providers → Email**.
- **Storage:** migrations create the `songs` bucket and policies; verify the bucket stays **private** for production-like behavior.

---

## Scripts reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run infra:up` | Start local Supabase (Docker) |
| `npm run infra:down` | Stop local Supabase |
| `npm run infra:status` | Show local URLs and status |
| `npm run env:local` | Print env-style output (URL + keys) for `.env.local` |
| `npm run env:local:all` | Print URL + anon + service-role keys in env format |
| `npm run env:local:pretty` | Human-readable `supabase status` (URLs + keys) |
| `npm run db:reset` | Drop local DB data, re-run migrations + seed |
| `npm run worker:ingestion` | Run ingestion worker loop |
| `npm run worker:ingestion:once` | Run one worker iteration (debugging) |

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `env:local` prints only `DB_URL` / no anon key | **Auth/Kong/etc. are stopped** (see `Stopped services:`). Run `npm run infra:down` then `npm run infra:up`, then `npm run env:local` again. Use `npm run env:local:pretty` to see keys when healthy. |
| `Missing NEXT_PUBLIC_SUPABASE_URL…` | Ensure `.env.local` exists and both vars are set; restart `npm run dev`. |
| `infra:up` fails | Start Docker Desktop; wait for it to be ready; retry. |
| Port already in use | `npm run infra:status` — stop other Supabase stacks or change ports in `supabase/config.toml` (then `infra:down` / `infra:up`). |
| Migrations error on hosted | Run files **in order**; do not skip `001`. |
| Images / covers broken locally | Use `http://127.0.0.1:54321` in `.env.local`; `next.config.ts` allows local storage URLs. |
| Build without `.env.local` | `npm run build` can succeed with dummy values; **runtime** still needs real URL + anon key. |
| Tracks stay `pending` on Vercel | Ensure `vercel.json` cron is deployed, and set `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel env. |

---

## Project layout (high level)

- `app/` — routes, API handlers (`/api/tracks`, `/api/stream`, `/api/albums`, …)
- `components/` — UI (library, player, modals, login)
- `lib/modules/` — app domain modules (`authz`, `catalog`, `playback`)
- `lib/supabase/` — browser/server clients, middleware env
- `supabase/migrations/` — SQL schema and policies (source of truth)
- `supabase/seed.sql` — optional local seed
- `supabase/config.toml` — local Supabase CLI settings
- `scripts/ingestion-worker.mjs` — minimal async ingestion worker
- `docker-compose.yml` — **not** the app stack; local DB is via **Supabase CLI** (see file comment)
- `proxy.ts` — Next.js proxy for Supabase session cookies

---

## Feature snapshot

- Email/password sign-in and sign-up; guest listen-only mode (`/guest`)
- Shared track library, uploads with optional cover, albums, signed URL playback
- Role-aware write operations (`viewer` / `uploader` / `admin`) via `profiles`
- Ingestion primitives: `track_assets`, `processing_jobs`, and worker loop
- Mobile-friendly dark UI

See earlier sections for Supabase policies and tables created by migrations.
