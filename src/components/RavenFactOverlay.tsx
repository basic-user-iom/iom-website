import { useEffect, useRef, useState } from 'react'
import { RAVEN_FACTS } from '../data/ravenFacts'

type RavenFactPhase = 'idle' | 'scan' | 'fact'

type RavenFactOverlayProps = {
  active: boolean
}

const FIRST_FACT_DELAY = [5200, 7600] as const
const BETWEEN_FACT_DELAY = [10500, 17500] as const
const SCAN_DURATION = 1550

function randomDelay([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min)
}

function makeFactOrder(length: number) {
  if (length <= 1) return [0]
  const start = Math.floor(Math.random() * length)
  // Seven is coprime with 30, so every field note appears before the sequence repeats.
  return Array.from({ length }, (_, index) => (start + index * 7) % length)
}

function readingDuration(body: string) {
  return Math.max(9000, Math.min(13500, 5200 + body.length * 42))
}

export function RavenFactOverlay({ active }: RavenFactOverlayProps) {
  const [phase, setPhase] = useState<RavenFactPhase>('idle')
  const [factIndex, setFactIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const factOrderRef = useRef<number[]>([])
  const factCursorRef = useRef(0)
  const firstFactRef = useRef(true)

  if (factOrderRef.current.length === 0) {
    factOrderRef.current = makeFactOrder(RAVEN_FACTS.length)
  }

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (active) return
    setPhase('idle')
    setPaused(false)
    firstFactRef.current = true
  }, [active])

  useEffect(() => {
    if (!active || paused || !pageVisible) return

    let delay = 0
    if (phase === 'idle') {
      delay = randomDelay(firstFactRef.current ? FIRST_FACT_DELAY : BETWEEN_FACT_DELAY)
    } else if (phase === 'scan') {
      delay = SCAN_DURATION
    } else {
      delay = readingDuration(RAVEN_FACTS[factIndex]?.body ?? '')
    }

    const timer = window.setTimeout(() => {
      if (phase === 'idle') {
        if (factCursorRef.current >= factOrderRef.current.length) {
          factOrderRef.current = makeFactOrder(RAVEN_FACTS.length)
          factCursorRef.current = 0
        }
        const nextIndex = factOrderRef.current[factCursorRef.current] ?? 0
        factCursorRef.current += 1
        firstFactRef.current = false
        setFactIndex(nextIndex)
        setPhase('scan')
      } else if (phase === 'scan') {
        setPhase('fact')
      } else {
        setPhase('idle')
      }
    }, delay)

    return () => window.clearTimeout(timer)
  }, [active, factIndex, pageVisible, paused, phase])

  if (!active) return null

  const fact = RAVEN_FACTS[factIndex] ?? RAVEN_FACTS[0]
  const sequenceNumber = factOrderRef.current.indexOf(factIndex) + 1

  return (
    <div
      className={`raven-facts raven-facts--${phase}${paused ? ' is-paused' : ''}`}
      data-phase={phase}
    >
      <div className="raven-fact-target" aria-hidden="true">
        <span className="raven-fact-target__orbit" />
        <span className="raven-fact-target__reticle" />
        <span className="raven-fact-target__sweep" />
      </div>

      {phase === 'fact' && fact ? (
        <aside className="raven-fact-card" role="note" aria-label="Raven field note">
          <div className="raven-fact-card__topline">
            <span>{fact.category}</span>
            <button
              type="button"
              className="raven-fact-card__pause"
              data-cursor="focus"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'Resume raven facts' : 'Pause raven facts'}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <p className="raven-fact-card__eyebrow">Did you know?</p>
          <h3>{fact.title}</h3>
          <p className="raven-fact-card__body">{fact.body}</p>
          <div className="raven-fact-card__footer">
            <span>
              Field note {String(Math.max(1, sequenceNumber)).padStart(2, '0')} /{' '}
              {String(RAVEN_FACTS.length).padStart(2, '0')}
            </span>
            <a
              href={fact.sourceUrl}
              target="_blank"
              rel="noreferrer"
              data-cursor="external"
            >
              {fact.sourceLabel}
            </a>
          </div>
        </aside>
      ) : null}
    </div>
  )
}
