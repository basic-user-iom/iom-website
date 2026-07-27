import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { getCaseStudyOverlay } from '../i18n/caseStudies'
import { useSiteI18n, type SiteLang } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import './caseStudy.css'

export function isCaseStudyPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/case-studies' || p.startsWith('/case-studies/')
}

type Stage = {
  id: string
  index: string
  title: string
  summary: string
  detail: string
  media: { type: 'image' | 'video'; src: string; alt: string }
}

type CaseStudySpec = {
  slug: string
  eyebrow: string
  title: string
  lead: string
  primaryCta: { label: string; href: string; external?: boolean }
  secondaryCta?: { label: string; href: string }
  stages: Stage[]
}

const VIEWER_STAGES: Stage[] = [
  {
    id: 'brief',
    index: '01',
    title: 'Brief',
    summary: 'Stakeholders need to review 3D without a CAD seat.',
    detail:
      'The hiring problem: share a model on a call, not a ZIP. Formats vary (GLTF, FBX, OBJ, IFC), and lighting or city context often sells the pitch as much as the mesh itself.',
    media: {
      type: 'image',
      src: '/assets/posters/3d-viewer.jpg',
      alt: '3D Viewer product poster — orbit chrome around a lit model',
    },
  },
  {
    id: 'wire',
    index: '02',
    title: 'Layout & review chrome',
    summary: 'Panels, orbit, and a path from open → understand → decide.',
    detail:
      'We shape the interface around review, not authorship: frame the asset, switch environments, and keep hotspots and export paths obvious. Desktop and web share the same mental model.',
    media: {
      type: 'video',
      src: '/assets/blog/3d-viewer/walkthrough.webm',
      alt: 'Product walkthrough — orbit, HDR lighting, and viewer chrome',
    },
  },
  {
    id: 'engineering',
    index: '03',
    title: 'Engineering',
    summary: 'Three.js pipeline, HDR ground projection, Streets GL bridge.',
    detail:
      'Real client pipelines need format coverage, reliable city-context sync, and texture restore when leaving Product ↔ City modes. The engineering story is reliability under messy assets — not a demo void.',
    media: {
      type: 'image',
      src: '/assets/blog/3d-viewer/view-b.jpg',
      alt: 'OSM 3D / Streets GL city context inside the viewer',
    },
  },
  {
    id: 'final',
    index: '04',
    title: 'Final WebGL',
    summary: 'Shareable browser review and Windows desktop builds.',
    detail:
      'Live at 3dbviewer.com — orbit under 360° HDR with ground projection, or drop into Streets GL when location is the story. Same craft language as our experiments, packaged for decisions.',
    media: {
      type: 'image',
      src: '/assets/blog/3d-viewer/view-a.jpg',
      alt: '360° HDR with ground projection — product lit by the environment plate',
    },
  },
]

const BLACK_WITNESS_STAGES: Stage[] = [
  {
    id: 'brief',
    index: '01',
    title: 'Brief',
    summary: 'A raven story that guests can walk, not just watch.',
    detail:
      'The Black Witness began as a photography series. The client-shaped problem: turn that atmosphere into a guided 360° experience — look around, click to learn, share a link without installing an app.',
    media: {
      type: 'image',
      src: '/assets/photos/the-black-witness/photo-0.webp',
      alt: 'The Black Witness — rooftop raven still that seeds the 360 narrative',
    },
  },
  {
    id: 'wire',
    index: '02',
    title: 'Tour structure',
    summary: 'Hotspots, guided stops, and a visitor preview path.',
    detail:
      'We author camera beats and hotspot types (info, scene links, popups) so the tour reads as a storyboard. Editor and visitor preview share one project file — build once, share a clean preview URL.',
    media: {
      type: 'image',
      src: '/assets/blog/_panorama-tour-steps/step-1.jpg',
      alt: 'Guided tour step 1 — raven hotspot and popup on The Black Witness',
    },
  },
  {
    id: 'engineering',
    index: '03',
    title: 'Engineering',
    summary: 'Equirectangular sphere, WebGPU effect layers, project save format.',
    detail:
      'Panoramas map onto a sphere camera; guided steps layer particles, spout/water, and compute birds timed to hotspots. `.360project` keeps scenes, stops, and effects portable between sessions.',
    media: {
      type: 'image',
      src: '/assets/blog/panorama-360-tour/view-a.jpg',
      alt: 'Step 2 — particle / fire hotspot beat inside the panorama tour',
    },
  },
  {
    id: 'final',
    index: '04',
    title: 'Final 360°',
    summary: 'Shareable visitor preview — no editor chrome.',
    detail:
      'Clients open a deep-linked preview (yaw / pitch locked for a shared first frame), play the guided tour, or explore hotspots freely. Same engine as the editor — packaged for guests.',
    media: {
      type: 'image',
      src: '/assets/blog/panorama-360-tour/view-c.jpg',
      alt: 'Step 4 — birds layer and storm-sky beat on The Black Witness',
    },
  },
]

