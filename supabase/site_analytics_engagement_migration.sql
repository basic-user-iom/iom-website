-- Engagement analytics: bots, keywords, time-on-page, link clicks
-- Run in Supabase SQL editor after geo migration

alter table public.site_analytics_events
  add column if not exists event_type text not null default 'pageview'
    check (event_type in ('pageview', 'engage', 'click'));

alter table public.site_analytics_events
  add column if not exists is_bot boolean not null default false;

alter table public.site_analytics_events
  add column if not exists utm_term text not null default ''
    check (char_length(utm_term) <= 256);

alter table public.site_analytics_events
  add column if not exists search_keyword text not null default ''
    check (char_length(search_keyword) <= 256);

alter table public.site_analytics_events
  add column if not exists duration_ms integer
    check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 86400000));

alter table public.site_analytics_events
  add column if not exists link_url text not null default ''
    check (char_length(link_url) <= 1024);

alter table public.site_analytics_events
  add column if not exists link_label text not null default ''
    check (char_length(link_label) <= 256);

create index if not exists site_analytics_events_type_idx
  on public.site_analytics_events (event_type, created_at desc);

create index if not exists site_analytics_events_bot_idx
  on public.site_analytics_events (is_bot, created_at desc);

create index if not exists site_analytics_events_keyword_idx
  on public.site_analytics_events (search_keyword, created_at desc)
  where search_keyword <> '';
