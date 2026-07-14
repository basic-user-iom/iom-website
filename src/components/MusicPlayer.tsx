import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../data/projects'
import {
  formatAudioTime,
  persistMute,
  persistVolume,
  readStoredMute,
  readStoredVolume,
} from '../utils/audioPrefs'
import { getDeviceProfile } from '../utils/device'
import { createMusicPlayerVisualizer } from '../utils/createMusicPlayerVisualizer'
import type { MusicPlayerVisualizerLike } from '../utils/musicPlayerVisualizerTypes'

interface MusicPlayerProps {
  tracks: Project[]
  activeTrackId: string | null
  onActiveTrackChange: (trackId: string) => void
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface MusicAlbumThumbProps {
  track: Project
  isActive: boolean
  onSelect?: (trackId: string) => void
}

function MusicAlbumThumb({ track, isActive, onSelect }: MusicAlbumThumbProps) {
  const isMobile = getDeviceProfile().isMobile
  const posterSrc = isMobile
    ? (track.mobilePosterUrl ?? track.posterUrl ?? track.thumbnail)
    : (track.posterUrl ?? track.thumbnail)
  const [posterFailed, setPosterFailed] = useState(false)
  const disabled = !track.audioUrl || !onSelect
  const showPoster = Boolean(posterSrc) && !posterFailed

  return (
    <button
      type="button"
      className={`music-player-album-thumb${isActive ? ' is-active' : ''}`}
      onClick={disabled ? undefined : () => onSelect(track.id)}
      disabled={disabled}
      aria-pressed={isActive}
      aria-label={track.audioUrl ? `Load ${track.title}` : track.title}
    >
      {showPoster ? (
        <img
          className="music-player-album-thumb-poster"
          src={posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setPosterFailed(true)}
        />
      ) : (
        <span className="music-player-album-thumb-fallback" aria-hidden="true">
          {track.title.slice(0, 1)}
        </span>
      )}
      <span className="music-player-album-thumb-title">{track.title}</span>
    </button>
  )
}

function isNativeFullscreenActive(el: HTMLElement | null): boolean {
  if (!el) return false
  const doc = document as FullscreenDocument
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el
}

interface TransportControlsProps {
  className?: string
  variant?: 'inline' | 'fullscreen'
  isPlaying: boolean
  muted: boolean
  volume: number
  currentTime: number
  duration: number
  progressMax: number
  progressValue: number
  activeTrackTitle?: string
  canGoPrev: boolean
  canGoNext: boolean
  disabled: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onToggleMute: () => void
  onVolumeChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onScrub: (event: React.ChangeEvent<HTMLInputElement>) => void
  onPrevTrack: () => void
  onNextTrack: () => void
}

function TransportControls({
  className,
  variant = 'inline',
  isPlaying,
  muted,
  volume,
  currentTime,
  duration,
  progressMax,
  progressValue,
  activeTrackTitle,
  canGoPrev,
  canGoNext,
  disabled,
  onPlay,
  onPause,
  onStop,
  onToggleMute,
  onVolumeChange,
  onScrub,
  onPrevTrack,
  onNextTrack,
}: TransportControlsProps) {
  const rootClass = ['music-player-transport', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} role="group" aria-label="Playback controls">
      {variant === 'fullscreen' && activeTrackTitle ? (
        <div className="music-player-fs-track-row">
          <button
            type="button"
            className="music-player-fs-nav-btn"
            onClick={onPrevTrack}
            disabled={!canGoPrev}
            aria-label="Previous track"
          >
            Prev
          </button>
          <p className="music-player-fs-track-title" title={activeTrackTitle}>
            {activeTrackTitle}
          </p>
          <button
            type="button"
            className="music-player-fs-nav-btn"
            onClick={onNextTrack}
            disabled={!canGoNext}
            aria-label="Next track"
          >
            Next
          </button>
        </div>
      ) : null}

      {variant === 'fullscreen' ? (
        <div className="music-player-fs-controls-row">
          <div className="music-player-buttons">
            <button
              type="button"
              className="music-player-btn"
              onClick={() => void onPlay()}
              disabled={isPlaying || disabled}
              aria-label="Play"
            >
              Play
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onPause}
              disabled={!isPlaying}
              aria-label="Pause"
            >
              Pause
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onStop}
              disabled={disabled}
              aria-label="Stop and reset"
            >
              Stop
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
            >
              {muted ? 'Muted' : 'Mute'}
            </button>
          </div>

          <div className="music-player-timeline">
            <span className="music-player-time">{formatAudioTime(currentTime)}</span>
            <input
              type="range"
              className="music-player-scrubber"
              min={0}
              max={progressMax}
              step={0.1}
              value={progressValue}
              onChange={onScrub}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={progressMax}
              aria-valuenow={progressValue}
              disabled={disabled || duration <= 0}
            />
            <span className="music-player-time">{formatAudioTime(duration)}</span>
          </div>

          <label className="music-player-volume" aria-label="Volume">
            <span className="music-player-volume-label">Vol</span>
            <input
              type="range"
              className="music-player-volume-slider"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={onVolumeChange}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={volume}
              aria-valuetext={`${volume} percent`}
            />
          </label>
        </div>
      ) : (
        <>
          <div className="music-player-buttons">
            <button
              type="button"
              className="music-player-btn"
              onClick={() => void onPlay()}
              disabled={isPlaying || disabled}
              aria-label="Play"
            >
              Play
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onPause}
              disabled={!isPlaying}
              aria-label="Pause"
            >
              Pause
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onStop}
              disabled={disabled}
              aria-label="Stop and reset"
            >
              Stop
            </button>
            <button
              type="button"
              className="music-player-btn"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
            >
              {muted ? 'Muted' : 'Mute'}
            </button>
          </div>

          <div className="music-player-timeline">
            <span className="music-player-time">{formatAudioTime(currentTime)}</span>
            <input
              type="range"
              className="music-player-scrubber"
              min={0}
              max={progressMax}
              step={0.1}
              value={progressValue}
              onChange={onScrub}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={progressMax}
              aria-valuenow={progressValue}
              disabled={disabled || duration <= 0}
            />
            <span className="music-player-time">{formatAudioTime(duration)}</span>
          </div>

          <label className="music-player-volume" aria-label="Volume">
            <span className="music-player-volume-label">Vol</span>
            <input
              type="range"
              className="music-player-volume-slider"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={onVolumeChange}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={volume}
              aria-valuetext={`${volume} percent`}
            />
          </label>
        </>
      )}
    </div>
  )
}

