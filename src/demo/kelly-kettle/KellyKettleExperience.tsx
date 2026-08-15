import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { DEFAULT_PARTICLES, MOBILE_PARTICLES } from './constants'
import { DebugPanel } from './DebugPanel'
import { KellyKettleScene } from './KellyKettleScene'
import { ViewEditor } from './ViewEditor'
import { DEFAULT_VIEW_SETUPS } from './viewSetups'
import {
  STEPS,
  type CameraPose,
  type DebugControls,
  type DemoStep,
  type LabelAnchor,
  type QualityLevel,
  type SavedLabel,
  type SceneStats,
  type StepViewSetup,
} from './types'

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
    layoutEdit: false,
  })
  const [pose, setPose] = useState<CameraPose | null>(null)
  const [setups, setSetups] = useState<Partial<Record<DemoStep, StepViewSetup>>>(DEFAULT_VIEW_SETUPS)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)

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

  const visibleAnchors = useMemo(() => {
    const saved = setups[step]?.labels ?? []
    if (saved.length) {
      const live = new Map(anchors.map((anchor) => [anchor.id, anchor]))
      return saved.map((label) => ({
        ...label,
        visible: live.get(label.id)?.visible ?? true,
      }))
    }
    return anchors.filter((anchor) => anchor.visible)
  }, [anchors, setups, step])

  const liveLabels: SavedLabel[] = visibleAnchors.map((anchor) => ({
    id: anchor.id,
    text: anchor.text,
    x: anchor.x,
    y: anchor.y,
    side: anchor.side,
  }))

  const moveLabel = (id: string, x: number, y: number) => {
    setSetups((prev) => {
      const current = prev[step] ?? { camera: pose, labels: [] }
      const labels = current.labels.filter((label) => label.id !== id)
      const source = visibleAnchors.find((anchor) => anchor.id === id)
      if (!source) return prev
      labels.push({ id, text: source.text, x, y, side: source.side })
      return { ...prev, [step]: { ...current, labels } }
    })
  }

  const onLabelPointerDown = (anchor: LabelAnchor, event: PointerEvent<HTMLLIElement>) => {
    if (!debug.layoutEdit) return
    event.preventDefault()
    event.stopPropagation()
    const box = viewportRef.current?.getBoundingClientRect()
    if (!box) return
    dragRef.current = {
      id: anchor.id,
      dx: event.clientX - box.left - (anchor.x / 100) * box.width,
      dy: event.clientY - box.top - (anchor.y / 100) * box.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onLabelPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    const drag = dragRef.current
    const box = viewportRef.current?.getBoundingClientRect()
    if (!drag || !box) return
    event.preventDefault()
    const x = Math.min(94, Math.max(6, ((event.clientX - box.left - drag.dx) / box.width) * 100))
    const y = Math.min(92, Math.max(6, ((event.clientY - box.top - drag.dy) / box.height) * 100))
    moveLabel(drag.id, x, y)
  }

  const onLabelPointerUp = () => {
    dragRef.current = null
  }

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
      <div className="kk-viewport" aria-label="Kelly Kettle demonstration" ref={viewportRef}>
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
          onCameraPose={setPose}
        />

        <ul
          className={`kk-labels${debug.layoutEdit ? ' is-edit' : ''}${setups[step]?.labels.length ? ' is-placed' : ''}`}
          aria-hidden={!debug.layoutEdit}
        >
          {visibleAnchors.map((anchor) => (
            <li
              key={anchor.id}
              className={`kk-label kk-label--${anchor.side}${debug.layoutEdit ? ' is-edit' : ''}`}
              style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
              onPointerDown={(event) => onLabelPointerDown(anchor, event)}
              onPointerMove={onLabelPointerMove}
              onPointerUp={onLabelPointerUp}
              onPointerCancel={onLabelPointerUp}
            >
              <span className="kk-label__line" />
              <span className="kk-label__text">{anchor.text}</span>
            </li>
          ))}
        </ul>

        {import.meta.env.DEV ? (
          <ViewEditor
            open={debug.layoutEdit}
            step={step}
            pose={pose}
            setups={setups}
            liveLabels={liveLabels}
            onToggle={() => {
              setDebug((prev) => ({ ...prev, layoutEdit: !prev.layoutEdit, autoRotate: false }))
              interactedRef.current = true
            }}
            onSaveCamera={() => {
              if (!pose) return
              setSetups((prev) => ({
                ...prev,
                [step]: { camera: pose, labels: prev[step]?.labels ?? liveLabels },
              }))
            }}
          />
        ) : null}

        {step === 'complete' ? (
          <div className="kk-complete" role="status">
            <p className="kk-complete__lead">
              A small fire. Strong natural airflow. Water heated from the inside.
            </p>
            <p className="kk-complete__body">
              The chimney places a large heating surface directly between the fire and the
              surrounding water.
            </p>
            <p className="kk-complete__note">
              Designed to boil water outdoors in approximately 3–5 minutes.
            </p>
            <button type="button" className="kk-primary" onClick={() => go('explore')}>
              Explore again
            </button>
          </div>
        ) : (
          <p className="kk-orbit-hint">
            <span className="kk-orbit-hint__mouse">Drag to rotate. Scroll to zoom.</span>
            <span className="kk-orbit-hint__touch">Drag to rotate. Pinch to zoom.</span>
          </p>
        )}
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
          className="kk-step"
          onClick={() => {
            interactedRef.current = true
            setResetViewToken((n) => n + 1)
          }}
          aria-label="Reset camera view"
        >
          Reset view
        </button>
      </div>

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
