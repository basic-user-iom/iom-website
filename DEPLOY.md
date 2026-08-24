# Deploy checklist — iobjectm.com

Production: **https://iobjectm.com** (Vercel, branch `master`).

## For you (site owner)

You do **not** need to remember deploy commands. In any Cursor chat on this project, say:

> **Deploy the site** / **Go live** / **Update iobjectm.com**

The agent will run `npm run deploy` automatically. A project hook **blocks** unsafe direct `vercel --prod` commands.

The Jul 14, 2026 incident happened because agents deployed from the working folder while **git stayed on an old commit**. Safeguards now prevent that.

## One command (agents & manual)

```bash
npm run deploy
```

This automatically: git safety check → isolated build → scoped push → Vercel production.

The build and upload use an isolated committed snapshot. Uncommitted and untracked workspace files are never uploaded. Production is composed from what is currently live plus only the requested project/demo scope, so work on other demos remains offline.

Automotive-only example (agents run this for the owner):

```bash
npm run deploy -- --scope automotive-studio
```

Standard standalone demos use `--scope demo:<folder-name>`. Source projects with a matching demo output use `--scope project:<folder-name>`. A mixed/full-site release requires the explicit `--scope site` opt-in.

(`npm run deploy:prod` is the same; `deploy` is the short alias.)

## Before you change anything

1. Confirm you are in **`F:\iom_website`** (not a sibling clone or old worktree).
2. Run `git status` and `git log -1 --oneline`.
3. If `git stash list` is non-empty, **do not** run `git stash pop/apply` unless you know exactly why the stash exists.

## Before every production deploy

Run the automated gate:

```bash
npm run deploy
```

Do not manually run `git push origin master` or `npx vercel --prod`. The scoped deploy command is the only path that composes the requested production snapshot safely.

### Manual checklist

- [ ] Only finished files for the requested project/demo are **committed**.
- [ ] Unfinished workspace changes may remain local; the isolated snapshot excludes them.
- [ ] Let `npm run deploy` perform the guarded push to `origin/master`.
- [ ] `npm run build` succeeds locally.
- [ ] If you edited **panorama-360**, run `npm run build:panorama-360` first (viewer lives in `F:\3d-viever-backup\v3.18`).
- [ ] If you edited **raven-path** assets, run `npm run build:ravens` first.
- [ ] High-risk files reviewed if touched:
  - `src/data/projects.ts` — project cards / sections
  - `src/utils/createMusicPlayerVisualizer.ts` — music player animation
  - `public/demos/**/index.html` — standalone demos
  - `src/crm/**` — live CRM + demo CRM

## After deploy

Verify on production (hard refresh or private window):

1. **Music** (`/#music`) — play → FFT ocean + raven (not raymarch placeholder).
2. **Software** — no Web Export Kit (OBJ-0119); CRM Demo (OBJ-0147) present.
3. **Demos** — spot-check any demo you changed, e.g. `/demos/ssr-denoise/`, `/demos/volume-lighting/`.
4. **CRM demo** — `/crm-demo` on a narrow viewport (no horizontal overflow).

## Never do this

- `git stash -u` / `git stash push -u` on this repo without committing or backing up first.
- `git reset --hard` without checking what will be lost.
- `npx vercel --prod` while tracked files are uncommitted.
- Deploy from a folder that is not the current git checkout at `origin/master`.
- Edit panorama viewer in `v3.18` without rebuilding `public/demos/panorama-360/`.

## CRM note

- **`/client-login`** — real Supabase CRM (client data).
- **`/crm-demo`** — in-memory sandbox only.
- Email conversation table: run `supabase/crm_lead_messages_migration.sql` in Supabase.
- Client reply mirror (Proton keep-copy → Resend → CRM): see [`docs/crm-email-inbound-setup.md`](docs/crm-email-inbound-setup.md).

Schema/SQL changes need Supabase migrations run separately; they are not deployed by Vercel.

## Security ops

- Secret rotation (quiet window): [`SECURITY_SECRET_ROTATION.md`](SECURITY_SECRET_ROTATION.md)
- Preview Supabase (separate from production CRM): [`supabase/PREVIEW_APPLY_ORDER.md`](supabase/PREVIEW_APPLY_ORDER.md)
- Hardening status SQL: `supabase/security_hardening_verify_status.sql`
- Production smoke: `npm run security:smoke`
