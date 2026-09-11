-- Optional demo data for the reporting module.
--
-- Gives you one client (Everlast) with three months of Google Ads + Meta Ads
-- campaign-grain data so /reports renders end-to-end before Supermetrics is
-- wired up. Safe to skip in production — nothing else depends on it.

insert into reporting.clients (name, slug, brand)
values (
  'Everlast',
  'everlast',
  '{"primary_color":"#b91c1c","subtitle":"Paid media performance"}'::jsonb
)
on conflict (slug) do nothing;

insert into reporting.client_channels (client_id, channel_id, external_account_id)
select c.id, ch.id, 'demo-' || ch.key
  from reporting.clients c
  cross join reporting.channels ch
 where c.slug = 'everlast'
   and ch.key in ('google_ads', 'meta_ads')
on conflict do nothing;

-- Deterministic pseudo-random daily rows: enough shape to exercise the report
-- (period vs. comparison, per-channel split, campaign detail) without pretending
-- to be real performance data.
with client as (
  select id from reporting.clients where slug = 'everlast'
),
days as (
  select generate_series(
           date_trunc('month', current_date)::date - interval '3 months',
           date_trunc('month', current_date)::date - interval '1 day',
           interval '1 day'
         )::date as date
),
campaigns as (
  select * from (values
    ('google_ads'::text, 'Brand — Exact'::text,        0.30::numeric),
    ('google_ads',       'Non-Brand — Services',       0.45),
    ('google_ads',       'Performance Max',            0.25),
    ('meta_ads',         'Prospecting — Broad',        0.60),
    ('meta_ads',         'Retargeting — 30d',          0.40)
  ) as t(source, campaign, share)
)
insert into reporting.ad_performance_daily
  (client_id, channel_id, date, campaign, spend, impressions, clicks, conversions, metrics)
select cl.id,
       ch.id,
       d.date,
       cp.campaign,
       round((base.daily_spend * cp.share)::numeric, 2),
       round(base.daily_spend * cp.share * base.impr_per_dollar)::bigint,
       round(base.daily_spend * cp.share * base.clicks_per_dollar)::bigint,
       round((base.daily_spend * cp.share * base.conv_per_dollar)::numeric, 2),
       case when ch.key = 'meta_ads'
            then jsonb_build_object('video_views', round(base.daily_spend * cp.share * 4)::int)
            else jsonb_build_object('search_impression_share', 0.62)
       end
  from client cl
  cross join days d
  cross join campaigns cp
  join reporting.channels ch on ch.key = cp.source
  cross join lateral (
    select case when cp.source = 'google_ads' then 180 else 120 end
             * (0.8 + 0.4 * ((extract(day from d.date)::int * 37 % 11) / 10.0))
             * (1 + 0.06 * (extract(month from d.date)::int % 3)) as daily_spend,
           case when cp.source = 'google_ads' then 55 else 210 end as impr_per_dollar,
           case when cp.source = 'google_ads' then 2.4 else 3.1 end as clicks_per_dollar,
           case when cp.source = 'google_ads' then 0.09 else 0.05 end as conv_per_dollar
  ) base
on conflict (client_id, channel_id, date, campaign) do nothing;

-- Roll the campaign rows up into the '(account)' rows the report reads.
select reporting.rebuild_account_totals(
         c.id,
         ch.id,
         (date_trunc('month', current_date)::date - interval '3 months')::date,
         (date_trunc('month', current_date)::date - interval '1 day')::date
       )
  from reporting.clients c
  cross join reporting.channels ch
 where c.slug = 'everlast'
   and ch.key in ('google_ads', 'meta_ads');
