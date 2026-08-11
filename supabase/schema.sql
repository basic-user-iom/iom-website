-- IOM Client CRM schema (Supabase / Postgres)
--
-- Apply (pick one):
--   A) Dashboard: https://supabase.com/dashboard/project/werfdsobddsijqckymip/sql/new
--      paste this entire file → Run
--   B) CLI (requires login): npx supabase login
--      npx supabase link --project-ref werfdsobddsijqckymip
--      npx supabase db query -f supabase/schema.sql --linked
--
-- After schema:
--   1. Authentication → Users → Add user (email + password)
--   2. Confirm local .env has VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
--   3. npm run dev → open /client-login → sign in with that Auth user
--   4. Staff profile photos use Storage bucket crm-user-avatars + auth user_metadata.avatar_url
--      (included below; no extra table required)
--
-- Note: CLI was not logged in when this header was written; use option A.

create extension if not exists "pgcrypto";

-- Leads / potential clients
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default '',
  website text not null default '',
  -- Extra named links beyond primary website: [{ "label": "...", "url": "https://..." }]
  links jsonb not null default '[]'::jsonb,
  contact_name text not null default '',
  email text not null default '',
  -- Extra labeled emails by department: [{ "label": "Sales", "email": "..." }]
  emails jsonb not null default '[]'::jsonb,
  phone text not null default '',
  offer text not null default '',
  notes text not null default '',
  -- Legacy unused column (harmless if present). App no longer reads/writes lead photos.
  photo_url text,
  temperature text not null default 'warm'
    check (temperature in ('hot', 'warm', 'cold')),
  status text not null default 'new'
    check (status in (
      'new', 'contacted', 'qualified', 'proposal',
      'negotiation', 'closed_won', 'closed_lost'
    )),
  next_follow_up date,
  estimated_value numeric,
  -- Optional emoticon for value (❤️ from the heart / pro-bono, 🎁 gift, etc.)
  value_emoji text not null default '',
  -- Freeform lead tags (suggested vocabulary in app; custom allowed)
  tags jsonb not null default '[]'::jsonb,
  -- Most recent inbound client email (null = no reply yet)
  last_client_reply_at timestamptz,
  -- Atlas Evaluation Principle scores (0–5, 0 = unset)
  atlas_eval jsonb not null default '{}'::jsonb,
  -- Client locale for staff: live local clock + weather (Open-Meteo)
  client_timezone text not null default '',
  client_city text not null default '',
  client_country text not null default '',
  client_lat double precision,
  client_lon double precision,
  owner_id uuid references auth.users (id) on delete set null,
  -- Snapshot at create/update so list UI can show who added + photo without Admin API
  owner_email text,
  owner_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Communication / activity log (Salesforce-style)
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  type text not null default 'note'
    check (type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null default '',
  body text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users (id) on delete set null
);

-- Email thread mirror (Proton remains the mailbox; CRM stores correspondence)
create table if not exists public.crm_lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  direction text not null
    check (direction in ('outbound', 'inbound')),
  from_email text not null default '',
  to_email text not null default '',
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  message_id text,
  in_reply_to text,
  references_header text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users (id) on delete set null,
  raw_headers jsonb not null default '{}'::jsonb
);

create index if not exists crm_lead_messages_lead_idx
  on public.crm_lead_messages (lead_id, occurred_at asc);

create unique index if not exists crm_lead_messages_message_id_uidx
  on public.crm_lead_messages (message_id)
  where message_id is not null and message_id <> '';

-- Projects (client_account_id / client_visible added below after client accounts)
create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads (id) on delete set null,
  name text not null default '',
  description text not null default '',
  status text not null default 'planned'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_status_idx on public.crm_leads (status);
create index if not exists crm_leads_temperature_idx on public.crm_leads (temperature);
create index if not exists crm_leads_updated_idx on public.crm_leads (updated_at desc);
create index if not exists crm_leads_owner_id_idx on public.crm_leads (owner_id);

-- Existing projects: ensure owner snapshot columns exist
alter table public.crm_leads add column if not exists owner_email text;
alter table public.crm_leads add column if not exists owner_avatar_url text;
create index if not exists crm_leads_owner_email_idx on public.crm_leads (owner_email);

-- Department emails + Atlas Evaluation (idempotent for existing DBs)
alter table public.crm_leads
  add column if not exists emails jsonb not null default '[]'::jsonb;
alter table public.crm_leads
  add column if not exists atlas_eval jsonb not null default '{}'::jsonb;
create index if not exists crm_activities_lead_idx on public.crm_activities (lead_id, occurred_at desc);
create index if not exists crm_projects_lead_idx on public.crm_projects (lead_id);

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_leads_updated_at on public.crm_leads;
create trigger crm_leads_updated_at
  before update on public.crm_leads
  for each row execute function public.crm_set_updated_at();

drop trigger if exists crm_projects_updated_at on public.crm_projects;
create trigger crm_projects_updated_at
  before update on public.crm_projects
  for each row execute function public.crm_set_updated_at();

alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_lead_messages enable row level security;
alter table public.crm_projects enable row level security;

-- Authenticated *staff* can manage ALL CRM rows (shared team tool — not owner-scoped).
-- Staff gate: public.is_crm_staff(). JWT-domain check here; full helper
-- (profiles OR @iobjectm.com) is defined after crm_staff_profiles below /
-- in security_hardening_staff_rls.sql for existing DBs.
create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@iobjectm.com';
$$;

