-- CRM project board: columns, tasks, time entries.
-- Missing from early schema.sql; production already has these.
-- Safe to re-run. Required for preview / fresh projects before SEC-R2 policies.
--
-- Apply order:
--   after schema.sql + crm_projects exist
--   before security_hardening_client_board_read.sql
--   (or after — this file also installs staff + client SELECT policies)

create extension if not exists "pgcrypto";

-- ── Board columns ──────────────────────────────────────────────────────────
create table if not exists public.crm_board_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects (id) on delete cascade,
  name text not null default '',
  position integer not null default 0,
  color text not null default '',
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists crm_board_columns_project_idx
  on public.crm_board_columns (project_id, position);

-- ── Tasks ──────────────────────────────────────────────────────────────────
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects (id) on delete cascade,
  column_id uuid references public.crm_board_columns (id) on delete set null,
  title text not null default '',
  description text not null default '',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  assignee_id uuid references auth.users (id) on delete set null,
  position integer not null default 0,
  owner_id uuid references auth.users (id) on delete set null,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_tasks_project_idx
  on public.crm_tasks (project_id, position);

create index if not exists crm_tasks_column_idx
  on public.crm_tasks (column_id);

-- ── Time entries ───────────────────────────────────────────────────────────
create table if not exists public.crm_time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.crm_projects (id) on delete set null,
  task_id uuid references public.crm_tasks (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  user_email text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  notes text not null default '',
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists crm_time_entries_project_idx
  on public.crm_time_entries (project_id, started_at desc);

create index if not exists crm_time_entries_user_idx
  on public.crm_time_entries (user_id, started_at desc);

-- Keep client_visible if tables already existed without it
alter table public.crm_board_columns
  add column if not exists client_visible boolean not null default false;
alter table public.crm_tasks
  add column if not exists client_visible boolean not null default false;
alter table public.crm_time_entries
  add column if not exists client_visible boolean not null default false;

-- updated_at trigger (function may already exist from schema.sql)
create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_tasks_updated_at on public.crm_tasks;
create trigger crm_tasks_updated_at
  before update on public.crm_tasks
  for each row execute function public.crm_set_updated_at();

alter table public.crm_board_columns enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_time_entries enable row level security;

-- Staff full access (shared team tool)
drop policy if exists "crm_board_columns_staff_all" on public.crm_board_columns;
create policy "crm_board_columns_staff_all"
  on public.crm_board_columns for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

drop policy if exists "crm_tasks_staff_all" on public.crm_tasks;
create policy "crm_tasks_staff_all"
  on public.crm_tasks for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

drop policy if exists "crm_time_entries_staff_all" on public.crm_time_entries;
create policy "crm_time_entries_staff_all"
  on public.crm_time_entries for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

-- Client read (SEC-R2): visible tasks only; columns only if they contain one
drop policy if exists "crm_tasks_client_select" on public.crm_tasks;
create policy "crm_tasks_client_select"
  on public.crm_tasks for select
  to authenticated
  using (
    public.is_crm_client()
    and public.crm_can_access_project(project_id)
    and client_visible = true
  );

drop policy if exists "crm_board_columns_client_select" on public.crm_board_columns;
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
  );

grant select, insert, update, delete on public.crm_board_columns to authenticated;
grant select, insert, update, delete on public.crm_tasks to authenticated;
grant select, insert, update, delete on public.crm_time_entries to authenticated;
