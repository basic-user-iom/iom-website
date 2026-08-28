import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  isLinarDemoUnlocked,
  tryCrmEmbedUnlock,
  unlockLinarDemo,
} from './auth'
import {
  PANEL_WIDTH_M,
  REST_BEND,
  makeBendState,
  maxRenderedNormalOffsetM,
  slatLayout,
} from './bendMath'
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
import {
  LINAR_TOUR_STEPS,
  type LinarTourStep,
} from './linarTour'
import type { LinarConfig, LinarLightState, LinarSide, LinarViewId } from './types'
import { DEFAULT_LINAR_CONFIG, DEFAULT_LINAR_LIGHT, cloneConfig } from './types'
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
const LINAR_CINEMATIC_SESSION_KEY = 'dukta-linar-startup-cinematic-v2'
const LINAR_CINEMATIC_LIGHT_STAGE = 5
const LINAR_CINEMATIC_EXIT_STAGE = 6
const LINAR_CINEMATIC_REVEAL_MS = 2200

type LinarExperienceMode = 'idle' | 'startup-cinematic' | 'guided-tour'
type LinarCinematicHandoffPhase = 'covering' | 'revealing' | null

type LinarTourSnapshot = {
  config: LinarConfig
  bend: number
  secondaryCurveAmount: number
  side: LinarSide
  view: LinarViewId
  light: LinarLightState
}

