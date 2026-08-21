import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { APPLICATIONS } from './data/applications'
import { img } from './data/media'
import { PROJECTS } from './data/projects'
import { RESOURCES } from './data/resources'
import { CONTACT, QUOTES } from './data/site'
import { SYSTEMS, type SystemId } from './data/systems'
import { HeroMedia } from './HeroMedia'
import { usePrefersReducedMotion, useScrollProgress } from './hooks'
import { pickLocale } from './i18n/locale'
import { useLocale } from './i18n/LocaleContext'
import { IncisionPattern } from './IncisionPattern'
import { MaskImage } from './MaskImage'
import { LINAR_CONFIGURATOR_HREF, openLinarConfigurator } from './openLinar'
import { navigate } from './router'

function SectionIntro({
  kicker,
  title,
  children,
}: {
  kicker?: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="dk-intro">
      {kicker ? <p className="dk-kicker">{kicker}</p> : null}
      <h2>{title}</h2>
      {children}
    </header>
  )
}

function Hero() {
  const { t } = useLocale()
  return (
    <section className="dk-hero" aria-label={t.a11y.introduction}>
      <HeroMedia />
      <div className="dk-hero__veil" aria-hidden="true" />
      <div className="dk-hero__copy">
        <p className="dk-kicker">{t.hero.kicker}</p>
        <h1>{t.hero.title}</h1>
        <p className="dk-hero__lead">{t.hero.lead}</p>
      </div>
      <p className="dk-hero__scroll" aria-hidden="true">
        {t.hero.scroll}
      </p>
    </section>
  )
}

