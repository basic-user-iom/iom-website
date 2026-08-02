-- Staff roles + active flag (SEC-001 / planned admin model).
-- Run in Supabase → SQL Editor after prior security_hardening_*.sql files.
-- Safe to re-run.

-- ── Staff profile role columns ─────────────────────────────────────────────
alter table public.crm_staff_profiles
  add column if not exists staff_role text not null default 'staff';

alter table public.crm_staff_profiles
  add column if not exists active boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_staff_profiles_staff_role_check'
  ) then
    alter table public.crm_staff_profiles
      add constraint crm_staff_profiles_staff_role_check
      check (staff_role in ('staff', 'admin'));
  end if;
end $$;

-- Active staff (directory row OR @iobjectm.com JWT email).
create or replace function public.is_crm_staff()
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

revoke all on function public.is_crm_staff() from public;
grant execute on function public.is_crm_staff() to authenticated;

-- Active admin only (explicit staff_role = admin).
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
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

-- Staff may still manage client accounts / project assignments (planned model).
-- Admin-only: elevating or deactivating staff directory rows.
drop policy if exists "crm_staff_profiles_admin_manage" on public.crm_staff_profiles;
create policy "crm_staff_profiles_admin_manage"
  on public.crm_staff_profiles for all
  to authenticated
  using (public.is_crm_admin())
  with check (public.is_crm_admin());

-- Prevent non-admins from elevating themselves via the existing update-own policy.
drop policy if exists "crm_staff_profiles_staff_update_own" on public.crm_staff_profiles;
create policy "crm_staff_profiles_staff_update_own"
  on public.crm_staff_profiles for update
  to authenticated
  using (public.is_crm_staff() and id = auth.uid())
  with check (
    public.is_crm_staff()
    and id = auth.uid()
    and staff_role = (
      select p.staff_role from public.crm_staff_profiles p where p.id = auth.uid()
    )
    and active = (
      select p.active from public.crm_staff_profiles p where p.id = auth.uid()
    )
  );

-- Bootstrap: promote your mailbox once after applying (example):
--   insert into public.crm_staff_profiles (id, email, display_name, staff_role, active)
--   values ('<auth-user-uuid>', 'you@iobjectm.com', 'You', 'admin', true)
--   on conflict (id) do update
--   set staff_role = 'admin', active = true, email = excluded.email;

comment on column public.crm_staff_profiles.staff_role is
  'staff = shared CRM access; admin = membership/role management';
comment on column public.crm_staff_profiles.active is
  'When false, is_crm_staff() denies access even for @iobjectm.com JWTs';
comment on function public.is_crm_admin() is
  'True only for active crm_staff_profiles rows with staff_role = admin';
