import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  requestMotionParallaxPermission,
  subscribeMotionParallaxStatus,
  type MotionParallaxStatus,
} from '../utils/deviceOrientationParallax'
import { getDeviceProfile } from '../utils/device'
import { reportHeroVisibility } from '../utils/embedVisibility'

const HeroSceneMount = lazy(() => import('./HeroSceneMount'))

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

function isNativeFullscreenActive(el: HTMLElement | null): boolean {
  if (!el) return false
  const doc = document as FullscreenDocument
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el
}

export function Hero() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [motionStatus, setMotionStatus] = useState<MotionParallaxStatus>('disabled')
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)
  const profile = getDeviceProfile()
  const useStaticHero = profile.prefersReducedMotion
  const isFullscreen = nativeFullscreen || pseudoFullscreen

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

  useEffect(() => {
    if (useStaticHero) return

    const container = canvasRef.current
    if (!container) return

    let cancelled = false

    const activate = () => {
      if (!cancelled) setSceneReady(true)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          activate()
          io.disconnect()
        }
      },
      { rootMargin: '80px', threshold: 0.05 },
    )
    io.observe(container)

    const idleId =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(activate, { timeout: 1800 })
        : window.setTimeout(activate, 1200)

    return () => {
      cancelled = true
      io.disconnect()
      if (typeof cancelIdleCallback !== 'undefined' && typeof idleId === 'number') {
        cancelIdleCallback(idleId)
      } else {
        clearTimeout(idleId as number)
      }
    }
  }, [useStaticHero])

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
    motionStatus === 'active' ? 'TILT · LIVE' : showMotionPrompt ? null : 'CAM · ORBIT'

  return (
    <section className="hero" id="top">
      <div className="hero-content">
        <p className="hero-eyebrow">Agency · Archive · Objects</p>
        <h1 className="hero-title">
          Interactive
          <span>Object Media</span>
        </h1>
        <p className="hero-lead">
          We build software, 3D experiences, immersive tours, and creative experiments —
          tools and worlds where digital objects become stories you can explore.
        </p>
        <div className="hero-actions">
          <a href="#software" className="btn btn-primary">
            View work
          </a>
          <a href="#contact" className="btn btn-ghost">
            Get in touch
          </a>
        </div>
      </div>

      <div className="hero-viewer">
        <div
          className={`hero-canvas-wrap${useStaticHero ? ' hero-canvas-wrap--static' : ''}${pseudoFullscreen ? ' hero-canvas-wrap--pseudo-fs' : ''}`}
          ref={canvasRef}
        >
          {sceneReady && !useStaticHero && (
            <Suspense fallback={null}>
              <HeroSceneMount containerRef={canvasRef} />
            </Suspense>
          )}
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
                  aria-label="Enable motion parallax"
                  onClick={() => {
                    void requestMotionParallaxPermission()
                  }}
                >
                  Tap to enable motion
                </button>
              ) : (
                <span>{motionHudLabel}</span>
              )}
              <div className="viewer-hud-right">
                {isFullscreen ? (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    aria-label="Exit fullscreen"
                    onClick={() => {
                      void exitFullscreen()
                    }}
                  >
                    EXIT
                  </button>
                ) : (
                  <button
                    type="button"
                    className="viewer-fullscreen-btn"
                    aria-label="Enter fullscreen"
                    onClick={() => {
                      void enterFullscreen()
                    }}
                  >
                    FULLSCREEN
                  </button>
                )}
                <span className="orbit-label">{useStaticHero ? '◉ STATIC' : '◉ LIVE'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <span className="scroll-cue-line" />
      </div>
    </section>
  )
}