const STUDIES: Record<string, CaseStudySpec> = {
  '3d-viewer': {
    slug: '3d-viewer',
    eyebrow: 'Case study · Software',
    title: '3D Viewer — from brief to WebGL',
    lead: 'How IOM turns a review problem into a shippable product: wire the chrome, harden the pipeline, then hand clients a link they can open on a call.',
    primaryCta: {
      label: 'Open live viewer',
      href: 'https://3dbviewer.com/',
      external: true,
    },
    secondaryCta: { label: 'Technical write-up', href: '/blog/3d-viewer' },
    stages: VIEWER_STAGES,
  },
  'black-witness': {
    slug: 'black-witness',
    eyebrow: 'Case study · 360°',
    title: 'The Black Witness — from brief to 360°',
    lead: 'How a photography series becomes a guided WebGPU panorama tour — hotspots, effect layers, and a visitor preview clients can share.',
    primaryCta: {
      label: 'Open visitor tour',
      href: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
    },
    secondaryCta: { label: 'Technical write-up', href: '/blog/panorama-suite' },
    stages: BLACK_WITNESS_STAGES,
  },
}

function localizeSpec(spec: CaseStudySpec, lang: SiteLang): CaseStudySpec {
  const overlay = getCaseStudyOverlay(lang, spec.slug)
  if (!overlay) return spec

  return {
    ...spec,
    eyebrow: overlay.eyebrow ?? spec.eyebrow,
    title: overlay.title ?? spec.title,
    lead: overlay.lead ?? spec.lead,
    primaryCta: {
      ...spec.primaryCta,
      label: overlay.primaryCtaLabel ?? spec.primaryCta.label,
    },
    secondaryCta: spec.secondaryCta
      ? {
          ...spec.secondaryCta,
          label: overlay.secondaryCtaLabel ?? spec.secondaryCta.label,
        }
      : undefined,
    stages: spec.stages.map((stage) => {
      const so = overlay.stages?.[stage.id]
      if (!so) return stage
      return {
        ...stage,
        title: so.title ?? stage.title,
        summary: so.summary ?? stage.summary,
        detail: so.detail ?? stage.detail,
        media: {
          ...stage.media,
          alt: so.mediaAlt ?? stage.media.alt,
        },
      }
    }),
  }
}

