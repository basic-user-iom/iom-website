# IOM Website Security Audit and Authorization Design

Date: 2026-08-02 (remediation update 2026-08-03)  
Production: https://iobjectm.com  
Highest-priority route: `/client-login`  
Status: Priority remediations applied (staff MFA/aal2 on privileged APIs, durable rate limits, staff roles + admin bootstrap, client tenancy SQL, CSP enforced, recorder hardened, inbound webhook fail-closed, `npm run security:smoke` + `security_hardening_verify_status.sql` green). Residual: JWT aal in RLS, secret rotation, preview/prod DB split.

## 1. Scope and limitations

This authorized review covered the first-party Vite/React application, Vercel Functions, Supabase SQL and RLS definitions, authentication/session code, CRM data access, Storage and R2 handling, email endpoints, invitations, analytics, environment handling, deployment configuration, dependencies, and Git secret indicators.

Validation performed:

- Static source and data-flow review.
- `npx tsc -b --noEmit`: passed.
- `npm audit --omit=dev`: zero known runtime advisories.
- Passive production HTTPS, header, cache, and invalid-token checks.
- An invalid bearer token was rejected by production with HTTP 401.
- No production accounts, client records, or files were accessed.

Not available:

- Supabase dashboard access or a deployed schema/policy dump.
- Supabase Auth signup, MFA, redirect, CAPTCHA, rate-limit, JWT, and email settings.
- Storage dashboard and Realtime publication configuration.
- Vercel environment scopes, build logs, and preview/production separation.
- Staging and dedicated Client A, Client B, staff, and administrator accounts.
- Evidence establishing which repository migrations have actually been applied.

Therefore deployed cross-account authorization remains:

`NOT VERIFIED — REQUIRED EVIDENCE MISSING`

The repository was already dirty before the audit. Those pre-existing changes were not modified.

## 2. Current architecture and data flow

- React 19 single-page application built with Vite 6 and TypeScript.
- Hosted by Vercel, with serverless endpoints under `api/`.
- Supabase provides Auth, PostgREST/database access, Storage, and SQL RPC.
- Cloudflare R2 stores recordings when configured.
- Other integrations include Proton SMTP, Resend, ElevenLabs, Web3Forms, Open-Meteo, and site analytics.
- `/client-login` uses browser-side Supabase authentication.
- The browser calls Supabase directly with the publishable key and the signed-in user's JWT.
- Sensitive Vercel endpoints generally validate the bearer token through Supabase `/auth/v1/user`.
- The SPA route guard controls what is displayed, but database confidentiality depends on RLS and endpoint authorization.

### Current authentication/session flow

1. `/client-login` loads the public SPA shell.
2. `CrmApp` calls `supabase.auth.getUser()` in the browser.
3. Unauthenticated users see the login form.
4. Login uses `signInWithPassword`.
5. Supabase JS persists and refreshes the session in browser storage.
6. CRM modules query Supabase directly.
7. Logout calls `supabase.auth.signOut()`.

There is no server-rendered protected layout or middleware. This is acceptable only if every database, Storage, RPC, Realtime, and Vercel endpoint independently enforces authorization.

## 3. Planned authorization model

The application is intended to support two user populations.

### 3.1 Staff users

Staff is a small shared team of two or more trusted users.

Staff requirements:

- Access all leads and all CRM sections.
- Access all projects, ideas, notes, communications, demos, recordings, links, blog administration, and other internal tools appropriate to their role.
- Create and manage client accounts and project assignments.
- Decide which project-related resources are visible to clients.
- Administrators can manage staff membership, roles, permissions, and client access.

Staff roles should initially be:

- `staff`: normal shared CRM access.
- `admin`: staff access plus user, role, membership, invitation, and visibility management.

Role assignments must be stored in protected database tables and changed only through administrator-authorized server operations. Editable Auth `user_metadata` must never be trusted for authorization.

### 3.2 Client users

Clients must only access data deliberately assigned or exposed to them.

A client may access:

