export type AnalyticsEventType = 'pageview' | 'engage' | 'click'

export interface AnalyticsEventInput {
  session_id: string
  path: string
  referrer: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term?: string
  search_keyword?: string
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  viewport_w?: number
  viewport_h?: number
  event_type?: AnalyticsEventType
  duration_ms?: number
  link_url?: string
  link_label?: string
}

export interface AnalyticsDailyRow {
  day: string
  pageviews: number
  visitors: number
}

export interface AnalyticsGeoPoint {
  lat: number
  lon: number
  country: string
  city: string
  visitors: number
  /** True when seen in the last ~30 minutes */
  live?: boolean
}

export interface AnalyticsSummary {
  pageviews: number
  visitors: number
  bounceRate: number
  avgPagesPerSession: number
  avgTimeOnPageSec: number
  humanVisitors: number
  botVisitors: number
  topPages: { path: string; views: number }[]
  topReferrers: { referrer: string; views: number }[]
  topSources: { source: string; views: number }[]
  topKeywords: { keyword: string; views: number }[]
  topLinks: { url: string; label: string; clicks: number }[]
  deviceBreakdown: { device: string; views: number }[]
  topCountries: { country: string; label: string; views: number }[]
  geoPoints: AnalyticsGeoPoint[]
  liveVisitors: number
  daily: AnalyticsDailyRow[]
}

export interface AnalyticsRange {
  from: string
  to: string
  label: string
}
