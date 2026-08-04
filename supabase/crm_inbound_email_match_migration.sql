-- IOM CRM: inbound email matching + unmatched queue
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run.
--
-- 1) RPC: find leads by primary email OR emails[].email (no 500-row scan)
-- 2) crm_inbound_unmatched: staff-recoverable queue for unmatched/ambiguous replies

-- ── Match RPC ──────────────────────────────────────────────────────────────
create or replace function public.crm_find_leads_by_email(p_email text)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct l.id
  from public.crm_leads l
  where lower(trim(coalesce(p_email, ''))) <> ''
    and (
      lower(trim(coalesce(l.email, ''))) = lower(trim(p_email))
      or exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(coalesce(l.emails, '[]'::jsonb)) = 'array'
              then coalesce(l.emails, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) as e
        where lower(trim(coalesce(e->>'email', ''))) = lower(trim(p_email))
      )
    );
$$;

revoke all on function public.crm_find_leads_by_email(text) from public;
grant execute on function public.crm_find_leads_by_email(text) to service_role;
grant execute on function public.crm_find_leads_by_email(text) to authenticated;

comment on function public.crm_find_leads_by_email(text) is
  'Return all crm_leads ids whose primary email or emails[].email matches (case-insensitive).';

-- ── Unmatched inbound queue ────────────────────────────────────────────────
create table if not exists public.crm_inbound_unmatched (
  id uuid primary key default gen_random_uuid(),
  from_email text not null default '',
  to_email text not null default '',
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  message_id text,
  in_reply_to text,
  references_header text,
  occurred_at timestamptz not null default now(),
  failure_code text not null default 'lead_not_found',
  resend_email_id text,
  svix_id text,
  candidate_lead_ids uuid[] not null default '{}',
  raw_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_lead_id uuid references public.crm_leads (id) on delete set null
);

create unique index if not exists crm_inbound_unmatched_svix_uidx
  on public.crm_inbound_unmatched (svix_id)
  where svix_id is not null and svix_id <> '';

create unique index if not exists crm_inbound_unmatched_message_id_uidx
  on public.crm_inbound_unmatched (message_id)
  where message_id is not null and message_id <> '' and resolved_at is null;

create index if not exists crm_inbound_unmatched_open_idx
  on public.crm_inbound_unmatched (created_at desc)
  where resolved_at is null;

alter table public.crm_inbound_unmatched enable row level security;

drop policy if exists "crm_inbound_unmatched_staff_all" on public.crm_inbound_unmatched;
create policy "crm_inbound_unmatched_staff_all"
  on public.crm_inbound_unmatched for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

grant select, insert, update, delete on public.crm_inbound_unmatched to authenticated;
grant all on public.crm_inbound_unmatched to service_role;

comment on table public.crm_inbound_unmatched is
  'Inbound emails that could not be matched (or matched ambiguously) to a CRM lead.';

-- Optional: index svix delivery id on stored messages for webhook idempotency
create index if not exists crm_lead_messages_svix_id_idx
  on public.crm_lead_messages ((raw_headers->>'svixId'))
  where (raw_headers->>'svixId') is not null
    and (raw_headers->>'svixId') <> '';
