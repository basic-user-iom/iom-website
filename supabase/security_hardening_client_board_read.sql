-- Client portal: allow members to read boards for projects they can access.
-- Run in Supabase → SQL Editor after client-scoped RLS. Safe to re-run.

do $$
begin
  if to_regclass('public.crm_board_columns') is not null then
    execute 'drop policy if exists "crm_board_columns_client_select" on public.crm_board_columns';
    execute $p$
      create policy "crm_board_columns_client_select"
        on public.crm_board_columns for select
        to authenticated
        using (
          public.is_crm_client()
          and public.crm_can_access_project(project_id)
        )
    $p$;
  end if;

  if to_regclass('public.crm_tasks') is not null then
    execute 'drop policy if exists "crm_tasks_client_select" on public.crm_tasks';
    execute $p$
      create policy "crm_tasks_client_select"
        on public.crm_tasks for select
        to authenticated
        using (
          public.is_crm_client()
          and public.crm_can_access_project(project_id)
        )
    $p$;
  end if;
end
$$;
