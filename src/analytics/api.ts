import { getSupabase } from '../crm/supabaseClient'
import { countryLabel, resolveCoords } from './geo'
import type { AnalyticsGeoPoint, AnalyticsRange, AnalyticsSummary } from './types'

const DEMO_GEO: AnalyticsGeoPoint[] = [
  { lat: 44.8, lon: 20.5, country: 'RS', city: 'Belgrade', visitors: 86, live: true },
  { lat: 52.5, lon: 13.4, country: 'DE', city: 'Berlin', visitors: 124, live: true },
  { lat: 51.5, lon: -0.12, country: 'GB', city: 'London', visitors: 98, live: false },
  { lat: 40.7, lon: -74.0, country: 'US', city: 'New York', visitors: 210, live: true },
  { lat: 37.8, lon: -122.4, country: 'US', city: 'San Francisco', visitors: 156, live: false },
  { lat: 48.9, lon: 2.35, country: 'FR', city: 'Paris', visitors: 72, live: false },
  { lat: 35.7, lon: 139.7, country: 'JP', city: 'Tokyo', visitors: 64, live: true },
  { lat: -33.9, lon: 151.2, country: 'AU', city: 'Sydney', visitors: 41, live: false },
  { lat: 1.35, lon: 103.8, country: 'SG', city: 'Singapore', visitors: 55, live: false },
  { lat: 52.4, lon: 4.9, country: 'NL', city: 'Amsterdam', visitors: 88, live: true },
]

function rangeDayCount(label: string): number {
  if (label === '7d') return 7
  if (label === '30d') return 30
  return 90
}

function rangeToDates(range: AnalyticsRange): { from: Date; to: Date } {
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (rangeDayCount(range.label) - 1))
  from.setUTCHours(0, 0, 0, 0)
  return { from, to }
}

/** Every calendar day in the range, including zeros — so sparklines match 7/30/90 tabs. */
function fillDailySeries(
  from: Date,
  to: Date,
  dailyMap: Map<string, { pageviews: number; sessions: Set<string> }>,
): AnalyticsSummary['daily'] {
  const rows: AnalyticsSummary['daily'] = []
  const cursor = new Date(from)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setUTCHours(0, 0, 0, 0)
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.toISOString().slice(0, 10)
    const bucket = dailyMap.get(day)
    rows.push({
      day,
      pageviews: bucket?.pageviews ?? 0,
      visitors: bucket?.sessions.size ?? 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return rows
}

function buildDemoDaily(label: string): AnalyticsSummary['daily'] {
  const days = rangeDayCount(label)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (days - 1 - i))
    const day = d.toISOString().slice(0, 10)
    const base = 120 + Math.round(Math.sin(i / 2) * 40 + i * 8)
    return { day, pageviews: base + 40, visitors: Math.round(base * 0.38) }
  })
}

const DEMO_SUMMARY: AnalyticsSummary = {
  pageviews: 2847,
  visitors: 912,
  bounceRate: 42,
  avgPagesPerSession: 3.1,
  avgTimeOnPageSec: 74,
  humanVisitors: 880,
  botVisitors: 32,
  liveVisitors: 5,
  topPages: [
    { path: '/', views: 1240 },
    { path: '/demos/panorama-360/', views: 412 },
    { path: '/demos/ssr-denoise/', views: 318 },
  ],
  topReferrers: [
    { referrer: 'google.com', views: 980 },
    { referrer: 'direct', views: 742 },
    { referrer: 'github.com', views: 318 },
  ],
  topSources: [
    { source: 'google / organic', views: 820 },
    { source: 'direct / none', views: 742 },
    { source: 'linkedin / social', views: 156 },
    { source: 'newsletter / email', views: 94 },
  ],
  topKeywords: [
    { keyword: '360 virtual tour editor', views: 48 },
    { keyword: 'webgpu ssr denoise', views: 31 },
    { keyword: 'interactive object media', views: 22 },
  ],
  topLinks: [
    { url: 'https://3dbviewer.com/', label: '3D Viewer', clicks: 186 },
    { url: '/demos/panorama-360/', label: '360° Panorama Tour Editor', clicks: 142 },
    { url: '/demos/ssr-denoise/', label: 'WebGPU SSR + Denoise', clicks: 98 },
  ],
  deviceBreakdown: [
    { device: 'desktop', views: 1820 },
    { device: 'mobile', views: 892 },
    { device: 'tablet', views: 135 },
  ],
  topCountries: [
    { country: 'US', label: 'United States', views: 366 },
    { country: 'DE', label: 'Germany', views: 124 },
    { country: 'GB', label: 'United Kingdom', views: 98 },
    { country: 'RS', label: 'Serbia', views: 86 },
  ],
  geoPoints: DEMO_GEO,
  daily: buildDemoDaily('30d'),
}

