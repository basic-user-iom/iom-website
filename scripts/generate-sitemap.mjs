#!/usr/bin/env node
/**
 * Generates public/sitemap.xml from site routes + projects.ts URLs + demo folders.
 * Extend URL rules here when adding new public sections.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE_ORIGIN = 'https://iobjectm.com'
const BUILD_DATE = new Date().toISOString().slice(0, 10)
const outPath = join(root, 'public', 'sitemap.xml')

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const EXCLUDED_PATHS = new Set(['/client-login', '/crm-demo'])

function normalizeLoc(path) {
  if (path.startsWith('http')) {
    const u = new URL(path)
    const pathname = u.pathname.replace(/\/+$/, '') || '/'
    if (EXCLUDED_PATHS.has(pathname)) return null
    return u.href.endsWith('/') ? u.href : `${u.href}/`
  }
  const p = path.startsWith('/') ? path : `/${path}`
  const pathname = p.replace(/\/+$/, '') || '/'
  if (EXCLUDED_PATHS.has(pathname)) return null
  return `${SITE_ORIGIN}${p.endsWith('/') ? p : `${p}/`}`
}

function parseProjectUrls() {
  const src = readFileSync(join(root, 'src', 'data', 'projects.ts'), 'utf8')
  const urls = []
  const re = /^\s*url:\s*['"]([^'"]+)['"]/gm
  let m
  while ((m = re.exec(src)) !== null) {
    const raw = m[1].trim()
    if (raw.startsWith('/') || raw.includes('iobjectm.com')) urls.push(raw)
  }
  return urls
}

function demoUrls() {
  const demosDir = join(root, 'public', 'demos')
  try {
    return readdirSync(demosDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/demos/${d.name}/`)
  } catch {
    return []
  }
}

function sampleBlogSlugs() {
  try {
    const src = readFileSync(join(root, 'src', 'blog', 'samplePosts.ts'), 'utf8')
    const slugs = []
    const re = /^\s*slug:\s*['"]([^'"]+)['"]/gm
    let m
    while ((m = re.exec(src)) !== null) slugs.push(m[1])
    return slugs
  } catch {
    return []
  }
}

async function fetchPublishedBlogSlugs() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
    /\/+$/,
    '',
  )
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!url || !key) return []
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?status=eq.published&select=slug`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    )
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return rows.map((r) => String(r.slug || '')).filter(Boolean)
  } catch {
    return []
  }
}

async function collectEntries() {
  const seen = new Set()
  const entries = []

  function add(loc, priority = 0.7) {
    const normalized = normalizeLoc(loc)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    entries.push({ loc: normalized, priority })
  }

  add(`${SITE_ORIGIN}/`, 1)
  // Public journal hub (coming-soon until BLOG_PUBLIC_ENABLED)
  add('/blog/', 0.8)

  for (const url of parseProjectUrls()) add(url)
  for (const url of demoUrls()) add(url)

  // Only include article URLs when the public blog is live
  let blogPublic = false
  try {
    const flags = readFileSync(join(root, 'src', 'blog', 'publicFlags.ts'), 'utf8')
    blogPublic = /BLOG_PUBLIC_ENABLED\s*=\s*true/.test(flags)
  } catch {
    blogPublic = false
  }
  if (blogPublic) {
    const slugs = new Set([...sampleBlogSlugs(), ...(await fetchPublishedBlogSlugs())])
    for (const slug of slugs) add(`/blog/${slug}/`, 0.8)
  }

  return entries.sort((a, b) => b.priority - a.priority)
}

function toXml(entries) {
  const body = entries
    .map(
      (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>${e.priority >= 1 ? 'weekly' : 'monthly'}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
}

const entries = await collectEntries()
writeFileSync(outPath, toXml(entries), 'utf8')
console.log(`✓ sitemap.xml — ${entries.length} URLs → public/sitemap.xml`)
