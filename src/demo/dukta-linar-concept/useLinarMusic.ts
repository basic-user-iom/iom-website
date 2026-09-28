import { useCallback, useEffect, useRef, useState } from 'react'

const LINAR_MUSIC_URL = '/media/dukta-linar-bach-cello-suite-no1-prelude.mp3'
const LINAR_MUSIC_START_SECONDS = 8
const LINAR_MUSIC_DEFAULT_VOLUME = 0.29
const LINAR_MUSIC_FADE_IN_MS = 2200
const LINAR_MUSIC_FADE_OUT_MS = 2800

export function useLinarMusic() {
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(
    Math.round(LINAR_MUSIC_DEFAULT_VOLUME * 100),
  )
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicFadeFrameRef = useRef<number | null>(null)
  const musicOperationRef = useRef(0)
  const musicShouldPlayRef = useRef(false)
  const musicVolumeRef = useRef(LINAR_MUSIC_DEFAULT_VOLUME)

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


  const onToggleMusic = useCallback(() => {
    if (musicShouldPlayRef.current) {
      stopMusic()
    } else {
      startMusic()
    }
  }, [startMusic, stopMusic])


  useEffect(
    () => () => {
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
    },
    [],
  )

  return { musicEnabled, musicVolume, startMusic, stopMusic, onToggleMusic, onMusicVolumeChange }
}

export type LinarMusicControls = ReturnType<typeof useLinarMusic>
