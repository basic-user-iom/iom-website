-- IOM CRM: department / labeled emails on crm_leads
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS).
--
-- Shape: [{ "label": "Sales", "email": "sales@example.com" }, ...]
-- Primary contact email stays in the existing `email` text column.

alter table public.crm_leads
  add column if not exists emails jsonb not null default '[]'::jsonb;

comment on column public.crm_leads.emails is
  'Extra labeled emails by department: [{"label":"Sales","email":"..."}]';
