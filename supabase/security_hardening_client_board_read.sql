-- Client portal: allow members to read boards for projects they can access.
-- Run in Supabase → SQL Editor after client-scoped RLS. Safe to re-run.
--
-- Clients may only see tasks marked client_visible. Board columns are visible
-- only when they contain at least one client-visible task (no empty/staff-only
-- column leakage). Prefer security_hardening_client_active_and_tasks.sql after
-- staff_aal2 for the full SEC-R1/R2 stack on existing DBs.

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
