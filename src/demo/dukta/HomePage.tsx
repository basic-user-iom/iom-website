import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
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

/** Visual-only teaser: one canvas surface, cylindrical arch (not CSS strips). */
const LINAR_TEASER_SLICES = 160

function coverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  w: number,
  h: number,
  nw: number,
  nh: number,
) {
  const ir = nw / nh
  const cr = w / h
  let dw: number
  let dh: number
  let dx: number
  let dy: number
  if (ir > cr) {
    dh = h
    dw = h * ir
    dx = (w - dw) / 2
    dy = 0
  } else {
    dw = w
    dh = w / ir
    dx = 0
    dy = (h - dh) / 2
  }
  ctx.drawImage(image, dx, dy, dw, dh)
  return { dx, dy, dw, dh }
}

/**
 * Carve openings into the bitmap (UV space) so they warp with the sheet.
 * Grooves run across the panel — after the arch warp they follow the fold,
 * instead of reading as a flat vertical stamp on hands/product.
 */
function stampLinarOpenings(
  ctx: CanvasRenderingContext2D,
  openness: number,
  bounds: { dx: number; dy: number; dw: number; dh: number },
) {
  const { dx, dy, dw, dh } = bounds
  if (dw < 8 || dh < 8) return

  const insetX = Math.max(2, dw * 0.05)
  const insetY = Math.max(2, dh * 0.06)
  const x0 = dx + insetX
  const y0 = dy + insetY
  const iw = dw - insetX * 2
  const ih = dh - insetY * 2
  if (iw < 4 || ih < 4) return

  const cols = 18
  const rows = 12
  const groove = Math.min(ih * 0.012, (0.35 + openness * 0.7) * 0.01 * ih)
  const colW = iw / cols
  const rowH = ih / rows

  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, iw, ih)
  ctx.clip()

  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 0.72 + openness * 0.22
  ctx.fillStyle = '#000'
  for (let r = 0; r < rows; r += 1) {
    if (r % 3 === 1) continue
    for (let c = 0; c < cols; c += 1) {
      const stagger = r % 2 === 0 ? 0 : colW * 0.32
      ctx.fillRect(
        x0 + c * colW + stagger * 0.18,
        y0 + r * rowH + (rowH - Math.max(groove, 0.7)) / 2,
        colW * 0.78,
        Math.max(groove, 0.7),
      )
    }
  }

  ctx.globalCompositeOperation = 'destination-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = '#2a2622'
  ctx.fillRect(dx, dy, dw, dh)
  ctx.restore()
}

type TeaserCol = { x: number; top: number; h: number }

