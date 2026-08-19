import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PANEL_WIDTH_M, REST_BEND, previewRadiusMm } from './bendMath'
import { LinarControls } from './LinarControls'
import { LinarProductInfo } from './LinarProductInfo'
import { LinarScene } from './LinarScene'
import {
  CONCEPT_DISCLAIMER,
  PARTNER_CONFIRMATION_NOTE,
  resolveLinarTech,
  suggestedIncisionLengthMm,
} from './linarData'
import type { LinarConfig, LinarSide, LinarViewId } from './types'
import { DEFAULT_LINAR_CONFIG, cloneConfig } from './types'
import './dukta-linar-concept.css'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const GEOM_KEYS: (keyof LinarConfig)[] = ['material', 'thicknessMm', 'cutWidthMm', 'slatWidthMm']

export function DuktaLinarConceptPage() {
  const reducedMotion = useRef(prefersReducedMotion()).current
  const [targetBend, setTargetBend] = useState(reducedMotion ? REST_BEND : 0)
  const [config, setConfig] = useState<LinarConfig>(() => cloneConfig(DEFAULT_LINAR_CONFIG))
  const [resetViewToken, setResetViewToken] = useState(0)
  const [viewPreset, setViewPreset] = useState<LinarViewId>('hero')
  const [side, setSide] = useState<LinarSide>('front')
  const [viewToken, setViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const sliderRef = useRef<HTMLInputElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)
  const targetBendRef = useRef(targetBend)
  const interactedRef = useRef(reducedMotion)

  const tech = useMemo(() => resolveLinarTech(config), [config])
  const currentPreviewRadius = previewRadiusMm(
    targetBend,
    PANEL_WIDTH_M,
    tech.referenceMinimumRadiusMm,
  )

  const markInteracted = useCallback(() => {
    interactedRef.current = true
  }, [])

  const syncBendUi = useCallback((value: number) => {
    if (sliderRef.current) sliderRef.current.value = String(value)
    if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
  }, [])

  const onBendInput = useCallback((value: number) => {
    interactedRef.current = true
    targetBendRef.current = value
    setTargetBend(value)
    if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
  }, [])

  const onIntroBend = useCallback(
    (value: number) => {
      if (interactedRef.current) return
      targetBendRef.current = value
      setTargetBend(value)
      syncBendUi(value)
    },
    [syncBendUi],
  )

  const onConfig = useCallback((patch: Partial<LinarConfig>) => {
    interactedRef.current = true
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      const geomChanged = GEOM_KEYS.some((key) => patch[key] !== undefined && patch[key] !== prev[key])
      if (geomChanged && patch.incisionLengthMm == null) {
        // Follow another validated sample only when the current incision was
        // already following its sample. A manually chosen/reference opening
        // (including the supplied 40 mm visual cell) must not jump to a new
        // length merely because material, thickness, cut, or slat width changed.
        const previousSuggested = suggestedIncisionLengthMm({ ...prev, pattern: 'regular' })
        const followsPreviousSample =
          previousSuggested != null && prev.incisionLengthMm === previousSuggested
        if (followsPreviousSample) {
          const suggested = suggestedIncisionLengthMm({ ...next, pattern: 'regular' })
          if (suggested != null) next.incisionLengthMm = suggested
        }
      }
      return next
    })
  }, [])

  const onResetPanel = useCallback(() => {
    interactedRef.current = true
    targetBendRef.current = REST_BEND
    setTargetBend(REST_BEND)
    setConfig(cloneConfig(DEFAULT_LINAR_CONFIG))
    syncBendUi(REST_BEND)
  }, [syncBendUi])

  useEffect(() => {
    document.body.classList.add('linar-route')
    document.documentElement.classList.add('linar-route')
    return () => {
      document.body.classList.remove('linar-route')
      document.documentElement.classList.remove('linar-route')
    }
  }, [])

  return (
    <div className="linar-page">
      <header className="linar-header">
        <p className="linar-brand">dukta flexible wood</p>
        <span className="linar-badge">Interactive concept</span>
      </header>

      <div className="linar-body">
        <section className="linar-viewport" aria-label="LINAR panel preview">
          {webglFailed ? (
            <p className="linar-fallback">
              The interactive 3D preview is not available on this device. You can still review
              the LINAR product information below.
            </p>
          ) : (
            <>
              <LinarScene
                targetBendRef={targetBendRef}
                config={config}
                tech={tech}
                resetViewToken={resetViewToken}
                viewPreset={viewPreset}
                side={side}
                viewToken={viewToken}
                interactedRef={interactedRef}
                reducedMotion={reducedMotion}
                onUnavailable={() => setWebglFailed(true)}
                onUserInteract={markInteracted}
                onIntroBend={onIntroBend}
              />
              <p className="linar-viewport__hint">Drag to rotate. Scroll or pinch to zoom.</p>
            </>
          )}
        </section>

        <aside className="linar-side">
          <div className="linar-side__scroll">
            <div className="linar-intro">
              <h1 className="linar-title">LINAR</h1>
              <p className="linar-lead">
                Explore how regular incision geometry allows a normally rigid wood-based panel to
                form a flexible architectural surface.
              </p>
            </div>

            <LinarControls
              bend={targetBend}
              config={config}
              tech={tech}
              previewRadiusMm={currentPreviewRadius}
              sliderRef={sliderRef}
              percentRef={percentRef}
              onBendInput={onBendInput}
              onConfig={onConfig}
              onResetView={() => {
                setSide('front')
                setViewPreset('hero')
                setResetViewToken((n) => n + 1)
              }}
              onResetPanel={() => {
                setSide('front')
                setViewPreset('hero')
                setViewToken((n) => n + 1)
                onResetPanel()
              }}
              viewPreset={viewPreset}
              onViewPreset={(id) => {
                if (id === 'hero') setSide('front')
                if (id === 'reverse') setSide('back')
                setViewPreset(id)
                setViewToken((n) => n + 1)
              }}
              side={side}
              onSideChange={(next) => {
                setSide(next)
                setViewPreset(next === 'back' ? 'reverse' : 'hero')
                setViewToken((n) => n + 1)
              }}
            />

            <LinarProductInfo config={config} tech={tech} />

            <p className="linar-disclaimer">
              {CONCEPT_DISCLAIMER} {PARTNER_CONFIRMATION_NOTE}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
