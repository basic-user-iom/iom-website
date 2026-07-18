# Blog — local review checklist

## Public gate

Set `BLOG_PUBLIC_ENABLED = true` in [`src/blog/publicFlags.ts`](../src/blog/publicFlags.ts) when real posts are ready. Until then, `/blog` (menu + footer) shows **Coming soon**. CRM → Blog still works for drafting.

Do **not** run `npm run deploy` until you have reviewed locally (unless you asked to go live).

## Demo-card posts (Phase 1 example)

Template for Software / 3D / 360 / Experiments cards: one SEO post per project, with demo screenshots under `public/assets/blog/<slug>/`.

**Review all demo-card posts locally:**

1. Set `BLOG_PUBLIC_ENABLED = true` in [`src/blog/publicFlags.ts`](../src/blog/publicFlags.ts)
2. `npm run dev`
3. Open http://localhost:5173/blog — **27** sample posts (Software / 3D / 360 / Experiments)
4. Spot-check a few slugs, e.g. `/blog/volume-lighting`, `/blog/ssr-denoise`, `/blog/panorama-360-tour`
5. Optional CRM: `/crm-demo` → **Blog** → Preview tab
6. Flip the gate back to `false` before production deploy unless you want the journal live
7. Live publish: `/client-login` → Blog → create from the Markdown (catalog in [`src/blog/posts/`](../src/blog/posts/)), then `npm run seo:sitemap`

**Capture / refresh screenshots** (dev server must be running; use `index.html` paths under Vite):

```bash
npm run dev
npm run blog:capture-shots -- http://localhost:5173 volume-lighting
```

Writes `public/assets/blog/volume-lighting/{cover,hero,beams,profile}.jpg`.

**All demo-card posts:** editorial overrides live in `scripts/lib/demo-blog-overrides*.mjs`. Regenerate catalog with `npm run blog:generate-posts`. Capture cover/view stills with `npm run blog:capture-all -- http://localhost:5174` (dev server running). Volume-lighting remains the hand-tuned reference in `src/blog/posts/volumeLightingPost.ts`.

## 1. Public UI (no DB required)

```bash
npm run dev
```

- With the public gate **off**: `/blog` shows Coming soon
- With the gate **on**: sample articles list (including volume-lighting when DB is empty)
- Open a post — Markdown, images, CTA, comment note for sample IDs
- Header + Footer show **Blog**

## 2. CRM sandbox (in-memory)

- Open http://localhost:5173/crm-demo → **Blog**
- Tabs: **Pending Review** / Posts / Comments / Emails
- Catalog posts seed as `pending_review` — use **Publish**, **Hide**, or **Unpublish**
- If the list looks stale, **Reset sample data** then reopen Blog
- Edit a post — **Preview** Markdown (images + links), **Insert demo CTA** snippet
- Cover path tip: `/assets/blog/<slug>/cover.jpg`
- Approve a pending comment, browse email list
- **Add sample comment** creates a moderation queue item

## 3. Live CRM + comments (needs Supabase)

1. Supabase → SQL Editor → run [`supabase/blog_migration.sql`](../supabase/blog_migration.sql) (new projects)
2. Existing projects: also run [`supabase/blog_status_pending_hidden.sql`](../supabase/blog_status_pending_hidden.sql) to allow `pending_review` / `hidden`
3. Ensure env has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and for comment APIs:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Proton SMTP (`PROTON_SMTP_HOST`, `PROTON_SMTP_USER`, `PROTON_SMTP_PASS`, …)
4. `/client-login` → Blog → **Import catalog** → review under Pending Review → **Publish** one by one
5. Set `BLOG_PUBLIC_ENABLED = true` when you want `/blog` live for visitors
6. Open `/blog/{slug}` → leave a comment with a real email → confirm via link
7. CRM → Blog → Comments (moderate) + Emails (audience; marketing only if checkbox was checked)

## 4. SEO

- `/blog` meta + Blog JSON-LD
- Per-post Article JSON-LD when viewing a live post (uses cover image)
- When `BLOG_PUBLIC_ENABLED` is true, `/blog/{slug}` is `index, follow` (verify route stays noindex)
- `npm run seo:sitemap` includes `/blog/` and sample (or live) post slugs

## Markdown notes

- Links: `[label](/demos/…)` or `https://…`
- Images (own line): `![Caption](/assets/blog/slug/hero.jpg)` → figure + figcaption
- Cover field: URL only (no upload yet) — prefer `/assets/blog/<slug>/cover.jpg`

## Out of scope until you ask

- Production deploy / enabling the public blog gate
- Phase 2 posts for all remaining demo cards
- Newsletter / bulk email campaigns
- Rich WYSIWYG / Supabase image upload
