-- IOM CRM: scheduled initial outreach send on crm_leads
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS).
--
-- Shape (jsonb, null = not scheduled):
-- {
--   "at": "2026-07-23T09:00:00.000Z",
--   "to": "client@example.com",
--   "from": "contact",
--   "error": "",
--   "attempts": 0
-- }
--
-- Cron: GET/POST /api/crm-scheduled-send (Vercel cron + CRM_CRON_SECRET)
-- sends due drafts via Proton, notifies staff on failure.

alter table public.crm_leads
  add column if not exists scheduled_send jsonb;

comment on column public.crm_leads.scheduled_send is
  'Armed initial outreach auto-send: {at,to,from,error,attempts} or null';

create index if not exists crm_leads_scheduled_send_at_idx
  on public.crm_leads ((scheduled_send->>'at'))
  where scheduled_send is not null;
