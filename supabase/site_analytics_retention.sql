-- Drop old analytics rows so the events table cannot grow without bound.
-- Safe to re-run. Staff-only CRM summary RPC still covers the last 90 days.
--
-- Run in Supabase → SQL Editor on Production (and Preview).

delete from public.site_analytics_events
where created_at < now() - interval '90 days';

delete from public.site_analytics_events
where coalesce(nullif(event_type, ''), 'pageview') = 'engage'
  and created_at < now() - interval '14 days';

comment on table public.site_analytics_events is
  'Site analytics events. Keep ~90 days of pageviews/clicks; engage heartbeats only 14 days.';
