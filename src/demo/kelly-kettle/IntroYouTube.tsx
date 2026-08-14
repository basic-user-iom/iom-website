import { useCallback, useState } from 'react'
import { IntroPicture } from './IntroPicture'

const VIDEO_ID = 'Xf7V4hmj3vw'
const EMBED_SRC = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`

export function IntroYouTube() {
  const [playing, setPlaying] = useState(false)

  const start = useCallback(() => setPlaying(true), [])

  return (
    <div className="kk-yt-card">
      <div className="kk-yt-card__frame">
        {playing ? (
          <iframe
            className="kk-yt-card__iframe"
            src={EMBED_SRC}
            title="Boiling water and cooking with the Kelly Kettle"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="kk-video-card__poster"
            onClick={start}
            aria-label="Play Kelly Kettle film: boiling water and cooking outdoors"
          >
            <IntroPicture
              name="kettle-youtube-poster"
              alt="Kelly Kettle boiling water outdoors, from the official product film"
              width={1280}
              height={720}
    sizes="(min-width: 1100px) 900px, 100vw"
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
                <span className="kk-video-card__time">YouTube</span>
                <span className="kk-video-card__cta">Watch boiling and cooking film</span>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
