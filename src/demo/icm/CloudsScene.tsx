import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CLOUD_CHAPTERS } from './data'
import { buildIcmCloudFragmentShader, ICM_CLOUD_VERTEX } from './cloudsShader'
import { getDeviceProfile } from '../../utils/device'

type Props = {
  onOpenChapter: (title: string, images: string[], imageIndex?: number) => void
}

type Marker = {
  id: string
  title: string
  images: string[]
  at: number
}

const MARKERS: Marker[] = CLOUD_CHAPTERS.map((c, i) => ({
  id: c.id,
  title: c.title,
  images: c.images,
  at: (i + 0.5) / CLOUD_CHAPTERS.length,
}))

type SkyPhoto = {
  key: string
  chapterId: string
  title: string
  images: string[]
  imageIndex: number
  src: string
  at: number
  band: number
  jitter: number
  aspect: 'landscape' | 'portrait'
}

const SKY_PHOTOS: SkyPhoto[] = MARKERS.flatMap((m) => {
  const layout = [
    { band: 0.28, jitter: -0.08, aspect: 'landscape' as const },
    { band: 0.42, jitter: 0.1, aspect: 'portrait' as const },
    { band: 0.55, jitter: -0.02, aspect: 'landscape' as const },
  ]
  return m.images.slice(0, 3).map((src, i) => ({
    key: `${m.id}-${i}`,
    chapterId: m.id,
    title: m.title,
    images: m.images,
    imageIndex: i,
    src,
    at: m.at,
    band: layout[i]?.band ?? 0.4,
    jitter: layout[i]?.jitter ?? 0,
    aspect: layout[i]?.aspect ?? 'landscape',
  }))
})

