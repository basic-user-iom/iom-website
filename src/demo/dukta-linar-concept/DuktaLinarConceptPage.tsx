import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  isLinarDemoUnlocked,
  tryCrmEmbedUnlock,
  unlockLinarDemo,
} from './auth'
import { PANEL_WIDTH_M, REST_BEND, previewRadiusMm } from './bendMath'
import { LinarControls } from './LinarControls'
import { LinarProductInfo } from './LinarProductInfo'
import { LinarScene } from './LinarScene'
import {
  CONCEPT_DISCLAIMER,
  PARTNER_CONFIRMATION_NOTE,
  resolveLinarTech,
  suggestedIncisionLengthMm,
} from './linarData'
import { LINAR_TOUR_STEPS, type LinarTourTarget } from './linarTour'
import type { LinarConfig, LinarSide, LinarViewId } from './types'
import { DEFAULT_LINAR_CONFIG, cloneConfig } from './types'
import './dukta-linar-concept.css'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const GEOM_KEYS: (keyof LinarConfig)[] = ['material', 'thicknessMm', 'cutWidthMm', 'slatWidthMm']
const LINAR_MUSIC_URL = '/media/dukta-linar-bach-cello-suite-no1-prelude.mp3'
const LINAR_MUSIC_START_SECONDS = 8
const LINAR_MUSIC_DEFAULT_VOLUME = 0.29
const LINAR_MUSIC_FADE_IN_MS = 2200
const LINAR_MUSIC_FADE_OUT_MS = 2800
type TourStatus = 'prompt' | 'running' | 'complete' | 'dismissed'

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockLinarDemo(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="linar-page linar-page--gate">
      <div className="linar-gate">
        <div className="linar-gate__panel">
          <p className="linar-gate__brand">dukta · LINAR concept</p>
          <p className="linar-gate__hint">Private preview. Enter the password to continue.</p>
          <form className="linar-gate__form" onSubmit={submit}>
            <input
              className="linar-gate__input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(false)
              }}
              autoFocus
            />
            <button className="linar-gate__submit" type="submit">
              Enter
            </button>
            {error ? <p className="linar-gate__error">Incorrect password.</p> : null}
          </form>
        </div>
      </div>
    </div>
  )
}

