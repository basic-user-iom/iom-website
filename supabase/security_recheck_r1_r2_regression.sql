-- SEC-R1 / SEC-R2 regression checklist (manual / staging).
-- Run as postgres after security_hardening_client_active_and_tasks.sql.
-- Replace UUIDs with dedicated Client A / staff fixtures. Do not run on prod as write tests.
--
-- Expected: each assertion comment matches the result when using SET ROLE / JWT claims
-- via Supabase Auth test users (prefer PostgREST with client JWTs over SET LOCAL).

-- Structural (no JWT needed)
select
  (pg_get_functiondef('public.crm_client_account_ids()'::regprocedure)
    ilike '%crm_client_accounts%'
    and pg_get_functiondef('public.crm_client_account_ids()'::regprocedure)
      ilike '%a.active%') as r1_account_ids_join_active,
  (pg_get_functiondef('public.is_crm_client()'::regprocedure)
    ilike '%crm_client_accounts%'
    and pg_get_functiondef('public.is_crm_client()'::regprocedure)
      ilike '%a.active%') as r1_is_client_join_active,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_tasks'
      and policyname = 'crm_tasks_client_select'
      and coalesce(qual, '') ilike '%client_visible%'
  ) as r2_tasks_client_visible,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_board_columns'
      and policyname = 'crm_board_columns_client_select'
      and coalesce(qual, '') ilike '%crm_tasks%'
  ) as r2_columns_require_visible_task;

-- Runtime matrix (use Client A JWT via PostgREST; document results):
-- 1) Active account + membership + visible project → projects/notes/tasks allowed per visibility.
-- 2) Set crm_client_accounts.active = false (membership stays true) → all client rows empty.
-- 3) Reactivate account → access restored.
-- 4) Set membership.active = false only → all access denied.
-- 5) Same project: client_visible task readable; client_visible=false task absent from select.
-- 6) Board columns with only staff-only tasks absent from select.
