-- IOM CRM: lead tags + last client reply timestamp
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS / idempotent UPDATEs).
--
-- tags: jsonb string array (custom + suggested vocabulary)
-- last_client_reply_at: latest inbound email on this lead (null = no client reply yet)

alter table public.crm_leads
  add column if not exists tags jsonb not null default '[]'::jsonb;

alter table public.crm_leads
  add column if not exists last_client_reply_at timestamptz null;

comment on column public.crm_leads.tags is
  'Freeform lead tags (jsonb string[]); suggested vocabulary in app leadTags.ts';

comment on column public.crm_leads.last_client_reply_at is
  'Most recent inbound client email (crm_lead_messages.direction = inbound)';

-- Backfill last reply from message thread
update public.crm_leads l
set last_client_reply_at = sub.latest
from (
  select lead_id, max(occurred_at) as latest
  from public.crm_lead_messages
  where direction = 'inbound'
  group by lead_id
) sub
where l.id = sub.lead_id
  and (l.last_client_reply_at is distinct from sub.latest);

-- Logical starter tags for researched import companies (only when tags still empty)
update public.crm_leads
set tags = '["immersive","ar-vr","agency","partnership","netherlands","eu","high-priority"]'::jsonb
where company_name ilike '%Capitola%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","heritage","education","interactive","netherlands","eu","high-priority"]'::jsonb
where company_name ilike '%YIPP%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","museum","brand","exhibition","netherlands","eu"]'::jsonb
where company_name ilike '%Studio Louter%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","science-center","interactive","netherlands","eu"]'::jsonb
where company_name ilike '%Wonderment%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","installation","museum","netherlands","eu"]'::jsonb
where company_name ilike '%Kiss the Frog%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","museum","installation","netherlands","eu"]'::jsonb
where company_name ilike '%DROPSTUFF%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","ar-vr","germany","eu"]'::jsonb
where company_name ilike '%INVR%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["interactive","creative-coding","realtime","belgium","eu"]'::jsonb
where company_name ilike '%Ocular%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["creative-coding","realtime","installation","netherlands","eu"]'::jsonb
where company_name ilike '%RNDR%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","exhibition","interactive","usa"]'::jsonb
where company_name ilike '%Bluecadet%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","interactive","multitouch","usa"]'::jsonb
where company_name ilike '%Ideum%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","ar-vr","interactive","usa"]'::jsonb
where company_name ilike '%Cortina%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","exhibition","brand","usa"]'::jsonb
where company_name ilike '%Local Projects%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","exhibition","interactive","usa"]'::jsonb
where company_name ilike '%Unified Field%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["museum","exhibition","usa"]'::jsonb
where company_name ilike '%RLMG%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["interactive","museum","usa"]'::jsonb
where company_name ilike '%Trivium%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["brand","immersive","usa"]'::jsonb
where company_name ilike '%Luci%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["brand","agency","usa"]'::jsonb
where company_name ilike '%Hyperquake%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["exhibition","brand","usa"]'::jsonb
where (company_name ilike '%c&g%' or company_name ilike '%C&G%')
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","brand","installation","usa"]'::jsonb
where company_name ilike '%Hush%'
  and company_name not ilike '%Harbor%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["entertainment","immersive","usa"]'::jsonb
where company_name ilike '%BRC%'
  and (tags is null or tags = '[]'::jsonb);

update public.crm_leads
set tags = '["immersive","interactive","netherlands","eu"]'::jsonb
where company_name ilike '%ArtiShock%'
  and (tags is null or tags = '[]'::jsonb);
