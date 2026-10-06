import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './GalleryLightbox.css'
import type { ProjectImage } from '../data/projects'
import {
  persistMute,
  persistVolume,
  readStoredMute,
  readStoredVolume,
} from '../utils/audioPrefs'
import {
  claimAudioFocus,
  releaseAudioFocus,
  subscribeAudioFocus,
} from '../utils/audioFocus'
import { lockBodyScroll } from '../utils/lockBodyScroll'

interface GalleryLightboxProps {
  title: string
  images: ProjectImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  audioUrl?: string
}

type GalleryFullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type GalleryFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => Promise<void> | void
}
function activeFullscreenElement() {
  return document.fullscreenElement ?? (document as GalleryFullscreenDocument).webkitFullscreenElement
}
async function leaveNativeFullscreen(element: Element) {
  if (activeFullscreenElement() !== element) return
  if (document.fullscreenElement === element && document.exitFullscreen) await document.exitFullscreen()
  else await (document as GalleryFullscreenDocument).webkitExitFullscreen?.()
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
  const galleryRef = useRef<GalleryFullscreenElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const fullscreenRef = useRef<HTMLButtonElement | null>(null)
  const [fullscreenMode, setFullscreenMode] = useState<'idle' | 'native' | 'expanded'>('idle')
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [viewingControls, setViewingControls] = useState(false)
  const expanded = fullscreenMode !== 'idle'

  const exitFullscreen = useCallback(async () => {
    const element = galleryRef.current
    if (!element) return
    try { await leaveNativeFullscreen(element) } catch { return }
    setFullscreenMode('idle')
    setViewingControls(false)
    fullscreenRef.current?.focus({ preventScroll: true })
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (fullscreenPending) return
    if (expanded) { await exitFullscreen(); return }
    const element = galleryRef.current
    if (!element) return
    setFullscreenPending(true)
    setViewingControls(false)
    setFullscreenMode('expanded')
    try {
      if (element.requestFullscreen && document.fullscreenEnabled !== false) {
        await element.requestFullscreen({ navigationUI: 'hide' })
      } else if (element.webkitRequestFullscreen && (document as GalleryFullscreenDocument).webkitFullscreenEnabled !== false) {
        await element.webkitRequestFullscreen()
      }
      if (element.isConnected && activeFullscreenElement() === element) setFullscreenMode('native')
    } catch {
      // Keep the expanded photo view when native fullscreen is absent or denied.
    } finally {
      if (element.isConnected) setFullscreenPending(false)
    }
  }, [expanded, exitFullscreen, fullscreenPending])

  useEffect(() => {
    const element = galleryRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const onChange = () => {
      if (activeFullscreenElement() === element) setFullscreenMode('native')
      else setFullscreenMode(current => current === 'native' ? 'idle' : current)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      if (element) void leaveNativeFullscreen(element).catch(() => {})
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [])

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

    const onPlay = () => {
      claimAudioFocus('gallery')
      setIsPlaying(true)
    }
    const onPause = () => {
      setIsPlaying(false)
      releaseAudioFocus('gallery')
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    const unsubscribeFocus = subscribeAudioFocus((detail) => {
      if (detail.active && detail.actor === 'music') {
        audio.pause()
      }
    })

    claimAudioFocus('gallery')
    void audio.play().catch(() => {
      setIsPlaying(false)
      releaseAudioFocus('gallery')
    })

    return () => {
      unsubscribeFocus()
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.pause()
      audio.src = ''
      audioRef.current = null
      setIsPlaying(false)
      releaseAudioFocus('gallery')
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
    return lockBodyScroll()
  }, [])

  useLayoutEffect(() => {
    // On iPhone the non-video Fullscreen API may be unavailable. Its browser
    // toolbar can still collapse on a real document scroll, unlike a fixed,
    // scroll-locked modal. Keep the existing lock's saved page position intact.
    if (fullscreenMode !== 'expanded' || fullscreenPending) return
    const html = document.documentElement
    html.classList.add('is-gallery-scroll-view')
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    return () => {
      html.classList.remove('is-gallery-scroll-view')
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [fullscreenMode, fullscreenPending])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (expanded) void exitFullscreen()
        else onClose()
        return
      }
      if (event.key === 'Tab') {
        const available = [...(galleryRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])]
          .filter(el => el.getClientRects().length > 0)
        const first = available[0], last = available[available.length - 1]
        if (first && last && (!galleryRef.current?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
        return
      }
      // Keep native button activation and slider keys without losing gallery arrows.
      const target = event.target as Element
      if (target.closest('input, select, textarea') || (event.key === ' ' && target.closest('button'))) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); goPrev() }
      else if (event.key === 'ArrowRight') { event.preventDefault(); goNext() }
      else if (event.key === 'm' || event.key === 'M') toggleMute()
      else if (audioUrl && event.key === ' ') {
        event.preventDefault()
        if (isPlaying) handlePause()
        else handlePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [audioUrl, expanded, exitFullscreen, goNext, goPrev, handlePause, handlePlay, isPlaying, onClose, toggleMute])

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const handleImageLoad = () => {
    preloaded.add(image.src)
    setImageReady(true)
  }

  return createPortal(
    <div
      ref={galleryRef}
      className="gallery-lightbox"
      data-fullscreen-mode={fullscreenMode}
      data-expanded={expanded}
      data-viewing-controls={viewingControls}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} gallery`}
      onClick={handleBackdropClick}
    >
      {fullscreenMode === 'expanded' ? <p className="gallery-lightbox-fullscreen-note" role="status">Swipe up for more space. In Safari: Page Menu, then Hide Toolbar if needed.</p> : null}
      <div className="gallery-lightbox-panel">
        <header className="gallery-lightbox-header">
          <div className="gallery-lightbox-heading">
            <p className="gallery-lightbox-eyebrow">Gallery</p>
            <h2 className="gallery-lightbox-title">{title}</h2>
          </div>
          <div className="gallery-lightbox-actions">
            {audioUrl ? (
              <div id="gallery-audio-controls" className="gallery-lightbox-audio-controls" role="group" aria-label="Gallery audio controls">
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  data-cursor="play"
                  onClick={handlePlay}
                  disabled={isPlaying}
                  aria-label="Play gallery audio"
                >
                  Play
                </button>
                <button
                  type="button"
                  className="gallery-lightbox-audio"
                  data-cursor="pause"
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
            <div className="gallery-lightbox-view-actions">
            {expanded && audioUrl ? <button type="button" className="gallery-lightbox-audio"
              aria-label={viewingControls ? 'Hide gallery controls' : 'Show gallery controls'}
              aria-expanded={viewingControls} aria-controls="gallery-audio-controls"
              onClick={() => setViewingControls(value => !value)}>Controls</button> : null}
            <button ref={fullscreenRef} type="button" className="gallery-lightbox-audio gallery-lightbox-fullscreen"
              onClick={() => { void toggleFullscreen() }} disabled={fullscreenPending}
              aria-pressed={expanded} aria-label={expanded ? 'Exit full screen gallery view' : 'Open full screen gallery view'}
              title={expanded ? 'Exit full screen' : 'Full screen'}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d={expanded ? 'M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5' : 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5'} />
              </svg>
            </button>
            <button
              ref={closeRef}
              type="button"
              className="gallery-lightbox-close"
              onClick={onClose}
              aria-label="Close gallery"
            >
              Close
            </button>
            </div>
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
    </div>,
    document.body,
  )
}
