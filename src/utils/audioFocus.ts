/** Exclusive audio ownership so ambient / music / gallery never stack. */
export type AudioFocusSource = 'site' | 'music' | 'gallery'

const EVENT = 'iom:audio-focus'

let focus: AudioFocusSource | null = null

export type AudioFocusDetail = {
  source: AudioFocusSource | null
  /** Who just claimed or released */
  actor: AudioFocusSource
  active: boolean
}

export function getAudioFocus(): AudioFocusSource | null {
  return focus
}

export function claimAudioFocus(source: AudioFocusSource): void {
  focus = source
  window.dispatchEvent(
    new CustomEvent<AudioFocusDetail>(EVENT, {
      detail: { source, actor: source, active: true },
    }),
  )
}

export function releaseAudioFocus(source: AudioFocusSource): void {
  if (focus !== source) return
  focus = null
  window.dispatchEvent(
    new CustomEvent<AudioFocusDetail>(EVENT, {
      detail: { source: null, actor: source, active: false },
    }),
  )
}

export function subscribeAudioFocus(listener: (detail: AudioFocusDetail) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AudioFocusDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
