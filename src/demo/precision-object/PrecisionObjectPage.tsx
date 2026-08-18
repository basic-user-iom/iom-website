import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AppShell } from './AppShell'
import { isPrecisionObjectUnlocked, tryCrmEmbedUnlock, unlockPrecisionObject } from './auth'
import { ClosingCTA } from './ClosingCTA'
import { DetailPanel } from './DetailPanel'
import { HeroSection } from './HeroSection'
import { HotspotLayer } from './HotspotLayer'
import { MechanismMode } from './MechanismMode'
import { ModelErrorBoundary } from './ModelErrorBoundary'
import { LookPanel } from './LookPanel'
import { defaultLook, loadStoredLook, type SavedLook } from './lookStudio'
import { HOTSPOTS, PRODUCT } from './productConfig'
import { ProductScene } from './ProductScene'
import { StorySection } from './StorySection'
import { ViewerControls } from './ViewerControls'
import type {
  CameraPresetId,
  LightingPresetId,
  LoadState,
  ModelCapabilities,
  ScreenHotspot,
  ViewerApi,
} from './types'
import { hasWebGL, prefersReducedMotion } from './webgl'
import './precision-object.css'

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockPrecisionObject(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="pov-page pov-page--gate">
      <div className="pov-gate">
        <div className="pov-gate__panel">
          <p className="pov-gate__brand">IOM · Precision object study</p>
          <p className="pov-gate__hint">Private preview. Enter the password to continue.</p>
          <form className="pov-gate__form" onSubmit={submit}>
            <input
              className="pov-gate__input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(false)
              }}
              autoFocus
            />
            <button className="pov-gate__submit" type="submit">
              Enter
            </button>
            {error ? <p className="pov-gate__error">Incorrect password.</p> : null}
          </form>
        </div>
      </div>
    </div>
  )
}

export function PrecisionObjectPage() {
  const [unlocked, setUnlocked] = useState(
    () => (typeof window === 'undefined' ? false : isPrecisionObjectUnlocked() || tryCrmEmbedUnlock()),
  )
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <PrecisionObjectUnlockedPage />
}

