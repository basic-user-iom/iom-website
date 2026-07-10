const MUTE_KEYS = {
  gallery: 'iom.gallery.audio.muted',
  music: 'iom.music.audio.muted',
} as const

const VOLUME_KEYS = {
  gallery: 'iom.gallery.audio.volume',
  music: 'iom.music.audio.volume',
} as const

export const DEFAULT_AUDIO_VOLUME = 45

export type AudioPrefsScope = keyof typeof MUTE_KEYS

export function readStoredMute(scope: AudioPrefsScope): boolean {
  try {
    return localStorage.getItem(MUTE_KEYS[scope]) === 'true'
  } catch {
    return false
  }
}

export function readStoredVolume(scope: AudioPrefsScope): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEYS[scope])
    if (raw == null) return DEFAULT_AUDIO_VOLUME
    const value = Number(raw)
    if (!Number.isFinite(value)) return DEFAULT_AUDIO_VOLUME
    return Math.min(100, Math.max(0, Math.round(value)))
  } catch {
    return DEFAULT_AUDIO_VOLUME
  }
}

export function persistMute(scope: AudioPrefsScope, muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEYS[scope], String(muted))
  } catch {
    /* ignore storage errors */
  }
}

export function persistVolume(scope: AudioPrefsScope, volume: number) {
  try {
    localStorage.setItem(VOLUME_KEYS[scope], String(volume))
  } catch {
    /* ignore storage errors */
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