function nearestMarker(progress: number): Marker {
  let best = MARKERS[0]
  let bestDist = Infinity
  for (const m of MARKERS) {
    const d = Math.abs(m.at - progress)
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return best
}

/** Apply GPU-friendly transforms every animation frame (no React re-render). */
function applySkyPhotoTransform(
  el: HTMLElement,
  photo: SkyPhoto,
  progress: number,
  mouseX: number,
  mouseY: number,
  activeChapterId: string,
  layerW: number,
  layerH: number,
) {
  const dist = photo.at - progress
  const abs = Math.abs(dist)
  const proximity = THREE.MathUtils.clamp(1 - abs / 0.28, 0, 1)
  const xPct = 50 + dist * 280 + photo.jitter * 100 + (mouseX - 0.5) * 6
  const yPct = photo.band * 100 + (mouseY - 0.5) * 4
  const x = (xPct / 100) * layerW
  const y = (yPct / 100) * layerH
  const scale = 0.55 + proximity * 0.7
  const opacity = abs < 0.28 ? 0.15 + proximity * 0.85 : 0
  const interactive = proximity > 0.35

  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
  el.style.opacity = String(opacity)
  el.style.zIndex = String(Math.round(proximity * 20))
  el.style.pointerEvents = interactive ? 'auto' : 'none'
  el.style.visibility = opacity < 0.04 ? 'hidden' : 'visible'
  el.classList.toggle('is-active', photo.chapterId === activeChapterId && proximity > 0.45)
}

export function CloudsScene({ onOpenChapter }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const photosLayerRef = useRef<HTMLDivElement>(null)
  const photoElsRef = useRef<(HTMLButtonElement | null)[]>([])
  const fillRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0.12)
  const targetProgressRef = useRef(0.12)
  const mouseRef = useRef({ x: 0.5, y: 0.45 })
  const targetMouseRef = useRef({ x: 0.5, y: 0.45 })
  const activeIdRef = useRef(MARKERS[0].id)
  const onOpenRef = useRef(onOpenChapter)
  onOpenRef.current = onOpenChapter

  const [progress, setProgress] = useState(0.12)
  const [activeId, setActiveId] = useState(MARKERS[0].id)
  const [ready, setReady] = useState(false)

  const active = useMemo(
    () => MARKERS.find((m) => m.id === activeId) ?? MARKERS[0],
    [activeId],
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    const profile = getDeviceProfile()
    const prefersReduced = profile.prefersReducedMotion

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new THREE.WebGLRenderer({
      antialias: !profile.isLowPower,
      alpha: false,
      powerPreference: profile.isLowPower ? 'low-power' : 'high-performance',
    })
    renderer.setPixelRatio(profile.maxPixelRatio)
    renderer.setClearColor(0xb8c8d8, 1)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(1, 1) },
      iMouse: { value: new THREE.Vector2(0, 0) },
      iNavigate: { value: new THREE.Vector3(0, 0, 0) },
      iMood: { value: 0 },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: ICM_CLOUD_VERTEX,
      fragmentShader: buildIcmCloudFragmentShader(
        Math.max(28, profile.cloudRaySteps),
        profile.cloudSimpleLighting,
      ),
      uniforms,
      depthWrite: false,
      depthTest: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(quad)

    let width = 1
    let height = 1
    let animationId = 0
    let lastRender = 0
    const frameInterval = profile.targetFps < 60 ? 1000 / profile.targetFps : 0
    const clock = new THREE.Clock()

    const applyResize = () => {
      const w = Math.max(1, mount.clientWidth)
      const h = Math.max(1, mount.clientHeight)
      width = w
      height = h
      renderer.setSize(w, h, false)
      const dpr = renderer.getPixelRatio()
      uniforms.iResolution.value.set(w * dpr, h * dpr)
    }

    applyResize()
    const ro = new ResizeObserver(applyResize)
    ro.observe(mount)

    let dragging = false
    let lastX = 0
    let lastY = 0

    const setTargetProgress = (value: number) => {
      targetProgressRef.current = THREE.MathUtils.clamp(value, 0, 1)
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      mount.setPointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      try {
        mount.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        targetMouseRef.current = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        }
      }
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      setTargetProgress(targetProgressRef.current + (-dx * 0.0009 + dy * 0.00055))
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // Soft wheel — avoid large discrete jumps
      const step = THREE.MathUtils.clamp(e.deltaY * 0.00028, -0.035, 0.035)
      setTargetProgress(targetProgressRef.current + step)
    }

    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointerup', onPointerUp)
    mount.addEventListener('pointercancel', onPointerUp)
    mount.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('wheel', onWheel, { passive: false })

    let visible = !document.hidden
    let uiActive = ''
    let uiProgressHud = -1
    let becameReady = false
    const onVis = () => {
      visible = !document.hidden
      if (visible && !animationId) animationId = requestAnimationFrame(animate)
    }
    document.addEventListener('visibilitychange', onVis)

    const syncPhotoLayer = (p: number) => {
      const layer = photosLayerRef.current
      const layerW = layer?.clientWidth || width
      const layerH = layer?.clientHeight || height
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const chapterId = activeIdRef.current
      const els = photoElsRef.current
      for (let i = 0; i < SKY_PHOTOS.length; i++) {
        const el = els[i]
        if (!el) continue
        applySkyPhotoTransform(el, SKY_PHOTOS[i], p, mx, my, chapterId, layerW, layerH)
      }
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${p})`
      }
    }

    const animate = (timestamp: number) => {
      if (disposed) return
      animationId = requestAnimationFrame(animate)
      if (!visible) return

      const dt = Math.min(clock.getDelta(), 0.05)
      // Critically-damped-ish ease toward target (smooth, no step feel)
      const ease = 1 - Math.exp(-dt * 5.5)
      progressRef.current += (targetProgressRef.current - progressRef.current) * ease

      if (!prefersReduced && !dragging) {
        targetProgressRef.current = THREE.MathUtils.clamp(
          targetProgressRef.current + dt * 0.006,
          0,
          1,
        )
        if (targetProgressRef.current >= 0.995) targetProgressRef.current = 0
      }

      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * (1 - Math.exp(-dt * 8))
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * (1 - Math.exp(-dt * 8))

      const p = progressRef.current
      const near = nearestMarker(p)
      activeIdRef.current = near.id

      // Photos + progress fill: every frame (smooth)
      syncPhotoLayer(p)

      // React HUD (markers/labels): only when chapter changes or rarely for bar fallback
      if (near.id !== uiActive || Math.abs(p - uiProgressHud) > 0.02) {
        uiActive = near.id
        uiProgressHud = p
        setActiveId(near.id)
        setProgress(p)
      }

      // WebGL can run at capped FPS without hitching photo motion
      const shouldRenderGl = frameInterval <= 0 || timestamp - lastRender >= frameInterval
      if (shouldRenderGl) {
        lastRender = timestamp
        const path = p * 16 + (prefersReduced ? 0 : clock.elapsedTime * 0.04)
        uniforms.iNavigate.value.set(path * 0.9, Math.sin(p * Math.PI * 2) * 0.4, path * 0.5)
        uniforms.iMood.value = p
        uniforms.iTime.value = clock.elapsedTime
        uniforms.iMouse.value.set(mouseRef.current.x * width, (1 - mouseRef.current.y) * height)
        renderer.render(scene, camera)

        if (!becameReady) {
          becameReady = true
          setReady(true)
        }
      }
    }

    // Initial placement before first paint
    syncPhotoLayer(progressRef.current)
    animationId = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(animationId)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointerup', onPointerUp)
      mount.removeEventListener('pointercancel', onPointerUp)
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('wheel', onWheel)
      material.dispose()
      quad.geometry.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  const openActive = () => onOpenChapter(active.title, active.images)

  const jumpTo = (at: number) => {
    targetProgressRef.current = at
  }

  return (
    <div className="icm-clouds-gl">
      <div ref={mountRef} className="icm-clouds-gl__canvas" />

      <div ref={photosLayerRef} className="icm-clouds-gl__photos">
        {SKY_PHOTOS.map((photo, i) => (
          <button
            key={photo.key}
            type="button"
            ref={(el) => {
              photoElsRef.current[i] = el
            }}
            className={`icm-clouds-gl__photo icm-clouds-gl__photo--${photo.aspect}`}
            aria-label={`${photo.title} photo ${photo.imageIndex + 1}`}
            onClick={(e) => {
              e.stopPropagation()
              jumpTo(photo.at)
              onOpenChapter(photo.title, photo.images, photo.imageIndex)
            }}
          >
            <img src={photo.src} alt="" draggable={false} />
            <span className="icm-clouds-gl__photo-label">{photo.title}</span>
          </button>
        ))}
      </div>

      <div className="icm-clouds-gl__hud">
        <div className="icm-clouds-gl__title">
          <p className="icm-clouds-gl__kicker">Exhibition</p>
          <h1>Clouds</h1>
          <p>Drag or scroll to move through the sky. Click a photograph to open it.</p>
        </div>

        <div className="icm-clouds-gl__dock">
          <nav className="icm-clouds-gl__chapters" aria-label="Chapters">
            {MARKERS.map((m) => {
              const isActive = m.id === activeId
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`icm-clouds-gl__chapter${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    jumpTo(m.at)
                    if (isActive) onOpenChapter(m.title, m.images)
                  }}
                >
                  <span className="icm-clouds-gl__chapter-thumb">
                    <img src={m.images[0]} alt="" />
                  </span>
                  <span className="icm-clouds-gl__chapter-name">{m.title}</span>
                </button>
              )
            })}
          </nav>

          <div className="icm-clouds-gl__bar">
            <div className="icm-clouds-gl__track">
              <div ref={fillRef} className="icm-clouds-gl__fill" />
              {MARKERS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`icm-clouds-gl__dot${m.id === activeId ? ' is-active' : ''}`}
                  style={{ left: `${m.at * 100}%` }}
                  aria-label={`Go to ${m.title}`}
                  onClick={() => jumpTo(m.at)}
                />
              ))}
            </div>
            <button type="button" className="icm-clouds-gl__open" onClick={openActive}>
              View {active.title}
            </button>
          </div>
        </div>
      </div>

      {!ready ? <div className="icm-clouds-gl__loading">Loading sky…</div> : null}
    </div>
  )
}