function PrecisionObjectUnlockedPage() {
  const [webglFailed, setWebglFailed] = useState(() => (typeof window === 'undefined' ? false : !hasWebGL()))
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 })
  const [caps, setCaps] = useState<ModelCapabilities | null>(null)
  const [interacted, setInteracted] = useState(false)
  const [hotspots, setHotspots] = useState<ScreenHotspot[]>([])
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  const [autoRotate, setAutoRotate] = useState(() => !prefersReducedMotion())
  const [lighting, setLighting] = useState<LightingPresetId>('studio')
  const [motion, setMotion] = useState(() => !prefersReducedMotion())
  const [lookOpen, setLookOpen] = useState(false)
  const [placeMode, setPlaceMode] = useState(false)
  const [placeHotspotId, setPlaceHotspotId] = useState<string | null>(null)
  const [look, setLook] = useState<SavedLook>(() => loadStoredLook() ?? defaultLook())
  const [exploded, setExploded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [inViewer, setInViewer] = useState(false)
  const wasViewer = useRef(false)
  const apiRef = useRef<ViewerApi | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLElement>(null)

  const onApi = useCallback((api: ViewerApi | null) => {
    apiRef.current = api
  }, [])

  useEffect(() => {
    document.body.classList.add('pov-route')
    document.documentElement.classList.add('pov-route')
    return () => {
      document.body.classList.remove('pov-route', 'pov-look-open')
      document.documentElement.classList.remove('pov-route', 'pov-look-open')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('pov-look-open', lookOpen)
    document.documentElement.classList.toggle('pov-look-open', lookOpen)
  }, [lookOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveHotspot(null)
        setLookOpen(false)
        setPlaceMode(false)
        apiRef.current?.setPlaceHotspots(false)
        if (document.fullscreenElement) {
          void apiRef.current?.exitFullscreen()
        }
      }
    }
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    const stage = stageRef.current
    if (!viewer || !stage) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
            if (entry.target === viewer) {
            const visible = entry.isIntersecting && entry.intersectionRatio > 0.45
            if (wasViewer.current && !visible) {
              setActiveHotspot(null)
              apiRef.current?.goToPreset('hero')
            }
            wasViewer.current = visible
            setInViewer(visible)
            apiRef.current?.setHeroBias(!visible)
          }
          if (entry.target === stage) {
            apiRef.current?.setActive(entry.isIntersecting)
          }
        }
      },
      { threshold: [0, 0.45, 0.8] },
    )
    io.observe(viewer)
    io.observe(stage)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!caps?.hasMotion) return
    apiRef.current?.setMotion(motion)
  }, [caps, motion])

  useEffect(() => {
    if (!caps?.loaded) return
    apiRef.current?.setLook(look)
  }, [caps, look])

  useEffect(() => {
    apiRef.current?.setPlaceHotspots(placeMode)
  }, [placeMode, caps])

  useEffect(() => {
    apiRef.current?.setPlaceHotspotId(placeHotspotId)
  }, [placeHotspotId, caps])

  const selectHotspot = useCallback((id: string) => {
    setActiveHotspot(id)
    if (placeMode || lookOpen) {
      setPlaceHotspotId(id)
      return
    }
    setInteracted(true)
    apiRef.current?.focusHotspot(id)
  }, [placeMode, lookOpen])

  const onStoryFocus = useCallback((preset: CameraPresetId, hotspotId?: string) => {
    scrollToId('viewer')
    setInteracted(true)
    if (hotspotId) {
      setActiveHotspot(hotspotId)
      apiRef.current?.focusHotspot(hotspotId)
      return
    }
    setActiveHotspot(null)
    apiRef.current?.goToPreset(preset)
  }, [])

  const loadPercent = load.status === 'loading' ? Math.round(load.progress * 100) : 100

  return (
    <AppShell>
      <div className="pov-stage" ref={stageRef}>
        <div className="pov-stage__canvas" ref={liveRef}>
          {webglFailed ? (
            <p className="pov-fallback">
              This browser cannot present the interactive object. The study remains available as a
              static product narrative below.
            </p>
          ) : (
            <ModelErrorBoundary
              fallback={
                <p className="pov-fallback">
                  The 3D presentation could not start. Refresh the page, or continue with the
                  written study below.
                </p>
              }
            >
              <ProductScene
                initialLook={look}
                onLoad={setLoad}
                onReady={setCaps}
                onInteract={() => setInteracted(true)}
                onHotspots={setHotspots}
                onUnavailable={() => setWebglFailed(true)}
                onApi={onApi}
                onMaterials={(materials) => {
                  setLook((prev) => (prev.materials.length > 0 ? prev : { ...prev, materials }))
                }}
                onHotspotPlaced={(id, position) => {
                  setLook((prev) => ({
                    ...prev,
                    hotspots: prev.hotspots.some((item) => item.id === id)
                      ? prev.hotspots.map((item) => (item.id === id ? { ...item, position } : item))
                      : [...prev.hotspots, { id, position }],
                  }))
                }}
              />
            </ModelErrorBoundary>
          )}

          {load.status === 'loading' && !webglFailed ? (
            <div className="pov-loader" role="status" aria-live="polite">
              <span className="pov-loader__label">Loading object</span>
              <span className="pov-loader__track">
                <span className="pov-loader__bar" style={{ width: `${loadPercent}%` }} />
              </span>
              <span className="pov-loader__pct">{loadPercent}%</span>
            </div>
          ) : null}

          {load.status === 'error' ? <p className="pov-error">{load.message}</p> : null}

          {!interacted && load.status === 'ready' && inViewer ? (
            <p className="pov-hint">
              <span className="pov-hint__mouse">{PRODUCT.instructionMouse}</span>
              <span className="pov-hint__touch">{PRODUCT.instructionTouch}</span>
            </p>
          ) : null}

          <HotspotLayer
            points={hotspots}
            activeId={activeHotspot}
            visible={inViewer && load.status === 'ready'}
            placing={placeMode}
            onSelect={selectHotspot}
          />
          <DetailPanel activeId={placeMode || lookOpen ? null : (inViewer ? activeHotspot : null)} onClose={() => setActiveHotspot(null)} />
          {inViewer && lookOpen ? (
            <LookPanel
              look={look}
              onChange={setLook}
              captureCamera={() => apiRef.current?.captureCamera() ?? null}
              placeMode={placeMode}
              onPlaceMode={(value) => {
                setPlaceMode(value)
                if (value) {
                  const id = placeHotspotId ?? activeHotspot ?? HOTSPOTS[0].id
                  setPlaceHotspotId(id)
                  setActiveHotspot(id)
                  apiRef.current?.setPlaceHotspotId(id)
                }
                apiRef.current?.setPlaceHotspots(value)
              }}
              placeHotspotId={placeHotspotId ?? activeHotspot}
              onPlaceHotspotId={(id) => {
                setPlaceHotspotId(id)
                setActiveHotspot(id)
                apiRef.current?.setPlaceHotspotId(id)
              }}
              onClose={() => {
                setLookOpen(false)
                setPlaceMode(false)
                apiRef.current?.setPlaceHotspots(false)
              }}
            />
          ) : null}
          {inViewer && caps?.hasExploded ? (
            <MechanismMode exploded={exploded} onChange={(value) => {
              setExploded(value)
              apiRef.current?.setExploded(value)
            }} />
          ) : null}
          {inViewer ? (
            <ViewerControls
              autoRotate={autoRotate}
              lighting={lighting}
              motion={motion}
              pbr={look.stand.enabled || look.watch.enabled}
              lookOpen={lookOpen}
              exploded={exploded}
              hasMotion={Boolean(caps?.hasMotion)}
              hasExploded={false}
              fullscreen={fullscreen}
              onAutoRotate={(value) => {
                setAutoRotate(value)
                apiRef.current?.setAutoRotate(value)
              }}
              onLighting={(value) => {
                setLighting(value)
                apiRef.current?.setLighting(value)
              }}
              onMotion={(value) => {
                setMotion(value)
                apiRef.current?.setMotion(value)
              }}
              onPbr={(value) => {
                setLook((prev) => ({
                  ...prev,
                  stand: { ...prev.stand, enabled: value },
                  watch: { ...prev.watch, enabled: value },
                }))
              }}
              onLookOpen={() => setLookOpen((open) => !open)}
              onExploded={(value) => {
                setExploded(value)
                apiRef.current?.setExploded(value)
              }}
              onReset={() => {
                setActiveHotspot(null)
                apiRef.current?.resetCamera()
              }}
              onPreset={(id) => {
                setActiveHotspot(null)
                apiRef.current?.goToPreset(id)
              }}
              onFullscreen={() => {
                const node = liveRef.current
                if (!node) return
                if (document.fullscreenElement) void document.exitFullscreen()
                else void node.requestFullscreen()
              }}
            />
          ) : null}
        </div>

        <HeroSection
          onExplore={() => {
            scrollToId('viewer')
            apiRef.current?.goToPreset('front')
          }}
          onDetails={() => scrollToId('narrative')}
        />

        <section
          id="viewer"
          className="pov-viewer"
          ref={viewerRef}
          aria-label="Interactive product viewer"
        />
      </div>

      <StorySection onFocus={onStoryFocus} />
      <ClosingCTA />
    </AppShell>
  )
}
