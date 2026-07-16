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

function collectEntries() {
  const seen = new Set()
  const entries = []

  function add(loc, priority = 0.7) {
    const normalized = normalizeLoc(loc)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    entries.push({ loc: normalized, priority })
  }

  add(`${SITE_ORIGIN}/`, 1)

  for (const url of parseProjectUrls()) add(url)
  for (const url of demoUrls()) add(url)

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

const entries = collectEntries()
writeFileSync(outPath, toXml(entries), 'utf8')
console.log(`✓ sitemap.xml — ${entries.length} URLs → public/sitemap.xml`)
