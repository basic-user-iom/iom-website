import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { getCaseStudyOverlay } from '../i18n/caseStudies'
import { useSiteI18n, type SiteLang } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import './caseStudy.css'

export { isCaseStudyPath } from './paths'

type Stage = {
  id: string
  index: string
  /** Challenge | Solution | Deliverables framework label */
  framework: 'challenge' | 'solution' | 'deliverables'
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
  /** One-line business outcome for B2B readers */
  impact: string
  primaryCta: { label: string; href: string; external?: boolean }
  secondaryCta?: { label: string; href: string }
  stages: Stage[]
  deliverables: string[]
}

const VIEWER_STAGES: Stage[] = [
  {
    id: 'brief',
    index: '01',
    framework: 'challenge',
    title: 'Challenge',
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
    framework: 'solution',
    title: 'Solution — layout',
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
    framework: 'solution',
    title: 'Solution — engineering',
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
    framework: 'deliverables',
    title: 'Deliverables',
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
    framework: 'challenge',
    title: 'Challenge',
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
    framework: 'solution',
    title: 'Solution — tour structure',
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
    framework: 'solution',
    title: 'Solution — engineering',
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
    framework: 'deliverables',
    title: 'Deliverables',
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

const MIAB_STAGES: Stage[] = [
  {
    id: 'brief',
    index: '01',
    framework: 'challenge',
    title: 'Challenge',
    summary: 'A keepsake that has to feel like open water — not a flat skybox.',
    detail:
      'Message in a Bottle needed a browser experience where writing and sealing a note sits inside a believable sea: day/night light, weather, and a bottle you can find and open — without asking guests to install anything.',
    media: {
      type: 'image',
      src: '/assets/blog/message-in-a-bottle/brief.jpg?v=20260731b',
      alt: 'Open-sea horizon mood — the atmospheric brief for Message in a Bottle',
    },
  },
  {
    id: 'wire',
    index: '02',
    framework: 'solution',
    title: 'Solution — experience layout',
    summary: 'Bottle, parchment, and sky controls on one calm composition.',
    detail:
      'We stage the first viewport around the bottle and horizon, then layer composer UI, quality tiers, and time-of-day controls so the narrative stays primary and the tech stays out of the way until someone chooses to explore.',
    media: {
      type: 'image',
      src: '/assets/blog/message-in-a-bottle/wire.jpg?v=20260731b',
      alt: 'Message layout — parchment letter over the open sea with sea and sky controls to the side',
    },
  },
  {
    id: 'engineering',
    index: '03',
    framework: 'solution',
    title: 'Solution — engineering',
    summary: 'WebGPU TSL ocean, sky radiance, and quality-aware clouds.',
    detail:
      'Gerstner swell, domain-warped chop, and a TSL sky with volumetric cloud lods that dial down on Medium/Low. Buoyancy, sea life, and encrypted message packaging stay on the same frame budget as the water.',
    media: {
      type: 'image',
      src: '/assets/blog/message-in-a-bottle/engineering.jpg?v=20260801',
      alt: 'WebGPU open-sea render — Gerstner water, haze, and cloud density controls',
    },
  },
  {
    id: 'final',
    index: '04',
    framework: 'deliverables',
    title: 'Deliverables',
    summary: 'A shareable WebGPU demo guests can open in the browser.',
    detail:
      'Live under /demos/message-in-a-bottle/ — write or receive a sealed note on an open sea with day/night sky, quality presets for real devices, and the craft language of our experiments packaged as a keepsake.',
    media: {
      type: 'image',
      src: '/assets/blog/message-in-a-bottle/final.jpg?v=20260801',
      alt: 'Message in a Bottle — final open-sea scene with foam, haze, and sky',
    },
  },
]

const LABELLED_CURSOR_STAGES: Stage[] = [
  {
    id: 'brief',
    index: '01',
    framework: 'challenge',
    title: 'Challenge',
    summary: 'Interactive media needs a pointer that speaks intent — not a generic arrow.',
    detail:
      'On a portfolio of 3D, video, and 360° work, hover should hint what happens next: VIEW a project, PLAY media, LOOK around a panorama, or ENTER 3D. The system cursor cannot carry that vocabulary without labels and motion that feel native to the brand.',
    media: {
      type: 'image',
      src: '/assets/blog/labelled-custom-cursor/brief.png?v=20260806',
      alt: 'Labelled cursor lab — playground targets and idle usage panel',
    },
  },
  {
    id: 'wire',
    index: '02',
    framework: 'solution',
    title: 'Solution — interaction design',
    summary: 'Markup-driven modes: data-cursor plus optional labels.',
    detail:
      'Targets declare intent in HTML — explore, view, play, look, drag, start, external, link, native. Custom labels (ENTER 3D) override defaults. The lab mirrors production markup so hovering a hit updates a live usage panel with the matching snippet.',
    media: {
      type: 'image',
      src: '/assets/blog/labelled-custom-cursor/wire.png?v=20260806',
      alt: 'ENTER 3D hover — usage panel shows data-cursor explore markup',
    },
  },
  {
    id: 'engineering',
    index: '03',
    framework: 'solution',
    title: 'Solution — engineering',
    summary: 'Precision tip, inertial ring, rAF lerp — no GSAP dependency.',
    detail:
      'A lightweight requestAnimationFrame loop tracks the pointer with a fast tip (~0.55) and a softer ring (~0.16). Target resolution walks the DOM for data-cursor / anchors / inputs; touch and form fields fall back to the native cursor so typing stays usable.',
    media: {
      type: 'image',
      src: '/assets/blog/labelled-custom-cursor/engineering.png?v=20260806',
      alt: 'LOOK mode active — code panel syncs to panorama data-cursor markup',
    },
  },
  {
    id: 'final',
    index: '04',
    framework: 'deliverables',
    title: 'Deliverables',
    summary: 'A shareable labelled lab — and a quieter focus orb on the live site.',
    detail:
      'Live under /demos/custom-cursor-labelled/ with a parked source snapshot. Homepage cards ship a calm cyan focus orb; the labelled set stays available for demos, CTAs, transport controls, and external links where a word or glyph still helps.',
    media: {
      type: 'image',
      src: '/assets/blog/labelled-custom-cursor/final.png?v=20260806',
      alt: 'Labelled custom cursor demo — playground and live usage code panel',
    },
  },
]

const STUDIES: Record<string, CaseStudySpec> = {
  '3d-viewer': {
    slug: '3d-viewer',
    eyebrow: 'Case study · Software',
    title: '3D Viewer — challenge to deliverables',
    lead: 'How IOM turns a review problem into a shippable product: wire the chrome, harden the pipeline, then hand clients a link they can open on a call.',
    impact:
      'Stakeholders review complex models in the browser — no CAD seat required — so design and sales decisions move on shared calls instead of stalled file handoffs.',
    primaryCta: {
      label: 'Open live viewer',
      href: 'https://3dbviewer.com/',
      external: true,
    },
    secondaryCta: { label: 'Technical write-up', href: '/blog/3d-viewer' },
    stages: VIEWER_STAGES,
    deliverables: [
      'Browser 3D viewer (orbit, HDR environments, hotspots)',
      'Windows desktop build for offline review',
      'Multi-format load path (GLTF, FBX, OBJ, IFC, and more)',
      'Streets GL / OSM city-context bridge for location pitches',
      'Exportable standalone web presentation',
    ],
  },
  'black-witness': {
    slug: 'black-witness',
    eyebrow: 'Case study · 360°',
    title: 'The Black Witness — challenge to 360°',
    lead: 'How a photography series becomes a guided WebGPU panorama tour — hotspots, effect layers, and a visitor preview clients can share.',
    impact:
      'Clients share a guided 360° walkthrough by URL — no install — so stakeholders experience the narrative on any device and return feedback before the next shoot or launch.',
    primaryCta: {
      label: 'Open visitor tour',
      href: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
    },
    secondaryCta: { label: 'Technical write-up', href: '/blog/panorama-suite' },
    stages: BLACK_WITNESS_STAGES,
    deliverables: [
      'Guided 360° visitor preview (shareable URL, no install)',
      'Hotspot storyboard (info, scene links, popups)',
      'WebGPU effect layers (particles, spout, compute birds)',
      'Portable `.360project` save format for editor ↔ preview',
      'Deep-link first frame (yaw / pitch) for client walkthroughs',
    ],
  },
  'message-in-a-bottle': {
    slug: 'message-in-a-bottle',
    eyebrow: 'Case study · WebGPU',
    title: 'Message in a Bottle — challenge to open sea',
    lead: 'How IOM builds a browser keepsake on live water: stage the bottle and parchment, harden a WebGPU ocean and sky, then ship a demo guests can open without an install.',
    impact:
      'Clients and guests experience an interactive keepsake in the browser — day/night sea, sealed notes, and device-aware quality — so narrative demos feel real enough to present, not just describe.',
    primaryCta: {
      label: 'Open live demo',
      href: '/demos/message-in-a-bottle/',
    },
    secondaryCta: { label: 'Browse experiments', href: '/#experiments' },
    stages: MIAB_STAGES,
    deliverables: [
      'Shareable WebGPU open-sea demo (no install)',
      'Bottle + parchment composer with sealed / encrypted notes',
      'TSL Gerstner ocean with foam, buoyancy, and sea life',
      'Day/night sky with quality-aware volumetric clouds',
      'Low / Medium / High presets tuned for real devices',
    ],
  },
  'labelled-custom-cursor': {
    slug: 'labelled-custom-cursor',
    eyebrow: 'Case study · Interaction',
    title: 'Labelled custom cursor — challenge to lab',
    lead: 'How IOM designs a context-aware pointer: declare intent in markup, animate tip and ring with a light rAF loop, then park a labelled lab while the live site stays quiet.',
    impact:
      'Visitors get clear hover affordances on interactive media — VIEW, PLAY, LOOK, ENTER 3D — so demos and CTAs communicate before the click, without fighting native text inputs or touch devices.',
    primaryCta: {
      label: 'Open live lab',
      href: '/demos/custom-cursor-labelled/',
    },
    secondaryCta: { label: 'Browse experiments', href: '/#experiments' },
    stages: LABELLED_CURSOR_STAGES,
    deliverables: [
      'Shareable labelled cursor lab (playground + live usage panel)',
      'data-cursor / data-cursor-label markup vocabulary',
      'Precision tip + inertial ring (rAF lerp, no GSAP)',
      'Native fallback for touch, forms, and coarse pointers',
      'Production quiet focus orb on homepage cards; labelled modes for CTAs & media',
    ],
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
    impact: overlay.impact ?? spec.impact,
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
    deliverables: overlay.deliverables ?? spec.deliverables,
  }
}

function frameworkLabel(
  framework: Stage['framework'],
  t: (key: string) => string,
): string {
  if (framework === 'challenge') return t('case.challenge')
  if (framework === 'deliverables') return t('case.deliverables')
  return t('case.solution')
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
        <p className="case-study-impact">
          <span className="case-study-impact-label">{t('case.impact')}</span>
          {localized.impact}
        </p>
        <ul className="case-study-framework" aria-label={t('case.frameworkAria')}>
          <li>{t('case.challenge')}</li>
          <li>{t('case.solution')}</li>
          <li>{t('case.deliverables')}</li>
        </ul>
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
          <a className="btn btn-ghost" href={href('/#contact')} data-cursor="start">
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
                <span className="case-study-stage-framework">
                  {frameworkLabel(stage.framework, t)}
                </span>
                <span className="case-study-stage-title">{stage.title}</span>
                <span className="case-study-stage-summary">{stage.summary}</span>
              </span>
            </button>
          ))}
        </nav>

        <article className="case-study-panel" aria-live="polite">
          <p className="case-study-panel-index">
            {t('case.stageMeta', {
              index: active.index,
              title: frameworkLabel(active.framework, t),
            })}
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

      <section className="case-study-deliverables" aria-labelledby="case-deliverables-heading">
        <h2 id="case-deliverables-heading">{t('case.deliverablesHeading')}</h2>
        <ul>
          {localized.deliverables.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="case-study-cta" aria-labelledby="case-study-cta-heading">
        <h2 id="case-study-cta-heading">{t('case.ctaTitle')}</h2>
        <p>{t('case.ctaText')}</p>
        <div className="case-study-hero-actions" style={{ justifyContent: 'center' }}>
          <a className="btn btn-primary" href={href('/#contact')} data-cursor="start">
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
                <a className="btn btn-ghost" href={href('/case-studies/message-in-a-bottle')}>
                  {localizeSpec(STUDIES['message-in-a-bottle']!, lang).title}
                </a>
                <a className="btn btn-ghost" href={href('/case-studies/labelled-custom-cursor')}>
                  {localizeSpec(STUDIES['labelled-custom-cursor']!, lang).title}
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
