-- IOM CRM: durable contact-priority queue on crm_leads
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS).
--
-- Priority stays until cleared manually or when initial outreach is marked sent.
-- (Unlike a follow-up date, this does not expire at midnight.)

alter table public.crm_leads
  add column if not exists contact_priority boolean not null default false;

comment on column public.crm_leads.contact_priority is
  'Queued for priority outreach; stays until cleared or marked sent';
