import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  isLinarDemoUnlocked,
  tryCrmEmbedUnlock,
  unlockLinarDemo,
} from './auth'
import { PANEL_WIDTH_M, REST_BEND, makeBendState, slatLayout } from './bendMath'
import { LinarControls } from './LinarControls'
import { LinarProductInfo } from './LinarProductInfo'
import { LinarScene } from './LinarScene'
import { LinarViewportControls } from './LinarViewportControls'
import {
  CONCEPT_DISCLAIMER,
  PARTNER_CONFIRMATION_NOTE,
  resolveLinarTech,
  suggestedIncisionLengthMm,
} from './linarData'
import { buildLinarShareUrl, parseLinarShareState } from './shareState'
import type { LinarConfig, LinarSide, LinarViewId } from './types'
import { DEFAULT_LINAR_CONFIG, cloneConfig } from './types'
import './dukta-linar-concept.css'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isEmbeddedWindow(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

const GEOM_KEYS: (keyof LinarConfig)[] = ['material', 'thicknessMm', 'cutWidthMm', 'slatWidthMm']
const LINAR_MUSIC_URL = '/media/dukta-linar-bach-cello-suite-no1-prelude.mp3'
const LINAR_MUSIC_START_SECONDS = 8
const LINAR_MUSIC_DEFAULT_VOLUME = 0.29
const LINAR_MUSIC_FADE_IN_MS = 2200
const LINAR_MUSIC_FADE_OUT_MS = 2800

function copyTextFallback(value: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.inset = '0 auto auto -9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  textarea.remove()
  return copied
}

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
  const [initialShareState] = useState(() => parseLinarShareState(window.location.hash))
  const [unlocked, setUnlocked] = useState(
    () => isLinarDemoUnlocked() || tryCrmEmbedUnlock(),
  )
  const [targetBend, setTargetBend] = useState(initialShareState.bend)
  const [secondaryCurveAmount, setSecondaryCurveAmount] = useState(
    initialShareState.secondaryCurveAmount,
  )
  const [config, setConfig] = useState<LinarConfig>(() =>
    cloneConfig(initialShareState.config),
  )
  const [resetViewToken, setResetViewToken] = useState(0)
  const [viewPreset, setViewPreset] = useState<LinarViewId>(initialShareState.view)
  const [side, setSide] = useState<LinarSide>(initialShareState.side)
  const [viewToken, setViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const [showHint, setShowHint] = useState(!reducedMotion)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(
    Math.round(LINAR_MUSIC_DEFAULT_VOLUME * 100),
  )
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicFadeFrameRef = useRef<number | null>(null)
  const musicOperationRef = useRef(0)
  const musicShouldPlayRef = useRef(false)
  const musicVolumeRef = useRef(LINAR_MUSIC_DEFAULT_VOLUME)
  const shareModeRef = useRef(initialShareState.isShared)
  const targetBendRef = useRef(targetBend)
  const targetSecondaryCurveRef = useRef(secondaryCurveAmount)
  const interactedRef = useRef(true)

  const tech = useMemo(() => resolveLinarTech(config), [config])
  const layout = useMemo(() => slatLayout(config), [config])
  const currentBendState = useMemo(
    () =>
      makeBendState(
        targetBend,
        PANEL_WIDTH_M,
        tech.referenceMinimumRadiusMm,
        layout.incisedWidthM,
        secondaryCurveAmount,
      ),
    [
      layout.incisedWidthM,
      secondaryCurveAmount,
      targetBend,
      tech.referenceMinimumRadiusMm,
    ],
  )
  const shareUrl = useMemo(
    () =>
      buildLinarShareUrl(window.location.href, {
        config,
        bend: targetBend,
        secondaryCurveAmount,
        side,
        view: viewPreset,
      }),
    [config, secondaryCurveAmount, side, targetBend, viewPreset],
  )

  useEffect(() => {
    const nextRadius = currentBendState.selectedRadiusMm
    const nextDirection = currentBendState.direction
    setConfig((previous) => {
      if (
        previous.bendDirection === nextDirection &&
        previous.bendRadiusMm === nextRadius
      ) {
        return previous
      }
      return {
        ...previous,
        bendDirection: nextDirection,
        bendRadiusMm: nextRadius,
      }
    })
  }, [currentBendState.direction, currentBendState.selectedRadiusMm])

  useEffect(() => {
    if (
      !unlocked ||
      !shareModeRef.current ||
      isEmbeddedWindow() ||
      window.location.href === shareUrl
    ) {
      return
    }
    window.history.replaceState(window.history.state, '', shareUrl)
  }, [shareUrl, unlocked])

  const onShare = useCallback(async (): Promise<boolean> => {
    if (!isEmbeddedWindow()) {
      shareModeRef.current = true
      window.history.replaceState(window.history.state, '', shareUrl)
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        return true
      }
    } catch {
      // Use the synchronous fallback below when Clipboard API access is denied.
    }
    return copyTextFallback(shareUrl)
  }, [shareUrl])

  useEffect(() => {
    const restoreSharedHash = () => {
      const shared = parseLinarShareState(window.location.hash)
      if (!shared.isShared) return
      if (!isEmbeddedWindow()) {
        shareModeRef.current = true
        const canonicalUrl = buildLinarShareUrl(window.location.href, {
          config: shared.config,
          bend: shared.bend,
          secondaryCurveAmount: shared.secondaryCurveAmount,
          side: shared.side,
          view: shared.view,
        })
        if (window.location.href !== canonicalUrl) {
          window.history.replaceState(window.history.state, '', canonicalUrl)
        }
      }
      targetBendRef.current = shared.bend
      targetSecondaryCurveRef.current = shared.secondaryCurveAmount
      setTargetBend(shared.bend)
      setSecondaryCurveAmount(shared.secondaryCurveAmount)
      setConfig(cloneConfig(shared.config))
      setSide(shared.side)
      setViewPreset(shared.view)
      setViewToken((value) => value + 1)
    }

    window.addEventListener('hashchange', restoreSharedHash)
    return () => window.removeEventListener('hashchange', restoreSharedHash)
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
      const safeTargetVolume = Math.max(0, Math.min(1, targetVolume))
      const startedAt = performance.now()

      const update = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs))
        const eased = 1 - (1 - progress) ** 3
        audio.volume = Math.max(
          0,
          Math.min(1, initialVolume + (safeTargetVolume - initialVolume) * eased),
        )
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
    setMusicEnabled(true)
    cancelMusicFade()

    if (!audio.paused) {
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
    setMusicEnabled(false)
    cancelMusicFade()
    if (!audio || audio.paused) {
      return
    }
    fadeMusicTo(audio, 0, LINAR_MUSIC_FADE_OUT_MS, () => {
      if (musicOperationRef.current !== operation) return
      audio.pause()
      audio.volume = musicVolumeRef.current
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

  const markInteracted = useCallback(() => {
    interactedRef.current = true
    setShowHint(false)
  }, [])

  const onBendInput = useCallback(
    (value: number) => {
      markInteracted()
      targetBendRef.current = value
      setTargetBend(value)
    },
    [markInteracted],
  )

  const onSecondaryCurveInput = useCallback(
    (value: number) => {
      markInteracted()
      const next = Math.max(0, Math.min(100, Math.round(value)))
      targetSecondaryCurveRef.current = next
      setSecondaryCurveAmount(next)
    },
    [markInteracted],
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
    targetSecondaryCurveRef.current = 0
    setTargetBend(REST_BEND)
    setSecondaryCurveAmount(0)
    setConfig(cloneConfig(DEFAULT_LINAR_CONFIG))
  }, [markInteracted])

  const onToggleMusic = useCallback(() => {
    if (musicShouldPlayRef.current) {
      stopMusic()
    } else {
      startMusic()
    }
  }, [startMusic, stopMusic])

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
    <div className="linar-page">
      <header className="linar-header">
        <p className="linar-brand">dukta flexible wood</p>
        <span className="linar-badge">Interactive concept</span>
      </header>

      <div className="linar-body">
        <section className="linar-viewport" aria-label="LINAR panel preview">
          {webglFailed ? (
            <p className="linar-fallback">
              The interactive 3D preview is not available on this device. You can still review
              the LINAR product information below.
            </p>
          ) : (
            <>
              <LinarScene
                targetBendRef={targetBendRef}
                targetSecondaryCurveRef={targetSecondaryCurveRef}
                config={config}
                tech={tech}
                resetViewToken={resetViewToken}
                viewPreset={viewPreset}
                side={side}
                viewToken={viewToken}
                tourActive={false}
                introStarted={false}
                interactedRef={interactedRef}
                reducedMotion={reducedMotion}
                onUnavailable={() => setWebglFailed(true)}
                onUserInteract={markInteracted}
                onIntroBend={() => undefined}
              />
              {showHint ? (
                <p className="linar-viewport__hint">Drag to rotate. Scroll or pinch to zoom.</p>
              ) : null}
            </>
          )}
          <LinarViewportControls
            viewPreset={viewPreset}
            side={side}
            musicEnabled={musicEnabled}
            musicVolume={musicVolume}
            viewAvailable={!webglFailed}
            shareUrl={shareUrl}
            onResetView={() => {
              markInteracted()
              setSide('front')
              setViewPreset('hero')
              setResetViewToken((n) => n + 1)
            }}
            onViewPreset={(id) => {
              markInteracted()
              if (id === 'hero') setSide('front')
              if (id === 'reverse') setSide('back')
              setViewPreset(id)
              setViewToken((n) => n + 1)
            }}
            onSideChange={(next) => {
              markInteracted()
              setSide(next)
              setViewPreset(next === 'back' ? 'reverse' : 'hero')
              setViewToken((n) => n + 1)
            }}
            onToggleMusic={onToggleMusic}
            onMusicVolumeChange={onMusicVolumeChange}
            onShare={onShare}
          />
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
              secondaryCurveAmount={secondaryCurveAmount}
              bendDirection={currentBendState.direction}
              config={config}
              tech={tech}
              previewRadiusMm={currentBendState.selectedRadiusMm}
              onBendInput={onBendInput}
              onSecondaryCurveInput={onSecondaryCurveInput}
              onConfig={onConfig}
              onResetPanel={() => {
                setSide('front')
                setViewPreset('hero')
                setViewToken((n) => n + 1)
                onResetPanel()
              }}
            />

            <LinarProductInfo
              config={config}
              tech={tech}
              selectedRadiusMm={currentBendState.selectedRadiusMm}
              bendDirection={currentBendState.direction}
              secondaryCurveAmount={secondaryCurveAmount}
            />

            <p className="linar-disclaimer">
              {CONCEPT_DISCLAIMER} {PARTNER_CONFIRMATION_NOTE}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
