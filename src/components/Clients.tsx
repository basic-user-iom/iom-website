import { memo, useEffect, useRef, useState } from 'react'
import { CLIENTS } from '../data/clients'

type ClientsStyle = 'wordmarks' | 'logos'

const STYLE_KEY = 'iom.clients.style'
/** Distance (px) where orb reflection falls off to zero. */
const REFLECT_FALLOFF = 280
/** Full orbit duration in ms (slower = more subtle). */
const ORBIT_MS = 16000

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

export const Clients = memo(function Clients() {
  const [style, setStyle] = useState<ClientsStyle>(() => readStoredStyle())
  const stageRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLSpanElement>(null)
  const marksRef = useRef<(HTMLAnchorElement | null)[]>([])
  const pausedRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, style)
    } catch {
      /* ignore */
    }
  }, [style])

  useEffect(() => {
    const stage = stageRef.current
    const orb = orbRef.current
    if (!stage || !orb) return

    if (prefersReducedMotion()) {
      stage.classList.add('clients-stage--static')
      return
    }

    const onEnter = () => {
      pausedRef.current = true
      stage.classList.add('is-paused')
    }
    const onLeave = () => {
      pausedRef.current = false
      stage.classList.remove('is-paused')
    }
    stage.addEventListener('pointerenter', onEnter)
    stage.addEventListener('pointerleave', onLeave)

    let raf = 0
    let lastAngle = 0
    let lastTs = performance.now()

    const tick = (ts: number) => {
      const dt = Math.min(48, ts - lastTs)
      lastTs = ts

      if (!pausedRef.current) {
        lastAngle = (lastAngle + (dt / ORBIT_MS) * Math.PI * 2) % (Math.PI * 2)
      }

      const w = stage.clientWidth
      const h = stage.clientHeight
      const rx = Math.max(40, w * 0.48)
      const ry = Math.max(28, h * 0.42)
      const cx = w / 2
      const cy = h / 2
      const ox = cx + Math.cos(lastAngle) * rx
      const oy = cy + Math.sin(lastAngle) * ry

      // Orb sits closer to the camera; logos sit on a deeper plane.
      orb.style.transform = `translate3d(${ox}px, ${oy}px, 72px) scale(1.35)`

      const stageBox = stage.getBoundingClientRect()
      const pageX = stageBox.left + ox
      const pageY = stageBox.top + oy

      for (const mark of marksRef.current) {
        if (!mark) continue
        const box = mark.getBoundingClientRect()
        const x = ((pageX - box.left) / Math.max(box.width, 1)) * 100
        const y = ((pageY - box.top) / Math.max(box.height, 1)) * 100
        const mx = box.left + box.width / 2
        const my = box.top + box.height / 2
        const dist = Math.hypot(pageX - mx, pageY - my)
        const intensity = Math.max(0, 1 - dist / REFLECT_FALLOFF)
        mark.style.setProperty('--reflect-x', `${x}%`)
        mark.style.setProperty('--reflect-y', `${y}%`)
        mark.style.setProperty('--reflect-i', intensity.toFixed(3))
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      stage.removeEventListener('pointerenter', onEnter)
      stage.removeEventListener('pointerleave', onLeave)
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
        <span className="clients-orb" ref={orbRef} aria-hidden="true" />
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
                title={client.name}
                style={{ ['--client-brand' as string]: client.brandColor }}
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
