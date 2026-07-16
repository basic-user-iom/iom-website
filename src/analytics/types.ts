export interface AnalyticsEventInput {
  session_id: string
  path: string
  referrer: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  viewport_w?: number
  viewport_h?: number
}

export interface AnalyticsDailyRow {
  day: string
  pageviews: number
  visitors: number
}

export interface AnalyticsSummary {
  pageviews: number
  visitors: number
  bounceRate: number
  avgPagesPerSession: number
  topPages: { path: string; views: number }[]
  topReferrers: { referrer: string; views: number }[]
  deviceBreakdown: { device: string; views: number }[]
  daily: AnalyticsDailyRow[]
}

export interface AnalyticsRange {
  from: string
  to: string
  label: string
}