- Projects to which the client has an active membership.
- Communications associated with those projects and marked client-visible.
- Notes associated with those projects or the client and marked client-visible.
- Ideas associated with those projects and marked client-visible.
- Demos associated with those projects and marked client-visible.
- Other future project resources only when both project membership and explicit visibility permit access.

A client must never access:

- Leads generally, lead prospecting data, or unrelated client records.
- Another client's projects, notes, communications, ideas, demos, files, or recordings.
- Staff-only notes, internal communication, drafts, cost information, CRM activity, or administrative metadata.
- Staff/admin functions, role assignments, membership management, exports, email sending, scheduled outreach, analytics administration, blog administration, or moderation functions.

### 3.3 Visibility rules

Project assignment and record visibility are separate decisions.

- Project membership establishes the maximum scope a client can enter.
- A resource must also be explicitly marked client-visible.
- New notes, ideas, communications, demos, files, and recordings default to staff-only.
- Staff can deliberately publish a resource to clients.
- Removing project membership immediately removes access to every related resource.
- Changing a resource back to staff-only immediately removes client access.
- Deactivating a user or membership immediately denies access even if a JWT still contains stale descriptive claims.

Recommended rule:

```text
client may access resource
  only if user is active
  and client membership is active
  and membership covers the resource's project
  and resource.client_visible = true
```

### 3.4 Recommended database entities

The exact migration should follow the existing production schema, but the authorization model should include equivalents of:

- `profiles`
  - `user_id`
  - `account_type`: `staff` or `client`
  - `staff_role`: `staff` or `admin`, nullable for clients
  - `active`
- `client_accounts` or `organizations`
  - represents the client/company boundary
- `client_memberships`
  - `user_id`
  - `client_account_id`
  - `active`
- `projects`
  - `client_account_id`
  - internal ownership and lifecycle fields
- `project_memberships`
  - optional when not every member of a client organization should see every project
  - `user_id` or `client_account_id`
  - `project_id`
  - `active`
- Project-related resources such as `project_notes`, `project_ideas`, `project_communications`, `project_demos`, and project files
  - `project_id`
  - `client_visible boolean not null default false`
  - creator and audit fields

If a note is related directly to a client but not to a project, it still needs an immutable `client_account_id` and `client_visible = true`. Prefer project relationships where possible to avoid parallel authorization paths.

### 3.5 Required RLS behavior

RLS must enforce authorization independently of the UI.

- Anonymous users: no access to private CRM/client tables.
- Active staff: shared access to internal CRM resources.
- Active admin: staff access plus protected administrative operations.
- Active client: select only assigned projects and explicitly client-visible related resources.
- Clients should not directly insert/update/delete internal resources unless a specific future workflow intentionally permits it.
- Client-supplied `user_id`, `client_account_id`, `project_id`, ownership, role, or visibility values must not establish authorization.
- Inserts and updates require both correct `USING` and `WITH CHECK` conditions.
- Security-definer helpers require a fixed `search_path`, minimal grants, and internal authorization.
- Views, RPCs, Storage, and Realtime must preserve the same rules.

## 4. Executive summary

Assurance level: **Low for a client-facing multi-tenant portal; moderate for a staff-only internal CRM if Supabase public signup is disabled and every account is trusted staff.**

Findings:

- Critical: 1
- High: 3
- Medium: 5
- Low: 3
- Informational: 2

The central issue is architectural: the checked-in schema grants virtually every Supabase `authenticated` account broad CRM and administrative data access. There is no current client organization, membership, staff role, administrator role, disabled-membership, or tenant-isolation model.

Consequences:

- Repository policies appear to deny anonymous CRM table access.
- One authenticated account can access all other CRM users' leads, projects, messages, notes, blog administration, and analytics.
- If public Supabase signup is enabled, a newly created account may immediately receive privileged access.
- The current design cannot safely be issued to ordinary clients.

`/client-login` may remain reachable as a staff-only login only if public signup is confirmed disabled, all existing accounts are trusted staff, and clients are not issued accounts until tenant-aware RLS is deployed and tested.

Final audit result: **High-risk issues require remediation.**

