-- SEC-R1 / SEC-R2 (security recheck 2026-08-03).
-- Run in Supabase → SQL Editor after staff_aal2 + client board read.
-- Safe to re-run.
--
-- R1: Inactive client accounts lose access (membership alone is not enough).
-- R2: Clients may only read tasks marked client_visible; board columns only if
--     they contain at least one client-visible task.

-- ── R1 helpers ─────────────────────────────────────────────────────────────
create or replace function public.is_crm_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and not public.is_crm_staff_identity()
    and exists (
      select 1
      from public.crm_client_memberships m
      join public.crm_client_accounts a
        on a.id = m.client_account_id
      where m.user_id = auth.uid()
        and m.active
        and a.active
    );
$$;

create or replace function public.crm_client_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.client_account_id
  from public.crm_client_memberships m
  join public.crm_client_accounts a
    on a.id = m.client_account_id
  where m.user_id = auth.uid()
    and m.active
    and a.active;
$$;

revoke all on function public.is_crm_client() from public;
revoke all on function public.crm_client_account_ids() from public;
grant execute on function public.is_crm_client() to authenticated;
grant execute on function public.crm_client_account_ids() to authenticated;

comment on function public.is_crm_client() is
  'True when the user has an active membership on an active client account (not staff).';
comment on function public.crm_client_account_ids() is
  'Active client account IDs for the current user (membership + account active).';

-- ── R2 board / task client SELECT ──────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_tasks') is not null then
    execute 'alter table public.crm_tasks add column if not exists client_visible boolean not null default false';
    execute 'drop policy if exists "crm_tasks_client_select" on public.crm_tasks';
    execute $p$
      create policy "crm_tasks_client_select"
        on public.crm_tasks for select
        to authenticated
        using (
          public.is_crm_client()
          and public.crm_can_access_project(project_id)
          and client_visible = true
        )
    $p$;
  end if;

  if to_regclass('public.crm_board_columns') is not null then
    execute 'alter table public.crm_board_columns add column if not exists client_visible boolean not null default false';
    execute 'drop policy if exists "crm_board_columns_client_select" on public.crm_board_columns';
    execute $p$
      create policy "crm_board_columns_client_select"
        on public.crm_board_columns for select
        to authenticated
        using (
          public.is_crm_client()
          and public.crm_can_access_project(project_id)
          and exists (
            select 1
            from public.crm_tasks t
            where t.column_id = crm_board_columns.id
              and t.client_visible = true
              and public.crm_can_access_project(t.project_id)
          )
        )
    $p$;
  end if;
end
$$;
