export type SeoUpgradeStatus = 'done' | 'pending' | 'planned'

export type SeoUpgradeCategory =
  | 'technical'
  | 'content'
  | 'structured-data'
  | 'performance'
  | 'analytics'

/** Registry entry — add new rows when shipping SEO improvements. */
export interface SeoUpgrade {
  id: string
  title: string
  description: string
  status: SeoUpgradeStatus
  category: SeoUpgradeCategory
  /** ISO date when completed or targeted */
  date?: string
}

export interface PageMeta {
  title: string
  description: string
  canonical: string
  ogImage?: string
  robots?: string
  keywords?: string[]
}

export interface SeoTarget {
  id: string
  phrase: string
  intent: 'brand' | 'product' | 'topic' | 'long-tail'
  /** Public pages / sections this target maps to */
  pages: string[]
  priority: 'high' | 'medium' | 'low'
  notes?: string
}

export interface SitemapEntry {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}
