# Blog — local review checklist

## Public gate

Set `BLOG_PUBLIC_ENABLED = true` in [`src/blog/publicFlags.ts`](../src/blog/publicFlags.ts) when real posts are ready. Until then, `/blog` (menu + footer) shows **Coming soon**. CRM → Blog still works for drafting.

Do **not** run `npm run deploy` until you have reviewed locally (unless you asked to go live).

## 1. Public UI (no DB required)

```bash
npm run dev
```

- Open http://localhost:5173/blog — sample articles should list
- Open a post — Markdown, CTA, comment note for sample IDs
- Header + Footer show **Blog**

## 2. CRM sandbox (in-memory)

- Open http://localhost:5173/crm-demo → **Blog**
- Tabs: Posts / Comments / Emails
- Edit a post, approve a pending comment, browse email list
- **Add sample comment** creates a moderation queue item

## 3. Live CRM + comments (needs Supabase)

1. Supabase → SQL Editor → run [`supabase/blog_migration.sql`](../supabase/blog_migration.sql)
2. Ensure env has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and for comment APIs:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Proton SMTP (`PROTON_SMTP_HOST`, `PROTON_SMTP_USER`, `PROTON_SMTP_PASS`, …)
3. `/client-login` → Blog → create/publish a post
4. Open `/blog/{slug}` → leave a comment with a real email → confirm via link
5. CRM → Blog → Comments (moderate) + Emails (audience; marketing only if checkbox was checked)

## 4. SEO

- `/blog` meta + Blog JSON-LD
- Per-post Article JSON-LD when viewing a live post
- `npm run seo:sitemap` includes `/blog/` and sample (or live) post slugs

## Out of scope until you ask

- Production deploy
- Newsletter / bulk email campaigns
- Rich WYSIWYG media CMS
