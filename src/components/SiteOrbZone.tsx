import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { CLIENTS } from '../data/clients'

export const ORB_COUNT = 3

type HoverKind = 'client' | 'rfo' | 'hero' | 'card' | null

type HoverState = {
  kind: HoverKind
  index: number | null
  el: HTMLElement | null
}

type SiteOrbApi = {
  zoneRef: RefObject<HTMLDivElement | null>
  clientMarksRef: RefObject<(HTMLElement | null)[]>
  rfoNodesRef: RefObject<(HTMLElement | null)[]>
  setHover: (kind: HoverKind, index: number | null, el?: HTMLElement | null) => void
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

/** Rectangular orb outline on cards — matches ProjectCard / MusicPlayer hover. */
export function useCardOrbPointerProps():
  | {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => void
      onPointerLeave: () => void
    }
  | undefined {
  const orbs = useSiteOrbsOptional()
  const handleOrbEnter = useCallback(
    (el: HTMLElement) => {
      orbs?.setHover('card', 0, el)
    },
    [orbs],
  )
  const handleOrbLeave = useCallback(() => {
    orbs?.setHover(null, null)
  }, [orbs])

  return useMemo(
    () =>
      orbs
        ? {
            onPointerEnter: (event: PointerEvent<HTMLElement>) => {
              handleOrbEnter(event.currentTarget)
            },
            onPointerLeave: handleOrbLeave,
          }
        : undefined,
    [orbs, handleOrbEnter, handleOrbLeave],
  )
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

/** Orbit around the part of the element currently on screen (tall grids stay in view). */
function centerInZoneVisible(el: HTMLElement, zone: HTMLElement): {
  x: number
  y: number
  visibleH: number
  visibleW: number
} {
  const er = el.getBoundingClientRect()
  const zr = zone.getBoundingClientRect()
  const vh = window.innerHeight
  const vw = window.innerWidth
  const top = Math.max(er.top, 0)
  const bottom = Math.min(er.bottom, vh)
  const left = Math.max(er.left, 0)
  const right = Math.min(er.right, vw)
  const visibleH = Math.max(1, bottom - top)
  const visibleW = Math.max(1, right - left)
  return {
    x: left + visibleW / 2 - zr.left,
    y: top + visibleH / 2 - zr.top,
    visibleH,
    visibleW,
  }
}

function normalizeAngle(a: number): number {
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x < -Math.PI) x += TAU
  return x
}

/** Point on a rectangle outline; t is 0..1 starting at top-left, clockwise. */
function pointOnRectPerimeter(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  t: number,
): { x: number; y: number } {
  const w = Math.max(8, halfW * 2)
  const h = Math.max(8, halfH * 2)
  const perim = 2 * (w + h)
  let d = (((t % 1) + 1) % 1) * perim
  if (d <= w) return { x: cx - halfW + d, y: cy - halfH }
  d -= w
  if (d <= h) return { x: cx + halfW, y: cy - halfH + d }
  d -= h
  if (d <= w) return { x: cx + halfW - d, y: cy + halfH }
  d -= w
  return { x: cx - halfW, y: cy + halfH - d }
}

/** Nearest perimeter progress (0..1) for a point near a rectangle outline. */
function rectPerimeterT(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  x: number,
  y: number,
): number {
  const left = cx - halfW
  const right = cx + halfW
  const top = cy - halfH
  const bottom = cy + halfH
  const w = Math.max(8, right - left)
  const h = Math.max(8, bottom - top)
  const perim = 2 * (w + h)

  const dl = Math.abs(x - left)
  const dr = Math.abs(x - right)
  const dt = Math.abs(y - top)
  const db = Math.abs(y - bottom)
  const m = Math.min(dl, dr, dt, db)

  let qx: number
  let qy: number
  if (m === dt) {
    qx = Math.min(right, Math.max(left, x))
    qy = top
  } else if (m === dr) {
    qx = right
    qy = Math.min(bottom, Math.max(top, y))
  } else if (m === db) {
    qx = Math.min(right, Math.max(left, x))
    qy = bottom
  } else {
    qx = left
    qy = Math.min(bottom, Math.max(top, y))
  }

  let dist: number
  if (Math.abs(qy - top) <= 0.5) dist = qx - left
  else if (Math.abs(qx - right) <= 0.5) dist = w + (qy - top)
  else if (Math.abs(qy - bottom) <= 0.5) dist = w + h + (right - qx)
  else dist = w + h + w + (bottom - qy)

  return ((dist / perim) % 1 + 1) % 1
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

type OrbitKind = 'hero' | 'section' | 'clients' | 'rfo'

type OrbitAnchor = {
  el: HTMLElement
  kind: OrbitKind
}

/** One orb set that follows the page: hero scene → project sections → Clients → RFO. */
export const SiteOrbZone = memo(function SiteOrbZone({ children }: { children: ReactNode }) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const clientMarksRef = useRef<(HTMLElement | null)[]>([])
  const rfoNodesRef = useRef<(HTMLElement | null)[]>([])
  const hoverRef = useRef<HoverState>({ kind: null, index: null, el: null })

  const setHover = useCallback((kind: HoverKind, index: number | null, el?: HTMLElement | null) => {
    hoverRef.current = { kind, index, el: el ?? null }
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

    let cancelled = false
    let idleId = 0
    let timeoutId = 0
    let cleanupRuntime: (() => void) | undefined

    const startRuntime = () => {
      if (cancelled) return
      cleanupRuntime = runOrbRuntime(zone, hoverRef, clientMarksRef, rfoNodesRef)
    }

    // Defer the rAF loop until after first paint / idle so LCP and hydration
    // are not competing with continuous style/layout work from the orbs.
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(startRuntime, { timeout: 2200 })
    } else {
      timeoutId = window.setTimeout(startRuntime, 400)
    }

    return () => {
      cancelled = true
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) window.clearTimeout(timeoutId)
      cleanupRuntime?.()
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

function runOrbRuntime(
  zone: HTMLDivElement,
  hoverRef: { current: HoverState },
  clientMarksRef: RefObject<(HTMLElement | null)[]>,
  rfoNodesRef: RefObject<(HTMLElement | null)[]>,
): () => void {
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
    let anchors: OrbitAnchor[] = []
    let heroLive = Boolean(zone.querySelector('.hero-canvas-wrap--live'))
    let evacuateBoost = 0
    let scrollAttendEl: HTMLElement | null = null
    let scrollAttendId = ''

    const onHeroLive = (event: Event) => {
      const detail = (event as CustomEvent<{ live?: boolean }>).detail
      if (detail?.live === false) {
        heroLive = false
        return
      }
      heroLive = true
      evacuateBoost = 1
      hoverRef.current = { kind: null, index: null, el: null }
      zone.classList.add('site-orb-zone--hero-live')
    }
    window.addEventListener('iom:hero-live', onHeroLive)

    const io = new IntersectionObserver(
      ([entry]) => {
        zoneActive = entry?.isIntersecting ?? false
        zone.classList.toggle('is-in-view', zoneActive)
      },
      { threshold: 0.02, rootMargin: '12% 0px' },
    )
    io.observe(zone)

    const refreshAnchors = () => {
      const next: OrbitAnchor[] = []
      const hero = zone.querySelector('.hero-canvas-wrap') as HTMLElement | null
      if (hero) {
        if (hero.classList.contains('hero-canvas-wrap--live')) heroLive = true
        next.push({ el: hero, kind: 'hero' })
      }

      zone.querySelectorAll<HTMLElement>('.section-block').forEach((section) => {
        const media =
          (section.querySelector(
            '.project-grid, .music-player-visual-wrap, .music-player-shell, .music-player',
          ) as HTMLElement | null) ?? section
        next.push({ el: media, kind: 'section' })
      })

      const clients = zone.querySelector('.clients-stage') as HTMLElement | null
      if (clients) next.push({ el: clients, kind: 'clients' })

      const rfo = zone.querySelector('#rfo') as HTMLElement | null
      if (rfo) next.push({ el: rfo, kind: 'rfo' })

      anchors = next
    }
    refreshAnchors()
    if (heroLive) zone.classList.add('site-orb-zone--hero-live')

    const resolveHoverTarget = (): HTMLElement | null => {
      const { kind, index, el } = hoverRef.current
      if (el?.isConnected) return el
      if (kind == null || index == null) return null
      if (kind === 'client') return clientMarksRef.current[index] ?? null
      if (kind === 'rfo') return rfoNodesRef.current[index] ?? null
      return null
    }

    const visibilityScore = (box: DOMRect, vh: number) => {
      const top = Math.max(box.top, 0)
      const bottom = Math.min(box.bottom, vh)
      const visible = Math.max(0, bottom - top)
      if (visible <= 0) return 0
      // Prefer anchors near the middle of the viewport so the handoff feels smooth.
      const mid = (box.top + box.bottom) / 2
      const centerBias = 1 - Math.min(1, Math.abs(mid - vh * 0.42) / (vh * 0.7))
      return visible * (0.55 + 0.45 * centerBias)
    }

    const applyOrbitFor = (
      kind: OrbitKind,
      el: HTMLElement,
      box: DOMRect,
      w: number,
    ): { cx: number; cy: number; rx: number; ry: number } => {
      if (kind === 'hero') {
        const c = centerInZone(el, zone)
        return {
          cx: c.x,
          cy: c.y,
          rx: Math.max(64, box.width * 0.44),
          ry: Math.max(48, box.height * 0.38),
        }
      }
      if (kind === 'rfo') {
        const c = centerInZone(el, zone)
        return {
          cx: c.x,
          cy: c.y,
          rx: Math.max(48, Math.min(w * 0.28, 220)),
          ry: Math.max(24, Math.min(70, box.height * 0.28)),
        }
      }
      if (kind === 'clients') {
        const c = centerInZone(el, zone)
        return {
          cx: c.x,
          cy: c.y,
          rx: Math.max(56, box.width * 0.38),
          ry: Math.max(40, box.height * 0.34),
        }
      }
      // Project / music media: orbit the visible slice so tall grids stay on-screen.
      // If the section is still below the fold (hero-live evacuate), aim at its top edge.
      if (box.top > window.innerHeight * 0.28) {
        const zr = zone.getBoundingClientRect()
        return {
          cx: box.left + box.width * 0.5 - zr.left,
          cy: box.top + Math.min(90, Math.max(36, box.height * 0.1)) - zr.top,
          rx: Math.max(64, Math.min(box.width * 0.34, w * 0.34)),
          ry: Math.max(32, 64),
        }
      }
      const c = centerInZoneVisible(el, zone)
      return {
        cx: c.x,
        cy: c.y,
        rx: Math.max(72, Math.min(c.visibleW * 0.42, w * 0.4)),
        ry: Math.max(44, Math.min(c.visibleH * 0.36, 150)),
      }
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
      let hoverTarget = resolveHoverTarget()
      let effectiveHoverKind = hoverRef.current.kind

      // Coarse pointers can't hover — attend the most visible project card instead.
      // Ignore touch-driven card hover (it only flashes on tap/leave); scroll owns cards.
      // Keep attending after the hero goes live so project grids still get outline orbits.
      if (mobile && (effectiveHoverKind === 'card' || !hoverTarget)) {
        if (effectiveHoverKind === 'card') {
          hoverTarget = null
          effectiveHoverKind = null
        }
        if (frame % 6 === 0) {
          const vhNow = window.innerHeight
          let bestEl: HTMLElement | null = null
          let bestScore = 0
          for (const card of zone.querySelectorAll<HTMLElement>(
            '.project-card, .music-player-album-thumb.has-poster, .pc-engage-card, .home-engage-proof-card',
          )) {
            if (card.classList.contains('project-card--coming-soon')) continue
            const box = card.getBoundingClientRect()
            const visible = Math.max(0, Math.min(box.bottom, vhNow) - Math.max(box.top, 0))
            if (visible <= 0) continue
            const ratio = visible / Math.min(box.height, vhNow)
            if (ratio < 0.28) continue
            const mid = (box.top + box.bottom) / 2
            const centerBias = 1 - Math.min(1, Math.abs(mid - vhNow * 0.42) / (vhNow * 0.7))
            // Active album art gets first claim so lights orbit the selected song card.
            const activeBoost = card.classList.contains('is-active') ? 1.35 : 1
            const score = ratio * (0.55 + 0.45 * centerBias) * activeBoost
            if (score > bestScore) {
              bestScore = score
              bestEl = card
            }
          }
          if (bestScore >= 0.22 && bestEl) {
            scrollAttendEl = bestEl
            scrollAttendId = bestEl.id
          } else {
            scrollAttendEl = null
            scrollAttendId = ''
          }
        }
        if (scrollAttendEl?.isConnected) {
          hoverTarget = scrollAttendEl
          effectiveHoverKind = 'card'
        } else {
          scrollAttendEl = null
          scrollAttendId = ''
        }
      }

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
      if (frame % 45 === 1) refreshAnchors()

      // Free-orbit around the most visible page anchor (hero scene, grids, clients, RFO).
      let cx = w / 2
      let cy = Math.min(h * 0.35, window.innerHeight * 0.45)
      let rx = Math.max(40, w * 0.42)
      let ry = Math.max(28, Math.min(120, h * 0.08))
      let freeRect: { halfW: number; halfH: number } | null = null

      const vh = window.innerHeight
      let best: OrbitAnchor | null = null
      let bestScore = 0
      let bestBox: DOMRect | null = null
      for (const anchor of anchors) {
        if (!anchor.el.isConnected) continue
        // Once the raven live scene starts, leave the hero frame for the page below.
        if (heroLive && anchor.kind === 'hero') continue
        if (hoverRef.current.kind === 'hero' && heroLive) {
          hoverRef.current = { kind: null, index: null, el: null }
        }
        const box = anchor.el.getBoundingClientRect()
        const s = visibilityScore(box, vh)
        if (s > bestScore) {
          bestScore = s
          best = anchor
          bestBox = box
        }
      }
      if (heroLive && bestScore < 48) {
        const nextSection = anchors.find((a) => a.kind === 'section' && a.el.isConnected)
        if (nextSection) {
          best = nextSection
          bestBox = nextSection.el.getBoundingClientRect()
          bestScore = 100
        }
      }
      if (best && bestBox && bestScore > 8) {
        if (best.kind === 'hero') {
          const c = centerInZone(best.el, zone)
          cx = c.x
          cy = c.y
          freeRect = {
            halfW: bestBox.width * 0.5 + 12,
            halfH: bestBox.height * 0.5 + 12,
          }
        } else {
          const orbit = applyOrbitFor(best.kind, best.el, bestBox, w)
          cx = orbit.cx
          cy = orbit.cy
          rx = orbit.rx
          ry = orbit.ry
        }
      }
      if (evacuateBoost > 0) {
        evacuateBoost = Math.max(0, evacuateBoost - dtMs / 1400)
      }

      for (const b of bodies) {
        b.angle += b.dir * ((Math.PI * 2) / b.period) * dt * FREE_SPEED * (freeRect ? 0.275 : 1)
      }

      const bases = bodies.map((b, i) => {
        if (freeRect) {
          const t = (((b.angle / TAU) % 1) + 1 + i / ORB_COUNT) % 1
          return pointOnRectPerimeter(cx, cy, freeRect.halfW, freeRect.halfH, t)
        }
        return orbitPoint(cx, cy, rx, ry, b)
      })
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
      const hoverKind = effectiveHoverKind
      const key =
        hoverTarget != null
          ? `${hoverKind ?? 'card'}:${hoverRef.current.index ?? ''}:${hoverTarget.id || scrollAttendId}`
          : ''

      if (hoverTarget) {
        releaseBlend = 0
        const box = hoverTarget.getBoundingClientRect()
        const { x: mx, y: my } = centerInZone(hoverTarget, zone)
        // RFO: hug the letter. Cards / hero window: rectangular outline.
        // Client tiles: circular ring outside the mark.
        let radius = 0
        let rectHalfW = 0
        let rectHalfH = 0
        const useRectPath = hoverKind === 'card' || hoverKind === 'hero' || scrollAttendEl === hoverTarget
        if (hoverKind === 'rfo') {
          const circleR = Math.min(box.width, box.height) * 0.5
          radius = Math.max(20, circleR + 14)
        } else if (useRectPath) {
          rectHalfW = box.width * 0.5 + 12
          rectHalfH = box.height * 0.5 + 12
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
          if (useRectPath) {
            const nearestT = rectPerimeterT(
              mx,
              my,
              rectHalfW,
              rectHalfH,
              disp[nearest].x,
              disp[nearest].y,
            )
            hoverPhase = nearestT * TAU
            ringSlots = assignRingSlots(disp, mx, my, hoverPhase)
            hoverPhase -= (ringSlots[nearest] * TAU) / ORB_COUNT
          } else {
            hoverPhase = Math.atan2(disp[nearest].y - my, disp[nearest].x - mx)
            ringSlots = assignRingSlots(disp, mx, my, hoverPhase)
            hoverPhase -= (ringSlots[nearest] * TAU) / ORB_COUNT
          }
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
        // Cards (incl. mobile scroll-attend): slow outline. Hero window: moderate.
        const speedScale =
          hoverKind === 'card' || scrollAttendEl === hoverTarget
            ? 0.375
            : hoverKind === 'hero'
              ? 0.275
              : 1
        hoverPhase += (dtMs / HOVER_ORBIT_MS) * TAU * spin * speedScale
        if (hoverPhase > TAU) hoverPhase -= TAU

        const follow =
          FOLLOW_ARRIVE + (FOLLOW_HOVER - FOLLOW_ARRIVE) * (1 - arriveBlend) ** 1.25
        const easeArrive = 1 - Math.pow(1 - follow, dtMs / 16.67)

        for (let i = 0; i < bodies.length; i++) {
          const slot = ringSlots[i]
          let ax: number
          let ay: number
          if (useRectPath) {
            const t = (hoverPhase / TAU + slot / ORB_COUNT) % 1
            const pt = pointOnRectPerimeter(mx, my, rectHalfW, rectHalfH, t)
            ax = pt.x
            ay = pt.y
          } else {
            const angle = hoverPhase + (slot * TAU) / ORB_COUNT
            ax = mx + Math.cos(angle) * radius
            ay = my + Math.sin(angle) * radius
          }
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
            if (freeRect) {
              const t = rectPerimeterT(
                cx,
                cy,
                freeRect.halfW,
                freeRect.halfH,
                disp[i].x,
                disp[i].y,
              )
              bodies[i].angle = (t - i / ORB_COUNT) * TAU
            } else {
              syncAngleFromPosition(bodies[i], disp[i].x, disp[i].y, cx, cy, rx, ry)
            }
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
          const dist = Math.hypot(targets[i].x - disp[i].x, targets[i].y - disp[i].y)
          // Catch up faster when the active section jumps (scroll / section handoff).
          const catchUp =
            evacuateBoost > 0
              ? 3.4
              : dist > 240
                ? 2.4
                : dist > 120
                  ? 1.7
                  : 1.25
          const pull = Math.min(1, ease * (releaseBlend > 0 ? 1 : catchUp))
          disp[i].x += (targets[i].x - disp[i].x) * pull
          disp[i].y += (targets[i].y - disp[i].y) * pull
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
      window.removeEventListener('iom:hero-live', onHeroLive)
      zone.classList.remove(
        'is-attending',
        'is-in-view',
        'site-orb-zone--static',
        'site-orb-zone--hero-live',
      )
    }
}