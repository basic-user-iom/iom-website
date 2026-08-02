import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Project } from '../data/projects'
import { useSiteI18n } from '../i18n'
import { getDeviceProfile } from '../utils/device'
import { reportEmbedHover, subscribeEmbedSlot } from '../utils/embedVisibility'
import { useSiteOrbsOptional } from './SiteOrbZone'

const GalleryLightbox = lazy(() =>
  import('./GalleryLightbox').then((m) => ({ default: m.GalleryLightbox })),
)

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
  const { t, href } = useSiteI18n()
  const orbs = useSiteOrbsOptional()
  const [embedFailed, setEmbedFailed] = useState(false)
  const [embedLoaded, setEmbedLoaded] = useState(false)
  const [previewImageFailed, setPreviewImageFailed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [embedSlotActive, setEmbedSlotActive] = useState(false)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const mountedRef = useRef(true)

  const profile = getDeviceProfile()
  const { isPending: isCountdownPending, label: countdownLabel } = useCountdown(project.availableAt)
  const isComingSoon = isCountdownPending || Boolean(project.comingSoonOverlay)
  const comingSoonLabel = project.comingSoonLabel ?? t('card.comingSoon')
  const caseStudyHref = project.caseStudyPath ? href(project.caseStudyPath) : undefined
  const projectHref =
    project.url?.startsWith('/case-studies/') ? href(project.url) : project.url
  const initials = project.title
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  const hasGallery = Boolean(project.gallery?.length)
  const hasMusicTrack = Boolean(project.audioUrl)
  // Nested <a> inside a wrapping card link is invalid and fails touch-target spacing.
  const hasSecondaryLinks = Boolean(
    project.caseStudyPath || project.sourceUrl || (project.referenceUrls?.length ?? 0) > 0,
  )
  const canEmbed = Boolean(project.embedUrl) && !embedFailed
  const useStaticEmbed = canEmbed && profile.useEmbedStaticFallback
  const showLiveEmbed = canEmbed && !useStaticEmbed
  const staticPreviewUrl = !canEmbed ? project.thumbnail ?? project.posterUrl : undefined
  const showThumbnail = Boolean(staticPreviewUrl)
  const showIframe = showLiveEmbed && isHovered && embedSlotActive && pageVisible
  const posterUrl = useStaticEmbed ? project.mobilePosterUrl ?? project.posterUrl : project.posterUrl
  const showPoster = canEmbed && Boolean(posterUrl) && !previewImageFailed
  const posterHidden = showIframe && embedLoaded
  const thumbSrc = staticPreviewUrl ?? project.posterUrl ?? ''
  const wantsThumbPreview = showThumbnail || (hasMusicTrack && Boolean(project.posterUrl))
  const showThumbImage = wantsThumbPreview && Boolean(thumbSrc) && !previewImageFailed
  const posterSizes = project.featured
    ? '(max-width: 720px) 92vw, (min-width: 900px) min(48vw, 720px), 520px'
    : '(max-width: 720px) 92vw, 400px'
  const posterSrcSet =
    project.mobilePosterUrl && posterUrl && project.mobilePosterUrl !== posterUrl
      ? `${project.mobilePosterUrl} 400w, ${posterUrl} 1280w`
      : undefined
  const thumbSrcSet =
    project.mobilePosterUrl && project.posterUrl && project.mobilePosterUrl !== project.posterUrl
      ? `${project.mobilePosterUrl} 400w, ${project.posterUrl} 1280w`
      : undefined

  const handlePreviewImageError = useCallback(() => {
    if (mountedRef.current) setPreviewImageFailed(true)
  }, [])

  const handleOrbEnter = useCallback(
    (el: HTMLElement) => {
      orbs?.setHover('card', 0, el)
    },
    [orbs],
  )

  const handleOrbLeave = useCallback(() => {
    orbs?.setHover(null, null)
  }, [orbs])

  const orbPointerProps = orbs
    ? {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => {
          handleOrbEnter(event.currentTarget)
        },
        onPointerLeave: handleOrbLeave,
      }
    : undefined

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setPreviewImageFailed(false)
  }, [project.id, thumbSrc, posterUrl])

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
      {wantsThumbPreview ? (
        <>
          {showThumbImage ? (
            <img
              className="card-preview-thumb"
              src={thumbSrc}
              srcSet={thumbSrcSet}
              sizes={thumbSrcSet ? posterSizes : undefined}
              alt=""
              width={800}
              height={500}
              /* Featured cards use display:contents — native lazy often never fires */
              loading={project.featured ? 'eager' : 'lazy'}
              decoding="async"
              onError={handlePreviewImageError}
              {...(project.featured ? { fetchPriority: 'high' as const } : {})}
            />
          ) : (
            <span className="card-preview-glyph" aria-hidden="true">
              {initials}
            </span>
          )}
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
              srcSet={posterSrcSet}
              sizes={posterSrcSet ? posterSizes : undefined}
              alt=""
              width={800}
              height={500}
              loading={project.featured ? 'eager' : 'lazy'}
              decoding="async"
              onError={handlePreviewImageError}
              {...(project.featured ? { fetchPriority: 'high' as const } : {})}
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
                  // First-party embeds only. Omitting sandbox avoids the Chrome warning
                  // that allow-scripts + allow-same-origin can escape the sandbox (and is a no-op here).
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
            <div className="card-footer-meta">
              <span className="card-year">{project.year}</span>
              {project.sourceUrl || project.referenceUrls?.length || project.caseStudyPath ? (
                <span className="card-footer-links">
                  {project.caseStudyPath ? (
                    <a
                      className="card-source-link"
                      href={caseStudyHref}
                      title={t('card.caseStudy')}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('card.caseStudy')}
                    </a>
                  ) : null}
                  {project.sourceUrl ? (
                    <a
                      className="card-source-link"
                      href={project.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('card.source')}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('card.source')}
                    </a>
                  ) : null}
                  {project.referenceUrls?.map((reference) => (
                    <a
                      key={reference.url}
                      className="card-source-link"
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={reference.label}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {reference.label}
                    </a>
                  ))}
                </span>
              ) : null}
            </div>
            <div className="card-footer-action">
              {project.url && hasSecondaryLinks ? (
                <a
                  className="card-link card-link--stretch"
                  href={projectHref}
                  {...(project.url.startsWith('http') || project.url.startsWith('/demos/')
                    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                    : {})}
                >
                  {project.url.startsWith('/case-studies/') && !project.caseStudyPath
                    ? t('card.viewStudy')
                    : t('card.open')}
                </a>
              ) : project.url ? (
                <span className="card-link">
                  {project.url.startsWith('/case-studies/') ? t('card.viewStudy') : t('card.open')}
                </span>
              ) : hasGallery ? (
                <button
                  type="button"
                  className="card-link"
                  onClick={(event) => {
                    event.stopPropagation()
                    openGallery()
                  }}
                >
                  {t('card.viewGallery')}
                </button>
              ) : hasMusicTrack ? (
                <button
                  type="button"
                  className="card-link"
                  onClick={(event) => {
                    event.stopPropagation()
                    selectMusicTrack()
                  }}
                >
                  {musicActive ? t('card.selected') : t('card.loadTrack')}
                </button>
              ) : (
                <span className="card-footer-note">{t('card.sample')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {isComingSoon ? (
        <div className="card-coming-soon-overlay" aria-hidden="true">
          <span className="card-coming-soon-label">{comingSoonLabel}</span>
          {isCountdownPending ? (
            <span className="card-coming-soon-countdown">{countdownLabel}</span>
          ) : null}
        </div>
      ) : null}
    </>
  )

  const className = `project-card reveal${project.featured ? ' is-featured' : ''}${hasGallery ? ' project-card--gallery' : ''}${hasMusicTrack ? ' project-card--music' : ''}${musicActive ? ' is-music-active' : ''}${isComingSoon ? ' project-card--coming-soon' : ''}`

  if (project.url && !isComingSoon && !hasSecondaryLinks) {
    const openInNewTab = project.url.startsWith('http') || project.url.startsWith('/demos/')
    return (
      <a
        id={project.id}
        href={projectHref}
        className={className}
        style={style}
        {...(openInNewTab ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {})}
        {...orbPointerProps}
      >
        {inner}
      </a>
    )
  }

  if (project.url && !isComingSoon && hasSecondaryLinks) {
    return (
      <article
        id={project.id}
        className={`${className} project-card--multi-link`}
        style={style}
        {...orbPointerProps}
      >
        {inner}
      </article>
    )
  }

  return (
    <>
      <article
        id={project.id}
        className={className}
        style={style}
        onClick={isComingSoon ? undefined : hasGallery ? openGallery : hasMusicTrack ? selectMusicTrack : undefined}
        {...orbPointerProps}
      >
        {inner}
      </article>
      {galleryOpen && project.gallery ? (
        <Suspense fallback={null}>
          <GalleryLightbox
            title={project.title}
            images={project.gallery}
            index={galleryIndex}
            onIndexChange={setGalleryIndex}
            onClose={() => setGalleryOpen(false)}
            audioUrl={project.galleryAudio}
          />
        </Suspense>
      ) : null}
    </>
  )
})
