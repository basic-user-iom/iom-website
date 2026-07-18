import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { isIcmDemoUnlocked, lockIcmDemo, tryCrmEmbedUnlock, unlockIcmDemo } from './auth'
import { EXHIBITIONS, MOTION, STILLS, type StillProject, type ViewMode } from './data'
import { CloudsScene } from './CloudsScene'
import { Lightbox, type LightboxState } from './Lightbox'
import './icm-demo.css'

const BASE = '/demo/icm'

export function isIcmDemoPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === BASE || p.startsWith(`${BASE}/`)
}

type Page =
  | 'home'
  | 'stills'
  | 'motion'
  | 'exhibitions'
  | 'clouds'
  | 'about'
  | 'contact'

function parsePage(pathname: string): Page {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === `${BASE}/stills`) return 'stills'
  if (p === `${BASE}/motion`) return 'motion'
  if (p === `${BASE}/exhibitions`) return 'exhibitions'
  if (p === `${BASE}/exhibitions/clouds`) return 'clouds'
  if (p === `${BASE}/about`) return 'about'
  if (p === `${BASE}/contact`) return 'contact'
  return 'home'
}

function hrefFor(page: Page): string {
  switch (page) {
    case 'home':
      return BASE
    case 'clouds':
      return `${BASE}/exhibitions/clouds`
    default:
      return `${BASE}/${page}`
  }
}

function navigate(to: string) {
  if (window.location.pathname === to) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const NAV: { page: Page; label: string }[] = [
  { page: 'home', label: 'Home' },
  { page: 'stills', label: 'Stills' },
  { page: 'motion', label: 'Motion' },
  { page: 'exhibitions', label: 'Exhibitions' },
  { page: 'about', label: 'About' },
  { page: 'contact', label: 'Contact' },
]

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (unlockIcmDemo(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="icm-gate">
      <div className="icm-gate__panel">
        <div className="icm-gate__brand">ICM</div>
        <p className="icm-gate__hint">Private client preview. Enter the password to continue.</p>
        <form className="icm-gate__form" onSubmit={submit}>
          <input
            className="icm-gate__input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(false)
            }}
            autoFocus
          />
          <button className="icm-gate__submit" type="submit">
            Enter
          </button>
          {error ? <p className="icm-gate__error">Incorrect password.</p> : null}
        </form>
      </div>
    </div>
  )
}

