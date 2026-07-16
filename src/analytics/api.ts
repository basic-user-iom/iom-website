import { getSupabase } from '../crm/supabaseClient'
import { countryLabel, resolveCoords } from './geo'
import type { AnalyticsGeoPoint, AnalyticsRange, AnalyticsSummary } from './types'

const LIVE_MS = 30 * 60 * 1000

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
  { lat: 41.9, lon: 12.5, country: 'IT', city: 'Rome', visitors: 37, live: false },
  { lat: 19.4, lon: -99.1, country: 'MX', city: 'Mexico City', visitors: 29, live: false },
]

const DEMO_SUMMARY: AnalyticsSummary = {
  pageviews: 2847,
  visitors: 912,
  bounceRate: 42,
  avgPagesPerSession: 3.1,
  liveVisitors: 5,
  topPages: [
    { path: '/', views: 1240 },
    { path: '/demos/panorama-360/', views: 412 },
    { path: '/demos/ssr-denoise/', views: 318 },
    { path: '/demos/streets-gl/', views: 276 },
    { path: '/demos/raven-path/', views: 201 },
    { path: '/crm-demo', views: 156 },
  ],
  topReferrers: [
    { referrer: 'google.com', views: 980 },
    { referrer: 'direct', views: 742 },
    { referrer: 'github.com', views: 318 },
    { referrer: 'linkedin.com', views: 156 },
    { referrer: 'threejs.org', views: 89 },
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
    { country: 'NL', label: 'Netherlands', views: 88 },
    { country: 'RS', label: 'Serbia', views: 86 },
    { country: 'FR', label: 'France', views: 72 },
  ],
  geoPoints: DEMO_GEO,
  daily: Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (13 - i))
    const day = d.toISOString().slice(0, 10)
    const base = 120 + Math.round(Math.sin(i / 2) * 40 + i * 8)
    return {
      day,
      pageviews: base + 40,
      visitors: Math.round(base * 0.38),
    }
  }),
}

function rangeToDates(range: AnalyticsRange): { from: Date; to: Date } {
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  const from = new Date(to)
  if (range.label === '7d') from.setUTCDate(from.getUTCDate() - 6)
  else if (range.label === '30d') from.setUTCDate(from.getUTCDate() - 29)
  else from.setUTCDate(from.getUTCDate() - 89)
  from.setUTCHours(0, 0, 0, 0)
  return { from, to }
}

function emptySummary(): AnalyticsSummary {
  return {
    pageviews: 0,
    visitors: 0,
    bounceRate: 0,
    avgPagesPerSession: 0,
    liveVisitors: 0,
    topPages: [],
    topReferrers: [],
    deviceBreakdown: [],
    topCountries: [],
    geoPoints: [],
    daily: [],
  }
}

type EventRow = {
  session_id: string
  path: string
  referrer: string
  device_type: string
  created_at: string
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}

export async function fetchAnalyticsSummary(
  range: AnalyticsRange,
  demo = false,
): Promise<{ data: AnalyticsSummary | null; schemaMissing: boolean }> {
  if (demo) return { data: DEMO_SUMMARY, schemaMissing: false }

  const sb = getSupabase()
  if (!sb) return { data: null, schemaMissing: false }

  const { from, to } = rangeToDates(range)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  let events: EventRow[] | null = null
  let error: { message: string; code?: string } | null = null

  const withGeo = await sb
    .from('site_analytics_events')
    .select('session_id, path, referrer, device_type, created_at, country, city, latitude, longitude')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (withGeo.error) {
    const geoMissing =
      withGeo.error.message.includes('country') ||
      withGeo.error.message.includes('latitude') ||
      withGeo.error.code === '42703'
    if (geoMissing) {
      const fallback = await sb
        .from('site_analytics_events')
        .select('session_id, path, referrer, device_type, created_at')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(10000)
      events = fallback.data
      error = fallback.error
    } else {
      error = withGeo.error
    }
  } else {
    events = withGeo.data
  }

  if (error) {
    const missing =
      error.message.includes('site_analytics_events') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    return { data: null, schemaMissing: missing }
  }

  if (!events?.length) {
    return { data: emptySummary(), schemaMissing: false }
  }

  const sessions = new Map<string, number>()
  const pageCounts = new Map<string, number>()
  const refCounts = new Map<string, number>()
  const deviceCounts = new Map<string, number>()
  const countryCounts = new Map<string, number>()
  const dailyMap = new Map<string, { pageviews: number; sessions: Set<string> }>()
  const geoBuckets = new Map<
    string,
    { lat: number; lon: number; country: string; city: string; sessions: Set<string>; live: boolean }
  >()
  const liveSessions = new Set<string>()
  const now = Date.now()

  for (const row of events) {
    sessions.set(row.session_id, (sessions.get(row.session_id) ?? 0) + 1)
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1)

    const ref = normalizeReferrer(row.referrer)
    refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1)
    deviceCounts.set(row.device_type, (deviceCounts.get(row.device_type) ?? 0) + 1)

    const country = (row.country || '').toUpperCase()
    if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)

    const day = row.created_at.slice(0, 10)
    if (!dailyMap.has(day)) dailyMap.set(day, { pageviews: 0, sessions: new Set() })
    const bucket = dailyMap.get(day)!
    bucket.pageviews += 1
    bucket.sessions.add(row.session_id)

    const createdMs = Date.parse(row.created_at)
    const isLive = Number.isFinite(createdMs) && now - createdMs <= LIVE_MS
    if (isLive) liveSessions.add(row.session_id)

    const coords = resolveCoords(country, row.latitude, row.longitude)
    if (!coords) continue
    const city = (row.city || '').trim()
    const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)},${country},${city}`
    if (!geoBuckets.has(key)) {
      geoBuckets.set(key, {
        lat: coords.lat,
        lon: coords.lon,
        country,
        city,
        sessions: new Set(),
        live: false,
      })
    }
    const geo = geoBuckets.get(key)!
    geo.sessions.add(row.session_id)
    if (isLive) geo.live = true
  }

  const pageviews = events.length
  const visitors = sessions.size
  const singlePageSessions = [...sessions.values()].filter((n) => n === 1).length
  const bounceRate = visitors ? Math.round((singlePageSessions / visitors) * 100) : 0
  const avgPagesPerSession = visitors ? Math.round((pageviews / visitors) * 10) / 10 : 0

  const geoPoints: AnalyticsGeoPoint[] = [...geoBuckets.values()]
    .map((g) => ({
      lat: g.lat,
      lon: g.lon,
      country: g.country,
      city: g.city,
      visitors: g.sessions.size,
      live: g.live,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 80)

  return {
    data: {
      pageviews,
      visitors,
      bounceRate,
      avgPagesPerSession,
      liveVisitors: liveSessions.size,
      topPages: topN(pageCounts, 8).map(([path, views]) => ({ path, views })),
      topReferrers: topN(refCounts, 6).map(([referrer, views]) => ({ referrer, views })),
      deviceBreakdown: topN(deviceCounts, 4).map(([device, views]) => ({ device, views })),
      topCountries: topN(countryCounts, 8).map(([country, views]) => ({
        country,
        label: countryLabel(country),
        views,
      })),
      geoPoints,
      daily: [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({
          day,
          pageviews: v.pageviews,
          visitors: v.sessions.size,
        })),
    },
    schemaMissing: false,
  }
}

function topN(map: Map<string, number>, n: number): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function normalizeReferrer(referrer: string): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host || 'direct'
  } catch {
    return referrer.slice(0, 80) || 'direct'
  }
}

export { DEMO_SUMMARY }