function paintArchedSheet(
  out: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  bend: number,
) {
  const w = out.canvas.width
  const h = out.canvas.height
  out.clearRect(0, 0, w, h)
  out.imageSmoothingEnabled = true
  out.imageSmoothingQuality = 'high'

  const t = Math.max(0, Math.min(1, bend))
  if (t < 0.004) {
    out.drawImage(src, 0, 0, w, h)
    return
  }

  // Cylindrical fold (sides inset) + paper arch (center up, sides down).
  // Previous layout centered a nearly full-height sheet then lifted the apex
  // off-canvas, so clip/canvas cropped the top into a flat edge.
  const maxPhi = t * 1.08
  const radius = w / (2 * maxPhi)
  const focal = w * 1.4
  const cx = w / 2
  const zMax = radius * (1 - Math.cos(maxPhi))
  const padTop = h * 0.06 * t
  const padBot = h * 0.11 * t
  const archAmp = h * 0.22 * t
  const sagAmp = h * 0.08 * t
  const sheetH = h - padTop - padBot - archAmp - sagAmp
  const originY = padTop + archAmp

  const cols: TeaserCol[] = []
  for (let i = 0; i <= LINAR_TEASER_SLICES; i += 1) {
    const u = i / LINAR_TEASER_SLICES
    const theta = (u - 0.5) * 2 * maxPhi
    const z = radius * (Math.cos(theta) - Math.cos(maxPhi))
    const persp = focal / (focal - z)
    const zN = z / Math.max(zMax, 1e-6)
    cols.push({
      x: cx + radius * Math.sin(theta) * persp,
      top: originY - archAmp * zN + sagAmp * (1 - zN),
      h: sheetH * (1 + t * 0.02 * zN),
    })
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const col of cols) {
    minX = Math.min(minX, col.x)
    maxX = Math.max(maxX, col.x)
    minY = Math.min(minY, col.top)
    maxY = Math.max(maxY, col.top + col.h)
  }

  const marginX = w * 0.04
  const marginTop = h * 0.05
  const marginBot = h * (0.06 + t * 0.06)
  if (minY < marginTop || maxY > h - marginBot || minX < marginX || maxX > w - marginX) {
    const boxW = Math.max(maxX - minX, 1)
    const boxH = Math.max(maxY - minY, 1)
    const s = Math.min((w - marginX * 2) / boxW, (h - marginTop - marginBot) / boxH)
    const ox = (w - boxW * s) / 2 - minX * s
    const oy = marginTop - minY * s
    for (const col of cols) {
      col.x = col.x * s + ox
      col.top = col.top * s + oy
      col.h *= s
    }
    minX = minX * s + ox
    maxX = maxX * s + ox
    minY = minY * s + oy
    maxY = maxY * s + oy
  }

  const silhouette = () => {
    out.beginPath()
    cols.forEach((col, i) => {
      if (i === 0) out.moveTo(col.x, col.top)
      else out.lineTo(col.x, col.top)
    })
    for (let i = cols.length - 1; i >= 0; i -= 1) {
      const col = cols[i]
      out.lineTo(col.x, col.top + col.h)
    }
    out.closePath()
  }

  out.save()
  out.fillStyle = `rgba(28, 25, 22, ${0.12 + t * 0.22})`
  out.beginPath()
  out.ellipse(
    (minX + maxX) / 2,
    Math.min(maxY + h * 0.025, h * 0.97),
    (maxX - minX) * 0.4,
    h * 0.042,
    0,
    0,
    Math.PI * 2,
  )
  out.fill()
  out.restore()

  // Card body + shadow so the arched photo edge reads on the beige stage
  // (the photo’s white top otherwise disappears into --dk-paper-2).
  out.save()
  out.shadowColor = `rgba(32, 26, 22, ${0.18 + t * 0.16})`
  out.shadowBlur = Math.max(8, h * 0.035)
  out.shadowOffsetY = Math.max(3, h * 0.012)
  out.fillStyle = '#efe8dc'
  silhouette()
  out.fill()
  out.restore()

  out.save()
  silhouette()
  out.clip()

  const srcW = src.width
  const srcH = src.height
  const n = LINAR_TEASER_SLICES
  for (let i = 0; i < n; i += 1) {
    const a = cols[i]
    const b = cols[i + 1]
    const dy = Math.min(a.top, b.top) - 0.5
    const dh = Math.max(a.top + a.h, b.top + b.h) - dy + 0.5
    const dw = Math.max(b.x - a.x, 0.75) + 1.75
    out.drawImage(src, (i / n) * srcW, 0, srcW / n, srcH, a.x, dy, dw, dh)
  }
  out.restore()

  out.save()
  out.strokeStyle = `rgba(48, 40, 34, ${0.16 + t * 0.14})`
  out.lineWidth = Math.max(1, h * 0.003)
  out.lineJoin = 'round'
  silhouette()
  out.stroke()
  out.restore()
}

function LinarTeaserPanel({ openness, bend }: { openness: number; bend: number }) {
  const reduced = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sheetRef = useRef<HTMLCanvasElement | null>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const liveRef = useRef(false)
  const [photoReady, setPhotoReady] = useState(false)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = img.linarVeneer
    const onReady = () => {
      photoRef.current = image
      setPhotoReady(true)
    }
    if (image.complete && image.naturalWidth > 0) onReady()
    else image.addEventListener('load', onReady)
    return () => image.removeEventListener('load', onReady)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const photo = photoRef.current
    if (!canvas || !photo || !photoReady || reduced) {
      liveRef.current = false
      setLive(false)
      return
    }

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      let sheet = sheetRef.current
      if (!sheet || sheet.width !== w || sheet.height !== h) {
        sheet = document.createElement('canvas')
        sheet.width = w
        sheet.height = h
        sheetRef.current = sheet
      }

      const sheetCtx = sheet.getContext('2d')
      const out = canvas.getContext('2d')
      if (!sheetCtx || !out) return

      sheetCtx.clearRect(0, 0, w, h)
      const bounds = coverImage(
        sheetCtx,
        photo,
        w,
        h,
        photo.naturalWidth,
        photo.naturalHeight,
      )
      stampLinarOpenings(sheetCtx, openness, bounds)
      paintArchedSheet(out, sheet, bend)
      if (!liveRef.current) {
        liveRef.current = true
        setLive(true)
      }
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [bend, openness, photoReady, reduced])

  return (
    <div
      className="dk-linar__panel"
      data-live={live ? 'true' : undefined}
      style={
        {
          '--open': String(openness),
          '--bend': String(bend),
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="dk-linar__stage">
        <img
          className="dk-linar__photo"
          src={img.linarVeneer}
          alt=""
          width={1024}
          height={768}
          draggable={false}
        />
        {reduced ? null : <canvas ref={canvasRef} className="dk-linar__sheet" />}
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
