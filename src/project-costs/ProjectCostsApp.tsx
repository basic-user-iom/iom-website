import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { TEAM, TEAM_PORTRAIT_EXTS } from '../data/team'
import { useSiteI18n } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import {
  AUGUST_OFFER,
  CAPACITY_TIMELINE,
  CONTACT_CHECKLIST,
  COST_REFERENCES,
  ENGAGEMENT_OPTIONS,
  ESTIMATE_FACTORS_SIMPLE,
  ESTIMATE_FACTORS_TECHNICAL,
  ESTIMATE_EXCLUSIONS,
  ESTIMATE_RATE_HIGHLIGHTS,
  GLANCE_RANGE_NOTE,
  HERO_COPY,
  HOW_IOM_WORKS,
  HOW_PROJECT_STARTS,
  PRODUCTION_TIME_NOTE,
  PROJECT_COSTS_META,
  PROJECT_EXAMPLES_INTRO,
  PROTOTYPE_STEPS,
  RATE_BLENDED_NOTE,
  SELECTED_SUPPORT_NOTE,
  type CostReference,
  type EngagementOption,
} from './data'
import { ProjectCostsInquiryForm } from './ProjectCostsInquiryForm'
import './projectCosts.css'

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function LearnMoreBlock({
  panelId,
  label,
  title,
  paragraphs,
  open,
  onToggle,
  children,
}: {
  panelId: string
  label: string
  title?: string
  paragraphs?: readonly string[]
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  const triggerId = `${panelId}-trigger`
  const regionId = `${panelId}-panel`

  return (
    <div className="pc-learn">
      <button
        type="button"
        className="pc-learn-trigger"
        id={triggerId}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className="pc-learn-icon" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      <div
        id={regionId}
        role="region"
        aria-labelledby={triggerId}
        className={`pc-learn-panel${open ? ' is-open' : ''}`}
      >
        {title ? <p className="pc-learn-panel-title">{title}</p> : null}
        {paragraphs?.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
        {children}
      </div>
    </div>
  )
}

function EngagementCard({
  option,
  open,
  onToggle,
}: {
  option: EngagementOption
  open: boolean
  onToggle: () => void
}) {
  return (
    <article
      className="pc-engage-card"
      id={option.anchor}
      data-cursor-orbit="card"
    >
      <div className="pc-engage-card-body">
        <p className="pc-engage-option">{option.optionLabel}</p>
        <h3 className="pc-engage-card-title">{option.title}</h3>
        <p className="pc-engage-card-summary">{option.summary}</p>
      </div>
      <div className="pc-engage-card-pricing">
        <p className="pc-engage-rate">{option.rateLine}</p>
        <p className="pc-engage-rate-note">{option.rateNote}</p>
      </div>
      <LearnMoreBlock
        panelId={`learn-${option.id}`}
        label={option.learnMoreLabel}
        title={option.learnMoreTitle}
        paragraphs={option.learnMoreParagraphs}
        open={open}
        onToggle={onToggle}
      />
    </article>
  )
}

function useCanHoverPlay(): boolean {
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setCanHover(hoverMq.matches)
      setReduced(reduceMq.matches)
    }
    sync()
    hoverMq.addEventListener('change', sync)
    reduceMq.addEventListener('change', sync)
    return () => {
      hoverMq.removeEventListener('change', sync)
      reduceMq.removeEventListener('change', sync)
    }
  }, [])

  return canHover && !reduced
}

