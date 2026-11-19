# Boldly OS

Boldly Media's internal operating system: one login-gated shell (auth, roles,
client switcher, activity log) with each tool plugged in as a **module**.
Client-facing portal comes later on the same foundation.

**Stack:** Next.js 14 (App Router, TypeScript) · Postgres + Drizzle ORM · Supabase Auth (Google) ·
Tailwind / shadcn-style UI · Vitest + PGlite.

## Quick start (local, demo data)

```bash
npm install
cp .env.example .env.local          # then set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d                # local Postgres on :5432 (or point DATABASE_URL elsewhere)
npm run db:reset                    # migrate + seed 3 demo clients
npm run dev                         # http://localhost:3000
```

With `DEMO_LOGIN=true` the sign-in page lists the demo accounts:

| Demo user | Role | Sees |
|---|---|---|
| Alex Morgan | Admin | Everything; creates clients, manages team |
| Jordan Lee | Team member | All clients; edits details, contacts, accounts |
| Priya Shah | Client user (phase 2) | Harbourline Dental only, read-only |

Demo sign-in is always disabled on Vercel production (`VERCEL_ENV=production`).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: permissions, client-scoping (real Postgres via PGlite), registry |
| `npm run check` | typecheck + lint + tests (what CI runs) |
| `npm run db:migrate` | apply `db/migrations/*.sql` |
| `npm run db:seed` | insert demo data (idempotent) |
| `npm run db:reset` | drop + migrate + seed (**local databases only**) |
| `npm run new:module -- <id> --name "Name" [--scope client\|global]` | scaffold a module — see [docs/MODULES.md](docs/MODULES.md) |

## Production setup (Supabase + Vercel)

1. **Database.** Create a Supabase project. Set `DATABASE_URL` to the *transaction pooler* URI and run
   `npm run db:migrate` (do **not** run `db:seed` in production unless you want the demo clients).
2. **Google sign-in.** Google Cloud → OAuth client (Web). Redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`. Add it as the Google provider in Supabase Auth.
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
3. **Access.** `ALLOWED_EMAIL_DOMAINS=boldlymedia.com` (anyone on it becomes a team member on first
   sign-in) and `BOOTSTRAP_ADMIN_EMAILS=<your email>` (becomes admin on first sign-in).
4. **Vercel.** Add the same env vars. Leave `DEMO_LOGIN` unset in production.

All secrets live in env vars; nothing is committed. `.env*.local` is git-ignored.

## How it fits together

```
app/
  login/                    sign-in (Google + demo)
  api/auth/callback/        OAuth callback → provision user, store Google tokens
  (shell)/layout.tsx        sidebar, client switcher, nav built from the module registry
  (shell)/page.tsx          home: clients + recent activity
  (shell)/c/[client]/       client workspace (overview, settings, client-scoped modules)
  (shell)/tools/…           internal tools (global modules)
  (shell)/admin/…           clients, team, activity
modules/
  registry.ts               every module the shell knows about
  types.ts                  ModuleManifest
  core/                     manifests, service (business logic), actions, validation
  approvals/ reporting/ portal/ tasks/ invoicing/   planned (nav stubs)
lib/
  db/                       schema, connection, withAccess (scoping), migration runner
  permissions/              roles → permissions, Access, assert helpers (pure)
  auth/                     session, demo sign-in, provisioning
  activity/                 logActivity / listActivity
db/migrations/              SQL source of truth (tables, RLS policies, grants)
db/seed/                    demo data
tests/                      Vitest
```

### Client isolation (two layers)

1. **App layer** — every service function checks the caller's permissions and client scope
   (`assertCan`, `assertClientAccess`) before touching data.
2. **Database layer** — every user-facing query runs inside `withAccess()`, which switches the
   transaction to the `boldly_app` role and sets `app.user_id`, `app.role`, `app.all_clients`,
   `app.client_ids`. Row-level security on every client-owned table filters by those settings, so a
   query that forgets its `WHERE client_id = …` still returns nothing from other clients.
   `google_tokens` isn't granted to `boldly_app` at all.

Tests in `tests/scoping.db.test.ts` run raw unfiltered SQL as each role against real Postgres to prove it.

Pages resolve clients with `requireClient(slug)`, which 404s for clients outside your scope
(no "exists but forbidden" leak).

### Roles

| Permission | Admin | Team | Client user |
|---|:-:|:-:|:-:|
| View clients | ✓ | ✓ | own only |
| Edit client details / accounts / contacts | ✓ | ✓ | |
| Create clients, change status | ✓ | | |
| View activity log, team | ✓ | ✓ | |
| Manage team | ✓ | | |
| Internal tools | ✓ | ✓ | |
| Approvals: view / decide | ✓ | ✓ | ✓ (phase 2) |

Defined in `lib/permissions/index.ts`.

## Status

- **Phase 1 — Core shell:** done (this commit).
- **Phase 2 — Approvals:** next.
- **Phase 3 — Client portal:** after approvals.
- Reporting, Tasks, Invoicing: nav stubs only.

Branding uses the palette/fonts from the Boldly site (Newsreader + Inter; deep teal `#012F37`,
mint `#A9E0D6`, periwinkle `#7F9BF2`, lavender `#C7C0F6`, off-white `#F3F1EA`). The wordmark in
`components/brand/logo.tsx` is a placeholder until the official logo file is added.
