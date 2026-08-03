-- SEC-001 phase 2 foundation: client org / membership / visibility columns.
-- Staff-only policies remain — does NOT open client portal access yet.
-- Run in Supabase → SQL Editor after security_hardening_staff_rls.sql.
-- Safe to re-run.

-- ── 0) Harden rate-limit RPC grants (anon must not execute) ────────────────
revoke all on function public.api_rate_limit_take(text, integer, integer) from public;
revoke all on function public.api_rate_limit_take(text, integer, integer) from anon, authenticated;
grant execute on function public.api_rate_limit_take(text, integer, integer) to service_role;

revoke all on function public.api_rate_limits_cleanup(integer) from public;
revoke all on function public.api_rate_limits_cleanup(integer) from anon, authenticated;
grant execute on function public.api_rate_limits_cleanup(integer) to service_role;

-- ── 1) Client accounts (company / org boundary) ─────────────────────────────
create table if not exists public.crm_client_accounts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads (id) on delete set null,
  name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_client_accounts_lead_idx
  on public.crm_client_accounts (lead_id);

create index if not exists crm_client_accounts_active_idx
  on public.crm_client_accounts (active);

drop trigger if exists crm_client_accounts_updated_at on public.crm_client_accounts;
create trigger crm_client_accounts_updated_at
  before update on public.crm_client_accounts
  for each row execute function public.crm_set_updated_at();

alter table public.crm_client_accounts enable row level security;

drop policy if exists "crm_client_accounts_staff_all" on public.crm_client_accounts;
create policy "crm_client_accounts_staff_all"
  on public.crm_client_accounts for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

grant select, insert, update, delete on public.crm_client_accounts to authenticated;

-- ── 2) Client user memberships ─────────────────────────────────────────────
create table if not exists public.crm_client_memberships (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.crm_client_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (client_account_id, user_id)
);

create index if not exists crm_client_memberships_user_idx
  on public.crm_client_memberships (user_id)
  where active;

create index if not exists crm_client_memberships_account_idx
  on public.crm_client_memberships (client_account_id)
  where active;

alter table public.crm_client_memberships enable row level security;

drop policy if exists "crm_client_memberships_staff_all" on public.crm_client_memberships;
create policy "crm_client_memberships_staff_all"
  on public.crm_client_memberships for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

grant select, insert, update, delete on public.crm_client_memberships to authenticated;

-- ── 3) Project memberships (optional finer scope) ──────────────────────────
create table if not exists public.crm_project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  client_account_id uuid references public.crm_client_accounts (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (user_id is not null or client_account_id is not null)
);

create index if not exists crm_project_memberships_project_idx
  on public.crm_project_memberships (project_id)
  where active;

create index if not exists crm_project_memberships_user_idx
  on public.crm_project_memberships (user_id)
  where active;

alter table public.crm_project_memberships enable row level security;

drop policy if exists "crm_project_memberships_staff_all" on public.crm_project_memberships;
create policy "crm_project_memberships_staff_all"
  on public.crm_project_memberships for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

grant select, insert, update, delete on public.crm_project_memberships to authenticated;

-- ── 4) Visibility / ownership columns on existing resources ────────────────
alter table public.crm_projects
  add column if not exists client_account_id uuid references public.crm_client_accounts (id) on delete set null,
  add column if not exists client_visible boolean not null default false;

create index if not exists crm_projects_client_account_idx
  on public.crm_projects (client_account_id);

do $$
begin
  if to_regclass('public.crm_research_notes') is not null then
    alter table public.crm_research_notes
      add column if not exists client_account_id uuid references public.crm_client_accounts (id) on delete set null,
      add column if not exists client_visible boolean not null default false;
    create index if not exists crm_research_notes_client_account_idx
      on public.crm_research_notes (client_account_id);
  end if;

  if to_regclass('public.crm_recordings') is not null then
    alter table public.crm_recordings
      add column if not exists project_id uuid references public.crm_projects (id) on delete set null,
      add column if not exists client_account_id uuid references public.crm_client_accounts (id) on delete set null,
      add column if not exists client_visible boolean not null default false;
    create index if not exists crm_recordings_project_idx
      on public.crm_recordings (project_id);
    create index if not exists crm_recordings_client_account_idx
      on public.crm_recordings (client_account_id);
  end if;
end
$$;

-- Optional workspace tables (created only if present in production)
do $$
declare
  t text;
begin
  foreach t in array array[
    'crm_mind_maps',
    'crm_mind_nodes',
    'crm_tasks',
    'crm_time_entries',
    'crm_board_columns'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'alter table public.%I add column if not exists client_visible boolean not null default false',
        t
      );
    end if;
  end loop;
end
$$;

-- ── 5) Helpers for future client policies (unused by RLS yet) ──────────────
create or replace function public.is_crm_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and not public.is_crm_staff()
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

create or replace function public.crm_can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_crm_staff()
    or exists (
      select 1
      from public.crm_project_memberships pm
      where pm.project_id = p_project_id
        and pm.active
        and (
          pm.user_id = auth.uid()
          or pm.client_account_id in (select public.crm_client_account_ids())
        )
    )
    or exists (
      select 1
      from public.crm_projects p
      where p.id = p_project_id
        and p.client_visible
        and p.client_account_id in (select public.crm_client_account_ids())
    );
$$;

revoke all on function public.is_crm_client() from public;
revoke all on function public.crm_client_account_ids() from public;
revoke all on function public.crm_can_access_project(uuid) from public;
grant execute on function public.is_crm_client() to authenticated;
grant execute on function public.crm_client_account_ids() to authenticated;
grant execute on function public.crm_can_access_project(uuid) to authenticated;

-- Sanity:
-- select * from public.crm_client_accounts limit 0;
-- select public.is_crm_client();
