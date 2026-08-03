# IOM Security Recheck — Cursor Remediation Brief

Date: 2026-08-03  
Repository: `F:\iom_website`  
Production: https://iobjectm.com  
Primary protected route: `/client-login`

## Instructions for Cursor

This report is the current security addendum after the latest hardening commits. Read the relevant implementation and migration files completely before changing anything.

Do not deploy automatically. Do not modify unrelated design or behavior. Use small reviewable changes, preserve the existing dirty worktree, add regression tests, run type checking and applicable tests, and report every changed file.

## Current result

- Critical findings: 0 confirmed
- High findings: 2
- Medium findings: 1
- Runtime dependency vulnerabilities: 0
- TypeScript validation: PASS

Overall result:

**Reasonable security controls are now present, but client authorization is not complete until the two High findings below are fixed and verified with dedicated accounts.**

## SEC-R1 — Inactive client accounts retain access

- Severity: High
- Confidence: Confirmed
- Category: Authorization and account revocation

Affected file:

- `supabase/security_hardening_client_tenancy_foundation.sql`

Affected functions:

- `public.is_crm_client()`
- `public.crm_client_account_ids()`
- Indirectly `public.crm_can_access_project(uuid)`

### Evidence

The functions check `crm_client_memberships.active`, but they do not join `crm_client_accounts` or require the client account itself to be active.

The CRM UI lets staff deactivate a client account. That operation currently does not revoke client access while the associated user membership remains active.

### Required behavior

A client may have access only when:

- The user is authenticated.
- The client membership is active.
- The associated client account is active.
- The project is assigned and visible, or an intentional active project membership exists.
- The requested related resource is explicitly client-visible when required.

### Required implementation

Update `is_crm_client()` and `crm_client_account_ids()` so they join `crm_client_accounts` and require both:

```sql
m.active
and a.active
```

The account-ID helper should follow this pattern:

```sql
select m.client_account_id
from public.crm_client_memberships m
join public.crm_client_accounts a
  on a.id = m.client_account_id
where m.user_id = auth.uid()
  and m.active
  and a.active;
```

Ensure every client RLS policy and authorization helper depends on the corrected account helper. Do not rely on the frontend to enforce deactivation.

### Required regression tests

1. Client A has an active account, active membership, and visible project: access allowed.
2. Set the client account to inactive while membership remains active: all access denied.
3. Reactivate the account: access restored.
4. Inactivate only the membership: all access denied.
5. Verify revocation for projects, notes, tasks, board columns, recordings, Storage, signed URLs, RPCs, and Realtime.

## SEC-R2 — Sharing a project exposes every board task

- Severity: High
- Confidence: Confirmed
- Category: Client information disclosure

Affected file:

- `supabase/security_hardening_client_board_read.sql`

Affected resources:

- `public.crm_tasks`
- `public.crm_board_columns`

### Evidence

The client task policy currently requires only:

```sql
public.is_crm_client()
and public.crm_can_access_project(project_id)
```

The table has a `client_visible` field, but the policy does not check it. Once a project is shared, a client can directly query every task in that project, including internal titles and descriptions.

This conflicts with the intended rule that staff deliberately decide which project information is accessible to clients.

### Required behavior

New tasks must remain staff-only by default. A client may read a task only when:

```sql
public.is_crm_client()
and public.crm_can_access_project(project_id)
and client_visible = true
```

Staff must be able to mark individual tasks client-visible or staff-only.

### Board-column decision

Implement one consistent model:

1. Require `client_visible = true` for board columns; or
2. Return only columns containing at least one client-visible task.

Do not reveal staff-only tasks through counts, ordering, empty columns, IDs, error behavior, or Realtime events.

### Required application changes

Add staff UI controls to mark tasks visible or hidden for clients. The UI is only a management surface; Supabase RLS must be the security boundary.

### Required regression tests

1. Client can read a visible task on an assigned project.
2. Client cannot read a staff-only task on the same project.
3. Client cannot read any task belonging to another client.
4. Changing `client_visible` to false removes access immediately.
5. Direct PostgREST requests cannot bypass the UI.
6. Realtime subscriptions reveal only visible tasks.
7. Counts and board columns do not reveal hidden task existence.

## SEC-R3 — MFA “set up again” recovery is likely nonfunctional

- Severity: Medium
- Confidence: High
- Category: Authentication recovery availability

Affected files:

- `api/crm-mfa-reset.js`
- `api/_lib/blog-helpers.js`
- `src/crm/crmMfa.ts`
- `src/crm/CrmLogin.tsx`

