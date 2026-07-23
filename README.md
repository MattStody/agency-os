# Agency OS

Next.js 14 (App Router) + Supabase Auth (Google OAuth) + Tailwind/shadcn-ui.
Signs users in with Google, requests Drive scopes (`drive.file`,
`drive.readonly`), stores the resulting Google access/refresh tokens in
Supabase, and lists `projects` from Postgres with a detail page that pulls
in linked Drive files.

## Stack

- Next.js 14 App Router, TypeScript
- Supabase Auth + Postgres (`@supabase/ssr`)
- Tailwind CSS + shadcn/ui-style components
- All Google API calls live in `lib/google/`

## Project structure

```
app/
  login/                 Login page + server actions (Google sign-in)
  api/auth/callback/     OAuth callback: exchanges code, stores Google tokens
  projects/              /projects list
  projects/[id]/         /projects/[id] detail, shows linked Drive files
  actions.ts             Shared server actions (sign out)
lib/
  supabase/              Server, browser, and middleware Supabase clients
  google/                All Google API calls (tokens.ts, drive.ts)
components/ui/           shadcn/ui-style primitives
supabase/migrations/     SQL schema (projects, google_tokens, RLS)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Run the migration in `supabase/migrations/0001_init.sql` against your
project (via the SQL editor, or the Supabase CLI: `supabase db push`).
It creates:

- `projects` — `owner_id` (FK to `auth.users`), `name`, `description`,
  `drive_folder_id`, `status`, timestamps. RLS restricts rows to their owner.
- `google_tokens` — one row per user holding `access_token`,
  `refresh_token`, `scope`, `expires_at`. RLS allows a user to `select`
  their own row; only the service-role client (server-only) can write to it.

### 3. Create a Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create an OAuth 2.0 Client ID (Web application).
2. Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Under **OAuth consent screen > Scopes**, add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`

### 4. Configure the Google provider in Supabase

In Supabase Dashboard → Authentication → Providers → Google: paste the
Client ID/Secret from step 3 and enable the provider.

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
  Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — same page (server-only, never expose to
  the client).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from step 3. Used
  server-side in `lib/google/tokens.ts` to refresh expired access tokens
  directly against Google (Supabase does not refresh the *provider*
  token for you).

### 6. Run

```bash
npm run dev
```

Visit `/login`, sign in with Google, and grant Drive access. You'll be
redirected to `/projects`.

## How Google tokens are stored and refreshed

1. `signInWithGoogle` (`app/login/actions.ts`) starts the OAuth flow via
   `supabase.auth.signInWithOAuth`, requesting the Drive scopes with
   `access_type=offline` and `prompt=consent` so Google issues a
   `refresh_token`.
2. `app/api/auth/callback/route.ts` exchanges the code for a Supabase
   session, reads `session.provider_token` /
   `session.provider_refresh_token`, and upserts them into
   `google_tokens` using the service-role client (bypasses RLS since this
   write happens server-side, outside the user's request context).
3. `lib/google/tokens.ts#getValidAccessToken` reads that row, and if the
   access token is expired, refreshes it directly against Google's token
   endpoint using the stored `refresh_token`, then persists the new
   access token/expiry.
4. `lib/google/drive.ts` is the only place that calls the Drive API,
   using `getValidAccessToken` under the hood.

## Notes / next steps

- Project creation UI isn't included — seed rows via
  `supabase/migrations/0002_seed_example.sql` or the Supabase dashboard
  to see the `/projects` list populated.
- A project surfaces Drive files by setting its `drive_folder_id` to a
  Google Drive folder ID the signed-in user can access.
