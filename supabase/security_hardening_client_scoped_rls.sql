-- SEC-001 phase 3: client-scoped SELECT policies + staff helper to link members by email.
-- Run in Supabase → SQL Editor AFTER security_hardening_client_tenancy_foundation.sql.
-- Safe to re-run.
--
-- Clients may SELECT only:
--   • their memberships / accounts
--   • projects they can access (client_visible + account, or project membership)
--   • research notes / recordings marked client_visible for their account
-- No client INSERT/UPDATE/DELETE on CRM resources.

-- ── 1) Link Auth user to client account by email (staff only) ───────────────
create or replace function public.crm_add_client_member(
  p_account_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_mid uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_crm_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_account_id is null or v_email = '' or position('@' in v_email) < 2 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.crm_client_accounts a where a.id = p_account_id
  ) then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  select u.id
  into v_uid
  from auth.users u
  where lower(coalesce(u.email, '')) = v_email
  limit 1;

  if v_uid is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  -- Do not attach IOM staff as client members
  if exists (
    select 1 from public.crm_staff_profiles p where p.id = v_uid
  )
  or v_email like '%@iobjectm.com' then
    raise exception 'staff_cannot_be_client' using errcode = '22023';
  end if;

  insert into public.crm_client_memberships (client_account_id, user_id, active)
  values (p_account_id, v_uid, true)
  on conflict (client_account_id, user_id) do update
  set active = true
  returning id into v_mid;

  return v_mid;
end;
$$;

revoke all on function public.crm_add_client_member(uuid, text) from public;
revoke all on function public.crm_add_client_member(uuid, text) from anon;
grant execute on function public.crm_add_client_member(uuid, text) to authenticated;

-- ── 2) Client read: accounts + memberships ─────────────────────────────────
drop policy if exists "crm_client_accounts_client_select" on public.crm_client_accounts;
create policy "crm_client_accounts_client_select"
  on public.crm_client_accounts for select
  to authenticated
  using (
    public.is_crm_client()
    and id in (select public.crm_client_account_ids())
  );

drop policy if exists "crm_client_memberships_client_select" on public.crm_client_memberships;
create policy "crm_client_memberships_client_select"
  on public.crm_client_memberships for select
  to authenticated
  using (
    public.is_crm_client()
    and user_id = auth.uid()
  );

-- ── 3) Client read: projects ───────────────────────────────────────────────
drop policy if exists "crm_projects_client_select" on public.crm_projects;
create policy "crm_projects_client_select"
  on public.crm_projects for select
  to authenticated
  using (
    public.is_crm_client()
    and public.crm_can_access_project(id)
  );

-- ── 4) Client read: research notes (if table exists) ───────────────────────
do $$
begin
  if to_regclass('public.crm_research_notes') is not null then
    execute 'drop policy if exists crm_research_notes_client_select on public.crm_research_notes';
    execute $p$
      create policy crm_research_notes_client_select
        on public.crm_research_notes for select
        to authenticated
        using (
          public.is_crm_client()
          and client_visible
          and client_account_id in (select public.crm_client_account_ids())
        )
    $p$;
  end if;
end
$$;

-- ── 5) Client read: recordings (if table exists) ───────────────────────────
do $$
begin
  if to_regclass('public.crm_recordings') is not null then
    execute 'drop policy if exists "crm_recordings_client_select" on public.crm_recordings';
    execute $p$
      create policy "crm_recordings_client_select"
        on public.crm_recordings for select
        to authenticated
        using (
          public.is_crm_client()
          and client_visible
          and client_account_id in (select public.crm_client_account_ids())
        )
    $p$;
  end if;
end
$$;

-- Sanity (as staff JWT):
--   select public.crm_add_client_member('<account-uuid>', 'client@example.com');
-- As client JWT:
--   select * from public.crm_projects;  -- only visible assigned rows
