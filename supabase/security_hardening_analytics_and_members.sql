-- SEC-011: Harden site analytics inserts.
-- Prefer /api/pageview (service role + rate limit). Revoke direct anon Rest insert.
-- Run in Supabase → SQL Editor. Safe to re-run.

-- Drop open insert policy
drop policy if exists "site_analytics_anon_insert" on public.site_analytics_events;

-- Anon must not insert directly (poisoning / bypass validation)
revoke insert on public.site_analytics_events from anon;
revoke insert on public.site_analytics_events from authenticated;

-- Service role bypasses RLS; grant for clarity on locked-down grants
grant insert on public.site_analytics_events to service_role;

-- Optional constrained policy if someone re-grants anon later (defense in depth)
drop policy if exists "site_analytics_insert_validated" on public.site_analytics_events;
create policy "site_analytics_insert_validated"
  on public.site_analytics_events for insert
  to anon, authenticated
  with check (
    char_length(session_id) between 8 and 64
    and char_length(path) between 1 and 512
    and char_length(coalesce(referrer, '')) <= 512
    and char_length(coalesce(utm_source, '')) <= 128
    and char_length(coalesce(utm_medium, '')) <= 128
    and char_length(coalesce(utm_campaign, '')) <= 128
    and device_type in ('desktop', 'mobile', 'tablet', 'unknown')
  );

-- Keep insert revoked — policy alone is not enough if grants return.
-- Production ingest: api/pageview.js with SUPABASE_SERVICE_ROLE_KEY.

-- Staff list client members with emails (phase-3 portal polish)
create or replace function public.crm_list_client_members(p_account_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crm_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.user_id,
    coalesce(u.email, '')::text as email,
    m.active,
    m.created_at
  from public.crm_client_memberships m
  left join auth.users u on u.id = m.user_id
  where m.client_account_id = p_account_id
  order by m.created_at desc;
end;
$$;

revoke all on function public.crm_list_client_members(uuid) from public;
revoke all on function public.crm_list_client_members(uuid) from anon;
grant execute on function public.crm_list_client_members(uuid) to authenticated;