revoke all on function public.is_crm_staff() from public;
grant execute on function public.is_crm_staff() to authenticated;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('crm_leads', 'crm_activities', 'crm_lead_messages', 'crm_projects')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

create policy "crm_leads_staff_all"
  on public.crm_leads for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

create policy "crm_activities_staff_all"
  on public.crm_activities for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

create policy "crm_lead_messages_staff_all"
  on public.crm_lead_messages for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

create policy "crm_projects_staff_all"
  on public.crm_projects for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

grant select, insert, update, delete on public.crm_leads to authenticated;
grant select, insert, update, delete on public.crm_activities to authenticated;
grant select, insert, update, delete on public.crm_lead_messages to authenticated;
grant select, insert, update, delete on public.crm_projects to authenticated;

-- ── Staff profile photos (safe to re-run) ──────────────────────────────────
-- Public Storage bucket for logged-in CRM user avatars.
-- URL is stored on the Auth user as user_metadata.avatar_url (no extra table).
-- Path convention: {auth.uid()}/avatar.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-user-avatars',
  'crm-user-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crm_user_avatars_public_read" on storage.objects;
create policy "crm_user_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'crm-user-avatars');

-- Staff may only write under their own uid folder
drop policy if exists "crm_user_avatars_auth_insert" on storage.objects;
create policy "crm_user_avatars_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_update" on storage.objects;
create policy "crm_user_avatars_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_delete" on storage.objects;
create policy "crm_user_avatars_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional: leave legacy crm_leads.photo_url column / crm-lead-photos bucket in place
-- if they already exist in production — the CRM UI no longer uses them.

-- ── Shared staff profiles (who-added display for all teammates) ─────────────
create table if not exists public.crm_staff_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create index if not exists crm_staff_profiles_email_idx
  on public.crm_staff_profiles (email);

alter table public.crm_staff_profiles enable row level security;

-- Full staff helper once the directory table exists (profiles OR @iobjectm.com).
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
      )
      or lower(coalesce(auth.jwt() ->> 'email', '')) like '%@iobjectm.com'
    );
$$;

revoke all on function public.is_crm_staff() from public;
grant execute on function public.is_crm_staff() to authenticated;

drop policy if exists "crm_staff_profiles_select_auth" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_insert_own" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_update_own" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_staff_select" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_staff_update_own" on public.crm_staff_profiles;

create policy "crm_staff_profiles_staff_select"
  on public.crm_staff_profiles for select
  to authenticated
  using (public.is_crm_staff());

create policy "crm_staff_profiles_staff_update_own"
  on public.crm_staff_profiles for update
  to authenticated
  using (public.is_crm_staff() and id = auth.uid())
  with check (public.is_crm_staff() and id = auth.uid());

-- New staff rows: service role / SQL Editor only
revoke insert on public.crm_staff_profiles from authenticated;
grant select, update on public.crm_staff_profiles to authenticated;

-- ── Client tenancy foundation (SEC-001 phase 2) ─────────────────────────────
-- Staff-only RLS for now. Helpers ready for future client-scoped policies.
-- Existing DBs: also run security_hardening_client_tenancy_foundation.sql

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

alter table public.crm_projects
  add column if not exists client_account_id uuid references public.crm_client_accounts (id) on delete set null,
  add column if not exists client_visible boolean not null default false;

create index if not exists crm_projects_client_account_idx
  on public.crm_projects (client_account_id);

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

-- ── Client-scoped SELECT (SEC-001 phase 3) ─────────────────────────────────
-- Existing DBs: also run security_hardening_client_scoped_rls.sql

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
  if not exists (select 1 from public.crm_client_accounts a where a.id = p_account_id) then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  select u.id into v_uid from auth.users u where lower(coalesce(u.email, '')) = v_email limit 1;
  if v_uid is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.crm_staff_profiles p where p.id = v_uid)
     or v_email like '%@iobjectm.com' then
    raise exception 'staff_cannot_be_client' using errcode = '22023';
  end if;
  insert into public.crm_client_memberships (client_account_id, user_id, active)
  values (p_account_id, v_uid, true)
  on conflict (client_account_id, user_id) do update set active = true
  returning id into v_mid;
  return v_mid;
end;
$$;

revoke all on function public.crm_add_client_member(uuid, text) from public;
revoke all on function public.crm_add_client_member(uuid, text) from anon;
grant execute on function public.crm_add_client_member(uuid, text) to authenticated;

drop policy if exists "crm_client_accounts_client_select" on public.crm_client_accounts;
create policy "crm_client_accounts_client_select"
  on public.crm_client_accounts for select
  to authenticated
  using (public.is_crm_client() and id in (select public.crm_client_account_ids()));

drop policy if exists "crm_client_memberships_client_select" on public.crm_client_memberships;
create policy "crm_client_memberships_client_select"
  on public.crm_client_memberships for select
  to authenticated
  using (public.is_crm_client() and user_id = auth.uid());

drop policy if exists "crm_projects_client_select" on public.crm_projects;
create policy "crm_projects_client_select"
  on public.crm_projects for select
  to authenticated
  using (public.is_crm_client() and public.crm_can_access_project(id));
