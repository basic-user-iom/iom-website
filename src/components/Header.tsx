import { useEffect, useRef, useState } from 'react'

import { LanguageSwitcher } from './LanguageSwitcher'
import { useSiteI18n } from '../i18n'
import { localizedSections } from '../i18n/projects/localize'
import { getDeviceProfile } from '../utils/device'
import { persistMute, readStoredMute } from '../utils/audioPrefs'
import { toggleSiteMute } from './SiteAmbientAudio'

const RAVEN_POSTER = '/assets/raven_mascot.webp?v=20260728'
const RAVEN_POSTER_2X = '/assets/raven_mascot@2x.webp?v=20260728'
const RAVEN_VIDEO = '/assets/raven_crop.mp4'

export function Header() {
  const { t, href, lang } = useSiteI18n()
  const sections = localizedSections(lang)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [siteMuted, setSiteMuted] = useState(() => readStoredMute('site'))
  const videoRef = useRef<HTMLVideoElement>(null)
  const profile = getDeviceProfile()
  // Mobile: skip the ~2.4MB autoplay loop — static poster is enough in the 44px badge.
  const useStaticRaven = profile.isMobile || profile.prefersReducedMotion

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || useStaticRaven) return

    const onVisibility = () => {
      if (document.hidden) {
        video.pause()
      } else {
        void video.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [useStaticRaven])

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
  const onBlog = /(?:^|\/)blog(?:\/|$)/.test(path)

  const handleMuteClick = () => {
    const next = toggleSiteMute()
    setSiteMuted(next)
    persistMute('site', next)
  }

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <a href="#main-content" className="skip-link">
        {t('nav.skip')}
      </a>
      <a href={href('/')} className="header-brand">
        <div className="raven-mascot-wrap">
          {useStaticRaven ? (
            <img
              className="raven-mascot"
              src={RAVEN_POSTER}
              srcSet={`${RAVEN_POSTER} 1x, ${RAVEN_POSTER_2X} 2x`}
              alt=""
              width={44}
              height={44}
              decoding="async"
              aria-hidden="true"
            />
          ) : (
            <video
              ref={videoRef}
              className="raven-mascot"
              src={RAVEN_VIDEO}
              poster={RAVEN_POSTER}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="brand-text">
          <span className="brand-name">IOM</span>
          <span className="brand-tag">{t('nav.brandTag')}</span>
        </div>
      </a>

      <nav id="site-nav" className={`header-nav${menuOpen ? ' is-open' : ''}`} aria-label={t('nav.primaryAria')}>
        <div className="header-nav-group" role="presentation">
          {sections.map((s) => (
            <a key={s.id} href={href(`/#${s.id}`)} onClick={closeMenu}>
              {s.label}
            </a>
          ))}
        </div>
        <span className="header-nav-divider" aria-hidden="true" />
        <div className="header-nav-group" role="presentation">
          <a href={href('/blog')} className={onBlog ? 'is-active' : undefined} onClick={closeMenu}>
            {t('nav.blog')}
          </a>
          <a href={href('/#about')} onClick={closeMenu}>
            {t('nav.about')}
          </a>
        </div>
        <div className="header-nav-mobile-cta">
          <a href={href('/#contact')} className="header-cta" onClick={closeMenu}>
            {t('nav.contact')}
          </a>
          <a href="/client-login" className="header-login" onClick={closeMenu}>
            {t('nav.login')}
          </a>
        </div>
      </nav>

      <div className="header-tools">
        <LanguageSwitcher />
        <button
          type="button"
          className={`header-mute${siteMuted ? ' header-mute--listen' : ''}`}
          onClick={handleMuteClick}
          aria-label={siteMuted ? t('nav.listenAria') : t('nav.muteAria')}
          aria-pressed={!siteMuted}
          title={siteMuted ? t('nav.listenAria') : t('nav.muteAria')}
        >
          {siteMuted ? t('nav.listen') : t('nav.mute')}
        </button>
        <a href={href('/#contact')} className="header-cta" onClick={closeMenu}>
          {t('nav.contact')}
        </a>
        <a href="/client-login" className="header-login" onClick={closeMenu}>
          {t('nav.login')}
        </a>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sr-only">{t('nav.menu')}</span>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  )
}
