-- Durable API rate limits (SEC-009).
-- Shared across Vercel serverless instances via Postgres.
-- Run in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null default 0
);

alter table public.api_rate_limits enable row level security;
-- No policies for anon/authenticated — service role only.

create or replace function public.api_rate_limit_take(
  p_key text,
  p_max integer,
  p_window_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  hits integer;
  window_interval interval;
begin
  if p_key is null or length(trim(p_key)) < 1 or coalesce(p_max, 0) < 1 then
    return false;
  end if;

  window_interval := make_interval(
    secs => greatest(coalesce(p_window_ms, 60000), 1000)::double precision / 1000.0
  );

  insert into public.api_rate_limits as r (bucket_key, window_started_at, hit_count)
  values (left(trim(p_key), 200), now_ts, 1)
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when r.window_started_at + window_interval <= now_ts then now_ts
      else r.window_started_at
    end,
    hit_count = case
      when r.window_started_at + window_interval <= now_ts then 1
      else r.hit_count + 1
    end
  returning r.hit_count into hits;

  return hits <= p_max;
end;
$$;

revoke all on function public.api_rate_limit_take(text, integer, integer) from public;
grant execute on function public.api_rate_limit_take(text, integer, integer) to service_role;

-- Optional cleanup of stale buckets (run occasionally)
create or replace function public.api_rate_limits_cleanup(p_older_than_ms integer default 86400000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.api_rate_limits
  where window_started_at < clock_timestamp()
    - make_interval(secs => greatest(p_older_than_ms, 60000)::double precision / 1000.0);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.api_rate_limits_cleanup(integer) from public;
grant execute on function public.api_rate_limits_cleanup(integer) to service_role;
