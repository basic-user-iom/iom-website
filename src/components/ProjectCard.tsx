import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Project } from '../data/projects'
import { getDeviceProfile } from '../utils/device'
import { reportEmbedHover, subscribeEmbedSlot } from '../utils/embedVisibility'
import { GalleryLightbox } from './GalleryLightbox'

/** Desktop viewport rendered inside embed previews, then CSS-scaled to fit the card pane */
const EMBED_VIEWPORT = { width: 1280, height: 800 } as const

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useCountdown(targetIso?: string): { isPending: boolean; label: string } {
  const targetMs = targetIso ? Date.parse(targetIso) : NaN
  const hasTarget = Number.isFinite(targetMs)

  const [remainingMs, setRemainingMs] = useState(() =>
    hasTarget ? Math.max(0, targetMs - Date.now()) : 0,
  )

  useEffect(() => {
    if (!hasTarget) return
    const tick = () => setRemainingMs(Math.max(0, targetMs - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [hasTarget, targetMs])

  return {
    isPending: hasTarget && remainingMs > 0,
    label: hasTarget ? formatCountdown(remainingMs) : '',
  }
}

interface ProjectCardProps {
  project: Project
  style?: CSSProperties
  musicActive?: boolean
  onMusicSelect?: (trackId: string) => void
}

export const ProjectCard = memo(function ProjectCard({
  project,
  style,
  musicActive = false,
  onMusicSelect,
}: ProjectCardProps) {
  const [embedFailed, setEmbedFailed] = useState(false)
  const [embedLoaded, setEmbedLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [embedSlotActive, setEmbedSlotActive] = useState(false)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const mountedRef = useRef(true)

  const profile = getDeviceProfile()
  const { isPending: isComingSoon, label: countdownLabel } = useCountdown(project.availableAt)
  const initials = project.title
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  const hasGallery = Boolean(project.gallery?.length)
  const hasMusicTrack = Boolean(project.audioUrl)
  const canEmbed = Boolean(project.embedUrl) && !embedFailed
  const useStaticEmbed = canEmbed && profile.useEmbedStaticFallback
  const showLiveEmbed = canEmbed && !useStaticEmbed
  const staticPreviewUrl = !canEmbed ? project.thumbnail ?? project.posterUrl : undefined
  const showThumbnail = Boolean(staticPreviewUrl)
  const showIframe = showLiveEmbed && isHovered && embedSlotActive && pageVisible
  const posterUrl = useStaticEmbed ? project.mobilePosterUrl ?? project.posterUrl : project.posterUrl
  const showPoster = canEmbed && Boolean(posterUrl)
  const posterHidden = showIframe && embedLoaded

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!showLiveEmbed) return
    return subscribeEmbedSlot(project.id, setEmbedSlotActive)
  }, [showLiveEmbed, project.id])

  useEffect(() => {
    const onVisibility = () => {
      const visible = !document.hidden
      setPageVisible(visible)
      if (!visible) {
        setEmbedLoaded(false)
        setIsHovered(false)
        reportEmbedHover(project.id, false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [project.id])

  const handlePreviewEnter = useCallback(() => {
    if (!showLiveEmbed) return
    setIsHovered(true)
    reportEmbedHover(project.id, true)
  }, [showLiveEmbed, project.id])

  const handlePreviewLeave = useCallback(() => {
    if (!showLiveEmbed) return
    setIsHovered(false)
    setEmbedLoaded(false)
    reportEmbedHover(project.id, false)
  }, [showLiveEmbed, project.id])

  const openGallery = useCallback(() => {
    if (!hasGallery) return
    setGalleryIndex(0)
    setGalleryOpen(true)
  }, [hasGallery])

  const selectMusicTrack = useCallback(() => {
    if (!hasMusicTrack || !onMusicSelect) return
    onMusicSelect(project.id)
  }, [hasMusicTrack, onMusicSelect, project.id])

  const handleGalleryKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!hasGallery) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openGallery()
      }
    },
    [hasGallery, openGallery],
  )

  const handleIframeLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      if (!mountedRef.current) return
      const iframe = event.currentTarget
      try {
        const doc = iframe.contentDocument
        if (doc) {
          const href = iframe.contentWindow?.location.href ?? ''
          if (
            href === 'about:blank' ||
            href.startsWith('chrome-error://') ||
            doc.body?.childElementCount === 0
          ) {
            setEmbedFailed(true)
            return
          }
        }
      } catch {
        // Cross-origin embed loaded successfully
      }
      setEmbedLoaded(true)
    },
    [],
  )

  const preview = (
    <div
      className={`card-preview${showLiveEmbed || useStaticEmbed ? ' card-preview--embed' : ''}${hasGallery ? ' card-preview--gallery' : ''}${hasMusicTrack ? ' card-preview--music' : ''}`}
      onMouseEnter={showLiveEmbed ? handlePreviewEnter : undefined}
      onMouseLeave={showLiveEmbed ? handlePreviewLeave : undefined}
    >
      {showThumbnail || (hasMusicTrack && project.posterUrl) ? (
        <>
          <img
            className="card-preview-thumb"
            src={staticPreviewUrl ?? project.posterUrl ?? ''}
            alt=""
            loading="lazy"
            decoding="async"
          />
          {hasGallery ? (
            <span className="card-preview-overlay" aria-hidden="true">
              VIEW GALLERY →
            </span>
          ) : hasMusicTrack ? (
            <span className="card-preview-overlay" aria-hidden="true">
              {musicActive ? 'NOW PLAYING' : 'LOAD TRACK →'}
            </span>
          ) : null}
        </>
      ) : showLiveEmbed || useStaticEmbed ? (
        <>
          {showPoster ? (
            <img
              className={`card-preview-poster${posterHidden ? ' is-hidden' : ''}`}
              src={posterUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="card-preview-glyph card-preview-glyph--embed" aria-hidden="true">
              {initials}
            </span>
          )}
          {!embedLoaded && showIframe && (
            <span className="card-preview-loading" aria-hidden="true" />
          )}
          {showIframe && (
            <div className="card-preview-embed-viewport">
              <div
                className="card-preview-embed-scale"
                style={
                  {
                    '--embed-w': `${EMBED_VIEWPORT.width}px`,
                    '--embed-h': `${EMBED_VIEWPORT.height}px`,
                  } as CSSProperties
                }
              >
                <iframe
                  className={`card-preview-iframe${embedLoaded ? ' is-loaded' : ''}`}
                  src={project.embedUrl}
                  title={`${project.title} preview`}
                  width={EMBED_VIEWPORT.width}
                  height={EMBED_VIEWPORT.height}
                  sandbox="allow-scripts allow-same-origin"
                  tabIndex={-1}
                  onLoad={handleIframeLoad}
                  onError={() => {
                    if (mountedRef.current) setEmbedFailed(true)
                  }}
                />
              </div>
            </div>
          )}
          <span className="card-preview-overlay" aria-hidden="true">
            OPEN →
          </span>
        </>
      ) : (
        <span className="card-preview-glyph" aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  )

  const inner = (
    <>
      <div className={`card-inner${isComingSoon ? ' card-inner--blurred' : ''}`}>
        <div className="card-archive-bar">
          <span>Archive</span>
          <span className="card-archive-id">{project.archiveId}</span>
        </div>
        {preview}
        <div className="card-body">
          <div className="card-meta">
            {project.tags.map((tag) => (
              <span key={tag} className="card-tag">
                {tag}
              </span>
            ))}
          </div>
          <h3 className="card-title">{project.title}</h3>
          <p className="card-desc">{project.description}</p>
          <div className="card-footer">
            <span>{project.year}</span>
            <span className="card-footer-links">
              {project.sourceUrl ? (
                <a
                  className="card-source-link"
                  href={project.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Source
                </a>
              ) : null}
              {project.referenceUrls?.map((reference) => (
                <a
                  key={reference.url}
                  className="card-source-link"
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {reference.label}
                </a>
              ))}
              {project.url ? (
                <span className="card-link">Open →</span>
              ) : hasGallery ? (
                <span className="card-link">View gallery →</span>
              ) : hasMusicTrack ? (
                <span className="card-link">{musicActive ? 'Selected' : 'Load track →'}</span>
              ) : (
                <span>Sample</span>
              )}
            </span>
          </div>
        </div>
      </div>
      {isComingSoon ? (
        <div className="card-coming-soon-overlay" aria-hidden="true">
          <span className="card-coming-soon-label">Coming Soon</span>
          <span className="card-coming-soon-countdown">{countdownLabel}</span>
        </div>
      ) : null}
    </>
  )

  const className = `project-card reveal${project.featured ? ' is-featured' : ''}${hasGallery ? ' project-card--gallery' : ''}${hasMusicTrack ? ' project-card--music' : ''}${musicActive ? ' is-music-active' : ''}${isComingSoon ? ' project-card--coming-soon' : ''}`

  if (project.url && !isComingSoon) {
    return (
      <a
        href={project.url}
        className={className}
        style={style}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    )
  }

  return (
    <>
      <article
        className={className}
        style={style}
        onClick={isComingSoon ? undefined : hasGallery ? openGallery : hasMusicTrack ? selectMusicTrack : undefined}
        onKeyDown={
          isComingSoon
            ? undefined
            : hasGallery
              ? handleGalleryKeyDown
              : hasMusicTrack
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectMusicTrack()
                    }
                  }
                : undefined
        }
        tabIndex={isComingSoon ? undefined : hasGallery || hasMusicTrack ? 0 : undefined}
        role={isComingSoon ? undefined : hasGallery || hasMusicTrack ? 'button' : undefined}
        aria-label={
          isComingSoon
            ? `${project.title} — coming soon`
            : hasGallery
              ? `View ${project.title} gallery`
              : hasMusicTrack
                ? `Load ${project.title} in music player`
                : undefined
        }
      >
        {inner}
      </article>
      {galleryOpen && project.gallery ? (
        <GalleryLightbox
          title={project.title}
          images={project.gallery}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
          audioUrl={project.galleryAudio}
        />
      ) : null}
    </>
  )
})
