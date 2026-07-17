-- IOM CRM: per-lead email correspondence (outbound + inbound mirror)
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS).
--
-- Outbound: written by /api/crm-send-email after Proton SMTP send.
-- Inbound: written by /api/crm-inbound-email from Proton keep-copy forwards.

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

create index if not exists crm_lead_messages_in_reply_to_idx
  on public.crm_lead_messages (in_reply_to)
  where in_reply_to is not null and in_reply_to <> '';

alter table public.crm_lead_messages enable row level security;

drop policy if exists "crm_lead_messages_auth_all" on public.crm_lead_messages;
create policy "crm_lead_messages_auth_all"
  on public.crm_lead_messages for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.crm_lead_messages to authenticated;

comment on table public.crm_lead_messages is
  'Email thread mirror for CRM leads (Proton remains the mailbox).';
