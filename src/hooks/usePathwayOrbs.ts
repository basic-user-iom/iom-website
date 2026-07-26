import { useEffect, type RefObject } from 'react'

const ORB_COUNT = 3
const HOVER_ORBIT_MS = 2800
const FOLLOW_FREE = 0.2
const FOLLOW_HOVER = 0.42
const FOLLOW_ARRIVE = 0.07
const ARRIVE_MS = 850
const FOLLOW_RELEASE = 0.055
const RELEASE_MS = 1100
const COUPLE = 0.045
const SOFTEN = 2200
const FREE_SPEED = 0.7
const TAU = Math.PI * 2

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

function centerInStage(el: HTMLElement, stage: HTMLElement): { x: number; y: number } {
  const er = el.getBoundingClientRect()
  const sr = stage.getBoundingClientRect()
  return {
    x: er.left + er.width / 2 - sr.left,
    y: er.top + er.height / 2 - sr.top,
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

/** Clients-style light orbs for the RFO pathway — free drift in view, ring on node hover. */
export function usePathwayOrbs(
  stageRef: RefObject<HTMLElement | null>,
  nodeRefs: RefObject<(HTMLElement | null)[]>,
  hoverIndexRef: RefObject<number | null>,
) {
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    if (prefersReducedMotion()) {
      stage.classList.add('about-pathway--static')
      return
    }

    let raf = 0
    let lastTs = performance.now()
    let active = false
    const bodies = seedBodies()
    let hoverPhase = 0
    let wasHovering = false
    let hoverNodeIndex = -1
    let ringSlots = [0, 1, 2]
    let arriveBlend = 0
    let releaseBlend = 0
    let displayScale = 1.35
    const disp = bodies.map(() => ({ x: 0, y: 0 }))
    const coast = bodies.map(() => ({ vx: 0, vy: 0 }))
    const prevDisp = bodies.map(() => ({ x: 0, y: 0 }))
    let seededDisp = false

    const io = new IntersectionObserver(
      ([entry]) => {
        active = entry?.isIntersecting ?? false
        stage.classList.toggle('is-in-view', active)
      },
      { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(stage)

    const tick = (ts: number) => {
      const orbs = stage.querySelectorAll<HTMLSpanElement>('.clients-orb')
      if (orbs.length < ORB_COUNT) {
        raf = window.requestAnimationFrame(tick)
        return
      }

      const dtMs = Math.min(48, ts - lastTs)
      lastTs = ts
      const dt = dtMs / 1000

      if (!active) {
        for (const el of orbs) el.style.opacity = '0'
        raf = window.requestAnimationFrame(tick)
        return
      }

      const w = stage.clientWidth
      const h = stage.clientHeight
      // Orbs are 10px + ~40px bloom; keep the full glow inside the stage.
      const pad = 52
      const minX = pad
      const maxX = Math.max(pad, w - pad)
      const minY = pad
      const maxY = Math.max(pad, h - pad)
      const clamp = (x: number, y: number) => ({
        x: Math.min(maxX, Math.max(minX, x)),
        y: Math.min(maxY, Math.max(minY, y)),
      })
      // Tight free orbit around the RFO nodes (not the full stage height).
      const rx = Math.max(40, Math.min(w * 0.28, (w / 2 - pad) * 0.85))
      const ry = Math.max(16, Math.min(h * 0.16, (h / 2 - pad) * 0.55))
      const cx = w / 2
      const cy = Math.min(maxY - ry, Math.max(minY + ry, h * 0.62))

      for (const b of bodies) {
        b.angle += b.dir * ((Math.PI * 2) / b.period) * dt * FREE_SPEED
      }

      const bases = bodies.map((b) => {
        const p = orbitPoint(cx, cy, rx, ry, b)
        return clamp(p.x, p.y)
      })
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
        return clamp(tx, ty)
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
      const nodes = nodeRefs.current ?? []
      const hoverNode = hoverIndex != null ? nodes[hoverIndex] : null
      const easeRelease = 1 - Math.pow(1 - FOLLOW_RELEASE, dtMs / 16.67)

      if (hoverNode) {
        releaseBlend = 0
        // Orbit the letter circle itself (not the whole RFO column with labels).
        const box = hoverNode.getBoundingClientRect()
        const { x: mx, y: my } = centerInStage(hoverNode, stage)
        const circleR = Math.min(box.width, box.height) * 0.5
        const maxRing = Math.max(
          12,
          Math.min(mx - minX, maxX - mx, my - minY, maxY - my) - 6,
        )
        // Ring sits just outside the cyan letter circle.
        const radius = Math.min(maxRing, Math.max(20, circleR + 14))

        if (!wasHovering || hoverNodeIndex !== hoverIndex) {
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
          hoverNodeIndex = hoverIndex ?? -1
          arriveBlend = 1
          stage.classList.add('is-attending')
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
          const target = clamp(
            mx + Math.cos(angle) * radius,
            my + Math.sin(angle) * radius,
          )
          prevDisp[i].x = disp[i].x
          prevDisp[i].y = disp[i].y
          disp[i].x += (target.x - disp[i].x) * easeArrive
          disp[i].y += (target.y - disp[i].y) * easeArrive
        }
        displayScale += (1.35 - displayScale) * Math.min(1, easeArrive)
      } else {
        if (wasHovering) {
          wasHovering = false
          hoverNodeIndex = -1
          releaseBlend = 1
          stage.classList.remove('is-attending')
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
          const c = clamp(disp[i].x, disp[i].y)
          disp[i].x = c.x
          disp[i].y = c.y
          prevDisp[i].x = disp[i].x
          prevDisp[i].y = disp[i].y
        }

        const scaleTarget = bodies.reduce((s, b) => s + b.scale, 0) / bodies.length
        displayScale += (scaleTarget - displayScale) * Math.min(1, easeRelease * 1.2)
      }

      for (let i = 0; i < ORB_COUNT; i++) {
        const c = clamp(disp[i].x, disp[i].y)
        disp[i].x = c.x
        disp[i].y = c.y
        bodies[i].x = c.x
        bodies[i].y = c.y
        const el = orbs[i]
        const scale = Math.min(
          1.35,
          hoverNode
            ? displayScale
            : bodies[i].scale + (displayScale - bodies[i].scale) * releaseBlend * 0.35,
        )
        el.style.opacity = '0.92'
        el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${scale})`
        el.classList.toggle('is-attending-orb', hoverNode != null)
      }

      for (let i = 0; i < nodes.length; i++) {
        nodes[i]
          ?.closest('.about-pathway-item')
          ?.classList.toggle('is-lit', hoverIndex === i)
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      io.disconnect()
      stage.classList.remove('is-attending', 'is-in-view', 'about-pathway--static')
    }
  }, [stageRef, nodeRefs, hoverIndexRef])
}
