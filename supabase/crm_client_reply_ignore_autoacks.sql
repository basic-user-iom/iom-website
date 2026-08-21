-- IOM CRM: recalculate last_client_reply_at ignoring auto-acks / OOO / tickets
-- Paste into Supabase → SQL Editor → Run, then hard-refresh CRM.
-- Safe to re-run.
--
-- Keeps inbound messages on the thread; only changes the “Client replied” stamp.

update public.crm_leads l
set last_client_reply_at = sub.latest
from (
  select
    m.lead_id,
    max(m.occurred_at) filter (
      where not (
        lower(coalesce(m.from_email, '')) ~ '(^|[@+._-])(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|notifications)([+._-]|@|$)'
        or lower(coalesce(m.from_email, '')) like '%+noreply@%'
        or lower(coalesce(m.from_email, '')) like '%+canned.response@%'
        or lower(coalesce(m.from_email, '')) like '%zendesk%'
        or lower(coalesce(m.from_email, '')) like '%freshdesk%'
        or lower(coalesce(m.from_email, '')) like '%calendly.com%'
        or lower(coalesce(m.subject, '')) ~ '(out of office|automatic reply|auto[- ]?reply|auto[- ]?response|automatic response|vacation|ticket received|request received|we received your|thank you for (your )?(email|application|contacting)|thanks for (reaching out|getting in touch)|we(''| will) get back to you|this is an automated|canned response|summer (holiday|closure)|on leave|on holiday|away from)'
        or lower(left(coalesce(m.body_text, ''), 800)) ~ '(please reply above this line|type your reply above this line|this is an automatic email|this is an automated response|your request \([0-9]+\) has been received|we have received your (email|message|request)|we(''| will) (personally )?get back to you as soon as|our team will (review|respond|get back)|ticket[- ]?(id|nummer|number))'
      )
    ) as latest
  from public.crm_lead_messages m
  where m.direction = 'inbound'
  group by m.lead_id
) sub
where l.id = sub.lead_id
  and (l.last_client_reply_at is distinct from sub.latest);

-- Also clear stamps on leads whose only inbound mail was auto-ack (sub.latest null)
update public.crm_leads l
set last_client_reply_at = null
where l.last_client_reply_at is not null
  and exists (
    select 1 from public.crm_lead_messages m
    where m.lead_id = l.id and m.direction = 'inbound'
  )
  and not exists (
    select 1 from public.crm_lead_messages m
    where m.lead_id = l.id
      and m.direction = 'inbound'
      and not (
        lower(coalesce(m.from_email, '')) ~ '(^|[@+._-])(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|notifications)([+._-]|@|$)'
        or lower(coalesce(m.from_email, '')) like '%+noreply@%'
        or lower(coalesce(m.from_email, '')) like '%+canned.response@%'
        or lower(coalesce(m.from_email, '')) like '%zendesk%'
        or lower(coalesce(m.from_email, '')) like '%freshdesk%'
        or lower(coalesce(m.from_email, '')) like '%calendly.com%'
        or lower(coalesce(m.subject, '')) ~ '(out of office|automatic reply|auto[- ]?reply|auto[- ]?response|automatic response|vacation|ticket received|request received|we received your|thank you for (your )?(email|application|contacting)|thanks for (reaching out|getting in touch)|we(''| will) get back to you|this is an automated|canned response|summer (holiday|closure)|on leave|on holiday|away from)'
        or lower(left(coalesce(m.body_text, ''), 800)) ~ '(please reply above this line|type your reply above this line|this is an automatic email|this is an automated response|your request \([0-9]+\) has been received|we have received your (email|message|request)|we(''| will) (personally )?get back to you as soon as|our team will (review|respond|get back)|ticket[- ]?(id|nummer|number))'
      )
  );
