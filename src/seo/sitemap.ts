import { PROJECTS } from '../data/projects'
import { SITE_ORIGIN } from './siteConfig'
import type { SitemapEntry } from './types'

const BUILD_DATE = new Date().toISOString().slice(0, 10)
const EXCLUDED_PATHS = new Set(['/client-login', '/crm-demo'])

function isExcludedUrl(loc: string): boolean {
  try {
    const pathname = new URL(loc).pathname.replace(/\/+$/, '') || '/'
    return EXCLUDED_PATHS.has(pathname)
  } catch {
    return false
  }
}

/** URLs included in sitemap.xml — extend when adding public routes. */
export function collectSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    {
      loc: `${SITE_ORIGIN}/`,
      lastmod: BUILD_DATE,
      changefreq: 'weekly',
      priority: 1,
    },
  ]

  const seen = new Set<string>([`${SITE_ORIGIN}/`])

  for (const project of PROJECTS) {
    const raw = project.url?.trim()
    if (!raw) continue

    let loc: string | null = null
    if (raw.startsWith('/')) {
      loc = `${SITE_ORIGIN}${raw.endsWith('/') ? raw : `${raw}/`}`
    } else if (raw.includes('iobjectm.com')) {
      try {
        const u = new URL(raw)
        loc = u.href.endsWith('/') ? u.href : `${u.href}/`
      } catch {
        continue
      }
    }

    if (!loc || seen.has(loc) || isExcludedUrl(loc)) continue
    seen.add(loc)
    entries.push({
      loc,
      lastmod: BUILD_DATE,
      changefreq: 'monthly',
      priority: project.featured ? 0.9 : 0.7,
    })
  }

  return entries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority != null ? `\n    <priority>${e.priority.toFixed(1)}</priority>` : ''}
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
