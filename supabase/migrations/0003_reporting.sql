-- Reporting module — Phase 0 "the spine".
--
-- Everything the reporting product reads and writes lives in its own schema so
-- it can grow (channels, commentary, portals) without colliding with the CRM
-- tables in `public`.
--
-- Access model: raw + fact tables are written ONLY by the server (service role,
-- which bypasses RLS) from the sync/normalization job. Signed-in agency users
-- get read access. Per-client scoping for an external client portal is Phase 5
-- and will tighten these policies then.
--
-- NOTE: to query this schema through supabase-js / PostgREST you must add
-- `reporting` to Project Settings → API → Exposed schemas.

create schema if not exists reporting;

grant usage on schema reporting to anon, authenticated, service_role;

-- Clients -------------------------------------------------------------------

create table if not exists reporting.clients (
  id            bigserial primary key,
  crm_project_id uuid references public.projects (id) on delete set null,
  name          text not null,
  slug          text unique not null,
  -- white-label brand bag: { "logo_url": ..., "primary_color": "#0f172a", ... }
  brand         jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger reporting_clients_set_updated_at
  before update on reporting.clients
  for each row execute function public.set_updated_at();

-- Channels — the fixed vocabulary of sources we support ---------------------

create table if not exists reporting.channels (
  id    smallserial primary key,
  key   text unique not null,
  label text not null,
  -- css class the report template uses for the channel's accent colour
  cls   text not null default 'neutral',
  sort_order smallint not null default 100
);

insert into reporting.channels (key, label, cls, sort_order) values
  ('google_ads',    'Google Ads',    'google', 10),
  ('meta_ads',      'Meta Ads',      'meta',   20),
  ('ga4',           'GA4',           'ga4',    30),
  ('gsc',           'Search Console','gsc',    40),
  ('call_tracking', 'Call Tracking', 'calls',  50)
on conflict (key) do nothing;

-- Which channels each client has connected -----------------------------------

create table if not exists reporting.client_channels (
  client_id           bigint   not null references reporting.clients (id) on delete cascade,
  channel_id          smallint not null references reporting.channels (id),
  external_account_id text,                    -- ad account / property id at the source
  active              boolean  not null default true,
  primary key (client_id, channel_id)
);

-- The normalized fact table (the heart of it) --------------------------------
--
-- One row per client / channel / campaign / day. Rows with campaign = '(account)'
-- are the channel totals for that day, so headline queries stay trivial.

create table if not exists reporting.ad_performance_daily (
  client_id   bigint   not null references reporting.clients (id) on delete cascade,
  channel_id  smallint not null references reporting.channels (id),
  date        date     not null,
  campaign    text     not null default '(account)',
  spend       numeric(14,2) not null default 0,
  impressions bigint        not null default 0,
  clicks      bigint        not null default 0,
  conversions numeric(12,2) not null default 0,   -- our unified "action"
  -- channel-specific extras without schema churn
  metrics     jsonb    not null default '{}'::jsonb,
  loaded_at   timestamptz not null default now(),
  primary key (client_id, channel_id, date, campaign)
);

create index if not exists idx_perf_client_date
  on reporting.ad_performance_daily (client_id, date);

-- Metric definitions (where cross-channel logic lives) -----------------------
--
-- `formula` is a restricted arithmetic expression over the base fact columns
-- (spend, impressions, clicks, conversions) — e.g. 'spend / conversions'.
-- It is evaluated by lib/reporting/formula.ts, never by eval() or raw SQL.

create table if not exists reporting.metric_definitions (
  key             text primary key,
  label           text not null,
  formula         text not null,
  lower_is_better boolean not null default false,
  format          text not null default 'number',   -- 'money' | 'int' | 'number' | 'percent'
  is_kpi          boolean not null default false,   -- show in the report's headline row
  sort_order      smallint not null default 100
);

insert into reporting.metric_definitions
  (key, label, formula, lower_is_better, format, is_kpi, sort_order) values
  ('spend',       'Spend',       'spend',                     false, 'money',   true, 10),
  ('impressions', 'Impressions', 'impressions',               false, 'int',     true, 20),
  ('clicks',      'Clicks',      'clicks',                    false, 'int',     true, 30),
  ('conversions', 'Conversions', 'conversions',               false, 'number',  true, 40),
  ('ctr',         'CTR',         'clicks / impressions',      false, 'percent', true, 50),
  ('cpc',         'Avg. CPC',    'spend / clicks',            true,  'money',   true, 60),
  ('blended_cpa', 'Blended CPA', 'spend / conversions',       true,  'money',   true, 70),
  ('cvr',         'Conv. rate',  'conversions / clicks',      false, 'percent', false, 80)
on conflict (key) do nothing;

-- Commentary (Phase 2 lands here; defined now so nothing re-plumbs) ----------

create table if not exists reporting.commentary (
  client_id  bigint not null references reporting.clients (id) on delete cascade,
  period     date   not null,          -- first day of the report month
  section    text   not null,          -- 'overview', 'google_ads', 'meta_ads', ...
  body       text,
  ai_draft   text,                     -- generated first pass, kept alongside edits
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (client_id, period, section)
);

create trigger reporting_commentary_set_updated_at
  before update on reporting.commentary
  for each row execute function public.set_updated_at();

-- Raw landing (Supermetrics writes here; normalization reads here) -----------
--
-- Kept separate from the fact table so a re-sync or a change to the mapping
-- logic can be replayed without ever corrupting normalized history.

create table if not exists reporting.raw_supermetrics (
  id            bigserial primary key,
  batch_id      uuid   not null,
  source        text   not null,        -- channel key: 'google_ads', 'meta_ads', ...
  client_id     bigint not null references reporting.clients (id) on delete cascade,
  payload       jsonb  not null,        -- raw row exactly as delivered
  synced_at     timestamptz not null default now(),
  normalized_at timestamptz
);

create index if not exists idx_raw_pending
  on reporting.raw_supermetrics (client_id, source, synced_at)
  where normalized_at is null;

-- Sync runs — so "lands on a schedule" is observable --------------------------

create table if not exists reporting.sync_runs (
  id          bigserial primary key,
  batch_id    uuid not null,
  client_id   bigint references reporting.clients (id) on delete cascade,
  source      text,
  status      text not null default 'running',   -- 'running' | 'succeeded' | 'failed'
  date_from   date,
  date_to     date,
  rows_landed integer not null default 0,
  rows_normalized integer not null default 0,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_sync_runs_started
  on reporting.sync_runs (started_at desc);

-- Account totals -------------------------------------------------------------
--
-- Derives the campaign = '(account)' rows from the campaign-grain rows for a
-- window. Idempotent: safe to re-run after any re-sync.

create or replace function reporting.rebuild_account_totals(
  p_client_id bigint,
  p_channel_id smallint,
  p_from date,
  p_to date
) returns integer
language plpgsql
security definer
set search_path = reporting, public
as $$
declare
  v_rows integer;
begin
  delete from reporting.ad_performance_daily
   where client_id = p_client_id
     and channel_id = p_channel_id
     and date between p_from and p_to
     and campaign = '(account)';

  insert into reporting.ad_performance_daily
    (client_id, channel_id, date, campaign, spend, impressions, clicks, conversions, metrics)
  select client_id,
         channel_id,
         date,
         '(account)',
         sum(spend),
         sum(impressions),
         sum(clicks),
         sum(conversions),
         '{}'::jsonb
    from reporting.ad_performance_daily
   where client_id = p_client_id
     and channel_id = p_channel_id
     and date between p_from and p_to
     and campaign <> '(account)'
   group by client_id, channel_id, date;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- The report rollup (Phase 1 reads this) -------------------------------------
--
-- One round trip returns both the report period and its comparison period,
-- per channel, from the '(account)' rows.

create or replace function reporting.report_rollup(
  p_client_id bigint,
  p_start date,
  p_end date,
  p_prev_start date,
  p_prev_end date
) returns table (
  bucket        text,
  channel_key   text,
  channel_label text,
  channel_cls   text,
  sort_order    smallint,
  spend         numeric,
  impressions   bigint,
  clicks        bigint,
  conversions   numeric
)
language sql
stable
security definer
set search_path = reporting, public
as $$
  select b.bucket,
         c.key,
         c.label,
         c.cls,
         c.sort_order,
         coalesce(sum(p.spend), 0)::numeric,
         coalesce(sum(p.impressions), 0)::bigint,
         coalesce(sum(p.clicks), 0)::bigint,
         coalesce(sum(p.conversions), 0)::numeric
    from (values ('current', p_start, p_end), ('previous', p_prev_start, p_prev_end))
           as b(bucket, from_date, to_date)
    join reporting.ad_performance_daily p
      on p.client_id = p_client_id
     and p.campaign = '(account)'
     and p.date between b.from_date and b.to_date
    join reporting.channels c on c.id = p.channel_id
   group by b.bucket, c.key, c.label, c.cls, c.sort_order;
$$;

-- RLS ------------------------------------------------------------------------
--
-- Reads: any signed-in agency user. Writes: service role only (bypasses RLS),
-- i.e. the sync job and server actions.

alter table reporting.clients             enable row level security;
alter table reporting.channels            enable row level security;
alter table reporting.client_channels     enable row level security;
alter table reporting.ad_performance_daily enable row level security;
alter table reporting.metric_definitions  enable row level security;
alter table reporting.commentary          enable row level security;
alter table reporting.raw_supermetrics    enable row level security;
alter table reporting.sync_runs           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'channels', 'client_channels', 'ad_performance_daily',
    'metric_definitions', 'commentary', 'sync_runs'
  ] loop
    execute format(
      'create policy "Authenticated users can read %1$s" on reporting.%1$I for select to authenticated using (true)',
      t
    );
  end loop;
end;
$$;

-- Commentary is edited in-app by analysts (Phase 2), so signed-in users write it.
create policy "Authenticated users can write commentary"
  on reporting.commentary for insert to authenticated with check (true);

create policy "Authenticated users can update commentary"
  on reporting.commentary for update to authenticated using (true) with check (true);

-- raw_supermetrics stays server-only: no policies, so only the service role reads it.

grant select on all tables in schema reporting to authenticated;
grant insert, update on reporting.commentary to authenticated;
revoke all on reporting.raw_supermetrics from authenticated, anon;
grant all on all tables in schema reporting to service_role;
grant usage, select on all sequences in schema reporting to service_role;

grant execute on function reporting.report_rollup(bigint, date, date, date, date)
  to authenticated, service_role;
grant execute on function reporting.rebuild_account_totals(bigint, smallint, date, date)
  to service_role;
