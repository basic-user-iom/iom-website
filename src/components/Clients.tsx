import { memo, useEffect, useRef, useState } from 'react'
import { CLIENTS } from '../data/clients'

type ClientsStyle = 'wordmarks' | 'logos'

const STYLE_KEY = 'iom.clients.style'
const ORB_COUNT = 3
/** Shared hover ring period (ms) — same angular speed for all three. */
const HOVER_ORBIT_MS = 2800
const FOLLOW_FREE = 0.2
const FOLLOW_HOVER = 0.42
/** Soft glide when first locking onto a logo. */
const FOLLOW_ARRIVE = 0.07
/** How long the arrive glide lasts (ms). */
const ARRIVE_MS = 850
/** Soft return after leaving a logo (lower = longer glide). */
const FOLLOW_RELEASE = 0.055
/** How long the release glide lasts (ms). */
const RELEASE_MS = 1100
/** Soft edge (px) inside the logo tile for gray→color fade. */
const COLOR_EDGE = 18
/** How quickly --reflect-i eases (lower = subtler). */
const COLOR_SMOOTH = 0.08
/** Cap so color never hard-snaps to full brand. */
const COLOR_MAX = 0.72
const COUPLE = 0.045
const SOFTEN = 2200
/** Free-orbit speed (0.7 = 30% slower than original). */
const FREE_SPEED = 0.7
const TAU = Math.PI * 2

/** 0 outside the tile; rises softly once an orb is inside the logo square. */
function intensityInMark(
  pageX: number,
  pageY: number,
  box: DOMRect,
): { intensity: number; x: number; y: number } {
  const xPct = ((pageX - box.left) / Math.max(box.width, 1)) * 100
  const yPct = ((pageY - box.top) / Math.max(box.height, 1)) * 100
  if (
    pageX < box.left ||
    pageX > box.right ||
    pageY < box.top ||
    pageY > box.bottom
  ) {
    return { intensity: 0, x: xPct, y: yPct }
  }
  const insetX = Math.min(pageX - box.left, box.right - pageX)
  const insetY = Math.min(pageY - box.top, box.bottom - pageY)
  const inset = Math.min(insetX, insetY)
  const edge = Math.min(COLOR_EDGE, Math.min(box.width, box.height) * 0.35)
  const t = Math.min(1, inset / Math.max(edge, 1))
  // Ease-in so the gray→color shift stays subtle.
  const intensity = COLOR_MAX * t * t
  return { intensity, x: xPct, y: yPct }
}

function normalizeAngle(a: number): number {
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x < -Math.PI) x += TAU
  return x
}

/** Assign each orb to the nearest free 120° ring slot (shortest paths, no crossing jumps). */
function assignRingSlots(
  positions: { x: number; y: number }[],
  mx: number,
  my: number,
  phase: number,
): number[] {
  const bodyAngles = positions.map((p) => Math.atan2(p.y - my, p.x - mx))
  const pairs: { b: number; s: number; da: number }[] = []
  for (let b = 0; b < ORB_COUNT; b++) {
    for (let s = 0; s < ORB_COUNT; s++) {
      const target = phase + (s * TAU) / ORB_COUNT
      pairs.push({ b, s, da: Math.abs(normalizeAngle(bodyAngles[b] - target)) })
    }
  }
  pairs.sort((a, b) => a.da - b.da)
  const bodyToSlot = [-1, -1, -1]
  const slotTaken = [false, false, false]
  for (const p of pairs) {
    if (bodyToSlot[p.b] >= 0 || slotTaken[p.s]) continue
    bodyToSlot[p.b] = p.s
    slotTaken[p.s] = true
  }
  for (let b = 0; b < ORB_COUNT; b++) {
    if (bodyToSlot[b] < 0) {
      const free = slotTaken.findIndex((t) => !t)
      bodyToSlot[b] = free < 0 ? b : free
      slotTaken[bodyToSlot[b]] = true
    }
  }
  return bodyToSlot
}

type Body = {
  x: number
  y: number
  angle: number
  period: number
  dir: number
  rxScale: number
  ryScale: number
  tilt: number
  mass: number
  scale: number
}

