import { useEffect, useRef, useState } from 'react'
import { img } from './data/media'
import {
  emitHeroSoundStatus,
  HERO_DEFAULT_VOLUME,
  onHeroSoundToggle,
  onHeroSoundVolume,
} from './heroSound'
import { usePrefersReducedMotion } from './hooks'
import { formatMessage } from './i18n/messages'
import { useLocale } from './i18n/LocaleContext'

/** Official dukta “flexible wood” film: https://www.youtube.com/watch?v=1p62XDub1Kg */
export const HERO_YOUTUBE_ID = '1p62XDub1Kg'

/** Keep poster opaque this long after YouTube reports PLAYING before fading. */
const POSTER_COVER_AFTER_PLAY_MS = 3400
/** Absolute cap: fade poster even if no play message arrives. */
const POSTER_COVER_FAILSAFE_MS = 5200

function youtubeEmbedSrc(id: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    playsinline: '1',
    loop: '1',
    playlist: id,
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    showinfo: '0',
    autohide: '1',
    enablejsapi: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://iobjectm.com',
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

function postYouTubeCommand(
  iframe: HTMLIFrameElement | null,
  func: string,
  args: unknown[] = [],
) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
}

function applyPlaybackLevel(iframe: HTMLIFrameElement | null, muted: boolean, volume: number) {
  if (muted || volume <= 0) {
    postYouTubeCommand(iframe, 'mute')
    return
  }
  postYouTubeCommand(iframe, 'unMute')
  postYouTubeCommand(iframe, 'setVolume', [volume])
  postYouTubeCommand(iframe, 'playVideo')
}

function isYouTubePlayingMessage(data: unknown): boolean {
  if (data == null) return false
  let parsed: unknown = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  const obj = parsed as Record<string, unknown>
  if (obj.event === 'onStateChange' && obj.info === 1) return true
  const info = obj.info
  if (typeof info === 'object' && info !== null && (info as { playerState?: number }).playerState === 1) {
    return true
  }
  return false
}

type Props = {
  className?: string
}

export function HeroMedia({ className }: Props) {
  const { t } = useLocale()
  const reduced = usePrefersReducedMotion()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const mutedRef = useRef(true)
  const volumeRef = useRef(HERO_DEFAULT_VOLUME)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(HERO_DEFAULT_VOLUME)
  const [showVideo, setShowVideo] = useState(false)
  const [videoLive, setVideoLive] = useState(false)

  const publish = (nextMuted: boolean, nextVolume: number, available = true) => {
    emitHeroSoundStatus({ available, muted: nextMuted, volume: nextVolume })
  }

  useEffect(() => {
    if (reduced) {
      publish(true, HERO_DEFAULT_VOLUME, false)
      return
    }
    const id = window.setTimeout(() => setShowVideo(true), 80)
    publish(true, HERO_DEFAULT_VOLUME, true)
    return () => {
      window.clearTimeout(id)
      publish(true, HERO_DEFAULT_VOLUME, false)
    }
  }, [reduced])

  useEffect(() => {
    mutedRef.current = muted
    volumeRef.current = volume
    if (!reduced) publish(muted, volume, true)
  }, [muted, volume, reduced])

  useEffect(() => {
    if (!showVideo || reduced) return

    let revealed = false
    let sawPlaying = false
    let revealTimer: number | undefined

    const reveal = () => {
      if (revealed) return
      revealed = true
      setVideoLive(true)
    }

    // Absolute cap from mount of the iframe layer — prefer covering chrome vs early fade.
    const failsafe = window.setTimeout(reveal, POSTER_COVER_FAILSAFE_MS)

    const onMessage = (event: MessageEvent) => {
      const origin = String(event.origin || '')
      if (!origin.includes('youtube.com')) return
      if (!isYouTubePlayingMessage(event.data) || sawPlaying) return
      sawPlaying = true
      // Prefer a long opaque cover over flashing YouTube’s pause/skip chrome.
      revealTimer = window.setTimeout(reveal, POSTER_COVER_AFTER_PLAY_MS)
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.clearTimeout(failsafe)
      if (revealTimer != null) window.clearTimeout(revealTimer)
      window.removeEventListener('message', onMessage)
    }
  }, [showVideo, reduced])

  useEffect(() => {
    if (!showVideo || reduced) return
    const iframe = iframeRef.current
    const onVis = () => {
      if (document.hidden) postYouTubeCommand(iframe, 'pauseVideo')
      else postYouTubeCommand(iframe, 'playVideo')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [showVideo, reduced])

  useEffect(() => {
    if (reduced) return
    return onHeroSoundToggle(() => {
      const next = !mutedRef.current
      mutedRef.current = next
      setMuted(next)
      applyPlaybackLevel(iframeRef.current, next, volumeRef.current)
    })
  }, [reduced])

  useEffect(() => {
    if (reduced) return
    return onHeroSoundVolume((nextVolume) => {
      volumeRef.current = nextVolume
      setVolume(nextVolume)
      if (nextVolume <= 0) {
        mutedRef.current = true
        setMuted(true)
        applyPlaybackLevel(iframeRef.current, true, 0)
        return
      }
      // Adjusting volume implies the user wants sound on.
      mutedRef.current = false
      setMuted(false)
      applyPlaybackLevel(iframeRef.current, false, nextVolume)
    })
  }, [reduced])

  const onIframeLoad = () => {
    const iframe = iframeRef.current
    iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: HERO_YOUTUBE_ID }), '*')
    postYouTubeCommand(iframe, 'playVideo')
    postYouTubeCommand(iframe, 'mute')
    postYouTubeCommand(iframe, 'setVolume', [HERO_DEFAULT_VOLUME])
  }

  return (
    <div className={`dk-hero__media${className ? ` ${className}` : ''}`}>
      {!reduced && showVideo ? (
        <div className="dk-hero__video" aria-hidden="true">
          <iframe
            ref={iframeRef}
            title={t.a11y.heroIframe}
            src={youtubeEmbedSrc(HERO_YOUTUBE_ID)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            tabIndex={-1}
            loading="eager"
            onLoad={onIframeLoad}
          />
        </div>
      ) : null}
      <img
        className={`dk-hero__poster${videoLive ? ' is-live' : ''}`}
        src={img.hero}
        alt=""
        width={2000}
        height={1333}
        fetchPriority="high"
        decoding="async"
      />
      <span className="dk-sr">
        {formatMessage(t.a11y.heroFilm, { n: HERO_DEFAULT_VOLUME })}
        {!reduced ? t.a11y.heroFilmHint : ''}
      </span>
    </div>
  )
}
