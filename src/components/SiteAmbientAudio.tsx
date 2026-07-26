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

/**
 * Homepage ambient loop. Mute state is shared via `site` audioPrefs +
 * `iom:site-audio-mute` CustomEvent from the header control.
 * Yields automatically when music or gallery audio takes focus.
 */
export function SiteAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userMutedRef = useRef(readStoredMute('site'))
  const duckedRef = useRef(false)

  useEffect(() => {
    const audio = new Audio(AMBIENT_URL)
    audio.loop = true
    audio.preload = 'none'
    const volume = readStoredVolume('site') / 100
    audio.volume = Math.min(1, volume * AMBIENT_GAIN)
    userMutedRef.current = readStoredMute('site')
    audio.muted = userMutedRef.current
    audioRef.current = audio

    const otherFocusActive = () => {
      const focus = getAudioFocus()
      return focus === 'music' || focus === 'gallery'
    }

    const tryPlay = () => {
      const el = audioRef.current
      if (!el || userMutedRef.current || duckedRef.current || otherFocusActive()) return
      claimAudioFocus('site')
      void el.play().catch(() => {
        releaseAudioFocus('site')
      })
    }

    const duck = () => {
      duckedRef.current = true
      const el = audioRef.current
      if (!el) return
      el.pause()
      if (getAudioFocus() === 'site') releaseAudioFocus('site')
    }

    const unduck = () => {
      duckedRef.current = false
      tryPlay()
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
        tryPlay()
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

    // Default: muted. If user previously unmuted, wait for a gesture before play.
    if (!userMutedRef.current) {
      const unlock = () => {
        tryPlay()
        window.removeEventListener('pointerdown', unlock)
        window.removeEventListener('keydown', unlock)
      }
      window.addEventListener('pointerdown', unlock, { once: true })
      window.addEventListener('keydown', unlock, { once: true })
    }

    return () => {
      unsubscribeFocus()
      window.removeEventListener('iom:site-audio-mute', onMuteEvent)
      window.removeEventListener('iom:site-audio-volume', onVolumeEvent)
      releaseAudioFocus('site')
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  return null
}

export function toggleSiteMute(): boolean {
  const next = !readStoredMute('site')
  persistMute('site', next)
  window.dispatchEvent(new CustomEvent('iom:site-audio-mute', { detail: { muted: next } }))
  return next
}
