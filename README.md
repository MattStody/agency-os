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
  reports/               /reports list, /reports/[slug] branded report
  api/reporting/sync/    Scheduled Supermetrics sync (Vercel Cron)
lib/
  supabase/              Server, browser, and middleware Supabase clients
  google/                All Google API calls (tokens.ts, drive.ts)
  reporting/             Reporting module (see "Reporting" below)
components/ui/           shadcn/ui-style primitives
components/reporting/    Report template + KPI/channel/campaign tables
supabase/migrations/     SQL schema (projects, google_tokens, reporting, RLS)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Run the migrations in `supabase/migrations/` against your project (via the
SQL editor, or the Supabase CLI: `supabase db push`).

`0001_init.sql` creates:

- `projects` — `owner_id` (FK to `auth.users`), `name`, `description`,
  `drive_folder_id`, `status`, timestamps. RLS restricts rows to their owner.
- `google_tokens` — one row per user holding `access_token`,
  `refresh_token`, `scope`, `expires_at`. RLS allows a user to `select`
  their own row; only the service-role client (server-only) can write to it.

`0003_reporting.sql` creates the `reporting` schema (see **Reporting** below).
`0004_reporting_seed_demo.sql` is optional demo data.

After running `0003`, add `reporting` to **Project Settings → API → Exposed
schemas** in the Supabase dashboard — PostgREST won't serve the schema
otherwise, and `/reports` will report that it can't find the tables.

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


## Reporting

A reporting module that lives inside the app rather than in a separate SaaS:
Supermetrics is the connector layer, everything after it is ours.

### The data flow

```
Supermetrics ──► reporting.raw_supermetrics ──► reporting.ad_performance_daily ──► /reports
                 (raw, never rewritten)         (normalized, one row per
                                                 client/channel/campaign/day)
```

- **Raw stays raw.** `raw_supermetrics` holds each row exactly as delivered, so
  a re-sync or a change to the mapping logic can be replayed without ever
  corrupting normalized history.
- **The fact table is the spine.** `ad_performance_daily` gives the four
  cross-channel metrics (spend, impressions, clicks, conversions) first-class
  columns and puts the long tail in `metrics jsonb`, so a new channel is data,
  not a migration. Rows with `campaign = '(account)'` are the channel totals
  for that day, derived by `reporting.rebuild_account_totals()`.
- **Metric definitions are data.** `reporting.metric_definitions` holds the
  label, format and formula for every metric a report shows (e.g. `blended_cpa`
  = `spend / conversions`). Formulas are restricted arithmetic over the four
  base columns, evaluated by `lib/reporting/formula.ts` — never `eval`, never
  raw SQL. Define a metric once and every client's report obeys it.
- **`lib/reporting/mappers.ts` is the reconciliation point.** Google and Meta do
  not arrive matching: column names, conversion semantics and date formats all
  differ (Meta reports conversions as an `actions` array, and its `clicks`
  counts every click, so link clicks are what's comparable to Google's). That
  file is the only place those quirks live.

### Running the sync

`/api/reporting/sync` pulls each active client-channel, lands it raw, and
normalizes it. It's wired to Vercel Cron in `vercel.json` (daily 09:00 UTC) and
authenticated with `CRON_SECRET`. Manual run:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/reporting/sync?client=everlast&period=2026-08"
```

The default window is the latest closed month through today, so a nightly run
both keeps the current month current and finalises last month as late
conversions land. Every run is recorded in `reporting.sync_runs`; one failing
channel doesn't stop the others.

### Reading reports

`/reports` lists clients; `/reports/[slug]?period=YYYY-MM` renders the branded
report for a month against the previous month. The page is server-rendered from
`buildReport()`, which returns exactly this contract:

```js
{
  client, subtitle, period_label, compare_label,
  kpis:     [ { label, value, prev, format, lower_is_better? } ],
  channels: [ { name, cls, spend, clicks, conversions } ],
}
```

Brand (logo, primary colour, subtitle) comes from `reporting.clients.brand`,
ready for the white-labeled client portal later.

### Adding a client

1. Insert into `reporting.clients` (`name`, `slug`, optional `brand`, optional
   `crm_project_id` linking to a row in `public.projects`).
2. Insert into `reporting.client_channels` one row per connected channel, with
   `external_account_id` set to the ad account / property id at the source.
3. Run the sync for that client.

### Checking the logic

```bash
npm run check:reporting
```

Dependency-free assertions over the mappers, formula evaluator, period maths
and formatting — the parts where a silent error would quietly corrupt every
number on a report.

### Access model

Reads (`reporting.*`) are open to any signed-in agency user via RLS; writes go
through the service-role client in the sync job. `raw_supermetrics` is
server-only. Per-client scoping for an external client portal is a later phase
and will tighten these policies then.

## Notes / next steps

- Project creation UI isn't included — seed rows via
  `supabase/migrations/0002_seed_example.sql` or the Supabase dashboard
  to see the `/projects` list populated.
- A project surfaces Drive files by setting its `drive_folder_id` to a
  Google Drive folder ID the signed-in user can access.
- Reporting: commentary (`reporting.commentary`) is defined but not yet edited
  in-app; scheduling/PDF delivery, the client portal, and goals/pacing alerts
  are later phases that read the same normalized store.
