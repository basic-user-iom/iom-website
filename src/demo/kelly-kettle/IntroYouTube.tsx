import { useCallback, useState } from 'react'

type Film = {
  id: string
  title: string
  cta: string
}

const FILMS: Film[] = [
  {
    id: '1aROnIvkQ4U',
    title: 'Kelly Kettle — works everywhere, every time',
    cta: 'Works everywhere',
  },
  {
    id: '7SY5qg2bIMQ',
    title: 'Kelly Kettle Scout and accessories',
    cta: 'Scout & accessories',
  },
  {
    id: 'Xf7V4hmj3vw',
    title: 'Kelly Kettle Trekker and accessories',
    cta: 'Trekker & accessories',
  },
]

function posterSrc(id: string) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
}

function embedSrc(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
}

function YouTubeCard({
  film,
  playing,
  onPlay,
}: {
  film: Film
  playing: boolean
  onPlay: (id: string) => void
}) {
  const start = useCallback(() => onPlay(film.id), [film.id, onPlay])

  return (
    <div className="kk-yt-card">
      <div className="kk-yt-card__frame">
        {playing ? (
          <iframe
            className="kk-yt-card__iframe"
            src={embedSrc(film.id)}
            title={film.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="kk-video-card__poster"
            onClick={start}
            aria-label={`Play ${film.title}`}
          >
            <img
              className="kk-media-img"
              src={posterSrc(film.id)}
              alt=""
              width={480}
              height={360}
              decoding="async"
              loading="lazy"
              onError={(event) => {
                const img = event.currentTarget
                if (img.dataset.fallback) return
                img.dataset.fallback = '1'
                img.src = `https://i.ytimg.com/vi/${film.id}/hqdefault.jpg`
              }}
            />
            <span className="kk-video-card__overlay">
              <span className="kk-video-card__play" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="40" height="40">
                  <circle cx="24" cy="24" r="23" fill="rgba(44,42,38,0.72)" />
                  <path d="M19 15.5v17l14-8.5z" fill="#f7f4ee" />
                </svg>
              </span>
              <span className="kk-video-card__meta">
                <span className="kk-video-card__time">YouTube</span>
                <span className="kk-video-card__cta">{film.cta}</span>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export function IntroYouTube() {
  const [active, setActive] = useState<string | null>(null)

  return (
    <div className="kk-field-videos">
      {FILMS.map((film) => (
        <YouTubeCard key={film.id} film={film} playing={active === film.id} onPlay={setActive} />
      ))}
    </div>
  )
}