function readStoredStyle(): ClientsStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY)
    if (raw === 'wordmarks' || raw === 'logos') return raw
  } catch {
    /* ignore */
  }
  return 'logos'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function seedBodies(): Body[] {
  return [
    {
      x: 0,
      y: 0,
      angle: 0.2,
      period: 11,
      dir: 1,
      rxScale: 0.92,
      ryScale: 0.78,
      tilt: 0.18,
      mass: 1.1,
      scale: 1.35,
    },
    {
      x: 0,
      y: 0,
      angle: 2.3,
      period: 7.5,
      dir: -1,
      rxScale: 0.62,
      ryScale: 0.95,
      tilt: -0.55,
      mass: 0.95,
      scale: 1.2,
    },
    {
      x: 0,
      y: 0,
      angle: 4.1,
      period: 15.5,
      dir: 1,
      rxScale: 0.78,
      ryScale: 0.48,
      tilt: 0.9,
      mass: 1,
      scale: 1.15,
    },
  ]
}

function orbitPoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  body: Body,
): { x: number; y: number } {
  const lx = Math.cos(body.angle) * rx * body.rxScale
  const ly = Math.sin(body.angle) * ry * body.ryScale
  const c = Math.cos(body.tilt)
  const s = Math.sin(body.tilt)
  return {
    x: cx + lx * c - ly * s,
    y: cy + lx * s + ly * c,
  }
}

/** Align a body's free-orbit phase to its current screen position (no teleport on release). */
function syncAngleFromPosition(
  body: Body,
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  const dx = x - cx
  const dy = y - cy
  const c = Math.cos(body.tilt)
  const s = Math.sin(body.tilt)
  const lx = dx * c + dy * s
  const ly = -dx * s + dy * c
  const ax = Math.max(8, rx * body.rxScale)
  const ay = Math.max(8, ry * body.ryScale)
  body.angle = Math.atan2(ly / ay, lx / ax)
}

/** Element center in the stage’s absolute-position coordinate space. */
function centerInStage(el: HTMLElement, stage: HTMLElement): { x: number; y: number } {
  const er = el.getBoundingClientRect()
  const sr = stage.getBoundingClientRect()
  return {
    x: er.left + er.width / 2 - sr.left,
    y: er.top + er.height / 2 - sr.top,
  }
}

