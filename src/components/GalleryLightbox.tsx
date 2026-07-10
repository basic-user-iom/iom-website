import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectImage } from '../data/projects'
import {
  persistMute,
  persistVolume,
  readStoredMute,
  readStoredVolume,
} from '../utils/audioPrefs'

interface GalleryLightboxProps {
  title: string
  images: ProjectImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  audioUrl?: string
}

const preloaded = new Set<string>()

function preloadSrc(src: string) {
  if (preloaded.has(src)) return
  const img = new Image()
  const markReady = () => preloaded.add(src)
  img.onload = markReady
  img.onerror = markReady
  img.src = src
}

function adjacentIndices(index: number, count: number): number[] {
  if (count <= 1) return [index]
  return [(index - 1 + count) % count, index, (index + 1) % count]
}

export function GalleryLightbox({
  title,
  images,
  index,
  onIndexChange,
  onClose,
  audioUrl,
}: GalleryLightboxProps) {
  const count = images.length
  const image = images[index]
  const [imageReady, setImageReady] = useState(false)
  const [muted, setMuted] = useState(() => readStoredMute('gallery'))
  const [volume, setVolume] = useState(() => readStoredVolume('gallery'))
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + count) % count)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % count)
  }, [count, index, onIndexChange])

  const handlePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    void audio.play().catch(() => {})
  }, [])

  const handlePause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const handleStop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current
      persistMute('gallery', next)
      return next
    })
  }, [])

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Math.min(100, Math.max(0, Number(event.target.value)))
    setVolume(next)
    persistVolume('gallery', next)
  }, [])

  useEffect(() => {
    const indices = new Set(adjacentIndices(index, count))
    indices.forEach((i) => preloadSrc(images[i].src))
  }, [count, images, index])

  useEffect(() => {
    const src = image.src
    setImageReady(false)

    if (preloaded.has(src)) {
      setImageReady(true)
      return
    }

    const probe = new Image()
    const markReady = () => {
      preloaded.add(src)
      setImageReady(true)
    }
    probe.onload = markReady
    probe.onerror = markReady
    probe.src = src
    if (probe.complete && probe.naturalWidth > 0) {
      markReady()
    }
  }, [image.src])

  useEffect(() => {
    if (!audioUrl) return

    const audio = new Audio(audioUrl)
    audio.loop = true
    audio.volume = readStoredVolume('gallery') / 100
    audio.muted = readStoredMute('gallery')
    audioRef.current = audio

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    void audio.play().catch(() => setIsPlaying(false))

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.pause()
      audio.src = ''
      audioRef.current = null
      setIsPlaying(false)
    }
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
  }, [muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume / 100
  }, [volume])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
      else if (event.key === 'm' || event.key === 'M') toggleMute()
      else if (audioUrl && event.key === ' ') {
        event.preventDefault()
        if (isPlaying) handlePause()
        else handlePlay()
      }
    }

    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [audioUrl, goNext, goPrev, handlePause, handlePlay, isPlaying, onClose, toggleMute])

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const handleImageLoad = () => {
    preloaded.add(image.src)
    setImageReady(true)
  }

  return (
    <div
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} gallery`}
      onClick={handleBackdropClick}
    >
      <div className="gallery-lightbox-panel">
        <header className="gallery-lightbox-header">
          <div>
            <p className="gallery-lightbox-eyebrow">Gallery</p>
            <h2 className="gallery-lightbox-title">{title}</h2>
          </div>
          <div className="gallery-lightbox-actions">
            {audioUrl ? (
              <div className="gallery-lightbox-audio-controls" role="group" aria-label="Gallery audio controls">
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  onClick={handlePlay}
                  disabled={isPlaying}
                  aria-label="Play gallery audio"
                >
                  Play
                </button>
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  onClick={handlePause}
                  disabled={!isPlaying}
                  aria-label="Pause gallery audio"
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  onClick={handleStop}
                  aria-label="Stop gallery audio and reset to beginning"
                >
                  Stop
                </button>
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute gallery audio' : 'Mute gallery audio'}
                  aria-pressed={muted}
                  aria-keyshortcuts="M"
                >
                  {muted ? 'Muted' : 'Mute'}
                </button>
                <label className="gallery-lightbox-audio-volume" aria-label="Gallery audio volume">
                  <span className="gallery-lightbox-audio-volume-label" aria-hidden="true">
                    Vol
                  </span>
                  <input
                    type="range"
                    className="gallery-lightbox-audio-volume-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={volume}
                    onChange={handleVolumeChange}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={volume}
                    aria-valuetext={`${volume} percent`}
                  />
                </label>
              </div>
            ) : null}
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={onClose}
              aria-label="Close gallery"
            >
              Close
            </button>
          </div>
        </header>

        <div className="gallery-lightbox-stage">
          {count > 1 ? (
            <button
              type="button"
              className="gallery-lightbox-nav gallery-lightbox-nav--prev"
              onClick={goPrev}
              aria-label="Previous image"
            >
              ←
            </button>
          ) : null}

          <figure className="gallery-lightbox-figure">
            <div className="gallery-lightbox-image-wrap">
              {!imageReady ? (
                <span className="gallery-lightbox-loading" aria-hidden="true" />
              ) : null}
              <img
                key={image.src}
                className={`gallery-lightbox-image${imageReady ? ' is-loaded' : ''}`}
                src={image.src}
                alt={image.caption}
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageLoad}
              />
            </div>
            {imageReady ? (
              <figcaption className="gallery-lightbox-caption">{image.caption}</figcaption>
            ) : (
              <figcaption className="gallery-lightbox-caption gallery-lightbox-caption--pending" aria-hidden="true" />
            )}
          </figure>

          {count > 1 ? (
            <button
              type="button"
              className="gallery-lightbox-nav gallery-lightbox-nav--next"
              onClick={goNext}
              aria-label="Next image"
            >
              →
            </button>
          ) : null}
        </div>

        {count > 1 ? (
          <p className="gallery-lightbox-counter" aria-live="polite">
            {index + 1} / {count}
          </p>
        ) : null}
      </div>
    </div>
  )
}
