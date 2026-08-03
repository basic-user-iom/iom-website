# Secret rotation runbook — iobjectm.com

Rotate when a key may have leaked, a contractor leaves, or on a regular cadence (e.g. quarterly).  
**Do not rotate mid-demo.** Prefer a quiet window. Always update Vercel **before** revoking the old key at the vendor.

Production deploy after env changes: say **deploy the site** (runs `npm run deploy`).

## Inventory (Vercel Production)

| Secret | Used for | Blast radius if rotated wrong |
|--------|----------|-------------------------------|
| `CRM_MEDIA_GRANT_SECRET` | Opaque recording playback grants | Passworded share links until unlock again |
| `CRM_CRON_SECRET` / `CRON_SECRET` | Scheduled send cron auth | Cron 401 until redeployed with new value |
| `CRM_INBOUND_EMAIL_SECRET` | Non-Resend inbound webhook | Inbound mail 401 |
| `RESEND_WEBHOOK_SECRET` | Resend → CRM inbound (Svix) | Inbound Resend 401; **already set** |
| `RESEND_API_KEY` | Fetch received email bodies | Inbound ingest fails |
| `CRM_STAFF_EMAILS` | Optional staff allowlist | Staff locked out if list wrong |
| `PROTON_SMTP_*` | Outreach SMTP | Outbound CRM email fails |
| `R2_*` | Recording uploads | Recorder upload/playback fails |
| `ELEVENLABS_*` | Voice morph | Voice features 503 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Browser + API auth | Whole CRM/login breaks |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin paths | Cron, inbound, MFA reset, media unlock |

Preview must **not** reuse Production `SUPABASE_SERVICE_ROLE_KEY`. See `supabase/PREVIEW_APPLY_ORDER.md`.

## Safe order

1. **`CRM_MEDIA_GRANT_SECRET`** — generate a long random string → Vercel Production → redeploy. Old grant URLs stop working (expected).
2. **`CRM_CRON_SECRET` / `CRON_SECRET`** — set both to the same new value if both exist → redeploy. Confirm cron still hits `/api/crm-scheduled-send`.
3. **`CRM_INBOUND_EMAIL_SECRET`** — new value → update any external webhook that posts to `/api/crm-inbound-email` → redeploy.
4. **`RESEND_WEBHOOK_SECRET`** — Resend dashboard → webhook signing secret → Vercel → redeploy. Confirm inbound still works.
5. **`RESEND_API_KEY`** — Resend API keys → Vercel → redeploy.
6. **Proton SMTP passwords** — Proton account → app password → matching `PROTON_SMTP_*_PASS` / `PROTON_SMTP_PASS` → redeploy → send a test outreach.
7. **R2 keys** — Cloudflare R2 → new API token → update `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (Production + Preview if used) → redeploy → test recorder upload.
8. **ElevenLabs** — new key → Vercel → redeploy.
9. **`SUPABASE_SERVICE_ROLE_KEY` last** — Supabase → Settings → API → reveal service_role → copy to Vercel Production **only** → `npm run deploy` → then consider the old key compromised if it was leaked (Supabase does not always allow independent revoke; project-level key rotation / support if needed).
10. **Anon key / URL** — only if rotating the whole Supabase project or resetting API keys; update `VITE_SUPABASE_*` on Production and rebuild (Vite inlines these at build time).

## After each step

- [ ] Vercel env updated for the correct environment (Production vs Preview).
- [ ] Redeployed (`npm run deploy` for Production).
- [ ] Smoke: `npm run security:smoke`
- [ ] Manual: `/client-login` MFA login, one email send or inbound, one recording unlock if media grant rotated.

## Do not

- Put Production service role on Preview.
- Commit secrets into git or chat logs.
- Rotate service role and revoke the old value before Vercel has the new one live.
