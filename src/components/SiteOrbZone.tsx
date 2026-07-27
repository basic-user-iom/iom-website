import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { CLIENTS } from '../data/clients'

export const ORB_COUNT = 3

type HoverKind = 'client' | 'rfo' | null

type HoverState = {
  kind: HoverKind
  index: number | null
}

type SiteOrbApi = {
  zoneRef: RefObject<HTMLDivElement | null>
  clientMarksRef: RefObject<(HTMLElement | null)[]>
  rfoNodesRef: RefObject<(HTMLElement | null)[]>
  setHover: (kind: HoverKind, index: number | null) => void
}

const SiteOrbContext = createContext<SiteOrbApi | null>(null)

export function useSiteOrbs(): SiteOrbApi {
  const ctx = useContext(SiteOrbContext)
  if (!ctx) throw new Error('useSiteOrbs must be used inside SiteOrbZone')
  return ctx
}

/** Optional — Clients/About can render without the zone in isolation. */
export function useSiteOrbsOptional(): SiteOrbApi | null {
  return useContext(SiteOrbContext)
}

const HOVER_ORBIT_MS = 3200
const FOLLOW_FREE = 0.18
const FOLLOW_HOVER = 0.4
const FOLLOW_ARRIVE = 0.065
const ARRIVE_MS = 900
const FOLLOW_RELEASE = 0.05
const RELEASE_MS = 1100
const COLOR_SMOOTH = 0.08
const COUPLE = 0.045
const SOFTEN = 2200
const FREE_SPEED = 0.7
const TAU = Math.PI * 2

type Body = {
  angle: number
  period: number
  dir: number
  rxScale: number
  ryScale: number
  tilt: number
  mass: number
  scale: number
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isCoarsePointer(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 820px)').matches
  )
}

