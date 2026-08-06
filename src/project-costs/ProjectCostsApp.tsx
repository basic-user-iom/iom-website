import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { TEAM, TEAM_PORTRAIT_EXTS } from '../data/team'
import { useSiteI18n } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import {
  CONSULT_POINTS,
  CONTACT_CHECKLIST,
  COST_FACTS,
  COST_FACTORS,
  COST_REFERENCES,
  HOW_IOM_WORKS,
  PROJECT_COSTS_META,
  PROTOTYPE_STEPS,
  SUPPORT_POINTS,
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

function ProtoPortrait({
  memberId,
  initials,
}: {
  memberId: (typeof PROTOTYPE_STEPS)[number]['memberId']
  initials: string
}) {
  const member = TEAM.find((m) => m.id === memberId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const canHover = useCanHoverPlay()
  const [imgIndex, setImgIndex] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [videoActive, setVideoActive] = useState(false)

  // Prefer PNG for the temporary still — WebP for raven/octopus is heavily compressed
  // and looks soft when cropped into a small circle.
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
    void video.play().then(() => setVideoActive(true)).catch(() => {})
  }, [videoSrc])

  const pause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    setVideoActive(false)
    // Keep a decoded video frame as the idle image (sharper than the still WebP).
    if (video.readyState >= 2) {
      try {
        if (video.currentTime < 0.05) video.currentTime = 0.08
      } catch {
        /* ignore */
      }
    }
  }, [])

  const onVideoReady = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const reveal = () => setVideoReady(true)
    try {
      if (video.currentTime < 0.05) {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          reveal()
        }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = 0.08
        return
      }
    } catch {
      /* ignore */
    }
    reveal()
  }, [])

  // Coarse pointers: play while the portrait is mostly in view
  useEffect(() => {
    if (canHover || !videoSrc) return
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55) play()
        else pause()
      },
      { threshold: [0, 0.55, 1] },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [canHover, videoSrc, play, pause])

  useEffect(() => () => {
    const video = videoRef.current
    if (!video) return
    video.pause()
  }, [])

  return (
    <span
      ref={rootRef}
      className={`pc-proto-portrait pc-proto-portrait--${memberId}${videoActive ? ' is-playing' : ''}${videoReady ? ' is-video-ready' : ''}`}
      aria-hidden="true"
      onPointerEnter={canHover ? play : undefined}
      onPointerLeave={canHover ? pause : undefined}
    >
      {src ? (
        <img
          className={`pc-proto-portrait-media pc-proto-portrait-media--still${videoReady ? ' is-dimmed' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            setImgIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))
          }}
        />
      ) : (
        <span className="pc-proto-portrait-fallback">{initials}</span>
      )}
      {videoSrc ? (
        <video
          ref={videoRef}
          className={`pc-proto-portrait-media pc-proto-portrait-media--video${videoReady ? ' is-active' : ''}`}
          src={videoSrc}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={onVideoReady}
        />
      ) : null}
    </span>
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
    <article className="pc-card" id={`ref-${ref.id}`}>
      <a className="pc-card-media" href={studyHref}>
        <img src={ref.image} alt={ref.imageAlt} loading="lazy" decoding="async" />
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
                  onClick={() => window.print()}
                >
                  Print / Save as PDF
                </button>
              </div>
            )}
            <p className="pc-eyebrow">Scope · Time · Budget</p>
            <p className="pc-page-title">{PROJECT_COSTS_META.pageTitle}</p>
            <h1 className="pc-title">Reference budgets for custom interactive work</h1>
            <p className="pc-lead">
              These ranges show the typical effort required to produce work comparable to
              selected IOM case studies. They are intended to help clients understand the
              likely scale of a project before a detailed brief and formal quotation are
              prepared.
            </p>
            <p className="pc-support-note">
              The figures are planning ranges rather than fixed packages. Final cost depends
              on asset readiness, technical integrations, number of scenes or features, review
              cycles, delivery requirements, production timeframe and the level of custom
              development.
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
                onClick={() => scrollToId('inquiry')}
              >
                Book a free consultation
              </button>
            </div>
          </header>

          <section className="pc-facts" aria-label="Engagement overview">
            <dl className="pc-facts-row">
              {COST_FACTS.map((fact) => (
                <div key={fact.id} className="pc-facts-item">
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="pc-rate-note">
              The applicable rate depends on project complexity, required expertise, asset
              readiness and delivery timeframe. Defined projects may also be quoted as fixed
              production stages.
            </p>
            <p className="pc-rate-note">
              IOM’s production rate generally ranges from €{PROJECT_COSTS_META.rateMin} to €
              {PROJECT_COSTS_META.rateMax} per hour, depending on technical and creative
              complexity, required specialist knowledge, urgency and requested delivery
              timeframe, availability of clean approved source assets, integration and testing
              requirements, and whether work is commissioned as a defined stage, fixed project
              or time-based engagement. Where a fixed project fee is quoted, it may use a
              blended rate based on the overall scope, complexity, schedule and production
              risk.
            </p>
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
                  href={href(ref.caseStudyPath)}
                  role="row"
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
            <p className="pc-section-note">
              The lower end of each range generally assumes well-prepared assets, a clearly
              defined scope, a standard delivery schedule and limited technical uncertainty.
              The upper end reflects greater complexity, specialist development, accelerated
              delivery, broader testing or less-prepared source material.
            </p>
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
                <li key={factor.title} className="pc-factor">
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
                <li key={step.index} className="pc-proto-step">
                  <div className="pc-proto-rfo">
                    <ProtoPortrait memberId={step.memberId} initials={step.initials} />
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
              Every potential project can begin with a free 30-minute consultation. This is an
              opportunity to discuss the main objective, intended audience, available materials,
              technical requirements, delivery timeframe and realistic production scope before
              any commitment is made.
            </p>
            <p className="pc-text-lead">The consultation is intended to help determine:</p>
            <ul className="pc-list">
              {CONSULT_POINTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => scrollToId('inquiry')}
            >
              Book a free consultation
            </button>
            <p className="pc-note">
              No obligation and no formal preparation document is required. A short description
              of the idea is sufficient to begin.
            </p>

            <div className="pc-support" aria-labelledby="support-heading">
              <p className="pc-eyebrow">Selected project support</p>
              <h3 className="pc-section-title pc-section-title--sub" id="support-heading">
                Support for selected projects
              </h3>
              <p className="pc-section-lead">
                Some projects have particularly strong creative, technical, cultural,
                educational or social potential. When a project is a strong fit for IOM and the
                production schedule allows it, we may choose to support its development through
                a reduced project fee or a limited number of complimentary production hours.
              </p>
              <p className="pc-section-note">
                This support is considered individually after the initial consultation. Any
                reduced rate or complimentary production time will be clearly defined in the
                project proposal before work begins.
              </p>
              <ul className="pc-support-points">
                {SUPPORT_POINTS.map((point) => (
                  <li key={point.title}>
                    <h4 className="pc-support-point-title">{point.title}</h4>
                    <p>{point.text}</p>
                  </li>
                ))}
              </ul>
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
                <li key={item.title} className="pc-how-item">
                  <h3 className="pc-how-title">{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <aside className="pc-estimate-box" aria-labelledby="estimate-heading">
            <h2 className="pc-section-title pc-section-title--sub" id="estimate-heading">
              About these estimates
            </h2>
            <div className="pc-estimate-copy">
              <p>
                All figures on this page are indicative planning ranges for work comparable to
                the referenced case studies. They are not fixed package prices, contractual
                quotations or statements of the exact historic cost of the original projects.
              </p>
              <p>
                The delivery ranges describe active production time. Calendar schedules may also
                depend on client feedback, access to assets, external approvals and third-party
                services.
              </p>
              <p>
                IOM’s standard production rate generally ranges from €{PROJECT_COSTS_META.rateMin}{' '}
                to €{PROJECT_COSTS_META.rateMax} per hour. The applicable rate depends on the
                complexity of the work, required expertise, asset readiness, technical
                uncertainty and requested delivery timeframe.
              </p>
              <p>
                Defined projects may be quoted as fixed stages or with a blended project rate
                rather than by simply multiplying every estimated hour by one rate.
              </p>
              <p>
                Unless specifically included in a quotation, estimates exclude travel,
                photography, scanning, paid assets, third-party software licences, hosting
                charges, taxes and ongoing maintenance.
              </p>
              <p>
                Additional work outside an agreed scope is charged at the rate defined in the
                approved proposal, generally within the €{PROJECT_COSTS_META.rateMin}–€
                {PROJECT_COSTS_META.rateMax} hourly range, unless another arrangement is agreed
                in writing.
              </p>
            </div>
          </aside>

          <section className="pc-section pc-contact" id="contact" aria-labelledby="contact-heading">
            <h2 className="pc-section-title" id="contact-heading">
              Have a project in mind?
            </h2>
            <p className="pc-section-lead">
              Send a short description of the intended audience, required experience, available
              assets and preferred delivery date. IOM will recommend an appropriate starting
              scope and provide a project-specific timeline and budget range.
            </p>
            <p className="pc-section-note">
              A free 30-minute consultation is available for every potential project. For
              selected projects with strong creative, technical, cultural, educational or social
              potential, IOM may also contribute through a reduced fee or a limited number of
              complimentary production hours.
            </p>
            <div className="pc-checklist">
              <p className="pc-checklist-label">Helpful information to include:</p>
              <ul className="pc-list">
                {CONTACT_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <ProjectCostsInquiryForm id="inquiry" defaultKind="consultation" />
            <a className="pc-text-link" href={href(PROJECT_COSTS_META.caseStudiesPath)}>
              View all case studies
            </a>
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
