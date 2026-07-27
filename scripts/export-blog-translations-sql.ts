/**
 * Export catalog blog translations → supabase/blog_translations_content.sql
 * Upserts by matching blog_posts.slug (works after EN backfill migration).
 *
 * Usage (from repo root, with tsx or after vite-node):
 *   npx --yes tsx scripts/export-blog-translations-sql.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_DEMO_BLOG_POSTS } from '../src/blog/posts/index.ts'
import { BLOG_CONTENT_LOCALES, type BlogContentLocale } from '../src/blog/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'supabase', 'blog_translations_content.sql')

function sqlString(value: string): string {
  // Dollar-quote so markdown bodies with quotes/backslashes stay intact.
  return `$iom$${value}$iom$`
}

const lines: string[] = [
  '-- Upsert demo-catalog translations into blog_post_translations by slug.',
  '-- Run AFTER blog_post_translations.sql (and after posts exist in blog_posts).',
  '-- Safe to re-run.',
  '',
]

let rows = 0
for (const post of ALL_DEMO_BLOG_POSTS) {
  const translations = post.translations ?? {}
  for (const locale of BLOG_CONTENT_LOCALES as readonly BlogContentLocale[]) {
    const fields = translations[locale]
    if (!fields) continue
    if (!fields.title.trim() && !fields.body.trim() && !fields.excerpt.trim()) continue
    rows += 1
    lines.push(`insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  ${sqlString(locale)},
  ${sqlString(fields.title)},
  ${sqlString(fields.excerpt)},
  ${sqlString(fields.body)},
  ${sqlString(fields.seo_title)},
  ${sqlString(fields.seo_description)}
from public.blog_posts p
where p.slug = ${sqlString(post.slug)}
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();
`)
  }
}

lines.push(`-- ${rows} translation rows for ${ALL_DEMO_BLOG_POSTS.length} catalog posts`)
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`Wrote ${rows} upserts → ${outPath}`)
