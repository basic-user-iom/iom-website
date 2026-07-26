import { useEffect, useRef } from 'react'
import {
  persistMute,
  persistVolume,
  readStoredMute,
  readStoredVolume,
} from '../utils/audioPrefs'
import {
  claimAudioFocus,
  getAudioFocus,
  releaseAudioFocus,
  subscribeAudioFocus,
} from '../utils/audioFocus'

/** Soft homepage bed — starts muted until the header control unmutes (user gesture). */
const AMBIENT_URL = '/assets/audio/mist-stone-sea.mp3'
const AMBIENT_GAIN = 0.28

type AmbientHandle = {
  /** Must run inside a user gesture (header Sound tap). */
  playFromGesture: () => void
}

let ambientHandle: AmbientHandle | null = null

/**
 * Homepage ambient loop. Mute state is shared via `site` audioPrefs +
 * `iom:site-audio-mute` CustomEvent from the header control.
 * Yields automatically when music or gallery audio takes focus.
 */
export function SiteAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userMutedRef = useRef(readStoredMute('site'))
  const duckedRef = useRef(false)
  const mediaUnlockedRef = useRef(false)

  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    // `none` breaks iOS: play() starts a fetch, then rejects once the gesture expires.
    audio.preload = 'auto'
    audio.src = AMBIENT_URL
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    const volume = readStoredVolume('site') / 100
    audio.volume = Math.min(1, volume * AMBIENT_GAIN)
    userMutedRef.current = readStoredMute('site')
    audio.muted = userMutedRef.current
    audioRef.current = audio
    try {
      audio.load()
    } catch {
      /* ignore */
    }

    const otherFocusActive = () => {
      const focus = getAudioFocus()
      return focus === 'music' || focus === 'gallery'
    }

    const canAudiblyPlay = () =>
      Boolean(audioRef.current) &&
      !userMutedRef.current &&
      !duckedRef.current &&
      !otherFocusActive()

    const playNow = () => {
      const el = audioRef.current
      if (!el || !canAudiblyPlay()) return
      el.muted = false
      claimAudioFocus('site')
      void el
        .play()
        .then(() => {
          mediaUnlockedRef.current = true
        })
        .catch(() => {
          releaseAudioFocus('site')
        })
    }

    /**
     * Unlock HTMLMediaElement on iOS with a muted play inside a user gesture.
     * Safe to call while the UI is still "Sound off".
     */
    const warmUnlockFromGesture = () => {
      const el = audioRef.current
      if (!el || mediaUnlockedRef.current) return

      const resumeAudible = canAudiblyPlay()
      el.muted = true
      void el
        .play()
        .then(() => {
          mediaUnlockedRef.current = true
          if (!resumeAudible) {
            el.pause()
            el.currentTime = 0
            el.muted = userMutedRef.current
            if (getAudioFocus() === 'site') releaseAudioFocus('site')
            return
          }
          el.muted = false
          claimAudioFocus('site')
        })
        .catch(() => {
          /* next gesture retries */
        })
    }

    const playFromGesture = () => {
      // Unmute tap: play audibly in this gesture. Do not also warm-unlock muted
      // in parallel — that races muted/unmuted play() on iOS.
      if (canAudiblyPlay()) {
        playNow()
        return
      }
      warmUnlockFromGesture()
    }

    ambientHandle = { playFromGesture }

    const duck = () => {
      duckedRef.current = true
      const el = audioRef.current
      if (!el) return
      el.pause()
      if (getAudioFocus() === 'site') releaseAudioFocus('site')
    }

    const unduck = () => {
      duckedRef.current = false
      playNow()
    }

    const onMuteEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean }>).detail
      if (!audioRef.current || typeof detail?.muted !== 'boolean') return
      userMutedRef.current = detail.muted
      persistMute('site', detail.muted)
      audioRef.current.muted = detail.muted
      if (detail.muted) {
        audioRef.current.pause()
        releaseAudioFocus('site')
      } else {
        // Prefer playFromGesture from toggleSiteMute (same tap stack). This is backup.
        playNow()
      }
    }

    const onVolumeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ volume?: number }>).detail
      if (!audioRef.current || typeof detail?.volume !== 'number') return
      persistVolume('site', detail.volume)
      audioRef.current.volume = Math.min(1, (detail.volume / 100) * AMBIENT_GAIN)
    }

    const unsubscribeFocus = subscribeAudioFocus((detail) => {
      if (detail.active && (detail.actor === 'music' || detail.actor === 'gallery')) {
        duck()
        return
      }
      if (!detail.active && (detail.actor === 'music' || detail.actor === 'gallery')) {
        unduck()
      }
    })

    const onFirstGesture = () => {
      warmUnlockFromGesture()
      if (canAudiblyPlay()) playNow()
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('touchstart', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
    }

    window.addEventListener('iom:site-audio-mute', onMuteEvent)
    window.addEventListener('iom:site-audio-volume', onVolumeEvent)
    window.addEventListener('pointerdown', onFirstGesture, { passive: true })
    window.addEventListener('touchstart', onFirstGesture, { passive: true })
    window.addEventListener('keydown', onFirstGesture)

    return () => {
      ambientHandle = null
      unsubscribeFocus()
      window.removeEventListener('iom:site-audio-mute', onMuteEvent)
      window.removeEventListener('iom:site-audio-volume', onVolumeEvent)
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('touchstart', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
      releaseAudioFocus('site')
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [])

  return null
}

export function toggleSiteMute(): boolean {
  const next = !readStoredMute('site')
  persistMute('site', next)
  window.dispatchEvent(new CustomEvent('iom:site-audio-mute', { detail: { muted: next } }))
  // Keep unlock + play on the same user-gesture stack as the header tap (critical on iOS).
  if (!next) ambientHandle?.playFromGesture()
  return next
}
