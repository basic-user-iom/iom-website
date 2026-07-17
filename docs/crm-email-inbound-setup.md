# CRM email inbound setup (Proton + Resend + CRM)

Outbound CRM sends already appear in **Proton Sent**. This guide mirrors **client replies** into the CRM while keeping them in Proton Inbox.

```text
Client reply → Proton Inbox (kept)
            → Proton forward copy → Resend Receiving
            → webhook → /api/crm-resend-inbound → CRM Email conversation
```

## Already done

- [x] `crm_lead_messages` table in Supabase
- [x] `CRM_INBOUND_EMAIL_SECRET` on Vercel
- [x] `SUPABASE_SERVICE_ROLE_KEY` on Vercel
- [x] Resend adapter code: `/api/crm-resend-inbound`

## A. Resend account (start here — no DNS yet)

1. Create/sign in at [https://resend.com](https://resend.com)
2. Open **Emails → Receiving** (or Domains → Receiving)
3. Copy your Resend receiving address — it looks like:  
   `something@xxxxx.resend.app`  
   (any local-part works, e.g. `crm@xxxxx.resend.app`)
4. Create an API key: **API Keys → Create** → copy `re_…`
5. Add webhook:
   - **Webhooks → Add Webhook**
   - URL: `https://iobjectm.com/api/crm-resend-inbound`
   - Event: **`email.received`**
   - After create, copy the **Signing secret** (`whsec_…`)

## B. Vercel env vars

Add (Production + Preview):

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | `re_…` |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` |

Then redeploy (`npm run deploy` or ask the agent).

## C. Proton keep-copy forward

In Proton Mail (paid plan with forwarding):

1. **Settings → All settings → Filters** (or **Forward and auto-reply**)
2. Add a filter / sieve that **forwards a copy** of incoming mail to your Resend address, e.g. `crm@xxxxx.resend.app`
3. Use **keep / `:copy`** so the message **stays in Proton Inbox**

Example Sieve (Filters → Add sieve filter):

```sieve
require ["copy"];
redirect :copy "crm@xxxxx.resend.app";
```

Apply for `contact@`, `visual@`, and/or `projects@` as needed.

## D. Test

1. From an external address, email a lead address that exists on a CRM lead (or reply to a CRM-sent thread).
2. Confirm the message is still in **Proton Inbox**.
3. Hard-refresh `/client-login` → open the lead → **Email conversation** should show **Received**.

If matching fails (404 in webhook logs), either:
- the sender email is not on the lead, or
- there is no prior outbound `message_id` to thread against — use **Log client reply** once, or send from CRM first.

## Optional later: branded subdomain

When you want `crm@inbound.iobjectm.com` instead of `@….resend.app`:

1. In Resend: add domain `inbound.iobjectm.com` and enable **Receiving**
2. In Vercel DNS for `iobjectm.com`: add **only** the MX (and any other) records Resend shows for the **subdomain** `inbound` — do **not** change root `@` MX (those stay Proton)
3. Point Proton forward to `crm@inbound.iobjectm.com`

## Manual fallback

Until Resend + Proton forward are live: **Log client reply** on the lead’s Email conversation panel.

## Matching rules

Inbound messages attach to a lead by:

1. `X-IOM-CRM-Lead` / explicit `leadId` (if present)
2. `In-Reply-To` / `References` matching a stored outbound `message_id`
3. Sender address matching the lead’s primary or department emails
