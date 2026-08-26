-- Drop old analytics rows so the events table cannot grow without bound.
-- Safe to re-run. Staff-only CRM summary RPC still covers the last 90 days.
--
-- Run in Supabase → SQL Editor on Production (and Preview).
-- After the one-shot deletes, this also schedules a daily purge (pg_cron).
-- Enable pg_cron first if needed: Database → Extensions → pg_cron.

delete from public.site_analytics_events
where created_at < now() - interval '90 days';

delete from public.site_analytics_events
where coalesce(nullif(event_type, ''), 'pageview') = 'engage'
  and created_at < now() - interval '14 days';

comment on table public.site_analytics_events is
  'Site analytics events. Keep ~90 days of pageviews/clicks; engage heartbeats only 14 days.';

create or replace function public.purge_site_analytics_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.site_analytics_events
  where created_at < now() - interval '90 days';

  delete from public.site_analytics_events
  where coalesce(nullif(event_type, ''), 'pageview') = 'engage'
    and created_at < now() - interval '14 days';
end;
$$;

revoke all on function public.purge_site_analytics_events() from public;

do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'Could not enable pg_cron (%). Turn it on in Database → Extensions, then re-run this file.', sqlerrm;
end $$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled; daily analytics purge was not scheduled.';
    return;
  end if;

  perform cron.unschedule(j.jobid)
  from cron.job j
  where j.jobname = 'purge-site-analytics-events';

  perform cron.schedule(
    'purge-site-analytics-events',
    '20 4 * * *',
    $job$select public.purge_site_analytics_events()$job$
  );
exception
  when others then
    raise notice 'Could not schedule analytics purge (%). Enable pg_cron and re-run this file.', sqlerrm;
end $$;