### Evidence

`crm-mfa-reset.js` calls:

```js
requireStaffUser(req, { requireMfa: false })
```

However, `requireStaffUser()` still queries the deployed `is_crm_staff()` RPC. That RPC now requires `aal2`.

A user at the MFA challenge has only `aal1`, so the reset endpoint should return 403 before factors are removed.

This closes the earlier MFA bypass, but makes the password-only self-service reset workflow ineffective.

### Security requirement

Do not restore password-only MFA deletion. A stolen password must not let an attacker remove the second factor and enroll a replacement.

### Recommended recovery models

Implement one of:

- Administrator-approved MFA reset.
- One-time recovery codes generated during enrollment.
- Independently verified recovery/support workflow.
- Factor replacement from a recent `aal2` session.

Routine factor removal and replacement should require `aal2`.

### Required regression tests

1. Password-only `aal1` session cannot delete verified factors.
2. Client accounts cannot call the reset endpoint.
3. Inactive staff cannot call it.
4. Active staff at `aal2` can perform an authorized routine factor change.
5. Recovery invalidates older sessions.
6. Recovery is rate-limited and audit-logged.

## Controls verified as improved

The following controls passed static or passive verification:

- CRM staff RLS requires JWT `aal2`.
- Administrator operations require an active admin row and `aal2`.
- Staff profiles include `active` and `staff_role`.
- Staff cannot self-promote or reactivate themselves.
- Recorder, R2, and ElevenLabs APIs require MFA-authenticated staff.
- CRM email and scheduled-send APIs require MFA-authenticated staff.
- Artist Globe administration requires MFA-authenticated staff.
- Privileged rate limits fail closed when durable limiting is unavailable.
- Resend webhook ingestion fails closed without a signing secret.
- Artist Globe invitation rows are not anonymously readable.
- Recording passwords are not placed in media URLs.
- CSP is enforced in production.
- HSTS, MIME protection, referrer policy, permissions policy, and frame policy are present.
- `/client-login` and API routes use `private, no-store` headers.
- Invalid bearer tokens return HTTP 401.
- Unapproved CORS origins are not reflected.
- Anonymous CRM and client-account queries return no rows.
- Anonymous staff, admin, and client helper calls return false.
- Runtime npm audit reports zero known vulnerabilities.
- TypeScript validation passes.
- No privileged tracked secret value was found.

## Required staging authorization matrix

Create dedicated non-production identities:

- Anonymous
- Client A
- Client B
- Staff at `aal1`
- Staff at `aal2`
- Administrator
- Inactive client account
- Inactive client membership
- Inactive staff account

Test direct PostgREST, RPC, Storage, R2, Vercel API, and Realtime requests.

| Action | Anonymous | Client A | Client B | Staff AAL1 | Staff AAL2 | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Read Client A project | Deny | Allow | Deny | Deny | Allow | Allow |
| Read Client A visible note | Deny | Allow | Deny | Deny | Allow | Allow |
| Read Client A hidden note | Deny | Deny | Deny | Deny | Allow | Allow |
| Read Client A visible task | Deny | Allow | Deny | Deny | Allow | Allow |
| Read Client A hidden task | Deny | Deny | Deny | Deny | Allow | Allow |
| Read another client's file | Deny | Deny | Deny | Deny | Allow | Allow |
| Generate another client's signed URL | Deny | Deny | Deny | Deny | Allow | Allow |
| Send CRM email | Deny | Deny | Deny | Deny | Allow | Allow |
| Use ElevenLabs/R2 staff APIs | Deny | Deny | Deny | Deny | Allow | Allow |
| Change client visibility | Deny | Deny | Deny | Deny | Allow if permitted | Allow |
| Change staff role | Deny | Deny | Deny | Deny | Deny unless admin | Allow |

Also test expired, malformed, missing, and disabled-user JWTs.

## Completion criteria

Security work should not be considered complete until:

1. Inactive client accounts reliably lose access.
2. Staff-only board tasks cannot be read by clients.
3. MFA recovery is secure and functional without password-only factor deletion.
4. The staging role matrix passes using direct requests rather than only UI tests.
5. Realtime and Storage isolation are verified.
6. Production migration status confirms every hardening migration is applied.
7. No application or API fallback weakens authorization when a migration or service is unavailable.

After implementing approved fixes:

- Show every changed file.
- Explain every security-relevant policy and endpoint change.
- Add or update regression tests.
- Run type checking and applicable tests.
- Do not deploy without explicit approval.
