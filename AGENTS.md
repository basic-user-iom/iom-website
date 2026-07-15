# Agent instructions — IOM website

This file is for **Cursor agents** working in `F:\iom_website`.

## Deploying to production (https://iobjectm.com)

When the user asks to **deploy**, **go live**, **push to production**, or **update the website**:

```bash
npm run deploy
```

That is the **only** allowed production deploy command. It automatically:

1. Verifies git is clean and synced with `origin/master`
2. Builds the site
3. Pushes to GitHub
4. Deploys to Vercel

**Never run** `npx vercel --prod` directly — a project hook blocks it.

The user does **not** need to know these steps. If they say "deploy the site", run `npm run deploy` and report the result.

## Before editing high-risk areas

Read **DEPLOY.md**. These files caused cross-chat overwrites:

- `src/data/projects.ts`
- `src/utils/createMusicPlayerVisualizer.ts`
- `public/demos/**/index.html`
- `src/crm/**`

After edits: commit, then deploy with `npm run deploy`.

## Git — blocked commands

These are blocked by `.cursor/hooks/`:

- `git stash -u` / `git stash push -u`
- `git reset --hard` (unless user explicitly asks)

## Panorama rebuild

If the 360° viewer changed in `F:\3d-viever-backup\v3.18`:

```bash
npm run build:panorama-360
```

Then commit and `npm run deploy`.
