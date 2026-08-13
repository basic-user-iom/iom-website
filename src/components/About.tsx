import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TEAM, TEAM_PORTRAIT_EXTS, type TeamMember } from '../data/team'
import { ContactForm } from './ContactForm'
import { HomeEngagementSection } from './HomeEngagementSection'
import { useSiteOrbsOptional } from './SiteOrbZone'
import { useSiteI18n } from '../i18n'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return reduced
}

/** Fine pointer + hover — desktop-style pointer play. */
function useCanHoverPlay(): boolean {
  const reduced = usePrefersReducedMotion()
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })

  useEffect(() => {
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanHover(hoverMq.matches)
    sync()
    hoverMq.addEventListener('change', sync)
    return () => hoverMq.removeEventListener('change', sync)
  }, [])

  return canHover && !reduced
}

type PortraitMode = 'hover' | 'scroll' | 'still'

const TeamCard = memo(function TeamCard({
  member,
  mode,
  scrollActive,
}: {
  member: TeamMember
  mode: PortraitMode
  scrollActive: boolean
}) {
  const { t } = useSiteI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const candidates = useMemo(() => {
    if (!member.portraitBase) return [] as string[]
    return TEAM_PORTRAIT_EXTS.map((ext) => `${member.portraitBase}${ext}`)
  }, [member.portraitBase])

  const [index, setIndex] = useState(0)
  const [videoActive, setVideoActive] = useState(false)
  const src = candidates[index]
  const showImage = Boolean(src)
  const role = t(`team.${member.id}.role`)
  const philosophy = t(`team.${member.id}.philosophy`)
  const rfoStage = t(`team.${member.id}.rfoStage`)
  const showVideo = Boolean(member.portraitVideo) && mode !== 'still'

  const playPortraitVideo = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.readyState < 2) {
      try {
        video.load()
      } catch {
        /* ignore */
      }
    }
    void video.play().then(() => setVideoActive(true)).catch(() => {})
  }, [])

  const pausePortraitVideo = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    try {
      video.currentTime = 0
    } catch {
      /* ignore */
    }
    setVideoActive(false)
  }, [])

  // Mobile / coarse: only the card in view plays; neighbors stop.
  useEffect(() => {
    if (mode !== 'scroll' || !showVideo) return
    if (scrollActive) playPortraitVideo()
    else pausePortraitVideo()
  }, [mode, scrollActive, showVideo, playPortraitVideo, pausePortraitVideo])

  useEffect(() => {
    return () => {
      const video = videoRef.current
      if (!video) return
      video.pause()
    }
  }, [])

  return (
    <li
      className={`about-team-card about-team-card--${member.id}`}
      data-member-id={member.id}
      onPointerEnter={mode === 'hover' ? playPortraitVideo : undefined}
      onPointerLeave={mode === 'hover' ? pausePortraitVideo : undefined}
    >
      <div className="about-team-visual" aria-hidden="true">
        {showImage ? (
          <img
            className={`about-team-photo${videoActive ? ' is-dimmed' : ''}`}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => {
              setIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))
            }}
          />
        ) : (
          <span className="about-team-monogram">{member.initials}</span>
        )}
        {showVideo && member.portraitVideo ? (
          <video
            ref={videoRef}
            className={`about-team-photo about-team-photo--video${videoActive ? ' is-active' : ''}`}
            src={member.portraitVideo}
            muted
            loop
            playsInline
            preload={mode === 'scroll' ? 'none' : 'metadata'}
          />
        ) : null}
      </div>

      <div className="about-team-copy">
        <span className="about-team-badge" aria-hidden="true">
          <span className="about-team-badge-letter" data-letter={member.initials}>
            {member.initials}
          </span>
        </span>
        <div className="about-team-body">
          <p className="about-team-rfo">{rfoStage}</p>
          <h3 className="about-team-name">{member.name}</h3>
          <p className="about-team-role">{role}</p>
          <span className="about-team-rule" aria-hidden="true" />
          <p className="about-team-philosophy">{philosophy}</p>
          <a className="about-team-email" href={`mailto:${member.email}`}>
            {member.email}
          </a>
        </div>
        <p className="about-team-mark" aria-hidden="true">
          IOM
        </p>
      </div>
    </li>
  )
})

