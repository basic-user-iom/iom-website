# Deploy checklist — iobjectm.com

Production: **https://iobjectm.com** (Vercel, branch `master`).

The Jul 14, 2026 incident happened because agents deployed from the working folder while **git stayed on an old commit**. Vercel uploaded untracked files; a later `git stash -u` wiped days of work. Follow this checklist every time.

## Before you change anything

1. Confirm you are in **`F:\iom_website`** (not a sibling clone or old worktree).
2. Run `git status` and `git log -1 --oneline`.
3. If `git stash list` is non-empty, **do not** run `git stash pop/apply` unless you know exactly why the stash exists.

## Before every production deploy

Run the automated gate (recommended):

```bash
npm run deploy:prod
```

Or manually:

```bash
node scripts/pre-deploy-check.mjs
npm run build
git push origin master
npx vercel --prod --yes
```

### Manual checklist

- [ ] All site changes are **committed** (no modified tracked files).
- [ ] Branch is **pushed** to `origin/master` (`git status` shows up to date).
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

Schema/SQL changes need Supabase migrations run separately; they are not deployed by Vercel.
