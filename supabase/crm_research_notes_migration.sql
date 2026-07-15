-- Research notes for CRM (artist lists, market research, follow-up ideas)
-- Run in Supabase → SQL Editor, then hard-refresh /client-login

create table if not exists public.crm_research_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  lead_id uuid references public.crm_leads(id) on delete set null,
  project_id uuid references public.crm_projects(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_research_notes_updated_at_idx
  on public.crm_research_notes (updated_at desc);

alter table public.crm_research_notes enable row level security;

drop policy if exists crm_research_notes_authenticated_all on public.crm_research_notes;
create policy crm_research_notes_authenticated_all
  on public.crm_research_notes
  for all
  to authenticated
  using (true)
  with check (true);
