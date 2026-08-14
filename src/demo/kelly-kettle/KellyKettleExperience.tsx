import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PARTICLES, MOBILE_PARTICLES } from './constants'
import { DebugPanel } from './DebugPanel'
import { KellyKettleScene } from './KellyKettleScene'
import { STEPS, type DebugControls, type DemoStep, type LabelAnchor, type QualityLevel, type SceneStats } from './types'

type Props = {
  reducedMotion: boolean
  quality: QualityLevel
  onFirstFrame?: () => void
}

export function KellyKettleExperience({ reducedMotion, quality, onFirstFrame }: Props) {
  const [step, setStep] = useState<DemoStep>('explore')
  const [resetViewToken, setResetViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const [anchors, setAnchors] = useState<LabelAnchor[]>([])
  const [stats, setStats] = useState<SceneStats>({
    fps: 0,
    triangles: 0,
    transferredBytes: 0,
    modelSource: 'procedural',
  })
  const [noteOpen, setNoteOpen] = useState(false)
  const [debug, setDebug] = useState<DebugControls>({
    modelSource: 'procedural',
    forceCutaway: false,
    fireIntensity: 1,
    airflowVisible: true,
    waterVisible: true,
    particleCount: quality === 'mobile' ? MOBILE_PARTICLES : DEFAULT_PARTICLES,
    autoRotate: true,
    mobilePerformance: quality === 'mobile',
    silhouetteCompare: false,
    handleAngle: 0,
    whistleInserted: true,
    chainVisible: true,
    chainDebug: false,
    handleCollisionDebug: false,
    emberIntensity: 1,
    chimneyFlameHeight: 1,
    exteriorOrCutaway: 'auto',
    metalRoughness: 0.48,
    showReferenceOverlay: false,
  })

  const stepRef = useRef(step)
  stepRef.current = step
  const debugRef = useRef(debug)
  debugRef.current = debug
  const interactedRef = useRef(reducedMotion)

  const go = useCallback((next: DemoStep) => {
    interactedRef.current = true
    setStep(next)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        if (step === 'explore') go('cutaway')
        else if (step === 'cutaway') go('fire')
      }
      if (event.key === 'ArrowLeft') {
        if (step === 'cutaway') go('explore')
        else if (step === 'fire' || step === 'complete') go('cutaway')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, step])

  const visibleAnchors = useMemo(() => anchors.filter((a) => a.visible), [anchors])

  if (webglFailed) {
    return (
      <p className="kk-fallback">
        The interactive 3D demonstration is not available on this device. The Kelly Kettle is a
        double-walled chimney: a small fire in the base draws air up the centre, and water in the
        surrounding jacket is heated from the inside.
      </p>
    )
  }

  return (
    <>
      <div className="kk-viewport" aria-label="Kelly Kettle demonstration">
        <KellyKettleScene
          stepRef={stepRef}
          debugRef={debugRef}
          reducedMotion={reducedMotion}
          quality={debug.mobilePerformance ? 'mobile' : quality}
          resetViewToken={resetViewToken}
          interactedRef={interactedRef}
          onUnavailable={() => setWebglFailed(true)}
          onUserInteract={() => {
            interactedRef.current = true
          }}
          onAnchors={setAnchors}
          onStats={setStats}
          onFireComplete={() => setStep('complete')}
          onFirstFrame={onFirstFrame}
        />

        <ul className="kk-labels" aria-hidden="true">
          {visibleAnchors.map((anchor) => (
            <li
              key={anchor.id}
              className={`kk-label kk-label--${anchor.side}`}
              style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
            >
              <span className="kk-label__line" />
              <span className="kk-label__text">{anchor.text}</span>
            </li>
          ))}
        </ul>

        <p className="kk-orbit-hint">
          <span className="kk-orbit-hint__mouse">Drag to rotate. Scroll to zoom.</span>
          <span className="kk-orbit-hint__touch">Drag to rotate. Pinch to zoom.</span>
        </p>
        {import.meta.env.DEV && debug.showReferenceOverlay ? (
          <div className="kk-ref-overlay" aria-hidden="true" />
        ) : null}
      </div>

      <div className="kk-steps" role="group" aria-label="Demonstration steps">
        {STEPS.map((item, index) => {
          const active = step === item.id || (step === 'complete' && item.id === 'fire')
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'kk-step is-active' : 'kk-step'}
              aria-pressed={active}
              aria-label={`${item.label}. ${item.hint}`}
              onClick={() => go(item.id)}
            >
              <span className="kk-step__n">{index + 1}</span>
              <span className="kk-step__label">{item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="kk-text-btn"
          onClick={() => setResetViewToken((n) => n + 1)}
          aria-label="Reset camera view"
        >
          Reset view
        </button>
      </div>

      {step === 'complete' && (
        <div className="kk-complete" role="status">
          <p className="kk-complete__lead">
            A small fire. Strong natural airflow. Water heated from the inside.
          </p>
          <p className="kk-complete__body">
            The chimney places a large heating surface directly between the fire and the surrounding
            water.
          </p>
          <p className="kk-complete__note">
            Designed to boil water outdoors in approximately 3–5 minutes.
          </p>
          <button type="button" className="kk-primary" onClick={() => go('explore')}>
            Explore again
          </button>
        </div>
      )}

      <p className="kk-text-explainer">
        Cool air enters the fire-base opening, the chimney draws heat upward, and water in the outer
        jacket is warmed by that inner surface — not by sitting on a flame.
      </p>
      <p className="kk-step-hint">
        {step === 'complete'
          ? 'The chimney is both the flue and the heating surface.'
          : STEPS.find((item) => item.id === step)?.hint}
      </p>

      <details
        className="kk-note"
        open={noteOpen}
        onToggle={(event) => setNoteOpen(event.currentTarget.open)}
      >
        <summary>About this draft model</summary>
        <p>
          The 3D object in this demonstration is an approximate model reconstructed from publicly
          available product images. A final implementation would use a dedicated, production-accurate
          model of the real product.
        </p>
      </details>

      {import.meta.env.DEV ? (
        <DebugPanel debug={debug} stats={stats} onChange={setDebug} />
      ) : null}
    </>
  )
}