const VISUALIZER_IO_THRESHOLD = 0.08
const VISUALIZER_IO_ROOT_MARGIN_DESKTOP = '160px 0px'
const VISUALIZER_IO_ROOT_MARGIN_MOBILE = '40px 0px'
const CROSSFADE_DURATION_SEC = 4

export function MusicPlayer({ tracks, activeTrackId, onActiveTrackChange }: MusicPlayerProps) {
  const playableTracks = tracks.filter((track) => track.audioUrl)
  const activeTrack =
    playableTracks.find((track) => track.id === activeTrackId) ?? playableTracks[0] ?? null

  const deviceProfile = getDeviceProfile()

  const playerRef = useRef<HTMLDivElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const visualWrapRef = useRef<HTMLDivElement>(null)
  const visualContainerRef = useRef<HTMLDivElement>(null)
  const visualizerRef = useRef<MusicPlayerVisualizerLike | null>(null)
  const visualizerMountedRef = useRef(false)
  const [visualizerReady, setVisualizerReady] = useState(false)
  const audioARef = useRef<HTMLAudioElement | null>(null)
  const audioBRef = useRef<HTMLAudioElement | null>(null)
  const activeSlotRef = useRef<'a' | 'b'>('a')
  const crossfadeRafRef = useRef<number | null>(null)
  const isCrossfadingRef = useRef(false)
  const playingTrackIdRef = useRef<string | null>(null)
  const autoAdvanceTriggeredRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceConnectedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const [muted, setMuted] = useState(() => readStoredMute('music'))
  const [volume, setVolume] = useState(() => readStoredVolume('music'))
  const mutedRef = useRef(muted)
  const volumeRef = useRef(volume)
  mutedRef.current = muted
  volumeRef.current = volume
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  )
  const isFullscreen = nativeFullscreen || pseudoFullscreen
  const viewportEngaged = inViewport || isFullscreen
  const shouldAnimateVisualizer =
    tabVisible &&
    viewportEngaged &&
    (isFullscreen || isPlaying || deviceProfile.visualizerIdleWhenVisible)

  const resizeVisualizer = useCallback(() => {
    const container = visualRef.current
    const visualizer = visualizerRef.current
    if (!container || !visualizer) return
    const rect = container.getBoundingClientRect()
    visualizer.resize(rect.width, rect.height)
  }, [])

  const drawVisualizer = useCallback((delta: number, time: number) => {
    visualizerRef.current?.update(delta, time, isPlaying, analyserRef.current)
  }, [isPlaying])

  const notifyVisualizerTrackChange = useCallback((trackId: string) => {
    visualizerRef.current?.setActiveTrackId?.(trackId)
  }, [])

  const visualizerTargetFps =
    isFullscreen && !deviceProfile.isMobile
      ? Math.min(deviceProfile.visualizerTargetFps, 30)
      : deviceProfile.visualizerTargetFps

  const stopVisualizer = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startVisualizer = useCallback(() => {
    stopVisualizer()
    lastFrameRef.current = performance.now()
    let lastDraw = lastFrameRef.current
    const frameInterval =
      visualizerTargetFps < 60
        ? 1000 / visualizerTargetFps
        : 0

    const tick = (now: number) => {
      if (frameInterval > 0) {
        const elapsed = now - lastDraw
        if (elapsed < frameInterval) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        lastDraw = now - (elapsed % frameInterval)
      }

      const delta = Math.min(0.05, (now - lastFrameRef.current) / 1000)
      lastFrameRef.current = now
      drawVisualizer(delta, now / 1000)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [visualizerTargetFps, drawVisualizer, stopVisualizer])

  const getAudioForSlot = useCallback((slot: 'a' | 'b') => {
    return slot === 'a' ? audioARef.current : audioBRef.current
  }, [])

  const getActiveAudio = useCallback(() => {
    return getAudioForSlot(activeSlotRef.current)
  }, [getAudioForSlot])

  const getInactiveSlot = useCallback((): 'a' | 'b' => {
    return activeSlotRef.current === 'a' ? 'b' : 'a'
  }, [])

  const getAudibleVolume = useCallback(() => {
    return mutedRef.current ? 0 : volumeRef.current / 100
  }, [])

  const applyUserVolume = useCallback(
    (audio: HTMLAudioElement, options: { forceUnmuted?: boolean } = {}) => {
      const effectiveMuted = options.forceUnmuted ? false : mutedRef.current
      audio.muted = effectiveMuted
      audio.volume = volumeRef.current / 100
    },
    [],
  )

  const applyOutputGain = useCallback((options: { forceUnmuted?: boolean } = {}) => {
    const effectiveMuted = options.forceUnmuted ? false : mutedRef.current
    const audible = effectiveMuted ? 0 : volumeRef.current / 100
    const gain = gainNodeRef.current
    if (gain) {
      gain.gain.value = audible
    }
  }, [])

  const applyVolumeToAllOutputs = useCallback(
    (options: { forceUnmuted?: boolean } = {}) => {
      applyOutputGain(options)
      const audioA = audioARef.current
      const audioB = audioBRef.current
      if (audioA) applyUserVolume(audioA, options)
      if (audioB) applyUserVolume(audioB, options)
    },
    [applyOutputGain, applyUserVolume],
  )

  const unlockAudioContext = useCallback(() => {
    const ctx = audioContextRef.current
    if (ctx?.state === 'suspended') {
      void ctx.resume()
    }
  }, [])

  const cancelCrossfade = useCallback(() => {
    if (crossfadeRafRef.current != null) {
      cancelAnimationFrame(crossfadeRafRef.current)
      crossfadeRafRef.current = null
    }
    isCrossfadingRef.current = false
    autoAdvanceTriggeredRef.current = false

    const active = getActiveAudio()
    const inactive = getAudioForSlot(getInactiveSlot())
    if (active) applyVolumeToAllOutputs()
    if (inactive) {
      inactive.pause()
      applyUserVolume(inactive)
    }
  }, [applyUserVolume, applyVolumeToAllOutputs, getActiveAudio, getAudioForSlot, getInactiveSlot])

  const ensureAudioGraph = useCallback(() => {
    if (sourceConnectedRef.current) return

    const audioA = audioARef.current
    const audioB = audioBRef.current
    if (!audioA || !audioB) return

    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const context = audioContextRef.current ?? new AudioCtx()
    audioContextRef.current = context

    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.58
    analyser.minDecibels = -88
    analyser.maxDecibels = -12
    analyserRef.current = analyser

    const gain = context.createGain()
    gain.gain.value = getAudibleVolume()
    gainNodeRef.current = gain

    const sourceA = context.createMediaElementSource(audioA)
    const sourceB = context.createMediaElementSource(audioB)
    sourceA.connect(analyser)
    sourceB.connect(analyser)
    analyser.connect(gain)
    gain.connect(context.destination)
    sourceConnectedRef.current = true
  }, [getAudibleVolume])

  const transitionToTrack = useCallback(
    async (trackId: string, options: { crossfade?: boolean; fromAutoAdvance?: boolean } = {}) => {
      const track = playableTracks.find((item) => item.id === trackId)
      if (!track?.audioUrl) return

      const { crossfade = false, fromAutoAdvance = false } = options
      const outgoing = getActiveAudio()
      const incomingSlot = getInactiveSlot()
      const incoming = getAudioForSlot(incomingSlot)
      if (!outgoing || !incoming) return

      if (fromAutoAdvance && autoAdvanceTriggeredRef.current) return
      if (isCrossfadingRef.current && fromAutoAdvance) return

      const shouldCrossfade =
        crossfade && !outgoing.paused && playingTrackIdRef.current != null && trackId !== playingTrackIdRef.current

      if (!shouldCrossfade) {
        cancelCrossfade()
        outgoing.src = track.audioUrl
        outgoing.load()
        outgoing.currentTime = 0
        applyUserVolume(outgoing)
        playingTrackIdRef.current = trackId
        onActiveTrackChange(trackId)
        notifyVisualizerTrackChange(trackId)
        setCurrentTime(0)
        setDuration(0)

        if (fromAutoAdvance) {
          ensureAudioGraph()
          unlockAudioContext()
          try {
            await outgoing.play()
            setIsPlaying(true)
          } catch {
            setIsPlaying(false)
          }
        } else {
          setIsPlaying(false)
        }
        return
      }

      isCrossfadingRef.current = true
      if (fromAutoAdvance) autoAdvanceTriggeredRef.current = true

      playingTrackIdRef.current = trackId
      onActiveTrackChange(trackId)
      notifyVisualizerTrackChange(trackId)

      incoming.src = track.audioUrl
      incoming.currentTime = 0
      applyUserVolume(incoming)
      incoming.volume = 0

      ensureAudioGraph()
      unlockAudioContext()

      try {
        await incoming.play()
        setIsPlaying(true)
      } catch {
        isCrossfadingRef.current = false
        autoAdvanceTriggeredRef.current = false
        return
      }

      const targetVol = getAudibleVolume()
      const startOutVol = outgoing.volume
      const startTime = performance.now()
      const durationMs = CROSSFADE_DURATION_SEC * 1000

      const step = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / durationMs)
        outgoing.volume = startOutVol * (1 - t)
        incoming.volume = targetVol * t
        setCurrentTime(incoming.currentTime)

        if (t < 1) {
          crossfadeRafRef.current = requestAnimationFrame(step)
          return
        }

        outgoing.pause()
        outgoing.currentTime = 0
        applyUserVolume(outgoing)
        applyUserVolume(incoming)
        activeSlotRef.current = incomingSlot
        isCrossfadingRef.current = false
        autoAdvanceTriggeredRef.current = false
        crossfadeRafRef.current = null
        setCurrentTime(incoming.currentTime)
        setDuration(Number.isFinite(incoming.duration) ? incoming.duration : 0)
      }

      crossfadeRafRef.current = requestAnimationFrame(step)
    },
    [
      applyUserVolume,
      ensureAudioGraph,
      getActiveAudio,
      getAudioForSlot,
      getInactiveSlot,
      getAudibleVolume,
      notifyVisualizerTrackChange,
      onActiveTrackChange,
      playableTracks,
      cancelCrossfade,
      unlockAudioContext,
    ],
  )

  const transitionToTrackRef = useRef(transitionToTrack)
  transitionToTrackRef.current = transitionToTrack

  const playableTracksRef = useRef(playableTracks)
  playableTracksRef.current = playableTracks

  const activeTrackRef = useRef(activeTrack)
  activeTrackRef.current = activeTrack

  const ensureTrackRef = useCallback(() => {
    if (!playingTrackIdRef.current && activeTrackRef.current?.id) {
      playingTrackIdRef.current = activeTrackRef.current.id
    }
  }, [])

  const resolveLoadedAudio = useCallback(() => {
    ensureTrackRef()
    const audio = getActiveAudio()
    if (!audio) return null

    const trackId = playingTrackIdRef.current ?? activeTrackRef.current?.id ?? null
    const track = trackId
      ? playableTracksRef.current.find((item) => item.id === trackId)
      : null
    if (!track?.audioUrl) return null

    if (!audio.currentSrc) {
      const resumeTime = audio.paused ? currentTime : 0
      audio.src = track.audioUrl
      audio.load()
      applyUserVolume(audio)
      playingTrackIdRef.current = track.id
      if (resumeTime > 0 && Number.isFinite(resumeTime)) {
        audio.currentTime = resumeTime
      }
    }

    return audio
  }, [applyUserVolume, currentTime, ensureTrackRef, getActiveAudio])

  const handlePlay = useCallback(() => {
    const audio = resolveLoadedAudio()
    if (!audio) {
      setPlaybackError('No track loaded')
      return
    }

    setPlaybackError(null)
    autoAdvanceTriggeredRef.current = false

    // Connect graph + resume context synchronously inside the user gesture.
    ensureAudioGraph()
    unlockAudioContext()

    const shouldUnmute = mutedRef.current && volumeRef.current > 0
    if (shouldUnmute) {
      setMuted(false)
      persistMute('music', false)
    }
    applyUserVolume(audio, { forceUnmuted: shouldUnmute })
    applyOutputGain({ forceUnmuted: shouldUnmute })

    const playAttempt = audio.play()
    if (!playAttempt) {
      setIsPlaying(true)
      return
    }

    playAttempt
      .then(() => {
        setIsPlaying(true)
        unlockAudioContext()
      })
      .catch((err: unknown) => {
        console.warn('[music-player] play() rejected:', err)
        setIsPlaying(false)
        setPlaybackError('Tap Play again to start audio')
      })
  }, [applyOutputGain, applyUserVolume, ensureAudioGraph, resolveLoadedAudio, unlockAudioContext])

  const handlePause = useCallback(() => {
    cancelCrossfade()
    getActiveAudio()?.pause()
    getAudioForSlot(getInactiveSlot())?.pause()
    setIsPlaying(false)
    setPlaybackError(null)
  }, [cancelCrossfade, getActiveAudio, getAudioForSlot, getInactiveSlot])

  const handleStop = useCallback(() => {
    cancelCrossfade()
    ensureTrackRef()
    const active = getActiveAudio()
    if (active) {
      active.pause()
      active.currentTime = 0
      applyUserVolume(active)
    }
    const inactive = getAudioForSlot(getInactiveSlot())
    inactive?.pause()
    setCurrentTime(0)
    setIsPlaying(false)
    setPlaybackError(null)
    autoAdvanceTriggeredRef.current = false
  }, [applyUserVolume, cancelCrossfade, ensureTrackRef, getActiveAudio, getAudioForSlot, getInactiveSlot])

  const toggleMute = useCallback(() => {
    unlockAudioContext()
    setMuted((current) => {
      const next = !current
      persistMute('music', next)
      return next
    })
    setPlaybackError(null)
  }, [unlockAudioContext])

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = clamp(Number(event.target.value), 0, 100)
    setVolume(next)
    persistVolume('music', next)
    unlockAudioContext()
    if (next > 0 && mutedRef.current) {
      setMuted(false)
      persistMute('music', false)
    }
    setPlaybackError(null)
  }, [unlockAudioContext])

  const handleScrub = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = getActiveAudio()
    if (!audio || !Number.isFinite(audio.duration)) return
    const next = clamp(Number(event.target.value), 0, audio.duration)
    audio.currentTime = next
    setCurrentTime(next)
    autoAdvanceTriggeredRef.current = false
  }, [getActiveAudio])

  const selectTrack = useCallback(
    (trackId: string) => {
      if (trackId === playingTrackIdRef.current && !isCrossfadingRef.current) return
      void transitionToTrack(trackId, { crossfade: isPlaying })
    },
    [isPlaying, transitionToTrack],
  )

  const activeTrackIndex = playableTracks.findIndex((track) => track.id === activeTrack?.id)
  const canGoPrev = playableTracks.length > 1
  const canGoNext = playableTracks.length > 1

  const goPrevTrack = useCallback(() => {
    if (playableTracks.length <= 1) return
    const idx = playableTracks.findIndex((track) => track.id === playingTrackIdRef.current)
    const baseIndex = idx >= 0 ? idx : activeTrackIndex
    const prevIndex = baseIndex <= 0 ? playableTracks.length - 1 : baseIndex - 1
    void transitionToTrack(playableTracks[prevIndex].id, { crossfade: isPlaying })
  }, [activeTrackIndex, isPlaying, playableTracks, transitionToTrack])

  const goNextTrack = useCallback(() => {
    if (playableTracks.length <= 1) return
    const idx = playableTracks.findIndex((track) => track.id === playingTrackIdRef.current)
    const baseIndex = idx >= 0 ? idx : activeTrackIndex
    const nextIndex = (baseIndex + 1) % playableTracks.length
    void transitionToTrack(playableTracks[nextIndex].id, { crossfade: isPlaying })
  }, [activeTrackIndex, isPlaying, playableTracks, transitionToTrack])

  const enterFullscreen = useCallback(async () => {
    const el = visualWrapRef.current as FullscreenElement | null
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

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen()
    } else {
      void enterFullscreen()
    }
  }, [enterFullscreen, exitFullscreen, isFullscreen])

  useEffect(() => {
    const audioA = new Audio()
    const audioB = new Audio()
    audioA.preload = 'metadata'
    audioB.preload = 'metadata'
    applyUserVolume(audioA)
    applyUserVolume(audioB)
    audioARef.current = audioA
    audioBRef.current = audioB

    const syncPlayingState = () => {
      const active = activeSlotRef.current === 'a' ? audioA : audioB
      const inactive = activeSlotRef.current === 'a' ? audioB : audioA
      const activePlaying = !active.paused
      const crossfading = isCrossfadingRef.current
      setIsPlaying(activePlaying || (crossfading && !inactive.paused))
    }

    const onLoaded = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (isCrossfadingRef.current) {
        const incoming = activeSlotRef.current === 'a' ? audioB : audioA
        if (audio === incoming) {
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
        }
        return
      }
      if (audio === (activeSlotRef.current === 'a' ? audioA : audioB)) {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      }
    }

    const onTimeUpdate = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (isCrossfadingRef.current) return

      const active = activeSlotRef.current === 'a' ? audioA : audioB
      if (audio !== active || audio.paused) return

      setCurrentTime(audio.currentTime)

      if (autoAdvanceTriggeredRef.current) return
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return

      const remaining = audio.duration - audio.currentTime
      if (remaining > CROSSFADE_DURATION_SEC || remaining <= 0.05) return

      const tracks = playableTracksRef.current
      if (tracks.length <= 1) return

      const idx = tracks.findIndex((track) => track.id === playingTrackIdRef.current)
      const baseIndex = idx >= 0 ? idx : 0
      const nextIndex = (baseIndex + 1) % tracks.length
      void transitionToTrackRef.current(tracks[nextIndex].id, {
        crossfade: true,
        fromAutoAdvance: true,
      })
    }

    const onEnded = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (isCrossfadingRef.current) return

      const active = activeSlotRef.current === 'a' ? audioA : audioB
      if (audio !== active) return
      if (autoAdvanceTriggeredRef.current) return

      const tracks = playableTracksRef.current
      if (tracks.length <= 1) {
        setIsPlaying(false)
        setCurrentTime(0)
        return
      }

      const idx = tracks.findIndex((track) => track.id === playingTrackIdRef.current)
      const baseIndex = idx >= 0 ? idx : 0
      const nextIndex = (baseIndex + 1) % tracks.length
      void transitionToTrackRef.current(tracks[nextIndex].id, {
        crossfade: true,
        fromAutoAdvance: true,
      })
    }

    const onPlay = () => syncPlayingState()
    const onPause = () => syncPlayingState()

    for (const audio of [audioA, audioB]) {
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('ended', onEnded)
    }

    return () => {
      if (crossfadeRafRef.current != null) {
        cancelAnimationFrame(crossfadeRafRef.current)
        crossfadeRafRef.current = null
      }
      isCrossfadingRef.current = false
      autoAdvanceTriggeredRef.current = false

      for (const audio of [audioA, audioB]) {
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('ended', onEnded)
        audio.pause()
        audio.src = ''
      }
      audioARef.current = null
      audioBRef.current = null
      sourceConnectedRef.current = false
      gainNodeRef.current = null
      analyserRef.current = null
    }
    // Mount audio elements once — volume/mute updates go through applyVolumeToAllOutputs.
  }, [])

  useEffect(() => {
    if (!activeTrack?.audioUrl) {
      playingTrackIdRef.current = null
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    if (isCrossfadingRef.current) return

    const audio = getActiveAudio()
    if (!audio) return

    const sameTrack = playingTrackIdRef.current === activeTrack.id
    if (sameTrack && audio.currentSrc) return

    audio.src = activeTrack.audioUrl
    audio.load()
    applyUserVolume(audio)
    playingTrackIdRef.current = activeTrack.id
    if (!sameTrack) {
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      autoAdvanceTriggeredRef.current = false
    }
  }, [activeTrack?.audioUrl, activeTrack?.id, applyUserVolume, getActiveAudio])

  useEffect(() => {
    const audioA = audioARef.current
    const audioB = audioBRef.current
    if (!audioA || !audioB) return

    if (!isCrossfadingRef.current) {
      applyVolumeToAllOutputs()
    } else {
      applyOutputGain()
    }
  }, [applyOutputGain, applyVolumeToAllOutputs, muted, volume])

  useEffect(() => {
    const root = playerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0
        setInViewport(Boolean(entry?.isIntersecting && ratio >= VISUALIZER_IO_THRESHOLD))
      },
      { threshold: [0, VISUALIZER_IO_THRESHOLD, 0.25, 0.5], rootMargin: deviceProfile.isMobile ? VISUALIZER_IO_ROOT_MARGIN_MOBILE : VISUALIZER_IO_ROOT_MARGIN_DESKTOP },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [deviceProfile.isMobile])

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    let cancelled = false
    void createMusicPlayerVisualizer().then(({ visualizer, kind }) => {
      if (cancelled) {
        visualizer.dispose()
        return
      }
      visualizerRef.current = visualizer
      ;(window as Window & { __musicVisualizerKind?: string }).__musicVisualizerKind = kind
      const mount = visualRef.current
      if (mount) mount.dataset.visualizerKind = kind
      setVisualizerReady(true)
    })
    return () => {
      cancelled = true
      visualizerRef.current?.dispose()
      visualizerRef.current = null
      setVisualizerReady(false)
    }
  }, [])

  useEffect(() => {
    if (shouldAnimateVisualizer) {
      visualizerRef.current?.resume()
      startVisualizer()
    } else {
      stopVisualizer()
      visualizerRef.current?.pause()
    }
    return stopVisualizer
  }, [shouldAnimateVisualizer, startVisualizer, stopVisualizer, activeTrack?.id])

  useEffect(() => {
    visualizerRef.current?.setFullscreenMode(isFullscreen)
  }, [isFullscreen, visualizerReady])

  useEffect(() => {
    if (!visualizerReady) return

    const container = visualRef.current
    const visualizer = visualizerRef.current
    if (!container || !visualizer) return

    let cancelled = false
    void Promise.resolve(visualizer.mount(container)).then(() => {
      if (cancelled) return
      visualizerMountedRef.current = true
      resizeVisualizer()
      visualizer.update(0.016, performance.now() / 1000, false, null)
    })

    const observer = new ResizeObserver(resizeVisualizer)
    observer.observe(container)
    return () => {
      cancelled = true
      observer.disconnect()
      visualizerMountedRef.current = false
    }
  }, [visualizerReady, resizeVisualizer])

  useEffect(() => {
    const syncNativeFullscreen = () => {
      const active = isNativeFullscreenActive(visualWrapRef.current)
      setNativeFullscreen(active)
      if (active) setPseudoFullscreen(false)
      requestAnimationFrame(() => resizeVisualizer())
    }

    document.addEventListener('fullscreenchange', syncNativeFullscreen)
    document.addEventListener('webkitfullscreenchange', syncNativeFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncNativeFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncNativeFullscreen)
    }
  }, [resizeVisualizer])

  useEffect(() => {
    if (!pseudoFullscreen) return

    document.body.classList.add('music-player-fs-lock')
    resizeVisualizer()
    window.dispatchEvent(new Event('resize'))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPseudoFullscreen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('music-player-fs-lock')
      document.removeEventListener('keydown', onKeyDown)
      resizeVisualizer()
    }
  }, [pseudoFullscreen, resizeVisualizer])

  useEffect(() => {
    if (!isFullscreen) return
    requestAnimationFrame(() => resizeVisualizer())
  }, [isFullscreen, resizeVisualizer])

  useEffect(() => {
    const visual = visualContainerRef.current
    if (!visual) return

    const profile = getDeviceProfile()
    if (profile.prefersReducedMotion) return

    const onPointerMove = (event: PointerEvent) => {
      const rect = visual.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      visualizerRef.current?.setPointer(x, y)
    }

    const onPointerLeave = () => {
      visualizerRef.current?.resetPointer()
    }

    visual.addEventListener('pointermove', onPointerMove)
    visual.addEventListener('pointerleave', onPointerLeave)

    return () => {
      visual.removeEventListener('pointermove', onPointerMove)
      visual.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  useEffect(() => {
    const visual = visualContainerRef.current
    if (!visual || !shouldAnimateVisualizer) return

    const profile = getDeviceProfile()
    if (!profile.isMobile || profile.prefersReducedMotion) return

    type OrientEvent = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null
    let attached = false

    const attachOrientation = () => {
      if (attached) return
      orientationListener = (event: DeviceOrientationEvent) => {
        visualizerRef.current?.setDeviceOrientation(event.beta, event.gamma)
      }
      window.addEventListener('deviceorientation', orientationListener, { passive: true })
      attached = true
    }

    const detachOrientation = () => {
      if (orientationListener) {
        window.removeEventListener('deviceorientation', orientationListener)
        orientationListener = null
      }
      attached = false
      visualizerRef.current?.clearDeviceOrientation()
    }

    const requestOrientation = async () => {
      const OrientCtor = DeviceOrientationEvent as OrientEvent
      if (typeof OrientCtor.requestPermission === 'function') {
        try {
          const state = await OrientCtor.requestPermission()
          if (state === 'granted') attachOrientation()
        } catch {
          visualizerRef.current?.clearDeviceOrientation()
        }
        return
      }
      attachOrientation()
    }

    const onFirstInteract = () => {
      void requestOrientation()
      visual.removeEventListener('touchstart', onFirstInteract)
      visual.removeEventListener('click', onFirstInteract)
    }

    visual.addEventListener('touchstart', onFirstInteract, { passive: true })
    visual.addEventListener('click', onFirstInteract)

    if (typeof (DeviceOrientationEvent as OrientEvent).requestPermission !== 'function') {
      attachOrientation()
    }

    return () => {
      visual.removeEventListener('touchstart', onFirstInteract)
      visual.removeEventListener('click', onFirstInteract)
      detachOrientation()
    }
  }, [shouldAnimateVisualizer])

  if (playableTracks.length === 0) return null

  const progressMax = duration > 0 ? duration : 100
  const progressValue = duration > 0 ? currentTime : 0
  const transportDisabled = !activeTrack

  const transportProps: TransportControlsProps = {
    isPlaying,
    muted,
    volume,
    currentTime,
    duration,
    progressMax,
    progressValue,
    activeTrackTitle: activeTrack?.title,
    canGoPrev,
    canGoNext,
    disabled: transportDisabled,
    onPlay: handlePlay,
    onPause: handlePause,
    onStop: handleStop,
    onToggleMute: toggleMute,
    onVolumeChange: handleVolumeChange,
    onScrub: handleScrub,
    onPrevTrack: goPrevTrack,
    onNextTrack: goNextTrack,
  }

  return (
    <div className="music-player" aria-label="Music player" ref={playerRef}>
      <div className="music-player-shell">
        <aside className="music-player-tracks" aria-label="Track list">
          <p className="music-player-tracks-label">Soundscapes</p>
          <ul className="music-player-track-list">
            {playableTracks.map((track) => {
              const isActive = track.id === activeTrackId
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    className={`music-player-track${isActive ? ' is-active' : ''}`}
                    onClick={() => selectTrack(track.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="music-player-track-title">{track.title}</span>
                    <span className="music-player-track-meta">{track.year}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="music-player-stage">
          <div className="music-player-media-row">
            <div
              ref={visualWrapRef}
              className={`music-player-visual-wrap${isFullscreen ? ' music-player-visual-wrap--fs-active' : ''}${pseudoFullscreen ? ' music-player-visual-wrap--pseudo-fs' : ''}`}
            >
              <div
                ref={visualContainerRef}
                className={`music-player-visual${isPlaying ? ' is-live' : ''}`}
              >
                <div ref={visualRef} className="music-player-visual-mount" aria-hidden="true" />
                {!isPlaying ? (
                  <div className="music-player-visual-overlay">
                    <p className="music-player-visual-note">Press play to sync the sea</p>
                  </div>
                ) : null}
              </div>

              <div className="music-player-visual-chrome">
                <button
                  type="button"
                  className="music-player-visual-fs-btn"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={isFullscreen}
                >
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </button>
              </div>

              {isFullscreen ? (
                <div className="music-player-fs-bar" aria-label="Fullscreen playback controls">
                  <TransportControls {...transportProps} variant="fullscreen" className="music-player-transport--fs" />
                </div>
              ) : null}
            </div>

            {!isFullscreen ? (
              <aside className="music-player-thumbnails" aria-label="Album thumbnails">
                <p className="music-player-thumbnails-label">Albums</p>
                <div className="music-player-thumbnails-list">
                  {tracks.map((track) => (
                    <MusicAlbumThumb
                      key={track.id}
                      track={track}
                      isActive={track.id === activeTrackId}
                      onSelect={track.audioUrl ? selectTrack : undefined}
                    />
                  ))}
                </div>
              </aside>
            ) : null}
          </div>

          {!isFullscreen && activeTrack ? (
            <div className="music-player-now-playing">
              <p className="music-player-eyebrow">Now playing</p>
              <h3 className="music-player-title">{activeTrack.title}</h3>
              <div className="music-player-tags" aria-label="Track tags">
                {activeTrack.tags.map((tag) => (
                  <span key={tag} className="music-player-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="music-player-desc">{activeTrack.description}</p>
            </div>
          ) : null}

          {!isFullscreen ? <TransportControls {...transportProps} /> : null}

          {playbackError ? (
            <p className="music-player-playback-error" role="status">
              {playbackError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
