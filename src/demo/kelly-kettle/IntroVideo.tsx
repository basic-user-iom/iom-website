import { useCallback, useEffect, useRef, useState } from 'react'
import { IntroPicture } from './IntroPicture'

const WEBM = '/media/kettle-preview.webm'
const MP4 = '/media/kettle-preview.mp4'

type Props = {
  onPlayRequest?: () => void
}

export function IntroVideo({ onPlayRequest }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const attachSources = useCallback(() => {
    const video = videoRef.current
    if (!video || video.querySelector('source')) return
    const webm = document.createElement('source')
    webm.src = WEBM
    webm.type = 'video/webm'
    const mp4 = document.createElement('source')
    mp4.src = MP4
    mp4.type = 'video/mp4'
    video.append(webm, mp4)
  }, [])

  const start = useCallback(() => {
    attachSources()
    onPlayRequest?.()
    const video = videoRef.current
    if (!video) return
    video.load()
    void video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [attachSources, onPlayRequest])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) return

    let idle = false
    let near = false
    let done = false
    const tryDefer = () => {
      if (done || !idle || !near) return
      done = true
      attachSources()
      videoRef.current?.load()
    }

    const idleApi = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const hasIdle = typeof idleApi.requestIdleCallback === 'function'
    const idleId = hasIdle
      ? idleApi.requestIdleCallback!(() => {
          idle = true
          tryDefer()
        }, { timeout: 4000 })
      : window.setTimeout(() => {
          idle = true
          tryDefer()
        }, 2500)

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        near = true
        tryDefer()
      },
      { rootMargin: '200px' },
    )
    io.observe(card)

    return () => {
      io.disconnect()
      if (hasIdle) idleApi.cancelIdleCallback?.(idleId)
      else window.clearTimeout(idleId)
    }
  }, [attachSources])

  return (
    <div ref={cardRef} className="kk-video-card">
      <div className="kk-video-card__frame">
        <video
          ref={videoRef}
          className={playing ? 'kk-video-card__video is-on' : 'kk-video-card__video'}
          controls={playing}
          playsInline
          preload="none"
          poster="/media/kettle-video-poster.webp"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing ? (
          <button type="button" className="kk-video-card__poster" onClick={start} aria-label="Watch 8-second preview">
            <IntroPicture
              name="kettle-video-poster"
              alt="Kelly Kettle boiling in a misty forest, with flame rising through the chimney and fire glowing in the base"
              width={700}
              height={700}
              sizes="(min-width: 1100px) 360px, (min-width: 720px) 40vw, 100vw"
              className="kk-media-img"
            />
            <span className="kk-video-card__overlay">
              <span className="kk-video-card__play" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="48" height="48">
                  <circle cx="24" cy="24" r="23" fill="rgba(44,42,38,0.72)" />
                  <path d="M19 15.5v17l14-8.5z" fill="#f7f4ee" />
                </svg>
              </span>
              <span className="kk-video-card__meta">
                <span className="kk-video-card__time">0:08</span>
                <span className="kk-video-card__cta">Watch 8-second preview</span>
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