function StillPlaceholders({
  mode,
  onOpen,
}: {
  mode: ViewMode
  onOpen: (project: StillProject) => void
}) {
  if (mode === 'grid') {
    return (
      <div className="icm-work-grid">
        {STILLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="icm-work-card icm-clickable"
            onClick={() => onOpen(item)}
          >
            <div className="icm-work-card__frame">
              <img className="icm-work-card__img" src={item.cover} alt="" loading="lazy" />
            </div>
            <p className="icm-work-card__title">{item.title}</p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="icm-work-list">
      {STILLS.map((item) => (
        <article key={item.id} className="icm-work-item">
          <div className="icm-work-item__meta-left">{item.images.length} Images</div>
          <button
            type="button"
            className="icm-work-item__frame icm-clickable"
            onClick={() => onOpen(item)}
            aria-label={item.title}
          >
            <img className="icm-work-item__img" src={item.cover} alt="" loading="lazy" />
          </button>
          <div className="icm-work-item__meta-right">
            <div>{item.client}</div>
            <div>{item.year}</div>
          </div>
        </article>
      ))}
    </div>
  )
}

function CloudsPage({
  onOpenChapter,
}: {
  onOpenChapter: (title: string, images: string[], imageIndex?: number) => void
}) {
  return (
    <div className="icm-clouds">
      <div className="icm-clouds__back-wrap">
        <a
          className="icm-back"
          href={hrefFor('exhibitions')}
          onClick={(e) => {
            e.preventDefault()
            navigate(hrefFor('exhibitions'))
          }}
        >
          ← Exhibitions
        </a>
      </div>
      <CloudsScene onOpenChapter={onOpenChapter} />
    </div>
  )
}

export function IcmDemoApp() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [unlocked, setUnlocked] = useState(
    () => tryCrmEmbedUnlock() || isIcmDemoUnlocked(),
  )
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const page = useMemo(() => parsePage(path), [path])
  const showViewToggle = page === 'home' || page === 'stills'

  useEffect(() => {
    document.body.classList.add('icm-route')
    return () => document.body.classList.remove('icm-route')
  }, [])

  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }, [page])

  const openGallery = (title: string, images: string[], index = 0) => {
    setLightbox({ title, images, index })
  }

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  const go = (next: Page) => (e: MouseEvent) => {
    e.preventDefault()
    navigate(hrefFor(next))
  }

  const activeNav = page === 'clouds' ? 'exhibitions' : page

  return (
    <div className={`icm-app${page === 'clouds' ? ' icm-app--clouds' : ''}`}>
      <header className={`icm-header${scrolled ? ' icm-header--scrolled' : ''}`}>
        <a className="icm-brand" href={BASE} onClick={go('home')}>
          ICM
        </a>

        {showViewToggle ? (
          <div className="icm-view-toggle" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'list' ? 'is-active' : undefined}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              type="button"
              className={viewMode === 'grid' ? 'is-active' : undefined}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
          </div>
        ) : (
          <div />
        )}

        <nav className="icm-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.page}
              href={hrefFor(item.page)}
              className={activeNav === item.page ? 'is-active' : undefined}
              onClick={go(item.page)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="icm-menu-btn"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <nav className={`icm-mobile-nav${menuOpen ? ' is-open' : ''}`} aria-label="Mobile">
        {NAV.map((item) => (
          <a
            key={item.page}
            href={hrefFor(item.page)}
            className={activeNav === item.page ? 'is-active' : undefined}
            onClick={go(item.page)}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <main className="icm-main">
        {page === 'home' && (
          <>
            <div className="icm-page-intro">
              <h1>Selected work</h1>
              <p>Click any image to open the series. Sample stock photos for layout preview only.</p>
            </div>
            <StillPlaceholders
              mode={viewMode}
              onOpen={(p) => openGallery(p.title, p.images)}
            />
          </>
        )}

        {page === 'stills' && (
          <>
            <div className="icm-page-intro">
              <h1>Stills</h1>
              <p>Click a series to browse. List and grid use the same galleries.</p>
            </div>
            <StillPlaceholders
              mode={viewMode}
              onOpen={(p) => openGallery(p.title, p.images)}
            />
          </>
        )}

        {page === 'motion' && (
          <>
            <div className="icm-page-intro">
              <h1>Motion</h1>
              <p>Poster frames for now — click to enlarge. Film embeds come later.</p>
            </div>
            <div className="icm-motion-list">
              {MOTION.map((item) => (
                <article key={item.id} className="icm-motion-item">
                  <button
                    type="button"
                    className="icm-motion-item__frame icm-clickable"
                    onClick={() => openGallery(item.title, [item.cover])}
                  >
                    <img className="icm-motion-item__img" src={item.cover} alt="" loading="lazy" />
                    <div className="icm-motion-item__play">
                      <span>View still</span>
                      <span>{item.duration}</span>
                    </div>
                  </button>
                  <div className="icm-motion-item__meta">
                    <strong>{item.title}</strong>
                    <span>
                      {item.role} · {item.year}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {page === 'exhibitions' && (
          <>
            <div className="icm-page-intro">
              <h1>Exhibitions</h1>
              <p>Clouds opens the sky chapter. Other exhibitions open sample galleries.</p>
            </div>
            <div className="icm-exhibit-list">
              {EXHIBITIONS.map((ex) => (
                <article key={ex.id} className="icm-exhibit-row">
                  <button
                    type="button"
                    className="icm-exhibit-row__thumb icm-clickable"
                    onClick={() => {
                      if (ex.mode === 'clouds') navigate(hrefFor('clouds'))
                      else openGallery(ex.title, ex.images)
                    }}
                  >
                    <img className="icm-exhibit-row__img" src={ex.cover} alt="" loading="lazy" />
                  </button>
                  <div>
                    <h2>{ex.title}</h2>
                    <p className="icm-exhibit-row__sub">
                      {ex.subtitle} · {ex.year} · {ex.photoCount}+ photos
                    </p>
                  </div>
                  <p className="icm-exhibit-row__blurb">{ex.blurb}</p>
                  {ex.mode === 'clouds' ? (
                    <a
                      className="icm-exhibit-row__cta"
                      href={hrefFor('clouds')}
                      onClick={go('clouds')}
                    >
                      Enter
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="icm-exhibit-row__cta"
                      onClick={() => openGallery(ex.title, ex.images)}
                    >
                      Open
                    </button>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {page === 'clouds' && (
          <CloudsPage
            onOpenChapter={(title, images, imageIndex) =>
              openGallery(`Clouds — ${title}`, images, imageIndex ?? 0)
            }
          />
        )}

        {page === 'about' && (
          <>
            <div className="icm-page-intro">
              <h1>About</h1>
            </div>
            <div className="icm-prose">
              <p>
                ICM is a working title for this private preview — a photographer and film director
                portfolio shaped around stills, motion, and large exhibitions.
              </p>
              <p>
                Images here are temporary stock placeholders so you can judge layout and interaction.
                Client photography will replace them after EXIF strip, resize, and compress.
              </p>
            </div>
          </>
        )}

        {page === 'contact' && (
          <>
            <div className="icm-page-intro">
              <h1>Contact</h1>
            </div>
            <div className="icm-prose">
              <p>Placeholder contact details for the client preview.</p>
              <ul className="icm-contact-list">
                <li>
                  <a href="mailto:hello@iobjectm.com">hello@iobjectm.com</a>
                </li>
                <li>
                  <a href="https://iobjectm.com" target="_blank" rel="noreferrer">
                    Built by IOM
                  </a>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>

      {page !== 'clouds' ? (
        <footer className="icm-footer">
          <span>ICM · private demo</span>
          <span>
            <a href="/tools/image-prep?from=icm">Prep images</a>
            {' · '}
            <button
              type="button"
              onClick={() => {
                lockIcmDemo()
                setUnlocked(false)
              }}
            >
              Lock
            </button>
          </span>
        </footer>
      ) : null}

      {lightbox ? (
        <Lightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
        />
      ) : null}
    </div>
  )
}