function seedBodies(): Body[] {
  return [
    {
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

function centerInZone(el: HTMLElement, zone: HTMLElement): { x: number; y: number } {
  const er = el.getBoundingClientRect()
  const zr = zone.getBoundingClientRect()
  return {
    x: er.left + er.width / 2 - zr.left,
    y: er.top + er.height / 2 - zr.top,
  }
}

function normalizeAngle(a: number): number {
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x < -Math.PI) x += TAU
  return x
}

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

/** One orb set spanning Clients → RFO. */
export const SiteOrbZone = memo(function SiteOrbZone({ children }: { children: ReactNode }) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const clientMarksRef = useRef<(HTMLElement | null)[]>([])
  const rfoNodesRef = useRef<(HTMLElement | null)[]>([])
  const hoverRef = useRef<HoverState>({ kind: null, index: null })

  const setHover = useCallback((kind: HoverKind, index: number | null) => {
    hoverRef.current = { kind, index }
  }, [])

  const api = useMemo<SiteOrbApi>(
    () => ({ zoneRef, clientMarksRef, rfoNodesRef, setHover }),
    [setHover],
  )

  useEffect(() => {
    const zone = zoneRef.current
    if (!zone) return

    if (prefersReducedMotion()) {
      zone.classList.add('site-orb-zone--static')
      return
    }

    const mobile = isCoarsePointer()
    let raf = 0
    let lastTs = performance.now()
    let frame = 0
    let zoneActive = true
    const bodies = seedBodies()
    let hoverPhase = 0
    let wasHovering = false
    let hoverKey = ''
    let ringSlots = [0, 1, 2]
    let arriveBlend = 0
    let releaseBlend = 0
    let displayScale = mobile ? 1.15 : 1.35
    const disp = bodies.map(() => ({ x: 0, y: 0 }))
    const coast = bodies.map(() => ({ vx: 0, vy: 0 }))
    const prevDisp = bodies.map(() => ({ x: 0, y: 0 }))
    const colorI = CLIENTS.map(() => 0)
    let seededDisp = false

    const io = new IntersectionObserver(
      ([entry]) => {
        zoneActive = entry?.isIntersecting ?? false
        zone.classList.toggle('is-in-view', zoneActive)
      },
      { threshold: 0.05, rootMargin: '10% 0px' },
    )
    io.observe(zone)

    const resolveHoverTarget = (): HTMLElement | null => {
      const { kind, index } = hoverRef.current
      if (kind == null || index == null) return null
      if (kind === 'client') return clientMarksRef.current[index] ?? null
      return rfoNodesRef.current[index] ?? null
    }

    const tick = (ts: number) => {
      const orbs = zone.querySelectorAll<HTMLSpanElement>(':scope > .clients-orb')
      if (orbs.length < ORB_COUNT) {
        raf = window.requestAnimationFrame(tick)
        return
      }

      frame++
      const dtMs = Math.min(48, ts - lastTs)
      lastTs = ts
      const dt = dtMs / 1000

      // Mobile: skip alternate frames when not hovering to cut main-thread cost.
      const hoverTarget = resolveHoverTarget()
      if (mobile && !hoverTarget && frame % 2 === 1) {
        raf = window.requestAnimationFrame(tick)
        return
      }

      if (!zoneActive && !hoverTarget) {
        for (const el of orbs) el.style.opacity = '0'
        raf = window.requestAnimationFrame(tick)
        return
      }

      const w = zone.clientWidth
      const h = zone.clientHeight
      const clientsEl = zone.querySelector('.clients-stage') as HTMLElement | null
      const rfoEl = zone.querySelector('#rfo') as HTMLElement | null

      // Free-orbit around the logo stage (not the whole clients block with titles).
      let cx = w / 2
      let cy = h * 0.22
      let rx = Math.max(40, w * 0.42)
      let ry = Math.max(28, Math.min(120, h * 0.08))

      const clientsBox = clientsEl?.getBoundingClientRect()
      const rfoBox = rfoEl?.getBoundingClientRect()
      const vh = window.innerHeight
      const score = (box: DOMRect | undefined) => {
        if (!box) return 0
        const top = Math.max(box.top, 0)
        const bottom = Math.min(box.bottom, vh)
        return Math.max(0, bottom - top)
      }
      const clientsScore = score(clientsBox)
      const rfoScore = score(rfoBox)
      if (rfoScore > clientsScore && rfoBox && rfoEl) {
        const c = centerInZone(rfoEl, zone)
        cx = c.x
        cy = c.y
        rx = Math.max(48, Math.min(w * 0.28, 220))
        ry = Math.max(24, Math.min(70, rfoBox.height * 0.28))
      } else if (clientsBox && clientsEl) {
        const c = centerInZone(clientsEl, zone)
        cx = c.x
        cy = c.y
        rx = Math.max(56, clientsBox.width * 0.38)
        ry = Math.max(40, clientsBox.height * 0.34)
      }

      for (const b of bodies) {
        b.angle += b.dir * ((Math.PI * 2) / b.period) * dt * FREE_SPEED
      }

      const bases = bodies.map((b) => orbitPoint(cx, cy, rx, ry, b))
      const targets = bases.map((base, i) => {
        let tx = base.x
        let ty = base.y
        if (!mobile) {
          for (let j = 0; j < bodies.length; j++) {
            if (i === j) continue
            const dx = bases[j].x - base.x
            const dy = bases[j].y - base.y
            const r2 = dx * dx + dy * dy + SOFTEN
            const pull = (COUPLE * bodies[j].mass * 120) / r2
            tx += dx * pull
            ty += dy * pull
          }
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

      const easeRelease = 1 - Math.pow(1 - FOLLOW_RELEASE, dtMs / 16.67)
      const key =
        hoverRef.current.kind != null && hoverRef.current.index != null
          ? `${hoverRef.current.kind}:${hoverRef.current.index}`
          : ''

      if (hoverTarget) {
        releaseBlend = 0
        const box = hoverTarget.getBoundingClientRect()
        const { x: mx, y: my } = centerInZone(hoverTarget, zone)
        const kind = hoverRef.current.kind
        // Clients: ring near tile edge so logo/text stays clear in the center.
        // RFO: hug the letter circle.
        let radius: number
        if (kind === 'rfo') {
          const circleR = Math.min(box.width, box.height) * 0.5
          radius = Math.max(20, circleR + 14)
        } else {
          // Orbit just outside the logo tile so brand art/text stays clear.
          const outside = Math.hypot(box.width, box.height) * 0.5 + 12
          radius = Math.max(52, outside)
        }

        if (!wasHovering || hoverKey !== key) {
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
          hoverPhase -= (ringSlots[nearest] * TAU) / ORB_COUNT
          wasHovering = true
          hoverKey = key
          arriveBlend = 1
          zone.classList.add('is-attending')
          for (let i = 0; i < bodies.length; i++) {
            coast[i].vx = 0
            coast[i].vy = 0
          }
        }

        if (arriveBlend > 0) arriveBlend = Math.max(0, arriveBlend - dtMs / ARRIVE_MS)

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
        displayScale += ((mobile ? 1.15 : 1.28) - displayScale) * Math.min(1, easeArrive)
      } else {
        if (wasHovering) {
          wasHovering = false
          hoverKey = ''
          releaseBlend = 1
          zone.classList.remove('is-attending')
          for (let i = 0; i < bodies.length; i++) {
            syncAngleFromPosition(bodies[i], disp[i].x, disp[i].y, cx, cy, rx, ry)
            const invDt = dt > 0.0001 ? 1 / dt : 60
            coast[i].vx = (disp[i].x - prevDisp[i].x) * invDt * 0.55
            coast[i].vy = (disp[i].y - prevDisp[i].y) * invDt * 0.55
          }
        }

        if (releaseBlend > 0) releaseBlend = Math.max(0, releaseBlend - dtMs / RELEASE_MS)

        const follow =
          FOLLOW_RELEASE + (FOLLOW_FREE - FOLLOW_RELEASE) * (1 - releaseBlend) ** 1.35
        const ease = 1 - Math.pow(1 - follow, dtMs / 16.67)

        for (let i = 0; i < bodies.length; i++) {
          coast[i].vx *= 0.9 ** (dtMs / 16.67)
          coast[i].vy *= 0.9 ** (dtMs / 16.67)
          disp[i].x += coast[i].vx * dt * releaseBlend
          disp[i].y += coast[i].vy * dt * releaseBlend
          disp[i].x += (targets[i].x - disp[i].x) * Math.min(1, ease * (releaseBlend > 0 ? 1 : 1.25))
          disp[i].y += (targets[i].y - disp[i].y) * Math.min(1, ease * (releaseBlend > 0 ? 1 : 1.25))
          prevDisp[i].x = disp[i].x
          prevDisp[i].y = disp[i].y
        }

        const scaleTarget = bodies.reduce((s, b) => s + b.scale, 0) / bodies.length
        displayScale += (scaleTarget - displayScale) * Math.min(1, easeRelease * 1.2)
      }

      for (let i = 0; i < ORB_COUNT; i++) {
        const el = orbs[i]
        const scale = hoverTarget
          ? displayScale
          : bodies[i].scale + (displayScale - bodies[i].scale) * releaseBlend * 0.35
        el.style.opacity = '0.92'
        el.style.transform = `translate(${disp[i].x}px, ${disp[i].y}px) scale(${scale})`
        el.classList.toggle('is-attending-orb', hoverTarget != null)
      }

      // Brand tint only on the hovered client — free-orbit crossing marks used to
      // flash random logos as orbs passed through them.
      if (!mobile) {
        const colorEase = 1 - Math.pow(1 - COLOR_SMOOTH, dtMs / 16.67)
        const hoverClientIndex =
          hoverRef.current.kind === 'client' ? hoverRef.current.index : null
        for (let i = 0; i < clientMarksRef.current.length; i++) {
          const mark = clientMarksRef.current[i]
          if (!mark) continue
          const targetI = hoverClientIndex === i ? 0.58 : 0
          colorI[i] += (targetI - colorI[i]) * colorEase
          if (colorI[i] < 0.008) colorI[i] = 0
          mark.style.setProperty('--reflect-x', '50%')
          mark.style.setProperty('--reflect-y', '42%')
          mark.style.setProperty('--reflect-i', colorI[i].toFixed(3))
          mark.classList.toggle('is-lit', colorI[i] > 0.2)
        }
      }

      const rfoNodes = rfoNodesRef.current
      for (let i = 0; i < rfoNodes.length; i++) {
        rfoNodes[i]
          ?.closest('.about-pathway-item')
          ?.classList.toggle(
            'is-lit',
            hoverRef.current.kind === 'rfo' && hoverRef.current.index === i,
          )
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      io.disconnect()
      zone.classList.remove('is-attending', 'is-in-view', 'site-orb-zone--static')
    }
  }, [])

  return (
    <SiteOrbContext.Provider value={api}>
      <div className="site-orb-zone" ref={zoneRef}>
        {Array.from({ length: ORB_COUNT }, (_, i) => (
          <span key={i} className={`clients-orb clients-orb--${i}`} aria-hidden="true" />
        ))}
        {children}
      </div>
    </SiteOrbContext.Provider>
  )
})