function ProtoStep({ step }: { step: (typeof PROTOTYPE_STEPS)[number] }) {
  const canHover = useCanHoverPlay()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoActive, setVideoActive] = useState(false)
  const member = TEAM.find((m) => m.id === step.memberId)
  const [imgIndex, setImgIndex] = useState(0)

  const candidates = useMemo(() => {
    if (!member?.portraitBase) return [] as string[]
    const preferPng = ['.png', '.webp', '.jpg', '.jpeg'] as const
    return preferPng
      .filter((ext) => (TEAM_PORTRAIT_EXTS as readonly string[]).includes(ext))
      .map((ext) => `${member.portraitBase}${ext}`)
  }, [member?.portraitBase])

  const src = candidates[imgIndex]
  const videoSrc = member?.portraitVideo

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return
    if (video.readyState < 2) {
      try {
        video.load()
      } catch {
        /* ignore */
      }
    }
    void video.play().then(() => setVideoActive(true)).catch(() => {})
  }, [videoSrc])

  const pause = useCallback(() => {
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

  const rootRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (canHover || !videoSrc) return
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.45) play()
        else pause()
      },
      { threshold: [0, 0.45, 1] },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [canHover, videoSrc, play, pause])

  useEffect(
    () => () => {
      videoRef.current?.pause()
    },
    [],
  )

  return (
    <li
      ref={rootRef}
      className="pc-proto-step"
      data-cursor-orbit="card"
      onPointerEnter={canHover ? play : undefined}
      onPointerLeave={canHover ? pause : undefined}
    >
      <div className="pc-proto-rfo">
        <span
          className={`pc-proto-portrait pc-proto-portrait--${step.memberId}${videoActive ? ' is-playing' : ''}`}
          aria-hidden="true"
        >
          {src ? (
            <img
              className={`pc-proto-portrait-media pc-proto-portrait-media--still${videoActive ? ' is-dimmed' : ''}`}
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => {
                setImgIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))
              }}
            />
          ) : (
            <span className="pc-proto-portrait-fallback">{step.initials}</span>
          )}
          {videoSrc ? (
            <video
              ref={videoRef}
              className={`pc-proto-portrait-media pc-proto-portrait-media--video${videoActive ? ' is-active' : ''}`}
              src={videoSrc}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : null}
        </span>
        <span className="pc-proto-rfo-label">
          <span className="pc-proto-stage">{step.stage}</span>
          <span className="pc-proto-who">{step.who}</span>
        </span>
      </div>
      <span className="pc-proto-index">{step.index}</span>
      <h3 className="pc-proto-title">{step.title}</h3>
      <p className="pc-proto-stage-line">{step.stageLine}</p>
      <p>{step.text}</p>
    </li>
  )
}

function TierBlock({
  tiers,
  compact,
}: {
  tiers: CostReference['tiers']
  compact?: boolean
}) {
  return (
    <div className={`pc-tiers${compact ? ' pc-tiers--compact' : ''}`}>
      {tiers.map((tier) => (
        <div key={tier.label} className="pc-tier">
          <p className="pc-tier-label">{tier.label}</p>
          <p className="pc-tier-hours">{tier.hours}</p>
          <p className="pc-tier-delivery">{tier.delivery}</p>
          <p className="pc-tier-budget">{tier.budget}</p>
        </div>
      ))}
    </div>
  )
}