## 5. Detailed findings

### SEC-001 — Every authenticated account receives CRM-wide access

- Severity: Critical
- Confidence: Confirmed
- Category: Broken object/function authorization and tenant isolation
- Evidence:
  - `supabase/schema.sql:155-210`
  - `supabase/crm_research_notes_migration.sql:18-26`
  - `supabase/crm_useful_links_migration.sql:22-30`
  - `supabase/blog_migration.sql:143-172`
  - `supabase/site_analytics_migration.sql:37-56`
- Affected resources: leads, activities, messages, projects, notes, links, blog administration, audience records, and analytics.
- Attack path: obtain any valid Supabase account, use its JWT directly with PostgREST, enumerate all rows, and update or delete arbitrary records.
- Impact: full CRM confidentiality, integrity, and availability loss.
- Remediation: implement the planned profiles, client organizations, memberships, roles, project assignments, client visibility, and tenant-aware RLS.
- Regression test: Client A receives no rows and cannot update/delete when directly requesting Client B resources.

### SEC-002 — Artist invitation tokens and recipient details are anonymously readable

- Severity: High
- Confidence: Confirmed
- Evidence: `supabase/artist_globe_migration.sql:105-114` grants anonymous selection with `USING (true)`.
- Impact: invitation disclosure and potential artist account takeover.
- Remediation: revoke anonymous table access and expose only a narrowly scoped token-validation/claim RPC.
- Regression test: anonymous direct selection fails; valid tokens can be redeemed only once and only before expiry.

### SEC-003 — Artist administration relies on a browser-visible static password

- Severity: High
- Confidence: High
- Evidence:
  - `src/artist-globe/api.ts:55-56`
  - `api/artist-globe-admin.js:7-12`
- Impact: recovery of the compiled password may permit service-role-backed moderation operations.
- Remediation: require a verified administrator JWT and server-side role check; remove the password from `VITE_*` configuration.

### SEC-004 — Any authenticated account can use privileged email and scheduled-send functions

- Severity: High
- Confidence: Confirmed
- Evidence:
  - `api/crm-send-email.js:48-61`
  - `api/crm-scheduled-send.js:81-102`
- Impact: arbitrary IOM email sending, scheduled-send triggering, phishing, spam, and reputation damage.
- Remediation: require active staff membership and action-specific permission checks.

### SEC-005 — Recording passwords are placed in query strings

- Severity: Medium
- Confidence: Confirmed
- Evidence: `api/crm-recorder.js:493-495` constructs a media URL containing the password.
- Impact: password exposure through history, logs, monitoring, copied URLs, and referrers.
- Remediation: exchange the password for a short-lived opaque playback grant and keep plaintext passwords out of URLs.

### SEC-006 — Raw authentication errors are displayed

- Severity: Medium
- Confidence: Confirmed
- Evidence: `src/crm/CrmLogin.tsx` displays errors propagated by `src/crm/api.ts` from Supabase.
- Impact: possible account-state enumeration and configuration disclosure.
- Remediation: return a uniform public login error and log only redacted diagnostics.

### SEC-007 — Browser security headers and protected-route cache policy are incomplete

