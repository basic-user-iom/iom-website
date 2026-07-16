import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAnalyticsSummary } from '../analytics/api'
import type { AnalyticsRange, AnalyticsSummary } from '../analytics/types'
import {
  SEO_TARGETS,
  SEO_UPGRADES,
  contentInventory,
  seoUpgradeStats,
} from '../seo'
import { SITE_ORIGIN } from '../seo/siteConfig'
import { useCrmI18n } from './i18n'

const AnalyticsGlobe = lazy(() =>
  import('./AnalyticsGlobe').then((m) => ({ default: m.AnalyticsGlobe })),
)

interface SeoViewProps {
  demo?: boolean
}

const RANGES: AnalyticsRange[] = [
  { from: '', to: '', label: '7d' },
  { from: '', to: '', label: '30d' },
  { from: '', to: '', label: '90d' },
]

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="crm-seo-bar" aria-hidden="true">
      <span className="crm-seo-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Sparkline({ daily }: { daily: AnalyticsSummary['daily'] }) {
  const max = Math.max(...daily.map((d) => d.pageviews), 1)
  return (
    <div className="crm-seo-sparkline" aria-hidden="true">
      {daily.map((d) => (
        <span
          key={d.day}
          className="crm-seo-spark-bar"
          style={{ height: `${Math.max(8, (d.pageviews / max) * 100)}%` }}
          title={`${d.day}: ${d.pageviews} views`}
        />
      ))}
    </div>
  )
}