function emptySummary(): AnalyticsSummary {
  return {
    pageviews: 0,
    visitors: 0,
    bounceRate: 0,
    avgPagesPerSession: 0,
    avgTimeOnPageSec: 0,
    humanVisitors: 0,
    botVisitors: 0,
    liveVisitors: 0,
    topPages: [],
    topReferrers: [],
    topSources: [],
    topKeywords: [],
    topLinks: [],
    deviceBreakdown: [],
    topCountries: [],
    geoPoints: [],
    daily: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asString(value: unknown): string {
  return value == null ? '' : String(value)
}

function asBool(value: unknown): boolean {
  return value === true
}

function asList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<
    string,
    unknown
  >[]
}

function isAnalyticsSchemaMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const message = error.message ?? ''
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42883' ||
    /site_analytics_summary|site_analytics_events|Could not find the function|schema cache/i.test(
      message,
    )
  )
}

function mapRpcSummary(raw: unknown, from: Date, to: Date): AnalyticsSummary {
  const row = asRecord(raw)
  if (!row) return emptySummary()

  const geoPoints: AnalyticsGeoPoint[] = []
  for (const g of asList(row.geoPoints)) {
    const country = asString(g.country).toUpperCase()
    const coords = resolveCoords(
      country,
      typeof g.lat === 'number' ? g.lat : Number(g.lat),
      typeof g.lon === 'number' ? g.lon : Number(g.lon),
    )
    if (!coords) continue
    geoPoints.push({
      lat: coords.lat,
      lon: coords.lon,
      country,
      city: asString(g.city),
      visitors: asNumber(g.visitors),
      live: asBool(g.live),
    })
  }

  const dailyMap = new Map<string, { pageviews: number; sessions: Set<string> }>()
  for (const d of asList(row.daily)) {
    const day = asString(d.day).slice(0, 10)
    if (!day) continue
    const visitors = asNumber(d.visitors)
    const sessions = new Set<string>()
    for (let i = 0; i < visitors; i += 1) sessions.add(`${day}:${i}`)
    dailyMap.set(day, { pageviews: asNumber(d.pageviews), sessions })
  }

  return {
    pageviews: asNumber(row.pageviews),
    visitors: asNumber(row.visitors),
    bounceRate: asNumber(row.bounceRate),
    avgPagesPerSession: asNumber(row.avgPagesPerSession),
    avgTimeOnPageSec: asNumber(row.avgTimeOnPageSec),
    humanVisitors: asNumber(row.humanVisitors),
    botVisitors: asNumber(row.botVisitors),
    liveVisitors: asNumber(row.liveVisitors),
    topPages: asList(row.topPages).map((item) => ({
      path: asString(item.path),
      views: asNumber(item.views),
    })),
    topReferrers: asList(row.topReferrers).map((item) => ({
      referrer: asString(item.referrer),
      views: asNumber(item.views),
    })),
    topSources: asList(row.topSources).map((item) => ({
      source: asString(item.source),
      views: asNumber(item.views),
    })),
    topKeywords: asList(row.topKeywords).map((item) => ({
      keyword: asString(item.keyword),
      views: asNumber(item.views),
    })),
    topLinks: asList(row.topLinks).map((item) => ({
      url: asString(item.url),
      label: asString(item.label),
      clicks: asNumber(item.clicks),
    })),
    deviceBreakdown: asList(row.deviceBreakdown).map((item) => ({
      device: asString(item.device),
      views: asNumber(item.views),
    })),
    topCountries: asList(row.topCountries).map((item) => {
      const country = asString(item.country).toUpperCase()
      return {
        country,
        label: countryLabel(country),
        views: asNumber(item.views),
      }
    }),
    geoPoints,
    daily: fillDailySeries(from, to, dailyMap),
  }
}

export async function fetchAnalyticsSummary(
  range: AnalyticsRange,
  demo = false,
): Promise<{ data: AnalyticsSummary | null; schemaMissing: boolean }> {
  if (demo) {
    return {
      data: { ...DEMO_SUMMARY, daily: buildDemoDaily(range.label) },
      schemaMissing: false,
    }
  }

  const sb = getSupabase()
  if (!sb) return { data: null, schemaMissing: false }

  const { from, to } = rangeToDates(range)
  const { data, error } = await sb.rpc('site_analytics_summary', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })

  if (error) {
    return { data: null, schemaMissing: isAnalyticsSchemaMissing(error) }
  }

  return { data: mapRpcSummary(data, from, to), schemaMissing: false }
}

export { DEMO_SUMMARY }
