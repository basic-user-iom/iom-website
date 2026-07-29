import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  requestMotionParallaxPermission,
  subscribeMotionParallaxStatus,
  type MotionParallaxStatus,
} from '../utils/deviceOrientationParallax'
import { getDeviceProfile } from '../utils/device'
import { reportHeroVisibility } from '../utils/embedVisibility'
import type { HeroSceneLoadStatus } from '../three/useHeroScene'
import { useSiteI18n } from '../i18n'
import { useSiteOrbsOptional } from './SiteOrbZone'

const HeroSceneMount = lazy(() => import('./HeroSceneMount'))

const HERO_POSTER_SRC = '/assets/posters/hero-ravens-sm.webp?v=20260728'

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

const LOADER_KEYS = ['hero.loader.0', 'hero.loader.1', 'hero.loader.2'] as const

function isNativeFullscreenActive(el: HTMLElement | null): boolean {
  if (!el) return false
  const doc = document as FullscreenDocument
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el
}

export function Hero() {
  const { t } = useSiteI18n()
  const orbs = useSiteOrbsOptional()
  const canvasRef = useRef<HTMLDivElement>(null)
  const posterSlotRef = useRef<HTMLDivElement>(null)
  const profile = getDeviceProfile()
  const useStaticHero = profile.prefersReducedMotion
  const [liveRequested, setLiveRequested] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [motionStatus, setMotionStatus] = useState<MotionParallaxStatus>('disabled')
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)
  const [loadStatus, setLoadStatus] = useState<HeroSceneLoadStatus>({
    progress: 0,
    phase: 'boot',
  })
  const [loaderLineIndex, setLoaderLineIndex] = useState(0)
  const [loaderVisible, setLoaderVisible] = useState(false)
  const [hasLcpPoster] = useState(() => Boolean(document.getElementById('lcp-poster')))
  const isFullscreen = nativeFullscreen || pseudoFullscreen
  const loaderLineCount = LOADER_KEYS.length
  const showPoster = useStaticHero || !liveRequested
  const showLiveScene = !useStaticHero && liveRequested && sceneReady

  const onSceneStatus = useCallback((status: HeroSceneLoadStatus) => {
    setLoadStatus(status)
    if (status.phase === 'ready') {
      window.setTimeout(() => setLoaderVisible(false), 420)
    }
  }, [])

  const startLiveScene = useCallback(() => {
    if (useStaticHero || liveRequested) return
    setLiveRequested(true)
    setLoaderVisible(true)
    setLoadStatus({ progress: 0, phase: 'boot' })
    orbs?.setHover(null, null)
    window.dispatchEvent(new CustomEvent('iom:hero-live', { detail: { live: true } }))
  }, [liveRequested, orbs, useStaticHero])

  // Adopt the HTML LCP <img> into the hero slot (same DOM node) so it stays
  // clipped by the canvas frame — no fixed-position drift / cropped HUD.
  useLayoutEffect(() => {
    const slot = posterSlotRef.current
    const lcp = document.getElementById('lcp-poster') as HTMLImageElement | null
    if (!slot || !lcp) return

    lcp.removeAttribute('style')
    lcp.classList.add('hero-poster')
    lcp.removeAttribute('hidden')
    if (lcp.parentElement !== slot) slot.appendChild(lcp)

    return () => {
      if (lcp.parentElement === slot) document.body.appendChild(lcp)
    }
  }, [])

  useEffect(() => {
    const lcp = document.getElementById('lcp-poster')
    if (!lcp) return
    document.body.classList.toggle('hero-live', !showPoster)
    if (showPoster) lcp.removeAttribute('hidden')
    else lcp.setAttribute('hidden', '')
  }, [showPoster])

  // Report hero viewport presence even when WebGL is static/disabled so embed slots work.
  useEffect(() => {
    const container = canvasRef.current
    if (!container) return

    const io = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0
        const visible = Boolean(entry?.isIntersecting && ratio >= 0.1)
        reportHeroVisibility(visible)
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )
    io.observe(container)
    return () => {
      io.disconnect()
      reportHeroVisibility(false)
    }
  }, [])

  // Load WebGL only after the visitor asks for the live scene.
  useEffect(() => {
    if (useStaticHero || !liveRequested) return
    let cancelled = false
    void import('./HeroSceneMount').then(() => {
      if (!cancelled) setSceneReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [liveRequested, useStaticHero])

  useEffect(() => {
    if (!loaderVisible || useStaticHero || !liveRequested) return
    const id = window.setInterval(() => {
      setLoaderLineIndex((i) => (i + 1) % loaderLineCount)
    }, 2200)
    return () => window.clearInterval(id)
  }, [loaderVisible, useStaticHero, liveRequested, loaderLineCount])

  useEffect(() => {
    return subscribeMotionParallaxStatus(setMotionStatus)
  }, [])

  useEffect(() => {
    const syncNativeFullscreen = () => {
      const active = isNativeFullscreenActive(canvasRef.current)
      setNativeFullscreen(active)
      if (active) setPseudoFullscreen(false)
    }

    document.addEventListener('fullscreenchange', syncNativeFullscreen)
    document.addEventListener('webkitfullscreenchange', syncNativeFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncNativeFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncNativeFullscreen)
    }
  }, [])

  useEffect(() => {
    if (!pseudoFullscreen) return

    document.body.classList.add('hero-viewer-fs-lock')
    window.dispatchEvent(new Event('resize'))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPseudoFullscreen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('hero-viewer-fs-lock')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pseudoFullscreen])

  const enterFullscreen = useCallback(async () => {
    const el = canvasRef.current as FullscreenElement | null
    if (!el) return

    const request =
      el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el)

    if (request) {
      try {
        await request()
        return
      } catch {
        // Fullscreen API rejected — fall through to CSS overlay.
      }
    }

    setPseudoFullscreen(true)
  }, [])

  const exitFullscreen = useCallback(async () => {
    if (pseudoFullscreen) {
      setPseudoFullscreen(false)
      return
    }

    const doc = document as FullscreenDocument
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (doc.webkitFullscreenElement) {
        await doc.webkitExitFullscreen?.()
      }
    } catch {
      setNativeFullscreen(false)
    }
  }, [pseudoFullscreen])

  const showMotionPrompt =
    motionStatus === 'needs_permission' || motionStatus === 'denied'

  const motionHudLabel =
    motionStatus === 'active' ? t('hero.hudTilt') : showMotionPrompt ? null : t('hero.hudOrbit')

  const progressPct = Math.round(loadStatus.progress * 100)

  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="hero-content">
        <p className="hero-eyebrow">{t('hero.eyebrow')}</p>
        <h1 className="hero-title" id="hero-heading">
          {t('hero.titleLine1')}
          <span>{t('hero.titleLine2')}</span>
        </h1>
        <p className="hero-lead">{t('hero.lead')}</p>
        <div className="hero-actions">
          <a href="#software" className="btn btn-primary">
            {t('hero.ctaWork')}
          </a>
          <a href="#contact" className="btn btn-ghost">
            {t('hero.ctaContact')}
          </a>
        </div>
      </div>

      <div className="hero-viewer">
        <div
          className={`hero-canvas-wrap${showPoster ? ' hero-canvas-wrap--static' : ''}${pseudoFullscreen ? ' hero-canvas-wrap--pseudo-fs' : ''}`}
          ref={canvasRef}
          role="img"
          aria-label={t('hero.canvasAria')}
        >
          <div ref={posterSlotRef} className="hero-poster-slot" />
          {showPoster ? (
            <>
              {!hasLcpPoster ? (
                <img
                  className="hero-poster"
                  src={HERO_POSTER_SRC}
                  alt=""
                  width={640}
                  height={540}
                  decoding="async"
                  fetchPriority="high"
                />
              ) : null}
              {!useStaticHero ? (
                <button
                  type="button"
                  className="hero-start-btn"
                  onClick={startLiveScene}
                  onPointerEnter={() => {
                    orbs?.setHover('hero', 0, canvasRef.current)
                  }}
                  onPointerLeave={() => {
                    orbs?.setHover(null, null)
                  }}
                >
                  <span className="hero-start-label">{t('hero.start')}</span>
                  <span className="hero-start-hint">{t('hero.startHint')}</span>
                </button>
              ) : null}
            </>
          ) : null}
          {showLiveScene && (
            <Suspense fallback={null}>
              <HeroSceneMount containerRef={canvasRef} onStatus={onSceneStatus} />
            </Suspense>
          )}
          {loaderVisible && liveRequested && !useStaticHero ? (
            <div className="hero-loader" role="status" aria-live="polite" aria-atomic="true">
              <p className="hero-loader-line">{t(LOADER_KEYS[loaderLineIndex] ?? LOADER_KEYS[0])}</p>
              <div className="hero-loader-bar" aria-hidden="true">
                <span className="hero-loader-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="hero-loader-meta">
                {loadStatus.phase === 'ready'
                  ? t('hero.loaderReady')
                  : t('hero.loaderLoading', { pct: progressPct })}
              </p>
            </div>
          ) : null}
          <div className="viewer-chrome">
            <span className="viewer-corner viewer-corner--tl" aria-hidden="true" />
            <span className="viewer-corner viewer-corner--tr" aria-hidden="true" />
            <span className="viewer-corner viewer-corner--bl" aria-hidden="true" />
            <span className="viewer-corner viewer-corner--br" aria-hidden="true" />
            <div className="viewer-hud">
              {showMotionPrompt && liveRequested ? (
                <button
                  type="button"
                  className="motion-parallax-prompt"
                  onClick={() => {
                    void requestMotionParallaxPermission()
                  }}
                >
                  {t('hero.motionEnable')}
                </button>
              ) : (
                <span>{liveRequested ? motionHudLabel : t('hero.hudPoster')}</span>
              )}
              <div className="viewer-hud-right">
                {isFullscreen ? (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    onClick={() => {
                      void exitFullscreen()
                    }}
                  >
                    <span>{t('hero.exit')}</span>
                    <span className="sr-only">{` — ${t('hero.fsExit')}`}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    onClick={() => {
                      void enterFullscreen()
                    }}
                  >
                    <span className="label-long">{t('hero.fsLabel')}</span>
                    <span className="label-short">{t('hero.fsShort')}</span>
                    <span className="sr-only">{` — ${t('hero.fsEnter')}`}</span>
                  </button>
                )}
                <span className="orbit-label">
                  {useStaticHero || !liveRequested ? t('hero.static') : t('hero.live')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-cue" aria-hidden="true">
        <span>{t('hero.scroll')}</span>
        <span className="scroll-cue-line" />
      </div>
    </section>
  )
}