export const Clients = memo(function Clients() {
  const [style, setStyle] = useState<ClientsStyle>(() => readStoredStyle())
  const stageRef = useRef<HTMLDivElement>(null)
  const marksRef = useRef<(HTMLAnchorElement | null)[]>([])
  const hoverIndexRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, style)
    } catch {
      /* ignore */
    }
  }, [style])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    if (prefersReducedMotion()) {
      stage.classList.add('clients-stage--static')
      return
    }

    let raf = 0
    let lastTs = performance.now()
    const bodies = seedBodies()
    let hoverPhase = 0
    let wasHovering = false
    let hoverLogoIndex = -1
    /** body index → ring slot 0..2 */
    let ringSlots = [0, 1, 2]
    /** 1 → just arrived on a logo; 0 → settled on the ring. */
    let arriveBlend = 0
    /** 1 → just released; 0 → fully back in free orbit. */
    let releaseBlend = 0
    let displayScale = 1.35
    const disp = bodies.map(() => ({ x: 0, y: 0 }))
    const coast = bodies.map(() => ({ vx: 0, vy: 0 }))
    const prevDisp = bodies.map(() => ({ x: 0, y: 0 }))
    const colorI = CLIENTS.map(() => 0)
    let seededDisp = false

    const tick = (ts: number) => {
      const orbs = stage.querySelectorAll<HTMLSpanElement>('.clients-orb')
      if (orbs.length < ORB_COUNT) {
        raf = window.requestAnimationFrame(tick)
        return
      }

      const dtMs = Math.min(48, ts - lastTs)
      lastTs = ts
      const dt = dtMs / 1000

      const w = stage.clientWidth
      const h = stage.clientHeight
      const rx = Math.max(40, w * 0.48)
      const ry = Math.max(28, h * 0.42)
      const cx = w / 2
      const cy = h / 2
      const stageBox = stage.getBoundingClientRect()

      for (const b of bodies) {
        b.angle += b.dir * ((Math.PI * 2) / b.period) * dt * FREE_SPEED
      }

      const bases = bodies.map((b) => orbitPoint(cx, cy, rx, ry, b))
      const targets = bases.map((base, i) => {
        let tx = base.x
        let ty = base.y
        for (let j = 0; j < bodies.length; j++) {
          if (i === j) continue
          const dx = bases[j].x - base.x
          const dy = bases[j].y - base.y
          const r2 = dx * dx + dy * dy + SOFTEN
          const pull = (COUPLE * bodies[j].mass * 120) / r2
          tx += dx * pull
          ty += dy * pull
        }
        return { x: tx, y: ty }
      })

      if (!seededDisp) {
        for (let i = 0; i < bodies.length; i++) {
          disp[i].x = targets[i].x
          disp[i].y = targets[i].y
          prevDisp[i].x = targets[i].x
          prevDisp[i].y = targets[i].y
        }
        seededDisp = true
      }

      const hoverIndex = hoverIndexRef.current
      const hoverMark = hoverIndex != null ? marksRef.current[hoverIndex] : null
      const easeRelease = 1 - Math.pow(1 - FOLLOW_RELEASE, dtMs / 16.67)

      if (hoverMark) {
        releaseBlend = 0
        const box = hoverMark.getBoundingClientRect()
        const { x: mx, y: my } = centerInStage(hoverMark, stage)
        // Keep the ring inside the logo tile so orbs can tint it while circling.
        const radius = Math.max(22, Math.min(box.width, box.height) * 0.36)

        // New logo (or first hover) — start a soft glide onto the ring (no teleport).
        if (!wasHovering || hoverLogoIndex !== hoverIndex) {
          let nearest = 0
          let nearestD = Infinity
          for (let i = 0; i < bodies.length; i++) {
            const d = Math.hypot(disp[i].x - mx, disp[i].y - my)
            if (d < nearestD) {
              nearestD = d
              nearest = i
            }
          }
          hoverPhase = Math.atan2(disp[nearest].y - my, disp[nearest].x - mx)
          ringSlots = assignRingSlots(disp, mx, my, hoverPhase)
          // Anchor phase so nearest orb's assigned slot matches its current bearing.
          hoverPhase -= (ringSlots[nearest] * TAU) / ORB_COUNT
          wasHovering = true
          hoverLogoIndex = hoverIndex ?? -1
          arriveBlend = 1
          stage.classList.add('is-attending')

          for (let i = 0; i < bodies.length; i++) {
            coast[i].vx = 0
            coast[i].vy = 0
          }
        }

        if (arriveBlend > 0) {
          arriveBlend = Math.max(0, arriveBlend - dtMs / ARRIVE_MS)
        }

        // Spin slowly while arriving, then full ring speed once settled.
        const spin = 0.28 + 0.72 * (1 - arriveBlend) ** 1.15
        hoverPhase += (dtMs / HOVER_ORBIT_MS) * TAU * spin
        if (hoverPhase > TAU) hoverPhase -= TAU

        const follow =
          FOLLOW_ARRIVE + (FOLLOW_HOVER - FOLLOW_ARRIVE) * (1 - arriveBlend) ** 1.25
        const easeArrive = 1 - Math.pow(1 - follow, dtMs / 16.67)

        for (let i = 0; i < bodies.length; i++) {
          const slot = ringSlots[i]
          const angle = hoverPhase + (slot * TAU) / ORB_COUNT
          const ax = mx + Math.cos(angle) * radius
          const ay = my + Math.sin(angle) * radius
          prevDisp[i].x = disp[i].x
          prevDisp[i].y = disp[i].y
          disp[i].x += (ax - disp[i].x) * easeArrive
          disp[i].y += (ay - disp[i].y) * easeArrive
        }
        displayScale += (1.7 - displayScale) * Math.min(1, easeArrive)
      } else {
        if (wasHovering) {
          wasHovering = false
          hoverLogoIndex = -1
          releaseBlend = 1
          stage.classList.remove('is-attending')

          // Re-phase free orbits onto current spots + keep a bit of ring momentum.
          for (let i = 0; i < bodies.length; i++) {
            syncAngleFromPosition(bodies[i], disp[i].x, disp[i].y, cx, cy, rx, ry)
            const invDt = dt > 0.0001 ? 1 / dt : 60
            coast[i].vx = (disp[i].x - prevDisp[i].x) * invDt * 0.55
            coast[i].vy = (disp[i].y - prevDisp[i].y) * invDt * 0.55
          }
        }

        if (releaseBlend > 0) {
          releaseBlend = Math.max(0, releaseBlend - dtMs / RELEASE_MS)
        }

        // Ease from soft release follow → normal free follow.
        const follow =
          FOLLOW_RELEASE + (FOLLOW_FREE - FOLLOW_RELEASE) * (1 - releaseBlend) ** 1.35
        const ease = 1 - Math.pow(1 - follow, dtMs / 16.67)

        for (let i = 0; i < bodies.length; i++) {
          // Coast fades out while springing toward the free-orbit target.
          coast[i].vx *= 0.9 ** (dtMs / 16.67)
          coast[i].vy *= 0.9 ** (dtMs / 16.67)
          disp[i].x += coast[i].vx * dt * releaseBlend
          disp[i].y += coast[i].vy * dt * releaseBlend
          disp[i].x += (targets[i].x - disp[i].x) * Math.min(1, ease * (releaseBlend > 0 ? 1 : 1.25))
          disp[i].y += (targets[i].y - disp[i].y) * Math.min(1, ease * (releaseBlend > 0 ? 1 : 1.25))
          prevDisp[i].x = disp[i].x
          prevDisp[i].y = disp[i].y
        }

        const scaleTarget =
          bodies.reduce((s, b) => s + b.scale, 0) / bodies.length
        displayScale += (scaleTarget - displayScale) * Math.min(1, easeRelease * 1.2)
      }

      for (let i = 0; i < ORB_COUNT; i++) {
        bodies[i].x = disp[i].x
        bodies[i].y = disp[i].y
        const el = orbs[i]
        const scale = hoverMark
          ? displayScale
          : bodies[i].scale + (displayScale - bodies[i].scale) * releaseBlend * 0.35
        // Pure 2D translate — avoids perspective skew so the ring matches the logo.
        el.style.transform = `translate(${bodies[i].x}px, ${bodies[i].y}px) scale(${scale})`
        el.classList.toggle('is-attending-orb', hoverMark != null)
      }

      const colorEase = 1 - Math.pow(1 - COLOR_SMOOTH, dtMs / 16.67)

      for (let i = 0; i < marksRef.current.length; i++) {
        const mark = marksRef.current[i]
        if (!mark) continue
        const box = mark.getBoundingClientRect()

        // Color only when an orb is inside this logo's square (soft edge fade).
        let targetI = 0
        let bestX = 50
        let bestY = 50
        for (let o = 0; o < bodies.length; o++) {
          const pageX = stageBox.left + bodies[o].x
          const pageY = stageBox.top + bodies[o].y
          const hit = intensityInMark(pageX, pageY, box)
          if (hit.intensity > targetI) {
            targetI = hit.intensity
            bestX = hit.x
            bestY = hit.y
          }
        }

        colorI[i] += (targetI - colorI[i]) * colorEase
        if (colorI[i] < 0.008) colorI[i] = 0

        mark.style.setProperty('--reflect-x', `${bestX}%`)
        mark.style.setProperty('--reflect-y', `${bestY}%`)
        mark.style.setProperty('--reflect-i', colorI[i].toFixed(3))
        mark.classList.toggle('is-lit', colorI[i] > 0.2)
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      stage.classList.remove('is-attending', 'clients-stage--static')
    }
  }, [])

  return (
    <section className="clients-block" id="clients" aria-labelledby="clients-heading">
      <p className="clients-eyebrow">Selected clients</p>
      <h2 className="clients-title" id="clients-heading">
        Organizations we&apos;ve built with
      </h2>
      <p className="clients-text">
        Hotels, developers, utilities, and platforms — project work across interactive media and
        digital experiences.
      </p>

      <div className="clients-style-toggle" role="group" aria-label="Show client wordmarks or logos">
        <button
          type="button"
          className={style === 'wordmarks' ? 'is-active' : undefined}
          aria-pressed={style === 'wordmarks'}
          onClick={() => setStyle('wordmarks')}
        >
          Wordmarks
        </button>
        <button
          type="button"
          className={style === 'logos' ? 'is-active' : undefined}
          aria-pressed={style === 'logos'}
          onClick={() => setStyle('logos')}
        >
          Logos
        </button>
      </div>

      <div className="clients-stage" ref={stageRef}>
        {Array.from({ length: ORB_COUNT }, (_, i) => (
          <span key={i} className={`clients-orb clients-orb--${i}`} aria-hidden="true" />
        ))}
        <ul className={`clients-grid clients-grid--${style}`}>
          {CLIENTS.map((client, index) => (
            <li key={client.id}>
              <a
                ref={(node) => {
                  marksRef.current[index] = node
                }}
                className="clients-mark"
                href={client.href}
                target="_blank"
                rel="noopener noreferrer"
                title={`${client.name} — open website`}
                aria-label={`${client.name} website`}
                style={{ ['--client-brand' as string]: client.brandColor }}
                onPointerEnter={() => {
                  hoverIndexRef.current = index
                }}
                onPointerLeave={() => {
                  if (hoverIndexRef.current === index) hoverIndexRef.current = null
                }}
              >
                <span className="clients-mark-reflect" aria-hidden="true" />
                {style === 'logos' && client.logo ? (
                  <img
                    className="clients-logo"
                    src={client.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="clients-mark-text">{client.mark}</span>
                )}
                <span className="sr-only">{client.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
})
