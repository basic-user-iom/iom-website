-- Require JWT aal2 for staff CRM data access (PostgREST / RLS).
-- Run in Supabase → SQL Editor AFTER relying on aal2 RLS.
-- Depends on: security_hardening_staff_roles.sql
-- Safe to re-run.
--
-- Design:
--   is_crm_staff_identity() — who is staff (no AAL). Used for login role resolve / MFA enroll.
--   is_crm_staff()          — identity AND aal2. Used by existing CRM RLS policies.
--   is_crm_admin()          — admin row AND aal2.

-- Identity only (password session / MFA enroll still works).
create or replace function public.is_crm_staff_identity()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.crm_staff_profiles p
        where p.id = auth.uid()
          and coalesce(p.active, true)
      )
      or (
        lower(coalesce(auth.jwt() ->> 'email', '')) like '%@iobjectm.com'
        and not exists (
          select 1
          from public.crm_staff_profiles p
          where p.id = auth.uid()
            and coalesce(p.active, true) = false
        )
      )
    );
$$;

revoke all on function public.is_crm_staff_identity() from public;
grant execute on function public.is_crm_staff_identity() to authenticated;

-- Data access: staff identity + MFA (aal2).
create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_crm_staff_identity()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.is_crm_staff() from public;
grant execute on function public.is_crm_staff() to authenticated;

-- Admin directory management also requires aal2.
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.crm_staff_profiles p
      where p.id = auth.uid()
        and coalesce(p.active, true)
        and p.staff_role = 'admin'
    );
$$;

revoke all on function public.is_crm_admin() from public;
grant execute on function public.is_crm_admin() to authenticated;

comment on function public.is_crm_staff_identity() is
  'Staff identity without MFA — for CRM role resolve / enroll UI only';
comment on function public.is_crm_staff() is
  'Staff CRM data access: active staff identity AND JWT aal2';
comment on function public.is_crm_admin() is
  'Active admin row AND JWT aal2';
