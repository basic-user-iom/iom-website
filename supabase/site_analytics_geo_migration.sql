-- Add visitor geo fields for IOM-SEO realtime globe
-- Run in Supabase SQL editor after site_analytics_migration.sql

alter table public.site_analytics_events
  add column if not exists country text not null default ''
    check (char_length(country) <= 8);

alter table public.site_analytics_events
  add column if not exists city text not null default ''
    check (char_length(city) <= 128);

alter table public.site_analytics_events
  add column if not exists latitude double precision;

alter table public.site_analytics_events
  add column if not exists longitude double precision;

create index if not exists site_analytics_events_geo_idx
  on public.site_analytics_events (created_at desc)
  where latitude is not null and longitude is not null;

create index if not exists site_analytics_events_country_idx
  on public.site_analytics_events (country, created_at desc);
