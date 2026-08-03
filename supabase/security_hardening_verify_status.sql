-- Verify which security hardening pieces are present.
-- Run in Supabase → SQL Editor (postgres). Safe / read-only.
--
-- If any row shows ok = false, apply these in order (SQL Editor):
--   1) security_hardening_rate_limits.sql
--   2) security_hardening_artist_invites.sql
--   3) security_hardening_staff_rls.sql
--   4) security_hardening_client_tenancy_foundation.sql
--   5) security_hardening_client_scoped_rls.sql
--   6) security_hardening_client_board_read.sql
--   7) security_hardening_analytics_and_members.sql
--   8) security_hardening_staff_roles.sql  (already applied if admin exists)
--   9) security_hardening_staff_aal2.sql

select
  check_id,
  label,
  ok,
  detail
from (
  select
    1 as ord,
    'rate_limits' as check_id,
    'api_rate_limit_take RPC' as label,
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'api_rate_limit_take'
    ) as ok,
    'SEC-009 durable rate limits' as detail

  union all
  select
    2,
    'staff_rls',
    'is_crm_staff() function',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_crm_staff'
    ),
    'SEC-001 staff gate'

  union all
  select
    3,
    'staff_roles',
    'staff_role + is_crm_admin()',
    (
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'crm_staff_profiles'
          and column_name = 'staff_role'
      )
      and exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'is_crm_admin'
      )
    ),
    'Admin role model'

  union all
  select
    4,
    'artist_invites',
    'artist invite claim RPC',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'artist_globe_get_invite'
    ),
    'SEC-002 invite lockdown'

  union all
  select
    5,
    'client_tenancy',
    'crm_client_accounts table',
    to_regclass('public.crm_client_accounts') is not null,
    'SEC-001 client tenancy foundation'

  union all
  select
    6,
    'client_memberships',
    'crm_client_memberships table',
    to_regclass('public.crm_client_memberships') is not null,
    'SEC-001 client memberships'

  union all
  select
    7,
    'analytics_rpc',
    'crm_list_client_members RPC',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'crm_list_client_members'
    ),
    'Analytics / members helper'

  union all
  select
    8,
    'admins_seeded',
    'at least one active admin',
    exists (
      select 1
      from public.crm_staff_profiles
      where staff_role = 'admin' and coalesce(active, true)
    ),
    'Bootstrap admin row'

  union all
  select
    9,
    'aal2_staff_gate',
    'is_crm_staff_identity + aal2 in is_crm_staff',
    (
      exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'is_crm_staff_identity'
      )
      and exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'is_crm_staff'
          and pg_get_functiondef(p.oid) ilike '%aal2%'
      )
    ),
    'JWT aal2 required for staff CRM RLS'
) s
order by ord;
