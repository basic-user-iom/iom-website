# CRM email inbound setup (Proton + Resend + CRM)

Outbound CRM sends already appear in **Proton Sent**. This guide mirrors **client replies** into the CRM while keeping them in Proton Inbox.

```text
Client reply → Proton Inbox (kept)
            → Proton forward copy → Resend Receiving
            → webhook → /api/crm-resend-inbound → CRM Email conversation
                 ↘ (no / ambiguous match) → crm_inbound_unmatched (staff attach UI)
```

## Already done

- [x] `crm_lead_messages` table in Supabase
- [x] `CRM_INBOUND_EMAIL_SECRET` on Vercel
- [x] `SUPABASE_SERVICE_ROLE_KEY` on Vercel
- [x] Resend adapter code: `/api/crm-resend-inbound`

## Apply matching + unmatched queue migration

Run in Supabase → SQL Editor:

[`supabase/crm_inbound_email_match_migration.sql`](../supabase/crm_inbound_email_match_migration.sql)

This adds:

- `crm_find_leads_by_email(email)` — matches primary + department emails without a 500-row scan
- `crm_inbound_unmatched` — queue for unmatched / ambiguous senders (staff attach in CRM Leads)

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
3. Open `/client-login` → open the lead → **Email conversation** should show **Received** (panel soft-refreshes about every 45s; or reselect the lead).

If matching fails, the webhook returns **200** with `queued: true` and the message appears under **Unmatched inbound email** on the Leads view — attach it to the correct lead there. Older installs that only returned 404 need the migration above.

## Optional later: branded subdomain

When you want `crm@inbound.iobjectm.com` instead of `@….resend.app`:

1. In Resend: add domain `inbound.iobjectm.com` and enable **Receiving**
2. In Vercel DNS for `iobjectm.com`: add **only** the MX (and any other) records Resend shows for the **subdomain** `inbound` — do **not** change root `@` MX (those stay Proton)
3. Point Proton forward to `crm@inbound.iobjectm.com`

## Manual fallback

**Log client reply** on the lead’s Email conversation panel (also covered in CRM Help).

Staff Help (**Help** in `/client-login`) documents the live Proton → Resend → CRM flow.  
Public demo Help (`/crm-demo`) explains the simulated Copper Lantern thread.

## Matching rules

Inbound messages attach to a lead by:

1. `X-IOM-CRM-Lead` / explicit `leadId` (if present)
2. `In-Reply-To` / `References` matching a stored outbound `message_id`
3. Sender address matching the lead’s primary or department emails (`crm_find_leads_by_email`)

Ambiguous senders (same address on multiple leads) and unknown senders go to `crm_inbound_unmatched` instead of being discarded.

Webhook deliveries are deduped by `svix-id` (and email `message_id`).

## Scheduled outbound (Hobby-friendly)

Vercel Hobby only runs cron **once per day** (`0 8 * * *` → `/api/crm-scheduled-send`). For ~5‑minute precision without upgrading, this repo uses **GitHub Actions** (public repo, free):

- Workflow: [`.github/workflows/crm-scheduled-send.yml`](../.github/workflows/crm-scheduled-send.yml)
- Schedule: every 5 minutes + manual **Run workflow**
- Secret: GitHub `CRM_CRON_SECRET` = same value as Vercel `CRON_SECRET`

Also ensure Vercel `CRON_SECRET` and `CRM_CRON_SECRET` match (or only one is set). Staff **Ping now** and the daily Vercel cron remain as backups. After 5 failures a schedule shows **Schedule stopped** with a **Retry** action.
