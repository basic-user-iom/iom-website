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
]

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
  daily: Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (13 - i))
    const day = d.toISOString().slice(0, 10)
    const base = 120 + Math.round(Math.sin(i / 2) * 40 + i * 8)
    return { day, pageviews: base + 40, visitors: Math.round(base * 0.38) }
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
  event_type?: string | null
  is_bot?: boolean | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  search_keyword?: string | null
  duration_ms?: number | null
  link_url?: string | null
  link_label?: string | null
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

  const selectFull =
    'session_id, path, referrer, device_type, created_at, country, city, latitude, longitude, event_type, is_bot, utm_source, utm_medium, utm_campaign, utm_term, search_keyword, duration_ms, link_url, link_label'

  let events: EventRow[] | null = null
  let error: { message: string; code?: string } | null = null

  const withAll = await sb
    .from('site_analytics_events')
    .select(selectFull)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(12000)

  if (withAll.error) {
    const fallback = await sb
      .from('site_analytics_events')
      .select('session_id, path, referrer, device_type, created_at, country, city, latitude, longitude')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })
      .limit(12000)
    if (fallback.error) {
      const basic = await sb
        .from('site_analytics_events')
        .select('session_id, path, referrer, device_type, created_at')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(12000)
      events = basic.data
      error = basic.error
    } else {
      events = fallback.data
    }
  } else {
    events = withAll.data
  }

  if (error) {
    const missing =
      error.message.includes('site_analytics_events') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    return { data: null, schemaMissing: missing }
  }

  if (!events?.length) return { data: emptySummary(), schemaMissing: false }

  const pageviewsRows = events.filter((e) => (e.event_type || 'pageview') === 'pageview')
  const engageRows = events.filter((e) => e.event_type === 'engage')
  const clickRows = events.filter((e) => e.event_type === 'click')

  const humanPageviews = pageviewsRows.filter((e) => !e.is_bot)
  const statsRows = humanPageviews.length ? humanPageviews : pageviewsRows

  const sessions = new Map<string, number>()
  const humanSessions = new Set<string>()
  const botSessions = new Set<string>()
  const pageCounts = new Map<string, number>()
  const refCounts = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  const keywordCounts = new Map<string, number>()
  const linkCounts = new Map<string, { url: string; label: string; clicks: number }>()
  const deviceCounts = new Map<string, number>()
  const countryCounts = new Map<string, number>()
  const dailyMap = new Map<string, { pageviews: number; sessions: Set<string> }>()
  const geoBuckets = new Map<
    string,
    { lat: number; lon: number; country: string; city: string; sessions: Set<string>; live: boolean }
  >()
  const liveSessions = new Set<string>()
  const now = Date.now()

  for (const row of statsRows) {
    sessions.set(row.session_id, (sessions.get(row.session_id) ?? 0) + 1)
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1)

    const ref = normalizeReferrer(row.referrer)
    refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1)

    const source = acquisitionLabel(row)
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)

    const kw = (row.search_keyword || row.utm_term || '').trim().toLowerCase()
    if (kw) keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 1)

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

  for (const row of pageviewsRows) {
    if (row.is_bot) botSessions.add(row.session_id)
    else humanSessions.add(row.session_id)
  }

  for (const row of clickRows) {
    if (row.is_bot) continue
    const url = (row.link_url || '').trim()
    if (!url) continue
    const label = (row.link_label || url).trim()
    const key = url
    const prev = linkCounts.get(key)
    if (prev) prev.clicks += 1
    else linkCounts.set(key, { url, label: label.slice(0, 80), clicks: 1 })
  }

  let totalDuration = 0
  let durationSamples = 0
  for (const row of engageRows) {
    if (row.is_bot) continue
    if (typeof row.duration_ms === 'number' && row.duration_ms > 0) {
      totalDuration += row.duration_ms
      durationSamples += 1
    }
  }

  const pageviews = statsRows.length
  const visitors = sessions.size
  const singlePageSessions = [...sessions.values()].filter((n) => n === 1).length
  const bounceRate = visitors ? Math.round((singlePageSessions / visitors) * 100) : 0
  const avgPagesPerSession = visitors ? Math.round((pageviews / visitors) * 10) / 10 : 0
  const avgTimeOnPageSec = durationSamples
    ? Math.round(totalDuration / durationSamples / 1000)
    : 0

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
      avgTimeOnPageSec,
      humanVisitors: humanSessions.size,
      botVisitors: botSessions.size,
      liveVisitors: liveSessions.size,
      topPages: topN(pageCounts, 8).map(([path, views]) => ({ path, views })),
      topReferrers: topN(refCounts, 6).map(([referrer, views]) => ({ referrer, views })),
      topSources: topN(sourceCounts, 6).map(([source, views]) => ({ source, views })),
      topKeywords: topN(keywordCounts, 8).map(([keyword, views]) => ({ keyword, views })),
      topLinks: [...linkCounts.values()]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 8),
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

function acquisitionLabel(row: EventRow): string {
  const source = (row.utm_source || '').trim()
  const medium = (row.utm_medium || '').trim()
  if (source || medium) return `${source || '(direct)'} / ${medium || '(none)'}`
  const ref = normalizeReferrer(row.referrer)
  if (ref === 'direct') return 'direct / none'
  if (ref.includes('google.')) return 'google / organic'
  if (ref.includes('bing.')) return 'bing / organic'
  if (ref.includes('duckduckgo.')) return 'duckduckgo / organic'
  if (ref.includes('linkedin.') || ref.includes('twitter.') || ref.includes('x.com') || ref.includes('facebook.')) {
    return `${ref} / social`
  }
  if (ref.includes('github.')) return 'github / referral'
  return `${ref} / referral`
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
