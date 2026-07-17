import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminModeration } from './AdminModeration'
import { ArtistDashboard } from './ArtistDashboard'
import { ArtistSlidePanel } from './ArtistSlidePanel'
import { backendMode, fetchLiveArtists } from './api'
import { GlobeScene } from './GlobeScene'
import { InviteClaim } from './InviteClaim'
import { PortfolioShowcase } from './PortfolioShowcase'
import { SubmitForm } from './SubmitForm'
import type { Artist, ArtistCategory } from './types'
import { CATEGORY_LABELS, PRIMARY_CATEGORIES } from './types'
import './artist-globe.css'

export function isArtistGlobePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/artist-globe' || p.startsWith('/artist-globe/')
}

type View = 'globe' | 'submit' | 'admin' | 'me' | 'invite'

function parseView(pathname: string): { view: View; inviteToken: string | null } {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/artist-globe/submit') return { view: 'submit', inviteToken: null }
  if (p === '/artist-globe/admin') return { view: 'admin', inviteToken: null }
  if (p === '/artist-globe/me') return { view: 'me', inviteToken: null }
  const inviteMatch = p.match(/^\/artist-globe\/invite\/([^/]+)$/)
  if (inviteMatch) return { view: 'invite', inviteToken: decodeURIComponent(inviteMatch[1]) }
  return { view: 'globe', inviteToken: null }
}

