import type { SeoUpgrade } from './types'

/**
 * SEO upgrade registry — append entries when shipping new SEO work.
 * The CRM SEO tab reads this list to show done / pending / planned tasks.
 *
 * Workflow for new content:
 * 1. Add project in src/data/projects.ts
 * 2. Run `npm run build` (regenerates sitemap)
 * 3. Add a registry entry here if the change needs tracking
 * 4. Optionally extend src/seo/targets.ts with new keyword targets
 */
export const SEO_UPGRADES: SeoUpgrade[] = [
  {
    id: 'canonical-domain',
    title: 'Production canonical domain',
    description: 'Canonical, Open Graph, and Twitter URLs point to iobjectm.com.',
    status: 'done',
    category: 'technical',
    date: '2026-07-16',
  },
  {
    id: 'robots-sitemap',
    title: 'robots.txt + XML sitemap',
    description: 'Crawler directives and auto-generated sitemap at build time.',
    status: 'done',
    category: 'technical',
    date: '2026-07-16',
  },
  {
    id: 'json-ld-org',
    title: 'Organization & WebSite schema',
    description: 'JSON-LD graph on homepage for entity and portfolio discovery.',
    status: 'done',
    category: 'structured-data',
    date: '2026-07-16',
  },
  {
    id: 'route-meta',
    title: 'Per-route meta tags',
    description: 'Dynamic title, description, canonical, and noindex for CRM routes.',
    status: 'done',
    category: 'technical',
    date: '2026-07-16',
  },
  {
    id: 'analytics-dashboard',
    title: 'Privacy-friendly traffic monitoring',
    description: 'Cookie-free pageview tracking with CRM dashboard (Supabase).',
    status: 'done',
    category: 'analytics',
    date: '2026-07-16',
  },
  {
    id: 'keyword-targets',
    title: 'Content keyword map',
    description: 'Target phrases mapped to sections and demo pages.',
    status: 'done',
    category: 'content',
    date: '2026-07-16',
  },
  {
    id: 'demo-meta-batch',
    title: 'Demo page meta tags',
    description: 'Add description + OG tags to all /demos/* static pages.',
    status: 'planned',
    category: 'content',
  },
  {
    id: 'gsc-integration',
    title: 'Google Search Console',
    description: 'Verify domain and submit sitemap in Search Console.',
    status: 'pending',
    category: 'technical',
  },
  {
    id: 'social-sameas',
    title: 'Social profile sameAs links',
    description: 'Add LinkedIn / GitHub / YouTube to Organization schema when ready.',
    status: 'planned',
    category: 'structured-data',
  },
  {
    id: 'project-schema-all',
    title: 'Per-project structured data',
    description: 'Generate CreativeWork schema for every indexable portfolio item.',
    status: 'planned',
    category: 'structured-data',
  },
]

export function seoUpgradeStats() {
  const done = SEO_UPGRADES.filter((u) => u.status === 'done').length
  const pending = SEO_UPGRADES.filter((u) => u.status === 'pending').length
  const planned = SEO_UPGRADES.filter((u) => u.status === 'planned').length
  return { done, pending, planned, total: SEO_UPGRADES.length }
}
