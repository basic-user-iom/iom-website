import { useEffect, useRef, useState } from 'react'

import { SECTIONS } from '../data/projects'
import { getDeviceProfile } from '../utils/device'
import { persistMute, readStoredMute } from '../utils/audioPrefs'
import { toggleSiteMute } from './SiteAmbientAudio'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [siteMuted, setSiteMuted] = useState(() => readStoredMute('site'))
  const videoRef = useRef<HTMLVideoElement>(null)
  const profile = getDeviceProfile()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || profile.prefersReducedMotion) return

    const onVisibility = () => {
      if (document.hidden) {
        video.pause()
      } else {
        void video.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [profile.prefersReducedMotion])

  useEffect(() => {
    const onMuteEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean }>).detail
      if (typeof detail?.muted === 'boolean') setSiteMuted(detail.muted)
    }
    window.addEventListener('iom:site-audio-mute', onMuteEvent)
    return () => window.removeEventListener('iom:site-audio-mute', onMuteEvent)
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/'
  const onBlog = path === '/blog' || path.startsWith('/blog/')

  const handleMuteClick = () => {
    const next = toggleSiteMute()
    setSiteMuted(next)
    persistMute('site', next)
  }

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <a href="/" className="header-brand" aria-label="IOM home">
        <div className="raven-mascot-wrap">
          <video
            ref={videoRef}
            className="raven-mascot"
            src="/assets/raven_crop.mp4"
            poster="/assets/raven_poster.svg"
            autoPlay={!profile.prefersReducedMotion}
            loop
            muted
            playsInline
            preload={profile.prefersReducedMotion ? 'none' : 'metadata'}
            aria-hidden="true"
          />
        </div>
        <div className="brand-text">
          <span className="brand-name">IOM</span>
          <span className="brand-tag">Interactive Object Media</span>
        </div>
      </a>

      <nav id="site-nav" className={`header-nav${menuOpen ? ' is-open' : ''}`} aria-label="Primary">
        <div className="header-nav-group" role="presentation">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`/#${s.id}`} onClick={closeMenu}>
              {s.label}
            </a>
          ))}
        </div>
        <span className="header-nav-divider" aria-hidden="true" />
        <div className="header-nav-group" role="presentation">
          <a href="/blog" className={onBlog ? 'is-active' : undefined} onClick={closeMenu}>
            Blog
          </a>
          <a href="/#about" onClick={closeMenu}>
            About
          </a>
        </div>
        <div className="header-nav-mobile-cta">
          <a href="/#contact" className="header-cta" onClick={closeMenu}>
            Get in touch
          </a>
          <a href="/client-login" className="header-login" onClick={closeMenu}>
            Login
          </a>
        </div>
      </nav>

      <div className="header-tools">
        <button
          type="button"
          className="header-mute"
          onClick={handleMuteClick}
          aria-label={siteMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          aria-pressed={siteMuted}
          title={siteMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
        >
          {siteMuted ? 'Sound off' : 'Mute'}
        </button>
        <a href="/#contact" className="header-cta" onClick={closeMenu}>
          Get in touch
        </a>
        <a href="/client-login" className="header-login" onClick={closeMenu}>
          Login
        </a>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  )
}
