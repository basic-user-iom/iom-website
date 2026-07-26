const MUTE_KEYS = {
  gallery: 'iom.gallery.audio.muted',
  music: 'iom.music.audio.muted',
  site: 'iom.site.audio.muted',
} as const

const VOLUME_KEYS = {
  gallery: 'iom.gallery.audio.volume',
  music: 'iom.music.audio.volume',
  site: 'iom.site.audio.volume',
} as const

export const DEFAULT_AUDIO_VOLUME = 45

/** Homepage ambient defaults quieter and muted until the user opts in. */
const DEFAULT_MUTE: Record<AudioPrefsScope, boolean> = {
  gallery: false,
  music: false,
  site: true,
}

const DEFAULT_VOLUME: Record<AudioPrefsScope, number> = {
  gallery: DEFAULT_AUDIO_VOLUME,
  music: DEFAULT_AUDIO_VOLUME,
  site: 35,
}

export type AudioPrefsScope = keyof typeof MUTE_KEYS

export function readStoredMute(scope: AudioPrefsScope): boolean {
  try {
    const raw = localStorage.getItem(MUTE_KEYS[scope])
    if (raw == null) return DEFAULT_MUTE[scope]
    return raw === 'true'
  } catch {
    return DEFAULT_MUTE[scope]
  }
}

export function readStoredVolume(scope: AudioPrefsScope): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEYS[scope])
    if (raw == null) return DEFAULT_VOLUME[scope]
    const value = Number(raw)
    if (!Number.isFinite(value)) return DEFAULT_VOLUME[scope]
    return Math.min(100, Math.max(0, Math.round(value)))
  } catch {
    return DEFAULT_VOLUME[scope]
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
