import { useCallback, useEffect, useRef, useState } from 'react'
import {
  persistMute,
  persistVolume,
  readStoredMute,
  readStoredVolume,
} from '../utils/audioPrefs'
import { CRM_MUSIC_TRACKS } from './crmMusicTracks'
import { useCrmI18n } from './i18n'

export function CrmMusicPlayer() {
  const { t } = useCrmI18n()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playAfterLoadRef = useRef(false)
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(() => readStoredMute('music'))
  const [volume, setVolume] = useState(() => readStoredVolume('music'))

  const tracks = CRM_MUSIC_TRACKS
  const track = tracks[index] ?? null
  const canNav = tracks.length > 1

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = readStoredVolume('music') / 100
    audio.muted = readStoredMute('music')
    audioRef.current = audio

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      if (tracks.length <= 1) {
        setIsPlaying(false)
        return
      }
      playAfterLoadRef.current = true
      setIndex((prev) => (prev + 1) % tracks.length)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [tracks.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return

    const shouldPlay = playAfterLoadRef.current
    playAfterLoadRef.current = false
    audio.src = track.audioUrl
    audio.load()
    if (shouldPlay) {
      void audio.play().catch(() => setIsPlaying(false))
    }
  }, [track?.id, track?.audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
    persistMute('music', muted)
  }, [muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume / 100
    persistVolume('music', volume)
  }, [volume])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src && track) {
      audio.src = track.audioUrl
      audio.load()
    }
    void audio.play().catch(() => setIsPlaying(false))
  }, [track])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  const goPrev = useCallback(() => {
    if (!canNav) return
    playAfterLoadRef.current = true
    setIndex((prev) => (prev - 1 + tracks.length) % tracks.length)
  }, [canNav, tracks.length])

  const goNext = useCallback(() => {
    if (!canNav) return
    playAfterLoadRef.current = true
    setIndex((prev) => (prev + 1) % tracks.length)
  }, [canNav, tracks.length])

  if (!track) return null

  return (
    <div className="crm-music-player" role="group" aria-label={t('music.aria')}>
      <div className="crm-music-controls">
        <button
          type="button"
          className="crm-music-btn"
          onClick={goPrev}
          disabled={!canNav}
          aria-label={t('music.prev')}
          title={t('music.prev')}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className="crm-music-btn crm-music-btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? t('music.pause') : t('music.play')}
          title={isPlaying ? t('music.pause') : t('music.play')}
        >
          <span aria-hidden="true">{isPlaying ? '❚❚' : '▶'}</span>
        </button>
        <button
          type="button"
          className="crm-music-btn"
          onClick={goNext}
          disabled={!canNav}
          aria-label={t('music.next')}
          title={t('music.next')}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="crm-music-meta">
        <span className="crm-music-kicker">
          {isPlaying ? t('music.nowPlaying') : t('music.idle')}
        </span>
        <span className="crm-music-title" title={track.title}>
          {track.title}
        </span>
      </div>
      <label className="crm-music-volume" title={t('music.volume')}>
        <span className="crm-music-volume-label" aria-hidden="true">
          {t('music.vol')}
        </span>
        <input
          type="range"
          className="crm-music-volume-slider"
          min={0}
          max={100}
          step={1}
          value={muted ? 0 : volume}
          aria-label={t('music.volume')}
          onChange={(e) => {
            const next = Number(e.target.value)
            setVolume(next)
            if (next > 0 && muted) setMuted(false)
            if (next === 0) setMuted(true)
          }}
        />
      </label>
    </div>
  )
}