function CaseStudyView({ spec }: { spec: CaseStudySpec }) {
  const { t, href, lang } = useSiteI18n()
  const localized = useMemo(() => localizeSpec(spec, lang), [spec, lang])
  const [activeId, setActiveId] = useState(localized.stages[0]?.id ?? '')
  const active = localized.stages.find((s) => s.id === activeId) ?? localized.stages[0]

  useEffect(() => {
    applyPageMeta(`/case-studies/${spec.slug}`, lang)
  }, [spec.slug, lang])

  useEffect(() => {
    setActiveId(localized.stages[0]?.id ?? '')
  }, [spec.slug, localized.stages])

  if (!active) return null

  return (
    <div className="case-study-page">
      <header className="case-study-hero">
        <p className="case-study-eyebrow">{localized.eyebrow}</p>
        <h1 className="case-study-title">{localized.title}</h1>
        <p className="case-study-lead">{localized.lead}</p>
        <div className="case-study-hero-actions">
          <a
            className="btn btn-primary"
            href={localized.primaryCta.href}
            {...(localized.primaryCta.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {localized.primaryCta.label}
          </a>
          {localized.secondaryCta ? (
            <a className="btn btn-ghost" href={localized.secondaryCta.href}>
              {localized.secondaryCta.label}
            </a>
          ) : null}
          <a className="btn btn-ghost" href={href('/#contact')}>
            {t('case.hireUs')}
          </a>
        </div>
      </header>

      <div className="case-study-layout">
        <nav className="case-study-stages" aria-label={t('case.stagesAria')}>
          {localized.stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={`case-study-stage-btn${stage.id === activeId ? ' is-active' : ''}`}
              aria-current={stage.id === activeId ? 'step' : undefined}
              onClick={() => setActiveId(stage.id)}
            >
              <span className="case-study-stage-index">{stage.index}</span>
              <span className="case-study-stage-label">
                <span className="case-study-stage-title">{stage.title}</span>
                <span className="case-study-stage-summary">{stage.summary}</span>
              </span>
            </button>
          ))}
        </nav>

        <article className="case-study-panel" aria-live="polite">
          <p className="case-study-panel-index">
            {t('case.stageMeta', { index: active.index, title: active.title })}
          </p>
          <h2 className="case-study-panel-title">{active.summary}</h2>
          <p className="case-study-panel-detail">{active.detail}</p>
          <figure className="case-study-media">
            {active.media.type === 'video' ? (
              <video
                key={active.media.src}
                className="case-study-media-el"
                src={active.media.src}
                autoPlay
                muted
                loop
                playsInline
                controls
                aria-label={active.media.alt}
              />
            ) : (
              <img
                key={active.media.src}
                className="case-study-media-el"
                src={active.media.src}
                alt={active.media.alt}
                loading="eager"
                decoding="async"
              />
            )}
            <figcaption>{active.media.alt}</figcaption>
          </figure>
        </article>
      </div>

      <section className="case-study-cta" aria-labelledby="case-study-cta-heading">
        <h2 id="case-study-cta-heading">{t('case.ctaTitle')}</h2>
        <p>{t('case.ctaText')}</p>
        <div className="case-study-hero-actions" style={{ justifyContent: 'center' }}>
          <a className="btn btn-primary" href={href('/#contact')}>
            {t('nav.contact')}
          </a>
          <a className="btn btn-ghost" href={href('/#360')}>
            {t('case.allCaseStudies')}
          </a>
        </div>
      </section>
    </div>
  )
}

export function CaseStudyApp({ path: pathProp }: { path?: string } = {}) {
  const { t, href, lang } = useSiteI18n()
  const [pathState, setPath] = useState(
    () => pathProp ?? (window.location.pathname.replace(/\/+$/, '') || '/'),
  )

  useEffect(() => {
    if (pathProp) {
      setPath(pathProp)
      return
    }
    const sync = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/')
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [pathProp])

  const path = pathProp ?? pathState
  const slug = path.replace(/^\/case-studies\/?/, '').replace(/\/+$/, '')
  const spec = slug ? STUDIES[slug] : null

  useEffect(() => {
    if (spec) return
    applyPageMeta(path === '/case-studies' ? '/case-studies' : path, lang)
    document.title = t('seo.caseStudiesTitle')
  }, [path, spec, lang, t])

  return (
    <>
      <Header />
      <main id="main-content" className="case-study-main">
        {spec ? (
          <CaseStudyView spec={spec} />
        ) : (
          <div className="case-study-page">
            <header className="case-study-hero">
              <h1 className="case-study-title">{t('case.listTitle')}</h1>
              <p className="case-study-lead">{t('case.listLead')}</p>
              <div className="case-study-hero-actions">
                <a className="btn btn-primary" href={href('/case-studies/3d-viewer')}>
                  {localizeSpec(STUDIES['3d-viewer']!, lang).title}
                </a>
                <a className="btn btn-ghost" href={href('/case-studies/black-witness')}>
                  {localizeSpec(STUDIES['black-witness']!, lang).title}
                </a>
              </div>
            </header>
            <p className="case-study-missing">
              {t('case.orReturn')}{' '}
              <a href={href('/#360')}>{t('case.archive')}</a> /{' '}
              <a href={href('/#contact')}>{t('case.contactStudio')}</a>.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
