-- Privacy-friendly site analytics (cookie-free pageview events)
-- Apply in Supabase SQL editor alongside schema.sql

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null check (char_length(session_id) between 8 and 64),
  path text not null check (char_length(path) <= 512),
  referrer text not null default '' check (char_length(referrer) <= 512),
  utm_source text not null default '' check (char_length(utm_source) <= 128),
  utm_medium text not null default '' check (char_length(utm_medium) <= 128),
  utm_campaign text not null default '' check (char_length(utm_campaign) <= 128),
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  viewport_w smallint,
  viewport_h smallint,
  created_at timestamptz not null default now()
);

create index if not exists site_analytics_events_created_idx
  on public.site_analytics_events (created_at desc);

create index if not exists site_analytics_events_path_idx
  on public.site_analytics_events (path, created_at desc);

create index if not exists site_analytics_events_session_idx
  on public.site_analytics_events (session_id, created_at desc);

alter table public.site_analytics_events enable row level security;

-- Public site may record pageviews (insert only — no PII, no cookies)
drop policy if exists "site_analytics_anon_insert" on public.site_analytics_events;
create policy "site_analytics_anon_insert"
  on public.site_analytics_events for insert
  to anon
  with check (true);

drop policy if exists "site_analytics_auth_select" on public.site_analytics_events;
create policy "site_analytics_auth_select"
  on public.site_analytics_events for select
  to authenticated
  using (true);

grant insert on public.site_analytics_events to anon;
grant select on public.site_analytics_events to authenticated;

-- Daily aggregates for CRM dashboard (authenticated read)
create or replace view public.site_analytics_daily as
select
  date_trunc('day', created_at at time zone 'UTC')::date as day,
  count(*) as pageviews,
  count(distinct session_id) as visitors
from public.site_analytics_events
group by 1
order by 1 desc;

grant select on public.site_analytics_daily to authenticated;
