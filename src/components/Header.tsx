import { useEffect, useRef, useState } from 'react'

import { SECTIONS } from '../data/projects'
import { getDeviceProfile } from '../utils/device'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
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

      <nav id="site-nav" className={`header-nav${menuOpen ? ' is-open' : ''}`}>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`/#${s.id}`} onClick={closeMenu}>
            {s.label}
          </a>
        ))}
        <a href="/#contact" onClick={closeMenu}>
          Contact
        </a>
        <a href="/client-login" onClick={closeMenu}>
          Client Login
        </a>
      </nav>
    </header>
  )
}