export function DuktaLinarConceptPage() {
  const reducedMotion = useRef(prefersReducedMotion()).current
  const [unlocked, setUnlocked] = useState(
    () => isLinarDemoUnlocked() || tryCrmEmbedUnlock(),
  )
  const [targetBend, setTargetBend] = useState(reducedMotion ? REST_BEND : 0)
  const [config, setConfig] = useState<LinarConfig>(() => cloneConfig(DEFAULT_LINAR_CONFIG))
  const [resetViewToken, setResetViewToken] = useState(0)
  const [viewPreset, setViewPreset] = useState<LinarViewId>('hero')
  const [side, setSide] = useState<LinarSide>('front')
  const [viewToken, setViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const [showHint, setShowHint] = useState(!reducedMotion)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(
    Math.round(LINAR_MUSIC_DEFAULT_VOLUME * 100),
  )
  const [tourStatus, setTourStatus] = useState<TourStatus>('prompt')
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const sliderRef = useRef<HTMLInputElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicFadeFrameRef = useRef<number | null>(null)
  const musicOperationRef = useRef(0)
  const musicShouldPlayRef = useRef(false)
  const musicVolumeRef = useRef(LINAR_MUSIC_DEFAULT_VOLUME)
  const tourTimerRef = useRef<number | null>(null)
  const tourStatusRef = useRef<TourStatus>(tourStatus)
  const tourStartedMusicRef = useRef(false)
  const targetBendRef = useRef(targetBend)
  const interactedRef = useRef(reducedMotion)
  tourStatusRef.current = tourStatus

  const tech = useMemo(() => resolveLinarTech(config), [config])
  const currentPreviewRadius = previewRadiusMm(
    targetBend,
    PANEL_WIDTH_M,
    tech.referenceMinimumRadiusMm,
  )

  const syncBendUi = useCallback((value: number) => {
    if (sliderRef.current) sliderRef.current.value = String(value)
    if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
  }, [])

  const cancelMusicFade = useCallback(() => {
    if (musicFadeFrameRef.current != null) {
      window.cancelAnimationFrame(musicFadeFrameRef.current)
      musicFadeFrameRef.current = null
    }
  }, [])

  const fadeMusicTo = useCallback(
    (audio: HTMLAudioElement, targetVolume: number, durationMs: number, onDone?: () => void) => {
      cancelMusicFade()
      const initialVolume = audio.volume
      const startedAt = performance.now()

      const update = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs)
        const eased = 1 - (1 - progress) ** 3
        audio.volume = initialVolume + (targetVolume - initialVolume) * eased
        if (progress >= 1) {
          musicFadeFrameRef.current = null
          onDone?.()
          return
        }
        musicFadeFrameRef.current = window.requestAnimationFrame(update)
      }

      musicFadeFrameRef.current = window.requestAnimationFrame(update)
    },
    [cancelMusicFade],
  )

  const createMusic = useCallback((): HTMLAudioElement => {
    if (musicRef.current) return musicRef.current
    const audio = new Audio(LINAR_MUSIC_URL)
    audio.loop = false
    audio.preload = 'auto'
    audio.volume = 0
    audio.onended = () => {
      if (!musicShouldPlayRef.current || musicRef.current !== audio) return
      audio.currentTime = LINAR_MUSIC_START_SECONDS
      audio.volume = musicVolumeRef.current
      void audio.play()
    }
    musicRef.current = audio
    return audio
  }, [])

  const startMusic = useCallback(() => {
    const audio = createMusic()
    const operation = ++musicOperationRef.current
    musicShouldPlayRef.current = true
    cancelMusicFade()

    if (!audio.paused) {
      setMusicEnabled(true)
      fadeMusicTo(audio, musicVolumeRef.current, LINAR_MUSIC_FADE_IN_MS)
      return
    }

    if (audio.currentTime < LINAR_MUSIC_START_SECONDS) {
      try {
        audio.currentTime = LINAR_MUSIC_START_SECONDS
      } catch {
        audio.addEventListener(
          'loadedmetadata',
          () => {
            audio.currentTime = LINAR_MUSIC_START_SECONDS
          },
          { once: true },
        )
      }
    }
    audio.volume = 0
    void audio
      .play()
      .then(() => {
        if (musicOperationRef.current !== operation || !musicShouldPlayRef.current) {
          audio.pause()
          return
        }
        setMusicEnabled(true)
        fadeMusicTo(audio, musicVolumeRef.current, LINAR_MUSIC_FADE_IN_MS)
      })
      .catch(() => {
        if (musicOperationRef.current !== operation) return
        musicShouldPlayRef.current = false
        setMusicEnabled(false)
      })
  }, [cancelMusicFade, createMusic, fadeMusicTo])

  const stopMusic = useCallback(() => {
    const operation = ++musicOperationRef.current
    const audio = musicRef.current
    musicShouldPlayRef.current = false
    cancelMusicFade()
    if (!audio || audio.paused) {
      setMusicEnabled(false)
      return
    }
    fadeMusicTo(audio, 0, LINAR_MUSIC_FADE_OUT_MS, () => {
      if (musicOperationRef.current !== operation) return
      audio.pause()
      audio.volume = musicVolumeRef.current
      setMusicEnabled(false)
    })
  }, [cancelMusicFade, fadeMusicTo])

  const onMusicVolumeChange = useCallback(
    (percent: number) => {
      const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)))
      const normalized = clampedPercent / 100
      musicVolumeRef.current = normalized
      setMusicVolume(clampedPercent)
      const audio = musicRef.current
      if (audio && musicShouldPlayRef.current) {
        cancelMusicFade()
        audio.volume = normalized
      }
    },
    [cancelMusicFade],
  )

  const clearTourTimer = useCallback(() => {
    if (tourTimerRef.current != null) {
      window.clearTimeout(tourTimerRef.current)
      tourTimerRef.current = null
    }
  }, [])

  const stopTour = useCallback(() => {
    clearTourTimer()
    if (tourStartedMusicRef.current) stopMusic()
    tourStartedMusicRef.current = false
    interactedRef.current = true
    tourStatusRef.current = 'dismissed'
    setTourStatus('dismissed')
  }, [clearTourTimer, stopMusic])

  const markInteracted = useCallback(() => {
    if (tourStatusRef.current === 'running') stopTour()
    interactedRef.current = true
    setShowHint(false)
  }, [stopTour])

  const onBendInput = useCallback(
    (value: number) => {
      markInteracted()
      targetBendRef.current = value
      setTargetBend(value)
      if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
    },
    [markInteracted],
  )

  const onIntroBend = useCallback(
    (value: number) => {
      if (interactedRef.current) return
      targetBendRef.current = value
      setTargetBend(value)
      syncBendUi(value)
    },
    [syncBendUi],
  )

  const onConfig = useCallback(
    (patch: Partial<LinarConfig>) => {
      markInteracted()
      setConfig((prev) => {
        const next = { ...prev, ...patch }
        const geomChanged = GEOM_KEYS.some(
          (key) => patch[key] !== undefined && patch[key] !== prev[key],
        )
        if (geomChanged && patch.incisionLengthMm == null) {
          // Follow another validated sample only when the current incision was
          // already following its sample. A manually chosen/reference opening
          // (including the supplied 40 mm visual cell) must not jump to a new
          // length merely because material, thickness, cut, or slat width changed.
          const previousSuggested = suggestedIncisionLengthMm({ ...prev, pattern: 'regular' })
          const followsPreviousSample =
            previousSuggested != null && prev.incisionLengthMm === previousSuggested
          if (followsPreviousSample) {
            const suggested = suggestedIncisionLengthMm({ ...next, pattern: 'regular' })
            if (suggested != null) next.incisionLengthMm = suggested
          }
        }
        return next
      })
    },
    [markInteracted],
  )

  const onResetPanel = useCallback(() => {
    markInteracted()
    targetBendRef.current = REST_BEND
    setTargetBend(REST_BEND)
    setConfig(cloneConfig(DEFAULT_LINAR_CONFIG))
    syncBendUi(REST_BEND)
  }, [markInteracted, syncBendUi])

  const onToggleMusic = useCallback(() => {
    const audio = createMusic()
    if (audio.paused) {
      startMusic()
    } else {
      stopMusic()
    }
  }, [createMusic, startMusic, stopMusic])

  const startTour = useCallback(() => {
    clearTourTimer()
    interactedRef.current = reducedMotion
    setShowHint(false)
    tourStartedMusicRef.current = true
    startMusic()
    tourStatusRef.current = 'running'
    setTourStepIndex(0)
    setTourStatus('running')
  }, [clearTourTimer, reducedMotion, startMusic])

  const activeTourStep =
    tourStatus === 'running' ? (LINAR_TOUR_STEPS[tourStepIndex] ?? null) : null
  const tourTarget: LinarTourTarget | null = activeTourStep?.target ?? null

  useEffect(() => {
    if (tourStatus !== 'running') return
    const step = LINAR_TOUR_STEPS[tourStepIndex]
    if (!step) return

    setSide(step.side)
    setViewPreset(step.view)
    setViewToken((value) => value + 1)

    const configTimer = window.setTimeout(
      () => setConfig((previous) => ({ ...previous, ...step.config })),
      reducedMotion ? 0 : 450,
    )
    const bendTimer = window.setTimeout(
      () => {
        targetBendRef.current = step.bend
        setTargetBend(step.bend)
        syncBendUi(step.bend)
      },
      reducedMotion ? 0 : 900,
    )

    const scrollFrame = window.requestAnimationFrame(() => {
      if (step.target === 'viewport') return
      document
        .querySelector<HTMLElement>(`[data-linar-tour="${step.target}"]`)
        ?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        })
    })

    clearTourTimer()
    tourTimerRef.current = window.setTimeout(() => {
      if (tourStepIndex >= LINAR_TOUR_STEPS.length - 1) {
        tourTimerRef.current = null
        if (tourStartedMusicRef.current) stopMusic()
        tourStartedMusicRef.current = false
        tourStatusRef.current = 'complete'
        setTourStatus('complete')
      } else {
        setTourStepIndex((index) => index + 1)
      }
    }, step.durationMs)

    return () => {
      window.cancelAnimationFrame(scrollFrame)
      window.clearTimeout(configTimer)
      window.clearTimeout(bendTimer)
      clearTourTimer()
    }
  }, [
    clearTourTimer,
    reducedMotion,
    stopMusic,
    syncBendUi,
    tourStatus,
    tourStepIndex,
  ])

  useEffect(() => {
    document.body.classList.add('linar-route')
    document.documentElement.classList.add('linar-route')
    return () => {
      musicShouldPlayRef.current = false
      musicOperationRef.current += 1
      if (musicFadeFrameRef.current != null) {
        window.cancelAnimationFrame(musicFadeFrameRef.current)
        musicFadeFrameRef.current = null
      }
      if (tourTimerRef.current != null) {
        window.clearTimeout(tourTimerRef.current)
        tourTimerRef.current = null
      }
      const audio = musicRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        musicRef.current = null
      }
      document.body.classList.remove('linar-route')
      document.documentElement.classList.remove('linar-route')
    }
  }, [])

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className={tourStatus === 'running' ? 'linar-page is-tour-running' : 'linar-page'}>
      {tourStatus === 'prompt' ? (
        <div className="linar-tour-welcome" role="dialog" aria-modal="true" aria-labelledby="tour-title">
          <div className="linar-tour-welcome__panel">
            <p className="linar-tour__eyebrow">Guided product tour</p>
            <h2 id="tour-title">Discover the LINAR surface</h2>
            <p>
              Follow an automatic camera tour through the incisions, materials, reverse surface,
              bending radius and configuration controls. Music starts with the tour.
            </p>
            <div className="linar-tour__actions">
              <button type="button" className="linar-tour__primary" onClick={startTour}>
                Start automatic tour
              </button>
              <button
                type="button"
                className="linar-tour__secondary"
                onClick={() => {
                  interactedRef.current = reducedMotion
                  tourStatusRef.current = 'dismissed'
                  setTourStatus('dismissed')
                }}
              >
                Skip tour
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="linar-header">
        <p className="linar-brand">dukta flexible wood</p>
        <span className="linar-badge">Interactive concept</span>
      </header>

      <div className="linar-body">
        <section
          className={
            tourTarget === 'viewport'
              ? 'linar-viewport is-tour-highlighted'
              : 'linar-viewport'
          }
          data-linar-tour="viewport"
          aria-label="LINAR panel preview"
        >
          {webglFailed ? (
            <p className="linar-fallback">
              The interactive 3D preview is not available on this device. You can still review
              the LINAR product information below.
            </p>
          ) : (
            <>
              <LinarScene
                targetBendRef={targetBendRef}
                config={config}
                tech={tech}
                resetViewToken={resetViewToken}
                viewPreset={viewPreset}
                side={side}
                viewToken={viewToken}
                tourActive={tourStatus === 'running'}
                introStarted={tourStatus !== 'prompt'}
                interactedRef={interactedRef}
                reducedMotion={reducedMotion}
                onUnavailable={() => setWebglFailed(true)}
                onUserInteract={markInteracted}
                onIntroBend={onIntroBend}
              />
              {showHint ? (
                <p className="linar-viewport__hint">Drag to rotate. Scroll or pinch to zoom.</p>
              ) : null}
            </>
          )}
          {activeTourStep ? (
            <aside
              key={tourStepIndex}
              className="linar-tour-card"
              aria-live="polite"
            >
              <div className="linar-tour-card__progress" aria-hidden="true">
                <span
                  style={{
                    width: `${((tourStepIndex + 1) / LINAR_TOUR_STEPS.length) * 100}%`,
                  }}
                />
              </div>
              <p className="linar-tour__eyebrow">
                Step {tourStepIndex + 1} / {LINAR_TOUR_STEPS.length}
              </p>
              <h2>{activeTourStep.title}</h2>
              <p>{activeTourStep.description}</p>
              <button type="button" className="linar-tour__secondary" onClick={stopTour}>
                Stop tour
              </button>
            </aside>
          ) : null}
          {tourStatus === 'complete' ? (
            <aside className="linar-tour-card linar-tour-card--complete" aria-live="polite">
              <p className="linar-tour__eyebrow">Tour complete</p>
              <h2>Continue exploring LINAR</h2>
              <p>Every view and setting is now available manually. Music remains in the View menu.</p>
              <div className="linar-tour__actions">
                <button
                  type="button"
                  className="linar-tour__primary"
                  onClick={() => {
                    tourStatusRef.current = 'dismissed'
                    setTourStatus('dismissed')
                  }}
                >
                  Explore manually
                </button>
                <button type="button" className="linar-tour__secondary" onClick={startTour}>
                  Replay tour
                </button>
              </div>
            </aside>
          ) : null}
        </section>

        <aside className="linar-side">
          <div className="linar-side__scroll">
            <div className="linar-intro">
              <h1 className="linar-title">LINAR</h1>
              <p className="linar-lead">
                Explore how regular incision geometry allows a normally rigid wood-based panel to
                form a flexible architectural surface.
              </p>
            </div>

            <LinarControls
              bend={targetBend}
              config={config}
              tech={tech}
              previewRadiusMm={currentPreviewRadius}
              sliderRef={sliderRef}
              percentRef={percentRef}
              onBendInput={onBendInput}
              onConfig={onConfig}
              onResetView={() => {
                markInteracted()
                setSide('front')
                setViewPreset('hero')
                setResetViewToken((n) => n + 1)
              }}
              onResetPanel={() => {
                setSide('front')
                setViewPreset('hero')
                setViewToken((n) => n + 1)
                onResetPanel()
              }}
              viewPreset={viewPreset}
              onViewPreset={(id) => {
                markInteracted()
                if (id === 'hero') setSide('front')
                if (id === 'reverse') setSide('back')
                setViewPreset(id)
                setViewToken((n) => n + 1)
              }}
              side={side}
              onSideChange={(next) => {
                markInteracted()
                setSide(next)
                setViewPreset(next === 'back' ? 'reverse' : 'hero')
                setViewToken((n) => n + 1)
              }}
              musicEnabled={musicEnabled}
              musicVolume={musicVolume}
              onToggleMusic={onToggleMusic}
              onMusicVolumeChange={onMusicVolumeChange}
              tourTarget={tourTarget}
            />

            <LinarProductInfo config={config} tech={tech} />

            <p className="linar-disclaimer">
              {CONCEPT_DISCLAIMER} {PARTNER_CONFIRMATION_NOTE}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