function cinematicWasSeen(): boolean {
  try {
    return window.sessionStorage.getItem(LINAR_CINEMATIC_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markCinematicSeen(): void {
  try {
    window.sessionStorage.setItem(LINAR_CINEMATIC_SESSION_KEY, '1')
  } catch {
    // The experience remains functional when storage is unavailable.
  }
}

function clearCinematicSeen(): void {
  try {
    window.sessionStorage.removeItem(LINAR_CINEMATIC_SESSION_KEY)
  } catch {
    // Debug reset is best-effort when storage is unavailable.
  }
}

function requestedTourDebugMode(): 'guided' | 'cinematic' | 'reset' | null {
  const value = new URLSearchParams(window.location.search).get('tour')
  return value === 'guided' || value === 'cinematic' || value === 'reset' ? value : null
}

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
  const [lightState, setLightState] = useState<LinarLightState>(() => ({
    ...initialShareState.light,
  }))
  const [viewToken, setViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const [showHint, setShowHint] = useState(!reducedMotion)
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null)
  const [experienceMode, setExperienceMode] = useState<LinarExperienceMode>('idle')
  const [cinematicToken, setCinematicToken] = useState(0)
  const [cinematicHandoffPhase, setCinematicHandoffPhase] =
    useState<LinarCinematicHandoffPhase>(null)
  const [sceneReady, setSceneReady] = useState(false)
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
  const configRef = useRef(config)
  const sideRef = useRef(side)
  const viewPresetRef = useRef(viewPreset)
  const lightStateRef = useRef(lightState)
  const experienceModeRef = useRef<LinarExperienceMode>('idle')
  const experienceStartHandledRef = useRef(false)
  // The legacy three-second intro is retired; the production cinematic owns
  // automation explicitly through `experienceMode` and overrides scene goals.
  const interactedRef = useRef(true)
  const tourTimerRef = useRef<number | null>(null)
  const cinematicHandoffTimerRef = useRef<number | null>(null)
  const tourRunRef = useRef(0)
  const tourActiveRef = useRef(false)
  const tourSnapshotRef = useRef<LinarTourSnapshot | null>(null)

  configRef.current = config
  sideRef.current = side
  viewPresetRef.current = viewPreset
  lightStateRef.current = lightState
  experienceModeRef.current = experienceMode

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
        maxRenderedNormalOffsetM(layout.thicknessM, config.backing !== 'none'),
      ),
    [
      config.backing,
      layout.incisedWidthM,
      layout.thicknessM,
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
        light: lightState,
      }),
    [config, lightState, secondaryCurveAmount, side, targetBend, viewPreset],
  )
  const tourActive = experienceMode === 'guided-tour' && tourStepIndex != null
  const cinematicActive = experienceMode === 'startup-cinematic'
  const activeTourStep = tourStepIndex == null ? null : LINAR_TOUR_STEPS[tourStepIndex]

  const applyTourStep = useCallback((step: LinarTourStep, index: number) => {
    targetBendRef.current = step.bend
    targetSecondaryCurveRef.current = step.secondaryCurveAmount
    setTargetBend(step.bend)
    setSecondaryCurveAmount(step.secondaryCurveAmount)
    setConfig((previous) => ({ ...previous, ...step.config }))
    setSide(step.side)
    setViewPreset(step.view)
    const nextLight = step.light
      ? { ...step.light }
      : { ...lightStateRef.current, enabled: false }
    lightStateRef.current = nextLight
    setLightState(nextLight)
    setViewToken((value) => value + 1)
    setTourStepIndex(index)
  }, [])

  const stopExperience = useCallback(
    (restoreSnapshot: boolean, preserveCamera = false) => {
      const snapshot = tourSnapshotRef.current
      if (cinematicHandoffTimerRef.current != null) {
        window.clearTimeout(cinematicHandoffTimerRef.current)
        cinematicHandoffTimerRef.current = null
      }
      setCinematicHandoffPhase(null)
      if (experienceModeRef.current === 'idle' && snapshot == null) return

      tourRunRef.current += 1
      tourActiveRef.current = false
      if (tourTimerRef.current != null) {
        window.clearTimeout(tourTimerRef.current)
        tourTimerRef.current = null
      }
      setTourStepIndex(null)
      setExperienceMode('idle')
      experienceModeRef.current = 'idle'
      tourSnapshotRef.current = null

      if (!restoreSnapshot || snapshot == null) return

      targetBendRef.current = snapshot.bend
      targetSecondaryCurveRef.current = snapshot.secondaryCurveAmount
      configRef.current = cloneConfig(snapshot.config)
      sideRef.current = snapshot.side
      viewPresetRef.current = snapshot.view
      lightStateRef.current = { ...snapshot.light }
      setTargetBend(snapshot.bend)
      setSecondaryCurveAmount(snapshot.secondaryCurveAmount)
      setConfig(cloneConfig(snapshot.config))
      setSide(snapshot.side)
      setViewPreset(snapshot.view)
      setLightState({ ...snapshot.light })
      if (!preserveCamera) setViewToken((value) => value + 1)
    },
    [],
  )

  const startTour = useCallback(() => {
    if (tourActiveRef.current || LINAR_TOUR_STEPS.length === 0) return
    if (experienceModeRef.current !== 'idle') stopExperience(true)

    tourRunRef.current += 1
    tourSnapshotRef.current = {
      config: cloneConfig(configRef.current),
      bend: targetBendRef.current,
      secondaryCurveAmount: targetSecondaryCurveRef.current,
      side: sideRef.current,
      view: viewPresetRef.current,
      light: { ...lightStateRef.current },
    }
    tourActiveRef.current = true
    experienceModeRef.current = 'guided-tour'
    setExperienceMode('guided-tour')
    interactedRef.current = true
    setShowHint(false)
    applyTourStep(LINAR_TOUR_STEPS[0], 0)
  }, [applyTourStep, stopExperience])

  const startCinematic = useCallback(() => {
    if (experienceModeRef.current !== 'idle') stopExperience(true)
    if (cinematicHandoffTimerRef.current != null) {
      window.clearTimeout(cinematicHandoffTimerRef.current)
      cinematicHandoffTimerRef.current = null
    }
    setCinematicHandoffPhase(null)
    tourSnapshotRef.current = {
      config: cloneConfig(configRef.current),
      bend: targetBendRef.current,
      secondaryCurveAmount: targetSecondaryCurveRef.current,
      side: sideRef.current,
      view: viewPresetRef.current,
      light: { ...lightStateRef.current },
    }
    tourActiveRef.current = false
    experienceModeRef.current = 'startup-cinematic'
    const studioLight = { ...lightStateRef.current, enabled: false }
    lightStateRef.current = studioLight
    setTourStepIndex(null)
    setExperienceMode('startup-cinematic')
    setLightState(studioLight)
    setShowHint(false)
    interactedRef.current = true
    markCinematicSeen()
    setCinematicToken((value) => value + 1)
  }, [stopExperience])

  const cancelExperienceForInteraction = useCallback(
    (preserveCamera = false) => {
      if (experienceModeRef.current !== 'idle') {
        stopExperience(true, preserveCamera)
      }
    },
    [stopExperience],
  )

  const toggleTour = useCallback(() => {
    if (tourActiveRef.current) stopExperience(true)
    else startTour()
  }, [startTour, stopExperience])

  const goToTourStep = useCallback(
    (index: number) => {
      if (!tourActiveRef.current) return
      if (index < 0) return
      if (index >= LINAR_TOUR_STEPS.length) {
        stopExperience(true)
        return
      }
      tourRunRef.current += 1
      applyTourStep(LINAR_TOUR_STEPS[index], index)
    },
    [applyTourStep, stopExperience],
  )

  useEffect(() => {
    if (!tourActive || !activeTourStep) return
    const target = activeTourStep.target
    let targetElement: HTMLElement | null = null
    let firstFrame = 0
    let secondFrame = 0

    firstFrame = window.requestAnimationFrame(() => {
      targetElement = document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`)
      if (!targetElement) return
      const details =
        targetElement instanceof HTMLDetailsElement
          ? targetElement
          : targetElement.closest<HTMLDetailsElement>('details')
      if (details && !details.open) details.open = true
      secondFrame = window.requestAnimationFrame(() => {
        targetElement?.classList.add('is-tour-targeted')
        targetElement?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      targetElement?.classList.remove('is-tour-targeted')
    }
  }, [activeTourStep, reducedMotion, tourActive])

  useEffect(() => {
    if (!unlocked || !sceneReady || experienceStartHandledRef.current) return
    experienceStartHandledRef.current = true
    const debugMode = requestedTourDebugMode()
    if (debugMode === 'reset') clearCinematicSeen()
    if (debugMode === 'guided') {
      startTour()
      return
    }
    if (debugMode === 'cinematic' || debugMode === 'reset') {
      startCinematic()
      return
    }
    if (initialShareState.isShared || isEmbeddedWindow()) return
    if (reducedMotion) {
      markCinematicSeen()
      return
    }
    if (!cinematicWasSeen()) startCinematic()
  }, [initialShareState.isShared, reducedMotion, sceneReady, startCinematic, startTour, unlocked])

  useEffect(
    () => () => {
      tourRunRef.current += 1
      tourActiveRef.current = false
      if (tourTimerRef.current != null) window.clearTimeout(tourTimerRef.current)
      if (cinematicHandoffTimerRef.current != null) {
        window.clearTimeout(cinematicHandoffTimerRef.current)
      }
    },
    [],
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
      experienceMode !== 'idle' ||
      isEmbeddedWindow() ||
      window.location.href === shareUrl
    ) {
      return
    }
    window.history.replaceState(window.history.state, '', shareUrl)
  }, [experienceMode, shareUrl, unlocked])

  const onShare = useCallback(async (): Promise<boolean> => {
    const snapshot = tourSnapshotRef.current
    const urlToShare = snapshot
      ? buildLinarShareUrl(window.location.href, {
          config: snapshot.config,
          bend: snapshot.bend,
          secondaryCurveAmount: snapshot.secondaryCurveAmount,
          side: snapshot.side,
          view: snapshot.view,
          light: snapshot.light,
        })
      : shareUrl
    if (snapshot) stopExperience(true)
    if (!isEmbeddedWindow()) {
      shareModeRef.current = true
      window.history.replaceState(window.history.state, '', urlToShare)
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlToShare)
        return true
      }
    } catch {
      // Use the synchronous fallback below when Clipboard API access is denied.
    }
    return copyTextFallback(urlToShare)
  }, [shareUrl, stopExperience])

  useEffect(() => {
    const restoreSharedHash = () => {
      const shared = parseLinarShareState(window.location.hash)
      if (!shared.isShared) return
      stopExperience(false)
      if (!isEmbeddedWindow()) {
        shareModeRef.current = true
        const canonicalUrl = buildLinarShareUrl(window.location.href, {
          config: shared.config,
          bend: shared.bend,
          secondaryCurveAmount: shared.secondaryCurveAmount,
          side: shared.side,
          view: shared.view,
          light: shared.light,
        })
        if (window.location.href !== canonicalUrl) {
          window.history.replaceState(window.history.state, '', canonicalUrl)
        }
      }
      targetBendRef.current = shared.bend
      targetSecondaryCurveRef.current = shared.secondaryCurveAmount
      configRef.current = cloneConfig(shared.config)
      sideRef.current = shared.side
      viewPresetRef.current = shared.view
      lightStateRef.current = { ...shared.light }
      setTargetBend(shared.bend)
      setSecondaryCurveAmount(shared.secondaryCurveAmount)
      setConfig(cloneConfig(shared.config))
      setSide(shared.side)
      setViewPreset(shared.view)
      setLightState({ ...shared.light })
      setViewToken((value) => value + 1)
    }

    window.addEventListener('hashchange', restoreSharedHash)
    return () => window.removeEventListener('hashchange', restoreSharedHash)
  }, [stopExperience])

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

  const startMusic = useCallback((restartFromCue = false) => {
    const audio = createMusic()
    const operation = ++musicOperationRef.current
    musicShouldPlayRef.current = true
    setMusicEnabled(true)
    cancelMusicFade()

    if (!audio.paused && !restartFromCue) {
      fadeMusicTo(audio, musicVolumeRef.current, LINAR_MUSIC_FADE_IN_MS)
      return
    }

    if (restartFromCue || audio.currentTime < LINAR_MUSIC_START_SECONDS) {
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
    cancelExperienceForInteraction(false)
    interactedRef.current = true
    setShowHint(false)
  }, [cancelExperienceForInteraction])

  const markSceneInteracted = useCallback(() => {
    cancelExperienceForInteraction(true)
    interactedRef.current = true
    setShowHint(false)
  }, [cancelExperienceForInteraction])

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
    stopExperience(false)
    interactedRef.current = true
    setShowHint(false)
    targetBendRef.current = REST_BEND
    targetSecondaryCurveRef.current = 0
    setTargetBend(REST_BEND)
    setSecondaryCurveAmount(0)
    configRef.current = cloneConfig(DEFAULT_LINAR_CONFIG)
    setConfig(cloneConfig(DEFAULT_LINAR_CONFIG))
    lightStateRef.current = { ...DEFAULT_LINAR_LIGHT }
    setLightState({ ...DEFAULT_LINAR_LIGHT })
    sideRef.current = 'front'
    viewPresetRef.current = 'hero'
    setSide('front')
    setViewPreset('hero')
    setViewToken((value) => value + 1)
  }, [stopExperience])

  const onLightChange = useCallback((next: LinarLightState) => {
    lightStateRef.current = { ...next }
    setLightState({ ...next })
  }, [])

  const onCinematicStage = useCallback((stage: number) => {
    if (experienceModeRef.current !== 'startup-cinematic') return
    // Let the architectural move settle in studio light before the final
    // single-source study begins. Combining a camera move, application swap
    // and blackout on one frame made the dense 4 mm pattern visibly flash.
    const lightStudyEnabled = stage === LINAR_CINEMATIC_LIGHT_STAGE
    const stageLight = {
      ...lightStateRef.current,
      enabled: lightStudyEnabled,
      ...(stage === 4
        ? {
            u: DEFAULT_LINAR_LIGHT.u,
            v: DEFAULT_LINAR_LIGHT.v,
            radius: DEFAULT_LINAR_LIGHT.radius,
          }
        : {}),
    }
    lightStateRef.current = stageLight
    setLightState(stageLight)
    const setCinematicView = (nextView: LinarViewId, nextSide: LinarSide = 'front') => {
      setSide(nextSide)
      setViewPreset(nextView)
      setViewToken((value) => value + 1)
    }

    if (stage === 0) {
      setConfig((previous) => ({
        ...previous,
        application: 'freestanding',
        panelCount: 1,
        backing: 'none',
      }))
      setCinematicView('closeup')
    } else if (stage === 1) {
      setCinematicView('bent')
    } else if (stage === 2) {
      // The technical Top preset changes the camera up-axis and is therefore
      // an intentional cut in normal use. The automatic intro uses the Side
      // profile instead so scene changes remain continuous.
      setCinematicView('side')
    } else if (stage === 3) {
      setCinematicView('bent')
    } else if (stage === 4) {
      // Keep one freestanding physical module throughout the cinematic.
      // Adding a second 150-pitch lattice and swapping application during a
      // moving shot doubled the sub-pixel pattern and produced a strong moire
      // burst. Repetition and architectural contexts remain fully available
      // in the configurator and guided tour.
      setConfig((previous) => ({
        ...previous,
        application: 'freestanding',
        panelCount: 1,
      }))
      setCinematicView('hero')
    } else if (stage === LINAR_CINEMATIC_EXIT_STAGE) {
      // The LIGHT-to-studio crossfade remains full-screen. A paper-colour veil
      // reaches opacity only at the end of this stage, hiding the unavoidable
      // viewport resize when the configurator interface returns.
      setCinematicHandoffPhase('covering')
    }
    // The illuminated stage deliberately holds the settled hero composition
    // while the source traces its shallow authored orbit in the scene.
  }, [])

  const onCinematicComplete = useCallback(() => {
    if (experienceModeRef.current !== 'startup-cinematic') return
    targetBendRef.current = 28
    targetSecondaryCurveRef.current = 0
    setTargetBend(28)
    setSecondaryCurveAmount(0)
    setConfig((previous) => ({ ...previous, application: 'freestanding', panelCount: 1 }))
    setSide('front')
    setViewPreset('hero')
    const finalLight: LinarLightState = {
      enabled: false,
      u: DEFAULT_LINAR_LIGHT.u,
      v: DEFAULT_LINAR_LIGHT.v,
      radius: DEFAULT_LINAR_LIGHT.radius,
    }
    lightStateRef.current = finalLight
    setLightState(finalLight)
    setCinematicHandoffPhase('revealing')
    if (cinematicHandoffTimerRef.current != null) {
      window.clearTimeout(cinematicHandoffTimerRef.current)
    }
    cinematicHandoffTimerRef.current = window.setTimeout(() => {
      cinematicHandoffTimerRef.current = null
      setCinematicHandoffPhase(null)
    }, LINAR_CINEMATIC_REVEAL_MS)
    tourSnapshotRef.current = null
    experienceModeRef.current = 'idle'
    setExperienceMode('idle')
    setShowHint(true)
    markCinematicSeen()
  }, [])

  const onToggleMusic = useCallback(() => {
    if (musicShouldPlayRef.current) {
      stopMusic()
    } else {
      startMusic()
    }
  }, [startMusic, stopMusic])

  const onToggleLight = useCallback(() => {
    const base = lightStateRef.current
    const next = { ...base, enabled: !base.enabled }
    lightStateRef.current = next
    setLightState(next)
  }, [])

  const setLightRadius = useCallback((radius: number) => {
    const base = lightStateRef.current
    const next = { ...base, radius: Math.max(-1, Math.min(1, radius)) }
    lightStateRef.current = next
    setLightState(next)
  }, [])

  const onResetLight = useCallback(() => {
    const next = {
      ...DEFAULT_LINAR_LIGHT,
      enabled: lightStateRef.current.enabled,
    }
    lightStateRef.current = next
    setLightState(next)
  }, [])

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
        audio.onended = null
        audio.removeAttribute('src')
        audio.load()
        musicRef.current = null
      }
      document.body.classList.remove('linar-route')
      document.documentElement.classList.remove('linar-route')
    }
  }, [])

  if (!unlocked) {
    return (
      <PasswordGate
        onUnlock={() => {
          // Password submission is a trusted user gesture. Start playback
          // synchronously here so browser autoplay policies permit it.
          startMusic()
          setUnlocked(true)
        }}
      />
    )
  }

  return (
    <div
      className={[
        'linar-page',
        tourActive ? 'is-tour-running' : '',
        cinematicActive ? 'is-cinematic-running' : '',
        reducedMotion && !initialShareState.isShared ? 'is-reduced-reveal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="linar-header">
        <p className="linar-brand">dukta flexible wood</p>
        <span className="linar-badge">Interactive concept</span>
      </header>

      <div className="linar-body">
        <section
          className={[
            'linar-viewport',
            lightState.enabled ? 'is-light-study' : '',
            tourActive && activeTourStep?.target === 'viewport'
              ? 'is-tour-highlighted'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-tour-id="viewport"
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
                targetSecondaryCurveRef={targetSecondaryCurveRef}
                config={config}
                tech={tech}
                resetViewToken={resetViewToken}
                viewPreset={viewPreset}
                side={side}
                viewToken={viewToken}
                tourActive={tourActive}
                cinematicActive={cinematicActive}
                cinematicToken={cinematicToken}
                lightState={lightState}
                introStarted={false}
                interactedRef={interactedRef}
                reducedMotion={reducedMotion}
                onUnavailable={() => {
                  stopExperience(true)
                  setWebglFailed(true)
                }}
                onUserInteract={markSceneInteracted}
                onLightChange={onLightChange}
                onSceneReady={() => setSceneReady(true)}
                onCinematicStage={onCinematicStage}
                onCinematicComplete={onCinematicComplete}
                onIntroBend={() => undefined}
              />
              {showHint || lightState.enabled ? (
                <p className="linar-viewport__hint" aria-live="polite">
                  {lightState.enabled
                    ? 'Drag the light orb to orbit 360°. Scroll over it or Shift-drag up/down for distance. Near places it 4 cm from the surface.'
                    : 'Drag to rotate. Scroll or pinch to zoom.'}
                </p>
              ) : null}
            </>
          )}
          {activeTourStep && tourStepIndex != null ? (
            <aside
              key={tourStepIndex}
              className="linar-tour-card"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="linar-tour-card__progress" aria-hidden="true">
                <span
                  style={{
                    width: `${((tourStepIndex + 1) / LINAR_TOUR_STEPS.length) * 100}%`,
                  }}
                />
              </div>
              <p className="linar-tour__eyebrow">
                Product tour {tourStepIndex + 1}/{LINAR_TOUR_STEPS.length}
              </p>
              <h2>{activeTourStep.title}</h2>
              <p>{activeTourStep.description}</p>
              <div className="linar-tour-card__actions">
                <button
                  type="button"
                  className="linar-tour__secondary"
                  disabled={tourStepIndex === 0}
                  onClick={() => goToTourStep(tourStepIndex - 1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="linar-tour__primary"
                  onClick={() => goToTourStep(tourStepIndex + 1)}
                >
                  {tourStepIndex === LINAR_TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </button>
                <button
                  type="button"
                  className="linar-tour__secondary"
                  onClick={() => stopExperience(true)}
                >
                  Skip
                </button>
              </div>
            </aside>
          ) : null}
          {cinematicActive ? (
            <aside className="linar-cinematic-hud" aria-live="polite">
              <div>
                <p className="linar-tour__eyebrow">
                  {lightState.enabled ? 'LINAR single-light study' : 'LINAR material study'}
                </p>
                <p>
                  {lightState.enabled
                    ? 'One warm source moves gently across incision depth and perforated shadow in darkness.'
                    : 'Light, incision and curvature in one continuous manufactured surface.'}
                </p>
              </div>
              <button type="button" onClick={() => stopExperience(true)}>
                Skip intro
              </button>
            </aside>
          ) : null}
          <LinarViewportControls
            viewPreset={viewPreset}
            side={side}
            musicEnabled={musicEnabled}
            musicVolume={musicVolume}
            viewAvailable={!webglFailed}
            tourActive={tourActive}
            lightEnabled={lightState.enabled}
            lightRadius={lightState.radius}
            cinematicActive={cinematicActive}
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
            onToggleTour={toggleTour}
            onReplayCinematic={() => {
              if (experienceModeRef.current !== 'idle') stopExperience(true)
              // INTRO is a trusted click, so restart the soundtrack from its
              // authored cue here rather than relying on a later autoplay.
              startMusic(true)
              startCinematic()
            }}
            onToggleLight={onToggleLight}
            onLightNear={() => setLightRadius(-1)}
            onLightFar={() => setLightRadius(1)}
            onResetLight={onResetLight}
            onUserInteract={markInteracted}
            onShare={onShare}
          />
        </section>

        <aside
          className="linar-side"
          onPointerDownCapture={markInteracted}
          onKeyDownCapture={markInteracted}
        >
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
              secondaryCurveSafetyLimited={currentBendState.secondaryCurveSafetyLimited}
              onBendInput={onBendInput}
              onSecondaryCurveInput={onSecondaryCurveInput}
              onConfig={onConfig}
              onResetPanel={() => {
                onResetPanel()
              }}
            />

            <LinarProductInfo
              config={config}
              tech={tech}
              selectedRadiusMm={currentBendState.selectedRadiusMm}
              bendDirection={currentBendState.direction}
              secondaryCurveAmount={secondaryCurveAmount}
              secondaryCurveSafetyLimited={currentBendState.secondaryCurveSafetyLimited}
            />

            <p className="linar-disclaimer">
              {CONCEPT_DISCLAIMER} {PARTNER_CONFIRMATION_NOTE}
            </p>
          </div>
        </aside>
      </div>
      {cinematicHandoffPhase ? (
        <div
          className={`linar-cinematic-curtain is-${cinematicHandoffPhase}`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
