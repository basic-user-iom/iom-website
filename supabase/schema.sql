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

-- Future: project organization linked to leads/clients
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
alter table public.crm_projects enable row level security;

-- Authenticated staff can manage ALL CRM rows (shared team tool — not owner-scoped).
-- Drop first so re-runs replace any older owner_id = auth.uid() policies.
-- For existing DBs, prefer supabase/crm_shared_access_migration.sql (drops all CRM policies).
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('crm_leads', 'crm_activities', 'crm_projects')
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

create policy "crm_leads_auth_all"
  on public.crm_leads for all
  to authenticated
  using (true)
  with check (true);

create policy "crm_activities_auth_all"
  on public.crm_activities for all
  to authenticated
  using (true)
  with check (true);

create policy "crm_projects_auth_all"
  on public.crm_projects for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.crm_leads to authenticated;
grant select, insert, update, delete on public.crm_activities to authenticated;
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

-- Each authenticated user may only write under their own uid folder
drop policy if exists "crm_user_avatars_auth_insert" on storage.objects;
create policy "crm_user_avatars_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_update" on storage.objects;
create policy "crm_user_avatars_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'crm-user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_delete" on storage.objects;
create policy "crm_user_avatars_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
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

drop policy if exists "crm_staff_profiles_select_auth" on public.crm_staff_profiles;
create policy "crm_staff_profiles_select_auth"
  on public.crm_staff_profiles for select
  to authenticated
  using (true);

drop policy if exists "crm_staff_profiles_insert_own" on public.crm_staff_profiles;
create policy "crm_staff_profiles_insert_own"
  on public.crm_staff_profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "crm_staff_profiles_update_own" on public.crm_staff_profiles;
create policy "crm_staff_profiles_update_own"
  on public.crm_staff_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, insert, update on public.crm_staff_profiles to authenticated;
