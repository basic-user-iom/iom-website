import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { isIcmDemoUnlocked, lockIcmDemo, unlockIcmDemo } from './auth'
import { EXHIBITIONS, MOTION, STILLS, type ViewMode } from './data'
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

function StillPlaceholders({ mode }: { mode: ViewMode }) {
  if (mode === 'grid') {
    return (
      <div className="icm-work-grid">
        {STILLS.map((item) => (
          <article key={item.id} className="icm-work-card">
            <div className="icm-work-card__frame" style={{ background: item.tone }}>
              <div className="icm-work-item__placeholder">Image</div>
            </div>
            <p className="icm-work-card__title">{item.title}</p>
            <div className="icm-work-card__meta">
              {item.imageCount} images · {item.year}
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="icm-work-list">
      {STILLS.map((item) => (
        <article key={item.id} className="icm-work-item">
          <div className="icm-work-item__meta-left">{item.imageCount} Images</div>
          <div>
            <div
              className={`icm-work-item__frame icm-work-item__frame--${item.aspect}`}
              style={{ background: item.tone }}
            >
              <div className="icm-work-item__placeholder">Image placeholder</div>
            </div>
            <p className="icm-work-item__title">{item.title}</p>
          </div>
          <div className="icm-work-item__meta-right">
            <div>{item.client}</div>
            <div>{item.year}</div>
          </div>
        </article>
      ))}
    </div>
  )
}

function CloudsPage() {
  const chapters = [
    { title: 'Dawn', count: '72 photos' },
    { title: 'Midday', count: '96 photos' },
    { title: 'Storm', count: '84 photos' },
    { title: 'Dusk', count: '108 photos' },
  ]

  return (
    <div className="icm-clouds">
      <a className="icm-back" href={hrefFor('exhibitions')} onClick={(e) => {
        e.preventDefault()
        navigate(hrefFor('exhibitions'))
      }}>
        ← Exhibitions
      </a>
      <div className="icm-clouds__stage">
        <div className="icm-clouds__drift icm-clouds__drift--a" />
        <div className="icm-clouds__drift icm-clouds__drift--b" />
        <div className="icm-clouds__drift icm-clouds__drift--c" />
        <div className="icm-clouds__overlay">
          <h1>Clouds</h1>
          <p>
            WebGL sky navigation comes next. For now: atmospheric stub + chapter entry points.
            Opening a chapter will lead to a normal gallery of that group.
          </p>
        </div>
      </div>
      <div className="icm-clouds__chapters">
        {chapters.map((c) => (
          <button key={c.title} type="button" className="icm-clouds__chapter">
            <strong>{c.title}</strong>
            <span>{c.count} · gallery soon</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function IcmDemoApp() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [unlocked, setUnlocked] = useState(() => isIcmDemoUnlocked())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  const go = (next: Page) => (e: MouseEvent) => {
    e.preventDefault()
    navigate(hrefFor(next))
  }

  const activeNav = page === 'clouds' ? 'exhibitions' : page

  return (
    <div className="icm-app">
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
              <p>Placeholder stills for the ICM preview. Replace with client photography via the image prep flow.</p>
            </div>
            <StillPlaceholders mode={viewMode} />
          </>
        )}

        {page === 'stills' && (
          <>
            <div className="icm-page-intro">
              <h1>Stills</h1>
              <p>Series placeholders — list and grid views, GSP-quiet layout.</p>
            </div>
            <StillPlaceholders mode={viewMode} />
          </>
        )}

        {page === 'motion' && (
          <>
            <div className="icm-page-intro">
              <h1>Motion</h1>
              <p>Film and directed work. Placeholders until cuts and embeds are provided.</p>
            </div>
            <div className="icm-motion-list">
              {MOTION.map((item) => (
                <article key={item.id} className="icm-motion-item">
                  <div className="icm-motion-item__frame" style={{ background: item.tone }}>
                    <div className="icm-motion-item__placeholder">
                      <span>Film placeholder</span>
                      <span>{item.duration}</span>
                    </div>
                  </div>
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
              <p>Large bodies of work as chapters. Clouds uses 3D sky navigation; others stay editorial.</p>
            </div>
            <div className="icm-exhibit-list">
              {EXHIBITIONS.map((ex) => (
                <article key={ex.id} className="icm-exhibit-row">
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
                    <span className="icm-exhibit-row__cta" style={{ opacity: 0.45 }}>
                      Soon
                    </span>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {page === 'clouds' && <CloudsPage />}

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
                Copy, portrait, and credits will replace this text. The site shell is ready for
                client images once they are prepared (EXIF stripped, resized, compressed).
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

      <footer className="icm-footer">
        <span>ICM · private demo</span>
        <span>
          <a href="/tools/image-prep" onClick={(e) => e.preventDefault()} title="Coming next">
            Prep images
          </a>
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
    </div>
  )
}
