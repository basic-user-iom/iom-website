# CRM email inbound setup (Proton + CRM)

Outbound CRM sends already appear in **Proton Sent** (Proton SMTP). This guide mirrors **client replies** into the CRM while keeping them in Proton Inbox.

## 1. Database

In Supabase → SQL Editor, run:

[`supabase/crm_lead_messages_migration.sql`](../supabase/crm_lead_messages_migration.sql)

## 2. Vercel env vars

| Variable | Purpose |
| --- | --- |
| `CRM_INBOUND_EMAIL_SECRET` | Shared secret for `POST /api/crm-inbound-email` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (inbound ingest bypasses RLS) |

Redeploy after setting env vars.

## 3. Inbound catch address → webhook

Use any email→webhook path that can POST JSON to:

`https://iobjectm.com/api/crm-inbound-email`

Headers:

```http
Authorization: Bearer <CRM_INBOUND_EMAIL_SECRET>
Content-Type: application/json
```

JSON body example:

```json
{
  "from": "client@example.com",
  "to": "contact@iobjectm.com",
  "subject": "Re: …",
  "text": "Thanks for your email…",
  "html": null,
  "messageId": "<abc@example.com>",
  "inReplyTo": "<outbound@iobjectm.com>",
  "references": "<outbound@iobjectm.com>",
  "date": "2026-07-17T12:00:00.000Z",
  "headers": {}
}
```

Cloudflare Email Routing + Worker, or a similar inbound parser, works well.

## 4. Proton keep-copy forward

In Proton Mail (for `contact@`, `visual@`, `projects@` as needed):

1. Create a filter / auto-forward rule for incoming mail.
2. **Keep a copy in Inbox** (do not delete).
3. Forward a copy to your inbound catch address from step 3.

Result:

- Client replies stay in Proton.
- The same replies appear on the lead’s **Email conversation** panel in `/client-login`.

## 5. Matching

Inbound messages attach to a lead by:

1. `X-IOM-CRM-Lead` / explicit `leadId` (if present)
2. `In-Reply-To` / `References` matching a stored outbound `message_id`
3. Sender address matching the lead’s primary or department emails

## Manual fallback

Until auto-forward is live, use **Log client reply** on the lead’s Email conversation panel.