- Severity: Medium
- Confidence: Confirmed
- Evidence: production supplied HSTS but lacked CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors`. `/client-login` returned a publicly cacheable SPA shell.
- Remediation: deploy tested headers, begin CSP in report-only mode, and use `private, no-store` for protected HTML and authenticated API responses.

### SEC-008 — `/client-login` falls back to a public browser-local password

- Severity: Medium
- Confidence: Confirmed
- Evidence: `src/crm/api.ts:720-734` uses `VITE_CRM_LOCAL_PASSWORD` or the default `iom-local` when Supabase is absent.
- Impact: production configuration failure creates misleading, weak local authentication. It does not directly expose Supabase data.
- Remediation: fail closed in production; permit local mode only behind an explicit development flag.

### SEC-009 — In-memory serverless rate limiting is not durable

- Severity: Medium
- Confidence: High
- Evidence: `api/_lib/blog-helpers.js` stores counters in an in-process Map.
- Impact: distributed attempts and cold starts can bypass recording-password, AI-cost, and abuse limits.
- Remediation: use a shared provider-backed rate limiter keyed by account, IP, action, and target resource.

### SEC-010 — Some authenticated API CORS policies reflect arbitrary origins

- Severity: Low
- Confidence: Confirmed
- Evidence:
  - `api/crm-send-email.js:29`
  - `api/crm-scheduled-send.js:18`
- Remediation: reuse the central allowed-origin helper and return `Vary: Origin`.

### SEC-011 — Anonymous analytics accepts arbitrary events

- Severity: Low
- Confidence: Confirmed
- Evidence: `supabase/site_analytics_migration.sql:31-44` uses anonymous `WITH CHECK (true)`.
- Impact: analytics poisoning and storage consumption.
- Remediation: validate event types and sizes and use rate-limited ingestion.

### SEC-012 — Some API errors expose upstream operational detail

- Severity: Low
- Confidence: Confirmed
- Affected areas: email, scheduled-send, and Artist Globe admin endpoints.
- Remediation: use stable public error codes and retain redacted detail only in protected logs.

### SEC-013 — Recording owner policies are stronger than core CRM policies

- Severity: Informational
- Evidence: `supabase/crm_recordings_migration.sql` restricts table access by `owner_id = auth.uid()` and Storage paths by UID folder.
- Result: the represented SQL denies direct cross-user recording CRUD.
- Limitation: deployed configuration was not dynamically verified.

### SEC-014 — No privileged secret value was found in tracked source

- Severity: Informational
- Evidence: service-role, R2, SMTP, Resend, and ElevenLabs secrets use server-only variable names; `.env` and `.env.local` are ignored.
- Limitation: Vercel settings, build logs, and actual browser bundles still require verification.

## 6. `/client-login` assessment

| Control | Result | Evidence |
|---|---|---|
| Authentication | PARTIAL | Supabase password auth; dashboard settings unavailable |
| Route guarding | PARTIAL | Browser guard exists; no server route guard |
| Server-side authorization | FAIL | Core data is direct Supabase access with authenticated-all RLS |
| Session handling | PARTIAL | `getUser()` and refresh; browser-persistent tokens |
| Logout | PASS | Supabase sign-out is called |
| Recovery | NOT VERIFIED | No complete application/dashboard evidence |
| CRM invitations | NOT VERIFIED | No safe CRM client-invitation model represented |
| Artist invitations | FAIL | Invite table is anonymously readable |
| Account enumeration | PARTIAL | Provider errors are surfaced |
| Rate limiting | NOT VERIFIED | Auth dashboard unavailable |
| MFA | NOT VERIFIED | No enforcement evidence |
| Role enforcement | FAIL | No client/staff/admin model |
| Cache behavior | PARTIAL | SPA shell publicly cached; data loads after auth |
| Direct API bypass | FAIL | Any authenticated user has broad direct access |
| Cross-client access | FAIL by represented policy | No tenant isolation |
| Staff/admin separation | FAIL | Authentication is treated as authorization |
| Disabled-user behavior | NOT VERIFIED | Dashboard/session evidence unavailable |
| Public signup disabled | NOT VERIFIED | Must be confirmed immediately |

## 7. Supabase authorization matrix

| Resource | Anonymous | Ordinary authenticated user | Other-client access | Intended future result | Current result |
|---|---|---|---|---|---|
| `crm_leads` | Denied | Full CRUD | Full CRUD | Staff only; limited client identity projection if required | FAIL |
| `crm_activities` | Denied | Full CRUD | Full CRUD | Staff only unless a separate client-visible communication exists | FAIL |
| `crm_lead_messages` | Denied | Full CRUD | Full CRUD | Staff; client-visible project communications only | FAIL |
| `crm_projects` | Denied | Full CRUD | Full CRUD | Staff all; clients assigned projects only | FAIL |
| Research notes | Denied | Full CRUD | Full CRUD | Clients only assigned + explicitly visible notes | FAIL |
| Useful links | Denied | Full CRUD | Full CRUD | Scope by project/visibility if exposed | FAIL |
| Blog administration | Public published reads | Full CRUD | Full CRUD | Staff/admin only | FAIL for clients |
| Analytics | Anonymous insert | Read all | Read all | Staff/admin only | FAIL for clients |
| Staff profiles | Denied | Read all/write own | Reads staff | Minimal necessary profile projection | PARTIAL |
| Recordings | Public shares only | Own rows | Denied by represented policy | Project assignment + explicit sharing, or owner | PASS/PARTIAL |
| Recording Storage | Signed share/none | Own UID folder | Denied by represented policy | Project-aware signed access | PASS/PARTIAL |
| Avatar Storage | Public read | Own writes | Public read | Intentionally public or make private | PARTIAL |
| Artist invites | Read all | Read all | Read all | Token RPC only | FAIL |
| Realtime | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Same project/visibility rules as SELECT | NOT VERIFIED |

## 8. Secret exposure report

Values remain redacted.

| Identifier | Location/type | Git history result | Action |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Public browser configuration | No tracked `.env` found | No rotation normally required |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key | No tracked `.env` found | RLS is mandatory; normally not secret |
| `VITE_WEB3FORMS_ACCESS_KEY` | Public form key | No tracked `.env` found | Verify provider restrictions |
| `VITE_CRM_LOCAL_PASSWORD` | Browser-visible fallback | Default tracked | Remove production fallback |
| `VITE_ARTIST_GLOBE_ADMIN_PASSWORD` | Browser-visible admin credential | Default tracked | Rotate and replace architecture |
| `VERCEL_OIDC_TOKEN` | Ignored `.env.local` | No tracked file history found | Rotate if sharing/exposure is uncertain |
| Supabase service-role key | Server-only references | Identifier in history; no value evidence | Inspect Vercel/build logs; rotate if exposure cannot be excluded |
| SMTP/Resend/ElevenLabs/R2/cron secrets | Server-only references | Identifiers only | Inspect deployment scopes and logs |

## 9. Dependency report

- npm with `package-lock.json`.
- Runtime audit: zero known vulnerabilities.
- No direct Git URL dependencies in `package.json`.
- No automatic fixes, installations, or upgrades were performed.
- TypeScript validation passed.
- No automated authentication, RLS, or security regression tests exist.

## 10. Deployment and browser-security report

- HTTPS/HSTS: PASS.
- CSP: FAIL; absent.
- Frame protection: FAIL; no `frame-ancestors` observed.
- MIME-sniffing protection: FAIL.
- Referrer policy: FAIL.
- Permissions policy: FAIL.
- CORS: PARTIAL.
- Protected-route caching: PARTIAL.
- Source maps: Vite default suggests disabled, but deployed artifacts require confirmation.
- Preview/production environment separation: NOT VERIFIED.
- Production invalid bearer token rejection: PASS.

## 11. Prioritized remediation plan

### Emergency

1. Confirm Supabase public signup is disabled and inventory every Auth account.
2. Do not issue client accounts until tenant-aware RLS is deployed and tested.
3. If clients already have accounts, restrict them immediately because current policies allow global CRM access.
4. Revoke anonymous reads of Artist Globe invitations.
5. Disable/replace the browser-password Artist Globe admin endpoint and rotate the password.

### Within 24 hours

1. Export the deployed Supabase schema, grants, policies, functions, buckets, publications, and Auth settings.
2. Add active staff/admin checks to privileged Vercel endpoints.
3. Review Vercel secret scopes and build logs; rotate credentials when exposure cannot be disproved.
4. Make `/client-login` fail closed when Supabase is not configured.
5. Apply `private, no-store` to authenticated responses.

### Within 7 days

1. Implement profiles, client accounts, memberships, project assignments, staff roles, and explicit client visibility.
2. Replace global authenticated policies with staff-wide and client-project-scoped RLS.
3. Add direct PostgREST, RPC, Storage, R2, and Realtime tests for anonymous, Client A, Client B, staff, and admin.
4. Require MFA for staff and administrators.
5. Replace recording passwords in URLs and deploy durable rate limiting.

### Planned hardening

1. Roll out CSP in report-only mode and then enforce it.
2. Add browser security headers.
3. Add audit logs for reads, exports, sharing, role/membership changes, email, and destructive actions.
4. Separate preview and production Supabase projects/credentials.
5. Track migration state through a reproducible migration workflow.

## 12. Proposed patch plan

No patch from this plan is approved merely by this document.

| File/resource | Proposed change | Security objective |
|---|---|---|
| New Supabase authorization migration | Add profiles, client accounts, memberships, project assignments, roles, active state, and visibility fields | Establish trusted authorization data |
| `supabase/schema.sql` | Replace authenticated-all RLS with staff-wide and client-project-scoped policies | Tenant and role isolation |
| Supplemental CRM migrations | Apply the same model to notes, ideas, links, messages, demos, files, recordings, and future resources | Close alternate access paths |
| Artist Globe migration | Make invitations private and add safe token RPCs | Protect invitation credentials |
| `api/_lib/blog-helpers.js` | Add centralized active-user/role authorization and consistent CORS/errors | Endpoint authorization |
| CRM Vercel endpoints | Require specific staff/admin permissions | Prevent client privilege escalation |
| Artist admin browser/API modules | Remove static password and use admin JWT/role | Protect service-role operations |
| CRM Supabase/auth modules | Fail closed in production and normalize login errors | Auth hardening |
| Recorder API | Replace query-string password with opaque access grant | Prevent credential leakage |
| `vercel.json` | Add tested headers and protected caching rules | Browser hardening |
| New security tests | Add role-versus-action and direct API matrices | Prevent regression |

## 13. Required authorization regression matrix

The future implementation is incomplete until direct, UI-bypassing tests prove all of the following:

| Action | Anonymous | Client A | Client B | Staff | Admin |
|---|---:|---:|---:|---:|---:|
| Read Client A assigned project | Deny | Allow | Deny | Allow | Allow |
| Read Client A staff-only project field | Deny | Deny | Deny | Allow | Allow |
| Read client-visible note on Client A project | Deny | Allow | Deny | Allow | Allow |
| Read staff-only note on Client A project | Deny | Deny | Deny | Allow | Allow |
| Read client-visible idea/demo on Client A project | Deny | Allow | Deny | Allow | Allow |
| Change `client_visible` | Deny | Deny | Deny | Allow if authorized | Allow |
| Assign client to project | Deny | Deny | Deny | Deny or limited | Allow |
| Change own role/account type | Deny | Deny | Deny | Deny | Controlled admin operation only |
| Read all leads | Deny | Deny | Deny | Allow | Allow |
| Send CRM email | Deny | Deny by default | Deny | Allow if permitted | Allow |
| Access another client's file/signed URL | Deny | Deny | Deny | Allow | Allow |
| Subscribe to another client's Realtime changes | Deny | Deny | Deny | Allow | Allow |

Tests must also cover malformed, expired, missing, and disabled-user JWTs; client-controlled project IDs; changed ownership fields; RPC calls; Storage object paths; Realtime subscriptions; cached responses; and removed memberships.

## 14. Missing evidence and residual risk

A complete conclusion still requires:

- A production Supabase schema/policy export.
- Confirmation that public signup is disabled.
- Existing-user and role inventory.
- MFA and redirect configuration.
- Realtime and Storage dashboard evidence.
- Vercel environment and preview separation evidence.
- Dedicated staging identities for all roles.
- Direct cross-account authorization tests.
- Production browser-bundle and protected-log secret checks.

Evidence-based conclusion: **High-risk issues require remediation.**

The current repository shows reasonable anonymous-denial and recording-owner controls, but any authenticated account is effectively a trusted CRM staff account. The application must not be treated as a multi-tenant client portal until the planned staff/client model is enforced by database, Storage, RPC, Realtime, and endpoint authorization and verified with direct tests.