function formatDuration(sec: number): string {
  if (!sec || sec < 1) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s}s`
}

export function SeoView({ demo = false }: SeoViewProps) {
  const { t } = useCrmI18n()
  const [range, setRange] = useState<AnalyticsRange>(RANGES[1])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  const upgradeStats = useMemo(() => seoUpgradeStats(), [])
  const inventory = useMemo(() => contentInventory(), [])

  const load = useCallback(async () => {
    const { data, schemaMissing: missing } = await fetchAnalyticsSummary(range, demo)
    setSummary(data)
    setSchemaMissing(missing)
    setLoading(false)
  }, [range, demo])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => {
      void load()
    }, 25_000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <div className="crm-seo-view">
      <div className="crm-seo-header">
        <div>
          <p className="crm-seo-kicker">{t('seo.kicker')}</p>
          <h2 className="crm-seo-title">{t('seo.title')}</h2>
          <p className="crm-muted crm-seo-intro">{t('seo.intro')}</p>
        </div>
        <div className="crm-seo-header-actions">
          <a
            href={SITE_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            {t('seo.openSite')}
          </a>
          <a
            href={`${SITE_ORIGIN}/sitemap.xml`}
            className="btn btn-ghost"
            target="_blank"
            rel="noreferrer"
          >
            {t('seo.sitemap')}
          </a>
        </div>
      </div>

      {schemaMissing && !demo && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('seo.schemaMissing')}
        </p>
      )}

      <section className="crm-seo-panel">
        <div className="crm-seo-panel-head">
          <h3 className="crm-seo-panel-title">{t('seo.trafficTitle')}</h3>
          <div className="crm-seo-range-tabs" role="tablist" aria-label={t('seo.rangeAria')}>
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                role="tab"
                aria-selected={range.label === r.label}
                className={`crm-seo-range-tab${range.label === r.label ? ' is-active' : ''}`}
                onClick={() => setRange(r)}
              >
                {t(`seo.range.${r.label}`)}
              </button>
            ))}
          </div>
        </div>

        {loading && !summary ? (
          <p className="crm-muted">{t('seo.loading')}</p>
        ) : summary ? (
          <>
            <div className="crm-seo-stats">
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.pageviews.toLocaleString()}</span>
                <span className="crm-stat-label">{t('seo.pageviews')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.humanVisitors.toLocaleString()}</span>
                <span className="crm-stat-label">{t('seo.humans')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.botVisitors.toLocaleString()}</span>
                <span className="crm-stat-label">{t('seo.bots')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.liveVisitors.toLocaleString()}</span>
                <span className="crm-stat-label">{t('seo.liveVisitors')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{formatDuration(summary.avgTimeOnPageSec)}</span>
                <span className="crm-stat-label">{t('seo.avgTime')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.bounceRate}%</span>
                <span className="crm-stat-label">{t('seo.bounce')}</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{summary.avgPagesPerSession}</span>
                <span className="crm-stat-label">{t('seo.pagesPerSession')}</span>
              </div>
            </div>

            <div className="crm-seo-map-row">
              <div className="crm-seo-globe-panel">
                <h4 className="crm-seo-subtitle">{t('seo.globeTitle')}</h4>
                <p className="crm-muted crm-seo-globe-blurb">{t('seo.globeBlurb')}</p>
                <Suspense fallback={<p className="crm-muted">{t('seo.globeLoading')}</p>}>
                  <AnalyticsGlobe
                    points={summary.geoPoints}
                    liveVisitors={summary.liveVisitors}
                  />
                </Suspense>
              </div>
              <div className="crm-seo-map-side">
                {summary.daily.length > 0 && (
                  <div className="crm-seo-chart-wrap">
                    <p className="crm-seo-chart-label">{t('seo.dailyTrend')}</p>
                    <Sparkline daily={summary.daily} />
                  </div>
                )}
                <h4 className="crm-seo-subtitle">{t('seo.topCountries')}</h4>
                <ul className="crm-seo-list">
                  {summary.topCountries.length === 0 ? (
                    <li className="crm-muted">{t('seo.noGeo')}</li>
                  ) : (
                    summary.topCountries.map((row) => (
                      <li key={row.country} className="crm-seo-list-row">
                        <span className="crm-seo-list-label">
                          {row.label} <span className="crm-seo-cc">{row.country}</span>
                        </span>
                        <span className="crm-seo-list-value">{row.views}</span>
                        <MiniBar
                          value={row.views}
                          max={summary.topCountries[0]?.views ?? 1}
                        />
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="crm-seo-columns crm-seo-columns--4">
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.topSources')}</h4>
                <p className="crm-muted crm-seo-col-note">{t('seo.topSourcesNote')}</p>
                <ul className="crm-seo-list">
                  {summary.topSources.length === 0 ? (
                    <li className="crm-muted">{t('seo.noSources')}</li>
                  ) : (
                    summary.topSources.map((row) => (
                      <li key={row.source} className="crm-seo-list-row">
                        <span className="crm-seo-list-label">{row.source}</span>
                        <span className="crm-seo-list-value">{row.views}</span>
                        <MiniBar value={row.views} max={summary.topSources[0]?.views ?? 1} />
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.topKeywords')}</h4>
                <p className="crm-muted crm-seo-col-note">{t('seo.topKeywordsNote')}</p>
                <ul className="crm-seo-list">
                  {summary.topKeywords.length === 0 ? (
                    <li className="crm-muted">{t('seo.noKeywords')}</li>
                  ) : (
                    summary.topKeywords.map((row) => (
                      <li key={row.keyword} className="crm-seo-list-row">
                        <span className="crm-seo-list-label">{row.keyword}</span>
                        <span className="crm-seo-list-value">{row.views}</span>
                        <MiniBar value={row.views} max={summary.topKeywords[0]?.views ?? 1} />
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.topLinks')}</h4>
                <p className="crm-muted crm-seo-col-note">{t('seo.topLinksNote')}</p>
                <ul className="crm-seo-list">
                  {summary.topLinks.length === 0 ? (
                    <li className="crm-muted">{t('seo.noLinks')}</li>
                  ) : (
                    summary.topLinks.map((row) => (
                      <li key={row.url} className="crm-seo-list-row">
                        <span className="crm-seo-list-label" title={row.url}>
                          {row.label || row.url}
                        </span>
                        <span className="crm-seo-list-value">{row.clicks}</span>
                        <MiniBar value={row.clicks} max={summary.topLinks[0]?.clicks ?? 1} />
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.topReferrers')}</h4>
                <ul className="crm-seo-list">
                  {summary.topReferrers.map((row) => (
                    <li key={row.referrer} className="crm-seo-list-row">
                      <span className="crm-seo-list-label">{row.referrer}</span>
                      <span className="crm-seo-list-value">{row.views}</span>
                      <MiniBar value={row.views} max={summary.topReferrers[0]?.views ?? 1} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="crm-seo-columns">
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.topPages')}</h4>
                <ul className="crm-seo-list">
                  {summary.topPages.map((row) => (
                    <li key={row.path} className="crm-seo-list-row">
                      <span className="crm-seo-list-label">{row.path}</span>
                      <span className="crm-seo-list-value">{row.views}</span>
                      <MiniBar value={row.views} max={summary.topPages[0]?.views ?? 1} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="crm-seo-col">
                <h4 className="crm-seo-subtitle">{t('seo.devices')}</h4>
                <ul className="crm-seo-list">
                  {summary.deviceBreakdown.map((row) => (
                    <li key={row.device} className="crm-seo-list-row">
                      <span className="crm-seo-list-label">{row.device}</span>
                      <span className="crm-seo-list-value">{row.views}</span>
                      <MiniBar
                        value={row.views}
                        max={summary.deviceBreakdown[0]?.views ?? 1}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {demo && (
              <p className="crm-muted crm-seo-demo-note">{t('seo.demoNote')}</p>
            )}
          </>
        ) : (
          <p className="crm-muted">{t('seo.noData')}</p>
        )}
      </section>

      <div className="crm-seo-grid">
        <section className="crm-seo-panel">
          <h3 className="crm-seo-panel-title">{t('seo.upgradesTitle')}</h3>
          <p className="crm-muted crm-seo-panel-blurb">{t('seo.upgradesBlurb')}</p>
          <div className="crm-seo-upgrade-stats">
            <span>{t('seo.upgradeDone', { n: String(upgradeStats.done) })}</span>
            <span>{t('seo.upgradePending', { n: String(upgradeStats.pending) })}</span>
            <span>{t('seo.upgradePlanned', { n: String(upgradeStats.planned) })}</span>
          </div>
          <ul className="crm-seo-upgrades">
            {SEO_UPGRADES.map((item) => (
              <li key={item.id} className={`crm-seo-upgrade crm-seo-upgrade--${item.status}`}>
                <div className="crm-seo-upgrade-head">
                  <strong>{item.title}</strong>
                  <span className="crm-seo-upgrade-badge">{item.status}</span>
                </div>
                <p className="crm-muted">{item.description}</p>
                <span className="crm-seo-upgrade-meta">
                  {item.category}
                  {item.date ? ` · ${item.date}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="crm-seo-panel">
          <h3 className="crm-seo-panel-title">{t('seo.targetsTitle')}</h3>
          <p className="crm-muted crm-seo-panel-blurb">{t('seo.targetsBlurb')}</p>
          <ul className="crm-seo-targets">
            {SEO_TARGETS.map((target) => (
              <li key={target.id} className="crm-seo-target">
                <div className="crm-seo-target-head">
                  <strong>{target.phrase}</strong>
                  <span className={`crm-seo-priority crm-seo-priority--${target.priority}`}>
                    {target.priority}
                  </span>
                </div>
                <p className="crm-muted">
                  {target.intent} · {target.pages.join(', ')}
                </p>
                {target.notes && <p className="crm-seo-target-notes">{target.notes}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="crm-seo-panel">
          <h3 className="crm-seo-panel-title">{t('seo.contentTitle')}</h3>
          <p className="crm-muted crm-seo-panel-blurb">{t('seo.contentBlurb')}</p>
          <ul className="crm-seo-inventory">
            {inventory.map((section) => (
              <li key={section.id} className="crm-seo-inventory-row">
                <div>
                  <strong>{section.label}</strong>
                  <p className="crm-muted">{section.blurb}</p>
                </div>
                <span className="crm-seo-inventory-meta">
                  {section.projectCount} {t('seo.projects')} · {section.anchor}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
