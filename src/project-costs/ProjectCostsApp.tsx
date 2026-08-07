import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { TEAM, TEAM_PORTRAIT_EXTS } from '../data/team'
import { useSiteI18n } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import {
  CONTACT_CHECKLIST,
  COST_FACTS,
  COST_FACTORS,
  COST_REFERENCES,
  GLANCE_RANGE_NOTE,
  HOW_IOM_WORKS,
  PRODUCTION_TIME_NOTE,
  PROJECT_COSTS_META,
  PROTOTYPE_STEPS,
  RATE_BLENDED_NOTE,
  SELECTED_SUPPORT_NOTE,
  type CostReference,
} from './data'
import { ProjectCostsInquiryForm } from './ProjectCostsInquiryForm'
import './projectCosts.css'

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

function ReferenceCard({ ref }: { ref: CostReference }) {
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
        <div className="pc-card-top">
          <span className="pc-card-ref">{ref.refLabel}</span>
          <span className="pc-card-cat">{ref.category}</span>
        </div>
        <h3 className="pc-card-title">
          <a href={studyHref}>{ref.title}</a>
        </h3>
        <p className="pc-card-desc">{ref.description}</p>
        <TierBlock tiers={ref.tiers} />

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
            <p className="pc-eyebrow">Scope · Time · Budget</p>
            <h1 className="pc-title">Reference budgets for custom interactive work</h1>
            <p className="pc-lead">
              These examples show the typical production effort required to create work
              comparable to selected IOM case studies. They are intended to help clients
              understand the likely scale, timeline and budget of a project before a detailed
              brief and formal quotation are prepared.
            </p>
            <p className="pc-support-note">
              The figures are planning references rather than fixed packages. Final scope
              depends on the condition of supplied assets, required features, technical
              integrations, review process, delivery requirements and production timeframe.
            </p>
            <div className="pc-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => scrollToId('reference-projects')}
              >
                View reference projects
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => openInquiry('consultation')}
              >
                Book a free consultation
              </button>
            </div>
          </header>

          <section className="pc-facts" aria-label="Engagement overview">
            <dl className="pc-facts-row">
              {COST_FACTS.map((fact) => (
                <div key={fact.id} className="pc-facts-item" data-cursor-orbit="card">
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="pc-rate-note">{RATE_BLENDED_NOTE}</p>
          </section>

          <section className="pc-section" id="glance" aria-labelledby="glance-heading">
            <h2 className="pc-section-title" id="glance-heading">
              Projects at a glance
            </h2>
            <p className="pc-section-lead">
              A focused version validates the essential idea and technical workflow. A
              case-study-level build includes a more complete design system, interaction layer,
              testing and production finish.
            </p>

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
              Typical comparable effort, reference production ranges and indicative budgets for
              case-study-level builds. Final scope is quoted separately.
            </p>
            <div className="pc-card-grid">
              {COST_REFERENCES.map((ref) => (
                <ReferenceCard key={ref.id} ref={ref} />
              ))}
            </div>
          </section>

          <section className="pc-section" aria-labelledby="factors-heading">
            <h2 className="pc-section-title" id="factors-heading">
              What determines the final scope?
            </h2>
            <ul className="pc-factor-grid">
              {COST_FACTORS.map((factor) => (
                <li key={factor.title} className="pc-factor" data-cursor-orbit="card">
                  <h3 className="pc-factor-title">{factor.title}</h3>
                  <p>{factor.text}</p>
                </li>
              ))}
            </ul>
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

          <section className="pc-section pc-engage" id="consultation" aria-labelledby="consult-heading">
            <p className="pc-eyebrow">Initial conversation</p>
            <h2 className="pc-section-title" id="consult-heading">
              Start with a free 30-minute consultation
            </h2>
            <p className="pc-section-lead">
              Every potential project can begin with a free 30-minute consultation. The
              conversation is used to understand the main objective, intended audience,
              available materials, technical requirements and preferred delivery timeframe.
            </p>
            <p className="pc-text-lead">
              Following the consultation, IOM can recommend an appropriate first stage and
              provide an indicative timeline and budget range.
            </p>
            <p className="pc-note">
              The consultation covers the initial project discussion. Technical research, file
              inspection, workflow testing, design work and prototype development are quoted
              separately when required.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openInquiry('consultation')}
            >
              Book a free consultation
            </button>

            <div className="pc-support pc-support--quiet" aria-labelledby="support-heading">
              <h3 className="pc-support-heading" id="support-heading">
                {SELECTED_SUPPORT_NOTE.title}
              </h3>
              <p>{SELECTED_SUPPORT_NOTE.lead}</p>
              <p className="pc-section-note">{SELECTED_SUPPORT_NOTE.footer}</p>
            </div>
          </section>

          <section className="pc-section" id="how-iom-works" aria-labelledby="how-heading">
            <h2 className="pc-section-title" id="how-heading">
              Small core team, scalable production
            </h2>
            <p className="pc-section-lead">
              IOM operates as a small specialist studio and brings in trusted collaborators when
              a project benefits from parallel production or additional expertise. This keeps
              communication direct while allowing larger technical and creative projects to be
              delivered efficiently.
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
            <div className="pc-estimate-copy">
              <p>
                All figures on this page are indicative planning ranges for work comparable to
                the referenced case studies. They are not fixed package prices, contractual
                quotations or statements of the exact historic cost of the original projects.
              </p>
              <p>{PRODUCTION_TIME_NOTE}</p>
              <p>
                The reference ranges assume two consolidated review rounds. Further revisions or
                major changes in direction are estimated separately.
              </p>
              <p>
                IOM’s typical production rate ranges from €{PROJECT_COSTS_META.rateMin} to €
                {PROJECT_COSTS_META.rateMax} per hour. The applicable rate depends on project
                complexity, specialist requirements, asset readiness, technical uncertainty and
                requested delivery timeframe. Defined projects may also be quoted as fixed stages
                or using a blended project rate.
              </p>
              <p>
                Unless specifically included in a quotation, the reference estimates exclude
                travel, on-location photography, scanning, paid assets, third-party software
                licences, hosting charges, taxes and ongoing maintenance.
              </p>
              <p>
                Work outside the approved scope is quoted separately or charged at the rate
                defined in the approved proposal.
              </p>
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
