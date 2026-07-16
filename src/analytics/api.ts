import { getSupabase } from '../crm/supabaseClient'
import type { AnalyticsRange, AnalyticsSummary } from './types'

const DEMO_SUMMARY: AnalyticsSummary = {
  pageviews: 2847,
  visitors: 912,
  bounceRate: 42,
  avgPagesPerSession: 3.1,
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

  const { data: events, error } = await sb
    .from('site_analytics_events')
    .select('session_id, path, referrer, device_type, created_at')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) {
    const missing =
      error.message.includes('site_analytics_events') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    return { data: null, schemaMissing: missing }
  }

  if (!events?.length) {
    return {
      data: {
        pageviews: 0,
        visitors: 0,
        bounceRate: 0,
        avgPagesPerSession: 0,
        topPages: [],
        topReferrers: [],
        deviceBreakdown: [],
        daily: [],
      },
      schemaMissing: false,
    }
  }

  const sessions = new Map<string, number>()
  const pageCounts = new Map<string, number>()
  const refCounts = new Map<string, number>()
  const deviceCounts = new Map<string, number>()
  const dailyMap = new Map<string, { pageviews: number; sessions: Set<string> }>()

  for (const row of events) {
    sessions.set(row.session_id, (sessions.get(row.session_id) ?? 0) + 1)
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1)

    const ref = normalizeReferrer(row.referrer)
    refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1)
    deviceCounts.set(row.device_type, (deviceCounts.get(row.device_type) ?? 0) + 1)

    const day = row.created_at.slice(0, 10)
    if (!dailyMap.has(day)) dailyMap.set(day, { pageviews: 0, sessions: new Set() })
    const bucket = dailyMap.get(day)!
    bucket.pageviews += 1
    bucket.sessions.add(row.session_id)
  }

  const pageviews = events.length
  const visitors = sessions.size
  const singlePageSessions = [...sessions.values()].filter((n) => n === 1).length
  const bounceRate = visitors ? Math.round((singlePageSessions / visitors) * 100) : 0
  const avgPagesPerSession = visitors ? Math.round((pageviews / visitors) * 10) / 10 : 0

  return {
    data: {
      pageviews,
      visitors,
      bounceRate,
      avgPagesPerSession,
      topPages: topN(pageCounts, 8).map(([path, views]) => ({ path, views })),
      topReferrers: topN(refCounts, 6).map(([referrer, views]) => ({ referrer, views })),
      deviceBreakdown: topN(deviceCounts, 4).map(([device, views]) => ({ device, views })),
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
