# Preview Supabase project setup

Vercel **Preview** deployments must use a **separate** Supabase project so CRM experiments never write to production.

Production stays on the live `basic-user-iom` (clients) project. Do **not** copy Production `SUPABASE_SERVICE_ROLE_KEY` into Preview.

## 1) Create the project (you)

1. Supabase → New project → name e.g. `iom-website-preview`.
2. Auth → Providers: Email on; **disable** public signups if that matches production.
3. Auth → Multi-Factor: enable TOTP (same as production).
4. Copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**Preview only**)

## 2) Apply SQL (SQL Editor, in order)

Run these files from this repo against the **preview** database:

1. Core CRM schema if the project is empty — start from your baseline (`supabase/schema.sql` and any CRM migrations you already use in prod), **or** restore a scrubbed dump. Preview needs the same tables as production CRM.
2. `security_hardening_rate_limits.sql`
3. `security_hardening_artist_invites.sql`
4. `security_hardening_staff_rls.sql`
5. `security_hardening_client_tenancy_foundation.sql`
6. `security_hardening_client_scoped_rls.sql`
7. `security_hardening_client_board_read.sql`
8. `security_hardening_analytics_and_members.sql`
9. `security_hardening_staff_roles.sql`
10. `security_hardening_staff_aal2.sql`
11. `security_hardening_verify_status.sql` — all checks should be `ok = true` after seeding an admin.

Bootstrap an admin (replace UUID/email from Auth → Users after you create a test staff user):

```sql
insert into public.crm_staff_profiles (id, email, display_name, staff_role, active)
select u.id, u.email, 'Preview Admin', 'admin', true
from auth.users u
where u.email = 'projects@iobjectm.com'
on conflict (id) do update
set staff_role = 'admin', active = true, email = excluded.email;
```

## 3) Wire Vercel Preview env

In Vercel → Project → Settings → Environment Variables, set **for Preview only** (not Production):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Preview project URL |
| `VITE_SUPABASE_ANON_KEY` | Preview anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview service_role |

Optional Preview copies (safe if non-prod): `R2_*` already may target the same bucket — prefer a separate preview bucket if you upload test recordings.

Redeploy a Preview deployment after saving env vars (Vite inlines `VITE_*` at build time).

## 4) Confirm isolation

- Production `/client-login` still uses Production Supabase.
- A Preview deployment URL login must show only preview data / empty CRM.
- `npx vercel env ls` — Production and Preview Supabase values must differ.

## Hand-off to agent

After the preview project exists, paste (in chat, once) or set yourself:

- Preview `VITE_SUPABASE_URL`
- Preview `VITE_SUPABASE_ANON_KEY`
- Preview `SUPABASE_SERVICE_ROLE_KEY`

Then ask to **wire Preview env on Vercel** (agent will use `vercel env add` for Preview only).