export const About = memo(function About() {
  const orbs = useSiteOrbsOptional()
  const { t } = useSiteI18n()
  const canHoverPlay = useCanHoverPlay()
  const reducedMotion = usePrefersReducedMotion()
  const portraitMode: PortraitMode = reducedMotion ? 'still' : canHoverPlay ? 'hover' : 'scroll'
  const [scrollActiveId, setScrollActiveId] = useState<string | null>(null)
  const teamListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (portraitMode !== 'scroll') {
      setScrollActiveId(null)
      return
    }

    const root = teamListRef.current
    if (!root) return

    const ratios = new Map<string, number>()
    const pick = () => {
      let best: string | null = null
      let bestRatio = 0.45
      for (const [id, ratio] of ratios) {
        if (ratio > bestRatio) {
          bestRatio = ratio
          best = id
        }
      }
      setScrollActiveId((prev) => (prev === best ? prev : best))
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.memberId
          if (!id) continue
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        pick()
      },
      {
        threshold: [0, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
        // Bias toward the card centered in the viewport while scrolling the stack.
        rootMargin: '-18% 0px -28% 0px',
      },
    )

    root.querySelectorAll<HTMLElement>('[data-member-id]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [portraitMode])

  return (
    <>
      <section className="about-block" id="about" aria-labelledby="about-heading">
        <div className="about-intro">
          <div className="about-intro-fx" aria-hidden="true">
            <span className="about-intro-wash" />
            <span className="about-intro-glow about-intro-glow--a" />
            <span className="about-intro-glow about-intro-glow--b" />
            <span className="about-intro-glow about-intro-glow--c" />
          </div>

          <div className="about-intro-shell">
            <header className="about-lead">
              <div className="about-lead-main">
                <p className="about-eyebrow">{t('about.eyebrow')}</p>
                <h2 className="about-title" id="about-heading">
                  {t('about.title')}
                </h2>
              </div>
              <div className="about-lead-copy">
                <p className="about-lead-blurb">{t('about.blurb')}</p>
                <p className="about-lead-note">{t('about.note')}</p>
              </div>
            </header>

            <div className="about-pathway" id="rfo" aria-labelledby="rfo-heading">
              <div className="about-pathway-head">
                <p className="about-eyebrow" id="rfo-heading">
                  Process · {t('rfo.title')}
                </p>
                <p className="about-pathway-tagline">{t('rfo.tagline')}</p>
                <p className="about-pathway-method">{t('rfo.method')}</p>
              </div>

              <ol className="about-pathway-flow" aria-label={t('about.rfoAria')}>
                {TEAM.map((member, i) => {
                  const phaseIds =
                    member.id === 'raven'
                      ? ([1] as const)
                      : member.id === 'fox'
                        ? ([2] as const)
                        : ([3, 4] as const)
                  const summaryTitle =
                    member.id === 'octopus'
                      ? t('rfo.phaseOutput.title')
                      : t(`rfo.phase${phaseIds[0]}.title`)

                  return (
                    <li
                      key={member.id}
                      className="about-pathway-item"
                      onPointerEnter={() => {
                        orbs?.setHover('rfo', i)
                      }}
                      onPointerLeave={() => {
                        orbs?.setHover(null, null)
                      }}
                    >
                      <span
                        className="about-pathway-node"
                        aria-hidden="true"
                        ref={(node) => {
                          if (orbs) orbs.rfoNodesRef.current[i] = node
                        }}
                      >
                        {member.initials}
                      </span>
                      <span className="about-pathway-label">
                        <span className="about-pathway-stage">{t(`team.${member.id}.rfoStage`)}</span>
                        <span className="about-pathway-who">{member.name}</span>
                      </span>

                      <details className="about-pathway-phase">
                        <summary className="about-pathway-phase-summary">
                          <span className="about-pathway-phase-copy">
                            <span className="about-pathway-phase-title">{summaryTitle}</span>
                            <span className="about-pathway-phase-more">
                              <span className="about-pathway-phase-more-open">{t('rfo.phaseMore')}</span>
                              <span className="about-pathway-phase-more-close">{t('rfo.phaseLess')}</span>
                            </span>
                          </span>
                        </summary>
                        <div className="about-pathway-phase-body">
                          <p className="about-pathway-phase-lead">
                            {t('rfo.phaseLead', {
                              who: member.name,
                              stage: t(`team.${member.id}.rfoStage`),
                            })}
                          </p>
                          {phaseIds.map((n) => (
                            <div key={n} className="about-pathway-phase-block">
                              {phaseIds.length > 1 ? (
                                <p className="about-pathway-phase-subtitle">{t(`rfo.phase${n}.title`)}</p>
                              ) : null}
                              <p className="about-pathway-phase-text">{t(`rfo.phase${n}.text`)}</p>
                            </div>
                          ))}
                        </div>
                      </details>

                      {i < TEAM.length - 1 ? (
                        <span className="about-pathway-link" aria-hidden="true" />
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>

        <p className="about-team-label">{t('about.teamLabel')}</p>
        <ul className="about-team" ref={teamListRef}>
          {TEAM.map((member) => (
            <TeamCard
              key={member.id}
              member={member}
              mode={portraitMode}
              scrollActive={portraitMode === 'scroll' && scrollActiveId === member.id}
            />
          ))}
        </ul>

        <p className="about-rfo-close-text">{t('rfo.close')}</p>

        <HomeEngagementSection />
      </section>

      <section className="about-block about-block--contact" id="contact" aria-labelledby="contact-heading">
        <p className="about-eyebrow">{t('about.contactEyebrow')}</p>
        <h2 className="about-title" id="contact-heading">
          {t('about.contactTitle')}
        </h2>
        <p className="about-text">{t('about.contactText')}</p>
        <ContactForm />
      </section>
    </>
  )
})
