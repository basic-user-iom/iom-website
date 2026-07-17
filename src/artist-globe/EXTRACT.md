# Extracting Artist Globe → iomglobeart.com

This demo lives under `src/artist-globe/` so it can become its own product with minimal rewrite.

## What to move

| Path | Role |
|------|------|
| `src/artist-globe/**` | App UI, Three.js globe, API helpers |
| `public/assets/artist-globe/**` | Earth texture |
| `supabase/artist_globe_migration.sql` | Schema + RLS |
| `api/artist-globe-admin.js` | Admin approve/reject (service role) |

Optional: copy fonts / CSS variables from the parent site, or keep Syne + IBM Plex Sans.

## Steps

1. Create a new Vite + React + Three.js repo (or Vercel project from this folder subset).
2. Point the domain **iomglobeart.com** at that project.
3. Either:
   - reuse the same Supabase project (tables already prefixed `artist_globe_*`), or
   - create a new Supabase project and run `artist_globe_migration.sql`.
4. Set env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ARTIST_GLOBE_ADMIN_PASSWORD` / `ARTIST_GLOBE_ADMIN_PASSWORD`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, for admin API)
5. Change the public origin used in invite URLs (`ARTIST_GLOBE_PUBLIC_ORIGIN` or request `Origin`).
6. Remove the `/artist-globe` route from the IOM marketing `App.tsx` (or keep a redirect).

## Auth note

Artist accounts use Supabase Auth with storage key `artist-globe-auth` (separate from CRM staff). Invites are one-time tokens; email delivery can be added later (Resend / Proton).

## Demo without Supabase

Until migration + service role are applied, the UI runs on **seed artists + localStorage** for submissions, approve/reject, invites, and profile edits. That is enough for pitch demos.
