import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  requestMotionParallaxPermission,
  subscribeMotionParallaxStatus,
  type MotionParallaxStatus,
} from '../utils/deviceOrientationParallax'
import { getDeviceProfile } from '../utils/device'
import { reportHeroVisibility } from '../utils/embedVisibility'
import type { HeroSceneLoadStatus } from '../three/useHeroScene'
import { useSiteI18n } from '../i18n'

const HeroSceneMount = lazy(() => import('./HeroSceneMount'))

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
  const canvasRef = useRef<HTMLDivElement>(null)
  const [sceneReady, setSceneReady] = useState(() => !getDeviceProfile().prefersReducedMotion)
  const [motionStatus, setMotionStatus] = useState<MotionParallaxStatus>('disabled')
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)
  const [loadStatus, setLoadStatus] = useState<HeroSceneLoadStatus>({
    progress: 0,
    phase: 'boot',
  })
  const [loaderLineIndex, setLoaderLineIndex] = useState(0)
  const [loaderVisible, setLoaderVisible] = useState(() => !getDeviceProfile().prefersReducedMotion)
  const profile = getDeviceProfile()
  const useStaticHero = profile.prefersReducedMotion
  const isFullscreen = nativeFullscreen || pseudoFullscreen
  const loaderLineCount = LOADER_KEYS.length

  const onSceneStatus = useCallback((status: HeroSceneLoadStatus) => {
    setLoadStatus(status)
    if (status.phase === 'ready') {
      window.setTimeout(() => setLoaderVisible(false), 420)
    }
  }, [])

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

  // Prefetch hero WebGL chunk immediately — clouds are above-fold and should not wait on idle.
  useEffect(() => {
    if (useStaticHero) return
    void import('./HeroSceneMount')
    setSceneReady(true)
  }, [useStaticHero])

  useEffect(() => {
    if (!loaderVisible || useStaticHero) return
    const id = window.setInterval(() => {
      setLoaderLineIndex((i) => (i + 1) % loaderLineCount)
    }, 2200)
    return () => window.clearInterval(id)
  }, [loaderVisible, useStaticHero, loaderLineCount])

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
          className={`hero-canvas-wrap${useStaticHero ? ' hero-canvas-wrap--static' : ''}${pseudoFullscreen ? ' hero-canvas-wrap--pseudo-fs' : ''}`}
          ref={canvasRef}
          role="img"
          aria-label={t('hero.canvasAria')}
        >
          {sceneReady && !useStaticHero && (
            <Suspense fallback={null}>
              <HeroSceneMount containerRef={canvasRef} onStatus={onSceneStatus} />
            </Suspense>
          )}
          {loaderVisible && !useStaticHero ? (
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
              {showMotionPrompt ? (
                <button
                  type="button"
                  className="motion-parallax-prompt"
                  aria-label={t('hero.motionAria')}
                  onClick={() => {
                    void requestMotionParallaxPermission()
                  }}
                >
                  {t('hero.motionEnable')}
                </button>
              ) : (
                <span>{motionHudLabel}</span>
              )}
              <div className="viewer-hud-right">
                {isFullscreen ? (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    aria-label={t('hero.fsExit')}
                    onClick={() => {
                      void exitFullscreen()
                    }}
                  >
                    {t('hero.exit')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    aria-label={t('hero.fsEnter')}
                    onClick={() => {
                      void enterFullscreen()
                    }}
                  >
                    <span className="label-long">{t('hero.fsLabel')}</span>
                    <span className="label-short">{t('hero.fsShort')}</span>
                  </button>
                )}
                <span className="orbit-label">{useStaticHero ? t('hero.static') : t('hero.live')}</span>
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