function navigate(to: string) {
  if (window.location.pathname === to) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function ArtistGlobeApp() {
  const [path, setPath] = useState(() => window.location.pathname)
  const { view, inviteToken } = parseView(path)
  const isEmbed =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('embed') || window.self !== window.top)

  const [artists, setArtists] = useState<Artist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem('artist-globe-recent')
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 3) : []
    } catch {
      return []
    }
  })
  const [category, setCategory] = useState<ArtistCategory | 'all'>('all')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const rememberOpened = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 3)
      try {
        sessionStorage.setItem('artist-globe-recent', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const openPortfolio = useCallback(
    (id: string) => {
      setSelectedId(id)
      setPortfolioOpen(true)
      rememberOpened(id)
    },
    [rememberOpened],
  )

  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    document.body.classList.add('artist-globe-route')
    if (isEmbed) document.body.classList.add('artist-globe-embed')
    return () => {
      document.body.classList.remove('artist-globe-route')
      document.body.classList.remove('artist-globe-embed')
    }
  }, [isEmbed])

  const reload = useCallback(async () => {
    const list = await fetchLiveArtists()
    setArtists(list)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, view])

  const categoryFiltered = useMemo(() => {
    return artists.filter((a) => category === 'all' || a.category === category)
  }, [artists, category])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const a of categoryFiltered) for (const t of a.tags) set.add(t)
    return [...set].sort()
  }, [categoryFiltered])

  useEffect(() => {
    setActiveTags((prev) => prev.filter((t) => allTags.includes(t)))
  }, [allTags])

  const filtered = useMemo(() => {
    return categoryFiltered.filter((a) => {
      if (activeTags.length > 0 && !activeTags.every((t) => a.tags.includes(t))) return false
      return true
    })
  }, [categoryFiltered, activeTags])

  const selected = artists.find((a) => a.id === selectedId) ?? null

  const recentArtists = useMemo(() => {
    return recentIds
      .map((id) => artists.find((a) => a.id === id))
      .filter((a): a is Artist => Boolean(a))
  }, [recentIds, artists])

  useEffect(() => {
    if (!selected) setPortfolioOpen(false)
  }, [selected])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  return (
    <div className={`ag-app${isEmbed ? ' ag-app--embed' : ''}`}>
      {isEmbed ? null : (
      <header className="ag-top">
        <div className="ag-brand">
          <a href="/artist-globe" className="ag-brand-link" onClick={(e) => {
            e.preventDefault()
            navigate('/artist-globe')
          }}>
            <span className="ag-brand-mark">IOM</span>
            <span className="ag-brand-name">Artist Globe</span>
          </a>
          <span className="ag-demo-badge">Demo</span>
        </div>
        <nav className="ag-nav" aria-label="Artist Globe">
          <button type="button" className={view === 'globe' ? 'is-active' : ''} onClick={() => navigate('/artist-globe')}>
            Globe
          </button>
          <button type="button" className={view === 'submit' ? 'is-active' : ''} onClick={() => navigate('/artist-globe/submit')}>
            Submit
          </button>
          <button type="button" className={view === 'me' ? 'is-active' : ''} onClick={() => navigate('/artist-globe/me')}>
            <span className="ag-nav-full">My profile</span>
            <span className="ag-nav-short">Me</span>
          </button>
          <button type="button" className={view === 'admin' ? 'is-active' : ''} onClick={() => navigate('/artist-globe/admin')}>
            Admin
          </button>
        </nav>
      </header>
      )}

      {view === 'globe' ? (
        <div className="ag-main">
          {isEmbed ? null : (
          <>
          {filtersOpen ? (
            <button
              type="button"
              className="ag-filters-backdrop"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
          ) : null}
          <aside className={`ag-filters${filtersOpen ? ' is-open' : ''}`} id="ag-filters-panel">
            <div className="ag-filters-mobile-bar">
              <span className="ag-filter-label">Filters</span>
              <button type="button" className="ag-btn ag-btn-primary" onClick={() => setFiltersOpen(false)}>
                Done
              </button>
            </div>
            <h1 className="ag-title">Artist Globe</h1>
            <p className="ag-lede">
              A living map of photographers, painters, sculptors, sound artists, and more — filter
              by practice, open a portfolio, or submit your own profile for review.
            </p>

            <div className="ag-filter-block">
              <span className="ag-filter-label">Category</span>
              <div className="ag-chips">
                <button
                  type="button"
                  className={category === 'all' ? 'is-active' : ''}
                  onClick={() => setCategory('all')}
                >
                  All
                </button>
                {PRIMARY_CATEGORIES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`ag-chip-${k} ${category === k ? 'is-active' : ''}`}
                    onClick={() => setCategory(k)}
                  >
                    {CATEGORY_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            {allTags.length > 0 ? (
              <div className="ag-filter-block">
                <span className="ag-filter-label">Tags</span>
                <div className="ag-chips ag-chips-tags">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={activeTags.includes(tag) ? 'is-active' : ''}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="ag-backend-hint">
              Data: {backendMode() === 'supabase' ? 'Supabase + seeds' : 'local demo + seeds'}
            </p>

            {recentArtists.length > 0 ? (
              <div className="ag-recent">
                <span className="ag-filter-label">Recently opened</span>
                <ol className="ag-crumbs">
                  {recentArtists.map((a, i) => (
                    <li key={a.id}>
                      {i > 0 ? <span className="ag-crumb-sep" aria-hidden="true">/</span> : null}
                      <button
                        type="button"
                        className={selectedId === a.id && portfolioOpen ? 'is-active' : ''}
                        onClick={() => openPortfolio(a.id)}
                        title={`${a.displayName} · ${a.city}`}
                      >
                        {a.displayName}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </aside>
          </>
          )}

          <div className="ag-stage">
            {isEmbed ? null : (
            <div className="ag-stage-tools">
              <button
                type="button"
                className="ag-btn ag-filters-toggle"
                aria-expanded={filtersOpen}
                aria-controls="ag-filters-panel"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filtersOpen ? 'Hide filters' : 'Filters'}
                {category !== 'all' || activeTags.length > 0
                  ? ` · ${[
                      category !== 'all' ? CATEGORY_LABELS[category] : null,
                      activeTags.length ? `${activeTags.length} tag${activeTags.length === 1 ? '' : 's'}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}`
                  : ''}
              </button>
            </div>
            )}
            {portfolioOpen && selected && !isEmbed ? (
              <PortfolioShowcase
                artist={selected}
                onClose={() => {
                  setPortfolioOpen(false)
                  setSelectedId(null)
                }}
              />
            ) : (
              <>
                <GlobeScene
                  artists={filtered}
                  selectedId={isEmbed ? null : selected?.id ?? null}
                  onSelect={(id) => {
                    if (isEmbed) return
                    setSelectedId(id)
                    setPortfolioOpen(false)
                    setFiltersOpen(false)
                    if (id) rememberOpened(id)
                  }}
                  onOpenPortfolio={isEmbed ? () => {} : openPortfolio}
                />
                {!isEmbed && selected && !portfolioOpen ? (
                  <ArtistSlidePanel
                    artist={selected}
                    recent={recentArtists}
                    onClose={() => setSelectedId(null)}
                    onOpenPortfolio={() => openPortfolio(selected.id)}
                    onSelectArtist={(id) => {
                      setSelectedId(id)
                      rememberOpened(id)
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {view === 'submit' ? (
        <div className="ag-scroll">
          <SubmitForm
            onDone={() => {
              void reload()
              navigate('/artist-globe')
            }}
            onCancel={() => navigate('/artist-globe')}
          />
        </div>
      ) : null}

      {view === 'admin' ? (
        <div className="ag-scroll">
          <AdminModeration />
        </div>
      ) : null}

      {view === 'me' ? (
        <div className="ag-scroll">
          <ArtistDashboard onBack={() => navigate('/artist-globe')} />
        </div>
      ) : null}

      {view === 'invite' && inviteToken ? (
        <div className="ag-scroll">
          <InviteClaim
            token={inviteToken}
            onClaimed={() => navigate('/artist-globe/me')}
          />
        </div>
      ) : null}
    </div>
  )
}
