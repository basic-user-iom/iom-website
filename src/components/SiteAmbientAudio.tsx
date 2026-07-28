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
 *
 * Network: src is attached only when the user asks for sound (Listen), so the
 * ~4MB bed does not download on cold load. Attach + play stay on the same
 * gesture stack for iOS.
 */
export function SiteAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userMutedRef = useRef(readStoredMute('site'))
  const duckedRef = useRef(false)
  const mediaUnlockedRef = useRef(false)
  const srcAttachedRef = useRef(false)

  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    audio.preload = 'none'
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    const volume = readStoredVolume('site') / 100
    audio.volume = Math.min(1, volume * AMBIENT_GAIN)
    userMutedRef.current = readStoredMute('site')
    audio.muted = userMutedRef.current
    audioRef.current = audio

    const ensureSrc = () => {
      const el = audioRef.current
      if (!el || srcAttachedRef.current) return
      el.preload = 'auto'
      el.src = AMBIENT_URL
      srcAttachedRef.current = true
      try {
        el.load()
      } catch {
        /* ignore */
      }
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
      ensureSrc()
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
     * Only used when src is already attached (Listen path) — never on random taps.
     */
    const warmUnlockFromGesture = () => {
      const el = audioRef.current
      if (!el || mediaUnlockedRef.current || !srcAttachedRef.current) return

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
      // Attach inside this gesture so iOS can start the fetch + play before it expires.
      ensureSrc()
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

    window.addEventListener('iom:site-audio-mute', onMuteEvent)
    window.addEventListener('iom:site-audio-volume', onVolumeEvent)

    return () => {
      ambientHandle = null
      unsubscribeFocus()
      window.removeEventListener('iom:site-audio-mute', onMuteEvent)
      window.removeEventListener('iom:site-audio-volume', onVolumeEvent)
      releaseAudioFocus('site')
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      srcAttachedRef.current = false
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