function ReferenceCard({
  ref,
  open,
  onToggle,
}: {
  ref: CostReference
  open: boolean
  onToggle: () => void
}) {
  const { href } = useSiteI18n()
  const studyHref = href(ref.caseStudyPath)

  return (
    <article className="pc-card" id={`ref-${ref.id}`} data-cursor-orbit="card">
      <a className="pc-card-media" href={studyHref}>
        <img
          src={ref.image}
          alt={ref.imageAlt}
          loading="eager"
          decoding="async"
          fetchPriority="low"
        />
      </a>
      <div className="pc-card-body">
        <div className="pc-card-body-top">
          <div className="pc-card-top">
            <span className="pc-card-ref">{ref.refLabel}</span>
            <span className="pc-card-cat">{ref.category}</span>
          </div>
          <h3 className="pc-card-title">
            <a href={studyHref}>{ref.title}</a>
          </h3>
          <p className="pc-card-desc">{ref.description}</p>
        </div>
        <div className="pc-card-pricing">
          <TierBlock tiers={ref.tiers} />
        </div>
        <LearnMoreBlock
          panelId={`learn-ref-${ref.id}`}
          label={ref.learnMoreLabel}
          title={`${ref.title} — scope and pricing detail`}
          open={open}
          onToggle={onToggle}
        >
          <div className="pc-card-cols">
            <div>
              <h4 className="pc-card-sub">Typically includes</h4>
              <ul className="pc-list">
                {ref.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {ref.priceDrivers?.length ? (
              <div>
                <h4 className="pc-card-sub">Usually changes in price because of</h4>
                <ul className="pc-list">
                  {ref.priceDrivers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {ref.productAdditions ? (
            <div className="pc-card-block">
              <h4 className="pc-card-sub">Possible product-level additions</h4>
              <ul className="pc-list pc-list--wrap">
                {ref.productAdditions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {ref.assumption ? <p className="pc-card-note">{ref.assumption}</p> : null}
          {ref.explainer ? <p className="pc-card-note">{ref.explainer}</p> : null}

          <a className="pc-card-link" href={studyHref}>
            View case study →
          </a>
        </LearnMoreBlock>
        <p className="pc-print-url">{PROJECT_COSTS_META.siteUrl}{ref.caseStudyPath}</p>
      </div>
    </article>
  )
}

export function ProjectCostsApp() {
  const { href, lang } = useSiteI18n()
  const [inquiryKind, setInquiryKind] = useState<'consultation' | 'estimate'>(
    'consultation',
  )
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({})
  const [narrowAccordion, setNarrowAccordion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 820px)').matches
  })
  const embed =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1'

  useEffect(() => {
    applyPageMeta(PROJECT_COSTS_META.path, lang)
  }, [lang])

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    if (path === '/start' || path.endsWith('/start')) {
      const next = path.replace(/\/start$/, '/project-costs')
      window.history.replaceState(null, '', `${next}${window.location.search}${window.location.hash}`)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('pc-embed', embed)
    return () => document.documentElement.classList.remove('pc-embed')
  }, [embed])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)')
    const sync = () => setNarrowAccordion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const match = ENGAGEMENT_OPTIONS.find((option) => option.anchor === hash)
    if (match) {
      setOpenPanels((prev) => ({ ...prev, [`engage-${match.id}`]: true }))
      window.requestAnimationFrame(() => scrollToId(match.anchor))
    }
  }, [])

  const togglePanel = useCallback(
    (key: string, group?: 'engage' | 'ref') => {
      setOpenPanels((prev) => {
        const opening = !prev[key]
        if (!opening) return { ...prev, [key]: false }
        if (group === 'engage' && narrowAccordion) {
          const next: Record<string, boolean> = {}
          for (const option of ENGAGEMENT_OPTIONS) {
            next[`engage-${option.id}`] = `engage-${option.id}` === key
          }
          return next
        }
        if (group === 'ref' && narrowAccordion) {
          const next: Record<string, boolean> = {}
          for (const reference of COST_REFERENCES) {
            next[`ref-${reference.id}`] = `ref-${reference.id}` === key
          }
          return next
        }
        return { ...prev, [key]: true }
      })
    },
    [narrowAccordion],
  )

  const openInquiry = (kind: 'consultation' | 'estimate') => {
    setInquiryKind(kind)
    scrollToId('inquiry')
  }

  const handlePrint = () => {
    const root = document.documentElement
    const onAfterPrint = () => {
      root.classList.remove('pc-printing')
      window.removeEventListener('afterprint', onAfterPrint)
    }
    root.classList.add('pc-printing')
    window.addEventListener('afterprint', onAfterPrint)

    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>('.pc-card-media img, .pc-proto-portrait-media--still'),
    )

    void Promise.all(
      imgs.map(async (img) => {
        // Lazy/deferred images often print as empty dark boxes — force decode first.
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            const done = () => resolve()
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
            // Re-assign src to kick a load if the browser deferred it.
            const { src } = img
            img.loading = 'eager'
            img.src = src
          })
        }
        try {
          await img.decode()
        } catch {
          /* ignore decode failures — still attempt print */
        }
      }),
    ).finally(() => {
      window.setTimeout(() => window.print(), 30)
    })
  }

  return (
    <>
      {!embed && <Header />}
      <main id="main-content" className={`pc-main${embed ? ' pc-main--embed' : ''}`}>
        <article className="pc-page">
          <header className="pc-hero">
            {!embed && (
              <div className="pc-hero-tools">
                <button
                  type="button"
                  className="pc-print-btn"
                  onClick={handlePrint}
                >
                  Print / Save as PDF
                </button>
              </div>
            )}
            <p className="pc-eyebrow">{HERO_COPY.eyebrow}</p>
            <h1 className="pc-title">{HERO_COPY.title}</h1>
            <p className="pc-lead">{HERO_COPY.lead}</p>
            <p className="pc-support-note">{HERO_COPY.sub}</p>
            <div className="pc-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openInquiry('consultation')}
              >
                {HERO_COPY.ctaPrimary}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => scrollToId('project-examples')}
              >
                {HERO_COPY.ctaSecondary}
              </button>
            </div>
          </header>

          <section className="pc-section" id="engage" aria-labelledby="engage-heading">
            <h2 className="pc-section-title" id="engage-heading">
              How you can engage IOM
            </h2>
            <p className="pc-section-lead">
              Three paths — from a focused specialist task to a complete scoped project. Technical
              detail is available below each option when you need it.
            </p>
            <div className="pc-engage-grid">
              {ENGAGEMENT_OPTIONS.map((option) => (
                <EngagementCard
                  key={option.id}
                  option={option}
                  open={Boolean(openPanels[`engage-${option.id}`])}
                  onToggle={() => togglePanel(`engage-${option.id}`, 'engage')}
                />
              ))}
            </div>
          </section>

          <section className="pc-section pc-capacity" id="capacity" aria-labelledby="capacity-heading">
            <h2 className="pc-section-title pc-section-title--wide" id="capacity-heading">
              {CAPACITY_TIMELINE.title}
            </h2>
            <p className="pc-section-lead">{CAPACITY_TIMELINE.summary}</p>
            <LearnMoreBlock
              panelId="learn-capacity"
              label={CAPACITY_TIMELINE.learnMoreLabel}
              title={CAPACITY_TIMELINE.learnMoreTitle}
              paragraphs={CAPACITY_TIMELINE.learnMoreParagraphs}
              open={Boolean(openPanels['capacity'])}
              onToggle={() => togglePanel('capacity')}
            />
          </section>

          <aside className="pc-august" id="august-offer" aria-labelledby="august-heading" data-cursor-orbit="card">
            <p className="pc-august-eyebrow">{AUGUST_OFFER.eyebrow}</p>
            <h2 className="pc-august-title" id="august-heading">
              {AUGUST_OFFER.title}
            </h2>
            <ul className="pc-list pc-august-list">
              {AUGUST_OFFER.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary pc-august-cta"
              onClick={() => openInquiry('consultation')}
            >
              {AUGUST_OFFER.cta}
            </button>
          </aside>

          <section
            className="pc-section"
            id="project-examples"
            aria-labelledby="examples-heading"
          >
            <h2 className="pc-section-title pc-section-title--wide" id="examples-heading">
              {PROJECT_EXAMPLES_INTRO.title}
            </h2>
            <p className="pc-section-lead">{PROJECT_EXAMPLES_INTRO.lead}</p>

            <div className="pc-glance" role="table" aria-label="Quick project comparison">
              <div className="pc-glance-head" role="row">
                <span role="columnheader">Project</span>
                <span role="columnheader">Typical comparable effort</span>
                <span role="columnheader">Typical delivery</span>
                <span role="columnheader">Indicative budget</span>
              </div>
              {COST_REFERENCES.map((ref) => (
                <a
                  key={ref.id}
                  className="pc-glance-row"
                  href={`#ref-${ref.id}`}
                  role="row"
                  data-cursor-orbit="card"
                  onClick={(event) => {
                    event.preventDefault()
                    scrollToId(`ref-${ref.id}`)
                  }}
                >
                  <span className="pc-glance-project" role="cell">
                    <span className="pc-glance-cat">{ref.glanceCategory}</span>
                    <span className="pc-glance-ref">Reference: {ref.title}</span>
                  </span>
                  <span className="pc-glance-tiers" role="cell">
                    {ref.tiers.map((tier) => (
                      <span key={tier.label} className="pc-glance-tier">
                        {ref.tiers.length > 1 ? (
                          <span className="pc-glance-tier-label">{tier.label}</span>
                        ) : null}
                        <span>{tier.hours}</span>
                        <span className="pc-glance-mobile-only">{tier.delivery}</span>
                        <span className="pc-glance-mobile-only pc-glance-budget">
                          {tier.budget}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="pc-glance-delivery" role="cell">
                    {ref.tiers.map((tier) => (
                      <span key={tier.label}>
                        {ref.tiers.length > 1 ? (
                          <span className="pc-glance-tier-label">{tier.label}</span>
                        ) : null}
                        {tier.delivery}
                      </span>
                    ))}
                  </span>
                  <span className="pc-glance-budget-col" role="cell">
                    {ref.tiers.map((tier) => (
                      <span key={tier.label} className="pc-glance-budget">
                        {ref.tiers.length > 1 ? (
                          <span className="pc-glance-tier-label">{tier.label}</span>
                        ) : null}
                        {tier.budget}
                      </span>
                    ))}
                  </span>
                </a>
              ))}
            </div>
            <p className="pc-section-note">{PROJECT_EXAMPLES_INTRO.glanceNote}</p>
            <p className="pc-section-note">{GLANCE_RANGE_NOTE}</p>
          </section>

          <section
            className="pc-section"
            id="reference-projects"
            aria-labelledby="refs-heading"
          >
            <h2 className="pc-section-title" id="refs-heading">
              Detailed reference projects
            </h2>
            <p className="pc-section-lead">
              What was included in each example, typical production ranges and why the reference
              may — or may not — be comparable to a new request. Not fixed package prices.
            </p>
            <div className="pc-card-grid">
              {COST_REFERENCES.map((ref) => (
                <ReferenceCard
                  key={ref.id}
                  ref={ref}
                  open={Boolean(openPanels[`ref-${ref.id}`])}
                  onToggle={() => togglePanel(`ref-${ref.id}`, 'ref')}
                />
              ))}
            </div>
          </section>

          <section className="pc-section" aria-labelledby="factors-heading">
            <h2 className="pc-section-title" id="factors-heading">
              What affects the estimate?
            </h2>
            <p className="pc-section-lead">{ESTIMATE_FACTORS_SIMPLE}</p>
            <LearnMoreBlock
              panelId="learn-estimate"
              label="Learn more about pricing factors"
              title="Technical factors that change production effort"
              open={Boolean(openPanels['estimate'])}
              onToggle={() => togglePanel('estimate')}
            >
              <ul className="pc-factor-grid pc-factor-grid--technical">
                {ESTIMATE_FACTORS_TECHNICAL.map((factor) => (
                  <li key={factor.title} className="pc-factor" data-cursor-orbit="card">
                    <h3 className="pc-factor-title">{factor.title}</h3>
                    <p>{factor.text}</p>
                  </li>
                ))}
              </ul>
            </LearnMoreBlock>
          </section>

          <section className="pc-section pc-starts" id="how-project-starts" aria-labelledby="starts-heading">
            <h2 className="pc-section-title" id="starts-heading">
              {HOW_PROJECT_STARTS.title}
            </h2>
            <div className="pc-starts-layout">
              <ol className="pc-starts-steps">
                {HOW_PROJECT_STARTS.steps.map((step, index) => (
                  <li key={step}>
                    <span className="pc-starts-index">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <aside className="pc-starts-aside" aria-label="Next steps">
                <p className="pc-section-note">{HOW_PROJECT_STARTS.footer}</p>
                <p className="pc-note">
                  Every potential project can begin with a free 30-minute consultation. Technical
                  research, file inspection, workflow testing, design work and prototype development
                  are quoted separately when required.
                </p>
                <div className="pc-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openInquiry('consultation')}
                  >
                    {HOW_PROJECT_STARTS.cta}
                  </button>
                </div>

                <div className="pc-support pc-support--quiet" aria-labelledby="support-heading">
                  <h3 className="pc-support-heading" id="support-heading">
                    {SELECTED_SUPPORT_NOTE.title}
                  </h3>
                  <p>{SELECTED_SUPPORT_NOTE.lead}</p>
                  <p className="pc-section-note">{SELECTED_SUPPORT_NOTE.footer}</p>
                </div>
              </aside>
            </div>
          </section>

          <section className="pc-section" id="prototype" aria-labelledby="proto-heading">
            <h2 className="pc-section-title" id="proto-heading">
              Start with a focused prototype
            </h2>
            <p className="pc-section-lead">
              Most projects do not need to begin with the complete reference build. A smaller,
              clearly defined prototype can validate the central interaction, visual direction
              and technical workflow before the full production scope is approved.
            </p>
            <ol className="pc-proto-steps" aria-label="Prototype stages · Research Form Output">
              {PROTOTYPE_STEPS.map((step) => (
                <ProtoStep key={step.index} step={step} />
              ))}
            </ol>
            <p className="pc-section-note">
              Prototype work is structured so that useful code, assets and design decisions can
              continue into the next production stage wherever practical — carried through
              Research (Raven), Form (Fox), and Output (Octopus).
            </p>
          </section>

          <section className="pc-section" id="how-iom-works" aria-labelledby="how-heading">
            <h2 className="pc-section-title" id="how-heading">
              Small core team, scalable production
            </h2>
            <p className="pc-section-lead">
              IOM operates as a small specialist studio and brings in trusted collaborators when
              a project benefits from parallel production or additional expertise.
            </p>
            <ul className="pc-how-grid">
              {HOW_IOM_WORKS.map((item) => (
                <li key={item.title} className="pc-how-item" data-cursor-orbit="card">
                  <h3 className="pc-how-title">{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <aside className="pc-estimate-box" aria-labelledby="estimate-heading" data-cursor-orbit="card">
            <h2 className="pc-section-title pc-section-title--sub" id="estimate-heading">
              About these estimates
            </h2>
            <div className="pc-estimate-layout">
              <div className="pc-estimate-copy">
                <p>
                  All figures on this page are indicative planning ranges for work comparable to
                  the referenced case studies. They are not fixed package prices, contractual
                  quotations or statements of the exact historic cost of the original projects.
                </p>
                <p>{PRODUCTION_TIME_NOTE}</p>
                <p>{RATE_BLENDED_NOTE}</p>
                <p>
                  Project quotes for larger scopes are prepared separately after consultation.
                  Unless specifically included in a quotation, the items listed alongside are
                  usually estimated separately.
                </p>
              </div>
              <div className="pc-estimate-highlights" aria-label="Key rate highlights">
                <p className="pc-estimate-highlights-eyebrow">Planning ranges</p>
                <ul className="pc-estimate-stats">
                  {ESTIMATE_RATE_HIGHLIGHTS.map((item) => (
                    <li key={item.label} className="pc-estimate-stat">
                      <span className="pc-estimate-stat-label">{item.label}</span>
                      <span className="pc-estimate-stat-value">{item.value}</span>
                    </li>
                  ))}
                </ul>
                <div className="pc-estimate-excludes">
                  <p className="pc-estimate-excludes-label">Usually quoted separately</p>
                  <ul className="pc-estimate-tags">
                    {ESTIMATE_EXCLUSIONS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </aside>

          <section className="pc-section pc-contact" id="contact" aria-labelledby="contact-heading">
            <h2 className="pc-section-title" id="contact-heading">
              Have a project in mind?
            </h2>
            <p className="pc-section-lead">
              Send a short project description together with any available information about the
              intended audience, existing materials, required platform and preferred completion
              date. IOM will recommend an appropriate starting scope and provide a
              project-specific timeline and budget range.
            </p>
            <div className="pc-checklist">
              <p className="pc-checklist-label">Helpful information to include:</p>
              <ul className="pc-list">
                {CONTACT_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="pc-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openInquiry('consultation')}
              >
                Book a free consultation
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => openInquiry('estimate')}
              >
                Request a project estimate
              </button>
              <a className="btn btn-ghost" href={href(PROJECT_COSTS_META.caseStudiesPath)}>
                View all case studies
              </a>
            </div>
            <ProjectCostsInquiryForm id="inquiry" defaultKind={inquiryKind} />
          </section>

          <p className="pc-print-footer" aria-hidden="true">
            IOM — Interactive Object Media · {PROJECT_COSTS_META.siteUrl} ·{' '}
            {PROJECT_COSTS_META.contactEmail}
          </p>
        </article>
      </main>
      {!embed && <Footer />}
    </>
  )
}
