/** Default playback level when unmuted / first playback. */
export const HERO_DEFAULT_VOLUME = 15

export type HeroSoundStatus = {
  available: boolean
  muted: boolean
  volume: number
}

type StatusListener = (status: HeroSoundStatus) => void

const STATUS_EVENT = 'dk-hero-sound-status'
const TOGGLE_EVENT = 'dk-hero-sound-toggle'
const VOLUME_EVENT = 'dk-hero-sound-volume'

export function emitHeroSoundStatus(status: HeroSoundStatus) {
  window.dispatchEvent(new CustomEvent<HeroSoundStatus>(STATUS_EVENT, { detail: status }))
}

export function requestHeroSoundToggle() {
  window.dispatchEvent(new Event(TOGGLE_EVENT))
}

export function requestHeroSoundVolume(volume: number) {
  window.dispatchEvent(
    new CustomEvent<number>(VOLUME_EVENT, {
      detail: Math.min(100, Math.max(0, Math.round(volume))),
    }),
  )
}

export function onHeroSoundStatus(listener: StatusListener): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<HeroSoundStatus>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(STATUS_EVENT, handler)
  return () => window.removeEventListener(STATUS_EVENT, handler)
}

export function onHeroSoundToggle(listener: () => void): () => void {
  window.addEventListener(TOGGLE_EVENT, listener)
  return () => window.removeEventListener(TOGGLE_EVENT, listener)
}

export function onHeroSoundVolume(listener: (volume: number) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail
    if (typeof detail === 'number') listener(detail)
  }
  window.addEventListener(VOLUME_EVENT, handler)
  return () => window.removeEventListener(VOLUME_EVENT, handler)
}