function Principle() {
  const { t } = useLocale()
  const steps: Array<{
    label: string
    image: string
    webp?: string
    alt: string
    width?: number
    height?: number
    sizes?: string
  }> = [
    { label: t.principle.steps[0], image: img.linarSample, alt: t.principle.alts[0] },
    {
      label: t.principle.steps[1],
      image: img.linarFront,
      webp: img.linarFrontWebp,
      alt: t.principle.alts[1],
      width: 1024,
      height: 768,
      sizes: '(min-width: 900px) 18vw, 45vw',
    },
    {
      label: t.principle.steps[2],
      image: img.technical.pattern,
      alt: t.principle.alts[2],
      width: 943,
      height: 1280,
    },
    {
      label: t.principle.steps[3],
      image: img.linarBendDetail,
      alt: t.principle.alts[3],
      width: 2000,
      height: 1208,
      sizes: '(min-width: 900px) 18vw, 45vw',
    },
    {
      label: t.principle.steps[4],
      image: img.applications.spruce,
      alt: t.principle.alts[4],
    },
  ]

  return (
    <section className="dk-section dk-principle" id="material">
      <div className="dk-container">
        <SectionIntro title={t.principle.title}>
          <p>{t.principle.body}</p>
        </SectionIntro>
        <ol className="dk-principle__steps">
          {steps.map((step, index) => (
            <li key={step.label} className="dk-principle__step">
              <span className="dk-principle__index">{String(index + 1).padStart(2, '0')}</span>
              <MaskImage
                src={step.image}
                webp={step.webp}
                alt={step.alt}
                width={step.width}
                height={step.height}
                sizes={step.sizes}
                reveal="crop"
              />
              <p>{step.label}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Transform() {
  const { t } = useLocale()
  const ref = useRef<HTMLElement>(null)
  const progress = useScrollProgress(ref)
  const reduced = usePrefersReducedMotion()
  const p = reduced ? 0.65 : progress

  const stage =
    p < 0.18 ? 'flat' : p < 0.36 ? 'cut' : p < 0.54 ? 'open' : p < 0.74 ? 'bend' : 'form'

  return (
    <section className="dk-transform" ref={ref} aria-label={t.a11y.materialTransform}>
      <div className="dk-transform__sticky">
        <div className="dk-transform__stage" data-stage={stage}>
          <div className="dk-transform__panel" style={{ '--p': String(p) } as CSSProperties}>
            <IncisionPattern
              kind="linar"
              openness={0.25 + p * 0.7}
              className="dk-transform__cuts"
              underlay="#2f2a26"
            />
            {/* Authentic flat LINAR panel — official source is 1024×768; keep, do not substitute */}
            <picture>
              <source srcSet={img.linarFrontWebp} type="image/webp" />
              <img
                src={img.linarFront}
                alt=""
                aria-hidden="true"
                className="dk-transform__face"
                width={1024}
                height={768}
                sizes="(min-width: 960px) min(42vw, 1024px), min(86vw, 1024px)"
                decoding="async"
              />
            </picture>
            {/* Mid scroll: hi-res flexible ribbon (open / flex) */}
            <picture>
              <source srcSet={img.flexibleRibbonWebp} type="image/webp" />
              <img
                src={img.flexibleRibbon}
                alt=""
                aria-hidden="true"
                className="dk-transform__ribbon"
                width={2000}
                height={1331}
                sizes="(min-width: 960px) min(55vw, 1100px), 92vw"
                decoding="async"
              />
            </picture>
            {/* Bend: official 2000px close-up */}
            <picture>
              <source srcSet={img.linarBendHiWebp} type="image/webp" />
              <img
                src={img.linarBendHi}
                alt=""
                aria-hidden="true"
                className="dk-transform__bend"
                width={2000}
                height={1333}
                sizes="(min-width: 960px) min(55vw, 1100px), 92vw"
                decoding="async"
              />
            </picture>
            <div className="dk-transform__light" />
            {/* Form: Toni Konzertsaal application (2000px) */}
            <img
              src={img.hero}
              alt=""
              aria-hidden="true"
              className="dk-transform__arch"
              width={2000}
              height={1333}
              sizes="(min-width: 960px) min(55vw, 1100px), 92vw"
              decoding="async"
            />
          </div>
          <div className="dk-transform__caption">
            <p className="dk-kicker">{t.transform.kicker}</p>
            <h2>{t.transform[stage]}</h2>
            <p>{t.transform.body}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Systems() {
  const { t } = useLocale()
  const [active, setActive] = useState<SystemId>('linar')
  const system = useMemo(() => SYSTEMS.find((s) => s.id === active) ?? SYSTEMS[1], [active])
  const copy = t.systems.items[system.id]

  return (
    <section className="dk-section dk-systems" id="systems">
      <div className="dk-container">
        <SectionIntro kicker={t.systems.kicker} title={t.systems.title}>
          <p>{t.systems.intro}</p>
        </SectionIntro>

        <div className="dk-systems__layout">
          <div className="dk-systems__tabs" role="tablist" aria-label={t.systems.kicker}>
            {SYSTEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === active}
                className={item.id === active ? 'is-active' : undefined}
                onClick={() => setActive(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="dk-systems__stage" role="tabpanel">
            <div className="dk-systems__visual">
              <IncisionPattern
                kind={system.pattern}
                className="dk-systems__overlay"
                openness={0.48}
                underlay="#e8e0d4"
              />
              <MaskImage
                key={system.id}
                src={system.image}
                alt={copy.imageAlt}
                reveal="incision"
                eager
                className="dk-systems__photo"
              />
            </div>
            <div className="dk-systems__copy">
              <p className="dk-kicker">{system.name}</p>
              <h3>{system.name}</h3>
              <p>{copy.definition}</p>
              <dl className="dk-spec">
                <div>
                  <dt>{t.systems.materials}</dt>
                  <dd>{copy.materials}</dd>
                </div>
                <div>
                  <dt>{t.systems.incision}</dt>
                  <dd>{copy.incision}</dd>
                </div>
                <div>
                  <dt>{t.systems.minRadius}</dt>
                  <dd>{system.minRadius}</dd>
                </div>
                <div>
                  <dt>{t.systems.openArea}</dt>
                  <dd>{system.openArea}</dd>
                </div>
                <div>
                  <dt>{t.systems.dimensions}</dt>
                  <dd>{copy.dimensions}</dd>
                </div>
              </dl>
              {system.configurator ? (
                <a className="dk-link" href={LINAR_CONFIGURATOR_HREF} onClick={openLinarConfigurator}>
                  {t.systems.configure}
                </a>
              ) : null}
              {copy.notes ? <p className="dk-note">{copy.notes}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Visual-only teaser: vertical strips approximate a paper-like center arch. */
const LINAR_TEASER_STRIPS = 16

function LinarTeaserPanel({ openness, bend }: { openness: number; bend: number }) {
  // Outer curve opens the cuts a little further as the sheet arches.
  const cutOpenness = Math.min(0.95, openness * (1 + bend * 0.32))

  const strips = useMemo(() => {
    // Half-wrap angle at full bend (~50°). Cylinder with apex toward the camera.
    const maxPhi = bend * 0.88
    return Array.from({ length: LINAR_TEASER_STRIPS }, (_, i) => {
      const u = (i + 0.5) / LINAR_TEASER_STRIPS - 0.5
      const phi = u * 2 * maxPhi
      const angleDeg = (phi * 180) / Math.PI
      // Cosine bowl: center closest to viewer, ends fall back — convex arch.
      const z = bend * 56 * (Math.cos(phi) - (maxPhi > 1e-4 ? Math.cos(maxPhi) : 1))
      // Slight lift so the silhouette reads as a bridge / upside-down U.
      const y = -bend * 12 * Math.cos(u * Math.PI)
      return {
        transform: `translate3d(0, ${y}px, ${z}px) rotateY(${angleDeg}deg)`,
      }
    })
  }, [bend])

  return (
    <div
      className="dk-linar__panel"
      style={
        {
          '--open': String(openness),
          '--bend': String(bend),
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="dk-linar__stage">
        {strips.map((style, i) => (
          <div key={i} className="dk-linar__strip" style={style}>
            <div
              className="dk-linar__strip-face"
              style={{
                width: `${LINAR_TEASER_STRIPS * 100}%`,
                transform: `translateX(${(-i / LINAR_TEASER_STRIPS) * 100}%)`,
              }}
            >
              <IncisionPattern
                kind="linar"
                openness={cutOpenness}
                className="dk-linar__cuts"
                underlay="#ddd4c6"
              />
              <img
                className="dk-linar__photo"
                src={img.linarVeneer}
                alt=""
                width={1024}
                height={768}
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LinarTeaser() {
  const { t } = useLocale()
  const [openness, setOpenness] = useState(0.45)
  const [bend, setBend] = useState(0.35)

  return (
    <section className="dk-section dk-linar" id="configure">
      <div className="dk-container dk-linar__grid">
        <div>
          <SectionIntro kicker={t.linar.kicker} title={t.linar.title}>
            <p>{t.linar.body}</p>
          </SectionIntro>
          <div className="dk-linar__controls">
            <label>
              <span>{t.linar.opening}</span>
              <input
                type="range"
                min={0.15}
                max={0.9}
                step={0.01}
                value={openness}
                onChange={(e) => setOpenness(Number(e.target.value))}
              />
            </label>
            <label>
              <span>{t.linar.bend}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={bend}
                onChange={(e) => setBend(Number(e.target.value))}
              />
            </label>
          </div>
          <a className="dk-button" href={LINAR_CONFIGURATOR_HREF} onClick={openLinarConfigurator}>
            {t.linar.openConfigurator}
          </a>
          <p className="dk-note">{t.linar.note}</p>
        </div>
        <LinarTeaserPanel openness={openness} bend={bend} />
      </div>
    </section>
  )
}

function Applications() {
  const { t } = useLocale()

  return (
    <section className="dk-section dk-apps" id="applications">
      <div className="dk-container">
        <SectionIntro kicker={t.applications.kicker} title={t.applications.title} />
        <div className="dk-apps__list">
          {APPLICATIONS.map((app, index) => {
            const copy = t.applications.items[app.id]
            return (
              <article
                key={app.id}
                className={`dk-apps__item dk-apps__item--${app.layout}${index % 2 ? ' is-alt' : ''}`}
              >
                <MaskImage src={app.image} alt={copy.alt} reveal={index % 2 ? 'crop' : 'incision'} />
                <div>
                  <p className="dk-kicker">{String(index + 1).padStart(2, '0')}</p>
                  <h3>{copy.title}</h3>
                  <p>{copy.copy}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FeaturedProjects() {
  const { t } = useLocale()
  const featured = PROJECTS.filter((p) => p.featured).slice(0, 7)

  return (
    <section className="dk-section dk-projects" id="projects-home">
      <div className="dk-container">
        <div className="dk-projects__head">
          <SectionIntro kicker={t.projects.kicker} title={t.projects.title} />
          <a
            className="dk-link"
            href="/demos/dukta/projects"
            onClick={(e) => {
              e.preventDefault()
              navigate('/demos/dukta/projects')
            }}
          >
            {t.actions.allProjects}
          </a>
        </div>
        <div className="dk-project-grid">
          {featured.map((project) => (
            <a
              key={project.slug}
              className={`dk-project-card dk-project-card--${project.span}`}
              href={`/demos/dukta/projects#${project.slug}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/demos/dukta/projects#${project.slug}`)
              }}
            >
              <MaskImage src={project.image} alt="" reveal="none" />
              <div className="dk-project-card__meta">
                <h3>{project.title}</h3>
                <p>
                  {project.system.toUpperCase()} · {t.projects.filters[project.application]} ·{' '}
                  {project.location}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Acoustics() {
  const { t } = useLocale()

  return (
    <section className="dk-section dk-acoustics" id="acoustics">
      <div className="dk-container dk-acoustics__grid">
        <SectionIntro kicker={t.acoustics.kicker} title={t.acoustics.title}>
          <p>{t.acoustics.body}</p>
          <p className="dk-note">{t.acoustics.note}</p>
        </SectionIntro>
        <div className="dk-acoustics__compare">
          <figure>
            <MaskImage
              src={img.linarFront}
              webp={img.linarFrontWebp}
              alt={t.acoustics.flatAlt}
              width={1024}
              height={768}
              sizes="(min-width: 900px) 28vw, 90vw"
              reveal="crop"
            />
            <figcaption>{t.acoustics.flat}</figcaption>
          </figure>
          <figure>
            <MaskImage
              src={img.applications.acoustic}
              alt={t.acoustics.formedAlt}
              reveal="incision"
            />
            <figcaption>{t.acoustics.formed}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}

function PressQuotes() {
  const { t } = useLocale()

  return (
    <section className="dk-section dk-press" id="press" aria-labelledby="dk-press-heading">
      <div className="dk-container">
        <h2 id="dk-press-heading" className="dk-sr">
          {t.press.kicker}
        </h2>
        <ul className="dk-press__grid">
          {t.press.quotes.map((quote) => (
            <li key={quote.attribution}>
              <blockquote className="dk-press__quote">
                <p>{quote.text}</p>
                <cite>— {quote.attribution}</cite>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Origin() {
  const { locale, t } = useLocale()
  const quote = QUOTES[locale]

  return (
    <section className="dk-section dk-origin" id="about">
      <div className="dk-container dk-origin__grid">
        <MaskImage src={img.dasMaterial} alt={t.origin.imageAlt} reveal="crop" />
        <div>
          <SectionIntro kicker={t.origin.kicker} title={t.origin.title}>
            <p>{t.origin.p1}</p>
            <p>{t.origin.p2}</p>
            <p>{t.origin.p3}</p>
          </SectionIntro>
          <blockquote className="dk-quote">
            <p>{quote.text}</p>
            <cite>{quote.source}</cite>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

function Resources() {
  const { locale, t } = useLocale()

  return (
    <section className="dk-section dk-resources" id="resources">
      <div className="dk-container">
        <SectionIntro kicker={t.resources.kicker} title={t.resources.title}>
          <p>{t.resources.intro}</p>
        </SectionIntro>
        <ul className="dk-resource-list">
          {RESOURCES.map((item) => {
            const copy = t.resources.items[item.id]
            const systemLabel = item.system === 'all' ? t.resources.allSystems : item.system
            return (
              <li key={item.id}>
                <a href={pickLocale(item.href, locale)} target="_blank" rel="noreferrer">
                  <span className="dk-resource-list__title">{copy.title}</span>
                  <span className="dk-resource-list__meta">
                    {t.resources.categories[item.category]} · {systemLabel} ·{' '}
                    {t.resources.types[item.type]}
                  </span>
                  {copy.note ? <span className="dk-resource-list__note">{copy.note}</span> : null}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function Contact() {
  const { locale, t } = useLocale()
  const address = CONTACT.address[locale]

  return (
    <section className="dk-section dk-contact" id="contact">
      <div className="dk-container dk-contact__grid">
        <div>
          <SectionIntro title={t.contact.title}>
            <p>{t.contact.body}</p>
          </SectionIntro>
          <div className="dk-contact__routes">
            <a href={CONTACT.samplesHref[locale]} target="_blank" rel="noreferrer">
              {t.contact.samples}
            </a>
            <a href={LINAR_CONFIGURATOR_HREF} onClick={openLinarConfigurator}>
              {t.contact.configure}
            </a>
            <a href={`mailto:${CONTACT.email}`}>{t.contact.questions}</a>
          </div>
        </div>
        <address className="dk-contact__card">
          <p className="dk-kicker">{CONTACT.company}</p>
          {address.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
          <div className="dk-contact__people">
            {CONTACT.people.map((person) => (
              <p key={person.email}>
                <strong>{person.name}</strong>
                <br />
                <a href={`tel:${person.phone.replace(/\s/g, '')}`}>{person.phone}</a>
                <br />
                <a href={`mailto:${person.email}`}>{person.email}</a>
              </p>
            ))}
          </div>
        </address>
      </div>
    </section>
  )
}

export function HomePage() {
  return (
    <main id="main">
      <Hero />
      <Principle />
      <Transform />
      <Systems />
      <LinarTeaser />
      <Applications />
      <FeaturedProjects />
      <Acoustics />
      <PressQuotes />
      <Origin />
      <Resources />
      <Contact />
    </main>
  )
}
