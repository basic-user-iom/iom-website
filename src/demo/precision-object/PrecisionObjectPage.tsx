import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AppShell } from './AppShell'
import { isPrecisionObjectUnlocked, tryCrmEmbedUnlock, unlockPrecisionObject } from './auth'
import { BERLIN_TZ, setTimeZone as setWatchTimeZone } from './cetWatchHands'
import { ClosingCTA } from './ClosingCTA'
import { DetailPanel } from './DetailPanel'
import { ExploreCue } from './ExploreCue'
import { HeroSection } from './HeroSection'
import { HotspotLayer } from './HotspotLayer'
import { MechanismMode } from './MechanismMode'
import { ModelErrorBoundary } from './ModelErrorBoundary'
import { LookPanel } from './LookPanel'
import { defaultLook, loadStoredLook, type SavedLook } from './lookStudio'
import { EXPLORE_CUE_ID, HOTSPOTS, PRODUCT } from './productConfig'
import { ProductScene } from './ProductScene'
import { StorySection } from './StorySection'
import { ViewerControls } from './ViewerControls'
import { ZonePicker } from './ZonePicker'
import {
  DEFAULT_LIGHTING_PRESET,
  type CameraPresetId,
  type LightingPresetId,
  type LoadState,
  type ModelCapabilities,
  type ScreenHotspot,
  type ViewerApi,
} from './types'
import { hasWebGL, prefersReducedMotion } from './webgl'
import './precision-object.css'

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function setPovClass(name: string, on: boolean): void {
  document.body.classList.toggle(name, on)
  document.documentElement.classList.toggle(name, on)
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
  const [lighting, setLighting] = useState<LightingPresetId>(DEFAULT_LIGHTING_PRESET)
  const [motion, setMotion] = useState(() => !prefersReducedMotion())
  const [timeZone, setTimeZone] = useState(BERLIN_TZ)
  const [lookOpen, setLookOpen] = useState(false)
  const [placeMode, setPlaceMode] = useState(false)
  const [placeHotspotId, setPlaceHotspotId] = useState<string | null>(null)
  const [look, setLook] = useState<SavedLook>(() => loadStoredLook() ?? defaultLook())
  const [gizmoOn, setGizmoOn] = useState(true)
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate')
  const [cameraPan, setCameraPan] = useState(true)
  const [handsHeld, setHandsHeld] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [inViewer, setInViewer] = useState(false)
  const [inHero, setInHero] = useState(true)
  const [inStage, setInStage] = useState(true)
  const [explored, setExplored] = useState(false)
  const wasViewer = useRef(false)
  const prevScrollRef = useRef({ inHero: true, inStage: true })
  const holdCameraRef = useRef(false)
  const exploredRef = useRef(false)
  exploredRef.current = explored
  const apiRef = useRef<ViewerApi | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const scrollBeforeExploreRef = useRef({ y: 0, inHero: true, inStage: true })

  const onApi = useCallback((api: ViewerApi | null) => {
    apiRef.current = api
    api?.setInteractionEnabled(exploredRef.current)
  }, [])

  useEffect(() => {
    document.body.classList.add('pov-route', 'pov-explore-locked')
    document.documentElement.classList.add('pov-route', 'pov-explore-locked')
    return () => {
      document.body.classList.remove(
        'pov-route',
        'pov-look-open',
        'pov-explore-locked',
        'pov-hero-away',
        'pov-stage-away',
        'pov-loading',
      )
      document.documentElement.classList.remove(
        'pov-route',
        'pov-look-open',
        'pov-explore-locked',
        'pov-hero-away',
        'pov-stage-away',
        'pov-loading',
      )
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('pov-look-open', lookOpen)
    document.documentElement.classList.toggle('pov-look-open', lookOpen)
  }, [lookOpen])

  useEffect(() => {
    document.body.classList.toggle('pov-explore-locked', !explored)
    document.documentElement.classList.toggle('pov-explore-locked', !explored)
    apiRef.current?.setInteractionEnabled(explored)
    if (!explored) {
      setLookOpen(false)
      setPlaceMode(false)
      setHandsHeld(false)
      apiRef.current?.setPlaceHotspots(false)
      apiRef.current?.setGizmoVisible(false)
      apiRef.current?.setHandsFrozen(false)
    }
  }, [explored])

  useEffect(() => {
    setPovClass('pov-loading', load.status === 'loading' && !webglFailed)
  }, [load.status, webglFailed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!exploredRef.current) return
      setActiveHotspot(null)
      setLookOpen(false)
      setPlaceMode(false)
      setAutoRotate(false)
      apiRef.current?.setPlaceHotspots(false)
      apiRef.current?.setAutoRotate(false)
      if (document.fullscreenElement) {
        void apiRef.current?.exitFullscreen()
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
    const hero = heroRef.current
    if (!viewer || !stage || !hero) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === viewer) {
            const visible = entry.isIntersecting && entry.intersectionRatio > 0.45
            if (wasViewer.current && !visible) {
              setActiveHotspot(null)
              if (exploredRef.current) apiRef.current?.goToInitialCamera()
            }
            wasViewer.current = visible
            setInViewer(visible)
            apiRef.current?.setHeroBias(!visible)
          }
          if (entry.target === stage) {
            const viewportH = entry.rootBounds?.height ?? window.innerHeight
            const cover = viewportH > 0 ? entry.intersectionRect.height / viewportH : 0
            const visibleStage = entry.isIntersecting && cover > 0.45
            setPovClass('pov-stage-away', !visibleStage)
            setInStage(visibleStage)
            apiRef.current?.setActive(entry.isIntersecting)
          }
          if (entry.target === hero) {
            const visibleHero = entry.isIntersecting && entry.intersectionRatio >= 0.75
            setPovClass('pov-hero-away', !visibleHero)
            setInHero(visibleHero)
          }
        }
      },
      { threshold: [0, 0.25, 0.45, 0.75, 0.8, 1] },
    )
    io.observe(viewer)
    io.observe(stage)
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!caps?.loaded) return
    const prev = prevScrollRef.current
    if (holdCameraRef.current || exploredRef.current) {
      prevScrollRef.current = { inHero, inStage }
      return
    }
    if (inHero && !prev.inHero) {
      apiRef.current?.goToInitialCamera()
    } else if (!inHero && inStage && look.scrollCamera && (prev.inHero || !prev.inStage)) {
      apiRef.current?.goToScrollCamera()
    }
    prevScrollRef.current = { inHero, inStage }
  }, [inHero, inStage, caps, look.scrollCamera])

  useEffect(() => {
    if (!caps?.loaded) return
    if (prefersReducedMotion()) {
      apiRef.current?.setAutoRotate(false)
      return
    }
    if (inHero || !inStage) {
      apiRef.current?.setAutoRotate(false)
      return
    }
    if (explored) {
      apiRef.current?.setAutoRotate(autoRotate)
      return
    }
    apiRef.current?.setAutoRotate(true)
  }, [explored, autoRotate, inHero, inStage, caps])

  useEffect(() => {
    if (!caps?.hasMotion) return
    apiRef.current?.setMotion(motion)
  }, [caps, motion])

  useEffect(() => {
    setWatchTimeZone(timeZone)
    apiRef.current?.setTimeZone(timeZone)
  }, [timeZone, caps])

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

  useEffect(() => {
    apiRef.current?.setCameraPan(cameraPan)
  }, [cameraPan, caps])

  useEffect(() => {
    apiRef.current?.setGizmoVisible(explored && lookOpen && gizmoOn)
  }, [explored, lookOpen, gizmoOn, caps])

  useEffect(() => {
    apiRef.current?.setGizmoMode(gizmoMode)
  }, [gizmoMode, caps])

  const stopInspectRotate = useCallback(() => {
    setAutoRotate(false)
    apiRef.current?.setAutoRotate(false)
  }, [])

  const closeHotspot = useCallback(() => {
    setActiveHotspot(null)
    stopInspectRotate()
  }, [stopInspectRotate])

  useEffect(() => {
    const root = liveRef.current
    if (!root) return
    let downX = 0
    let downY = 0
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      downX = event.clientX
      downY = event.clientY
    }
    const onUp = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest(
          '.pov-hotspot, .pov-explore-cue, .pov-studio, .pov-controls, .pov-detail, .pov-mechanism, .pov-zone, button, input, textarea, select, a',
        )
      ) {
        return
      }
      if (!target.closest('canvas, .pov-canvas')) return
      if (lookOpen || placeMode || !activeHotspot) return
      closeHotspot()
    }
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointerup', onUp)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onUp)
    }
  }, [lookOpen, placeMode, activeHotspot, closeHotspot])

  const selectHotspot = useCallback((id: string) => {
    if (!exploredRef.current) return
    setActiveHotspot(id)
    if (placeMode || lookOpen) {
      setPlaceHotspotId(id)
      return
    }
    setInteracted(true)
    const spec = look.hotspots.find((item) => item.id === id)
    if (spec?.autoRotate && !prefersReducedMotion()) {
      setAutoRotate(true)
      apiRef.current?.setAutoRotate(true)
    }
    apiRef.current?.focusHotspot(id)
  }, [placeMode, lookOpen, look.hotspots])

  const onStoryFocus = useCallback((preset: CameraPresetId, hotspotId?: string) => {
    if (!exploredRef.current) return
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

  const exploreObject = useCallback(() => {
    scrollBeforeExploreRef.current = { y: window.scrollY, inHero, inStage }
    setExplored(true)
    apiRef.current?.setInteractionEnabled(true)
    scrollToId('viewer')
    apiRef.current?.goToInitialCamera()
  }, [inHero, inStage])

  const exitExplore = useCallback(() => {
    const saved = scrollBeforeExploreRef.current
    setExplored(false)
    setLookOpen(false)
    setPlaceMode(false)
    setActiveHotspot(null)
    setExploded(false)
    setInteracted(false)
    const api = apiRef.current
    setLighting(DEFAULT_LIGHTING_PRESET)
    api?.setLighting(DEFAULT_LIGHTING_PRESET)
    setLook((prev) => ({
      ...prev,
      stand: { ...prev.stand, enabled: true },
      watch: { ...prev.watch, enabled: true },
    }))
    api?.setInteractionEnabled(false)
    api?.setPlaceHotspots(false)
    api?.setGizmoVisible(false)
    api?.setExploded(false)
    holdCameraRef.current = true
    const restoreLockedView = () => {
      window.scrollTo({
        top: saved.y,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
      if (saved.inHero) api?.restoreCameraForScroll(true)
      else api?.restoreCameraForScroll(false)
      window.setTimeout(() => {
        holdCameraRef.current = false
      }, 900)
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().finally(restoreLockedView)
      return
    }
    restoreLockedView()
  }, [])

  const explorePoint = hotspots.find((point) => point.id === EXPLORE_CUE_ID)
  const loadPercent = load.status === 'loading' ? Math.round(load.progress * 100) : 100

  return (
    <AppShell
      headerEnd={
        <ZonePicker
          value={timeZone}
          onChange={(next) => {
            setTimeZone(next)
            setWatchTimeZone(next)
            apiRef.current?.setTimeZone(next)
          }}
        />
      }
    >
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
                onModelChange={(model) => {
                  setLook((prev) => ({ ...prev, model }))
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

          {!interacted && load.status === 'ready' && inViewer && explored ? (
            <p className="pov-hint">
              <span className="pov-hint__mouse">{PRODUCT.instructionMouse}</span>
              <span className="pov-hint__touch">{PRODUCT.instructionTouch}</span>
            </p>
          ) : null}

          <HotspotLayer
            points={hotspots}
            activeId={activeHotspot}
            visible={explored && inViewer && load.status === 'ready'}
            placing={placeMode}
            onSelect={selectHotspot}
          />
          {!explored && !inHero && inStage && load.status === 'ready' && !webglFailed ? (
            <ExploreCue point={explorePoint} onExplore={exploreObject} />
          ) : null}
          <DetailPanel activeId={placeMode || lookOpen ? null : (explored && inViewer ? activeHotspot : null)} onClose={closeHotspot} />
          {explored && inViewer && lookOpen ? (
            <LookPanel
              look={look}
              onChange={setLook}
              captureCamera={() => apiRef.current?.captureCamera() ?? null}
              captureModel={() => apiRef.current?.captureModel() ?? null}
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
              gizmoOn={gizmoOn}
              onGizmoOn={setGizmoOn}
              gizmoMode={gizmoMode}
              onGizmoMode={setGizmoMode}
              cameraPan={cameraPan}
              onCameraPan={(value) => {
                setCameraPan(value)
                apiRef.current?.setCameraPan(value)
              }}
              handsHeld={handsHeld}
              onHandsHeld={(value) => {
                setHandsHeld(value)
                apiRef.current?.setHandsFrozen(value)
              }}
              onClose={() => {
                setLookOpen(false)
                setPlaceMode(false)
                apiRef.current?.setPlaceHotspots(false)
              }}
            />
          ) : null}
          {explored && inViewer && caps?.hasExploded ? (
            <MechanismMode exploded={exploded} onChange={(value) => {
              setExploded(value)
              apiRef.current?.setExploded(value)
            }} />
          ) : null}
          {explored && inViewer ? (
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
                closeHotspot()
                apiRef.current?.resetCamera()
              }}
              onPreset={(id) => {
                closeHotspot()
                apiRef.current?.goToPreset(id)
              }}
              onFullscreen={() => {
                const node = liveRef.current
                if (!node) return
                if (document.fullscreenElement) void document.exitFullscreen()
                else void node.requestFullscreen()
              }}
              onExit={exitExplore}
            />
          ) : null}
        </div>

        <HeroSection
          ref={heroRef}
          onExplore={exploreObject}
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
