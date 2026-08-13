import { useCallback, useEffect, useRef, useState } from 'react'
import { REST_BEND } from './bendMath'
import { LinarControls } from './LinarControls'
import { LinarProductInfo } from './LinarProductInfo'
import { LinarScene } from './LinarScene'
import type { LinarMaterialId } from './types'
import './dukta-linar-concept.css'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function DuktaLinarConceptPage() {
  const reducedMotion = useRef(prefersReducedMotion()).current
  const [targetBend, setTargetBend] = useState(reducedMotion ? REST_BEND : 0)
  const [material, setMaterial] = useState<LinarMaterialId>('mdf')
  const [resetViewToken, setResetViewToken] = useState(0)
  const [webglFailed, setWebglFailed] = useState(false)
  const sliderRef = useRef<HTMLInputElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)
  const targetBendRef = useRef(targetBend)
  const interactedRef = useRef(reducedMotion)

  const markInteracted = useCallback(() => {
    interactedRef.current = true
  }, [])

  const syncBendUi = useCallback((value: number) => {
    if (sliderRef.current) sliderRef.current.value = String(value)
    if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
  }, [])

  const onBendInput = useCallback(
    (value: number) => {
      interactedRef.current = true
      targetBendRef.current = value
      setTargetBend(value)
      if (percentRef.current) percentRef.current.textContent = `${Math.round(value)}%`
    },
    [],
  )

  const onIntroBend = useCallback(
    (value: number) => {
      if (interactedRef.current) return
      targetBendRef.current = value
      setTargetBend(value)
      syncBendUi(value)
    },
    [syncBendUi],
  )

  const onResetPanel = useCallback(() => {
    interactedRef.current = true
    targetBendRef.current = REST_BEND
    setTargetBend(REST_BEND)
    setMaterial('mdf')
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
            <LinarScene
              targetBendRef={targetBendRef}
              material={material}
              resetViewToken={resetViewToken}
              interactedRef={interactedRef}
              reducedMotion={reducedMotion}
              onUnavailable={() => setWebglFailed(true)}
              onUserInteract={markInteracted}
              onIntroBend={onIntroBend}
            />
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
              material={material}
              sliderRef={sliderRef}
              percentRef={percentRef}
              onBendInput={onBendInput}
              onMaterial={(id) => {
                markInteracted()
                setMaterial(id)
              }}
              onResetView={() => setResetViewToken((n) => n + 1)}
              onResetPanel={onResetPanel}
            />

            <LinarProductInfo />

            <p className="linar-disclaimer">
              Conceptual visualisation only. Panel behaviour, bending limits and manufacturability
              must be validated by dukta.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
