import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PANEL_HEIGHT, PANEL_WIDTH, REST_BEND, INTRO_PEAK_BEND } from './bendMath'
import { createLinarPanel } from './LinarPanel'
import type { LinarMaterialId } from './types'

type Props = {
  targetBendRef: { current: number }
  material: LinarMaterialId
  resetViewToken: number
  interactedRef: { current: boolean }
  reducedMotion: boolean
  onUnavailable: () => void
  onUserInteract: () => void
  onIntroBend: (value: number) => void
  onIntroComplete?: () => void
}

const BG = 0xf3efe8
const FLOOR = 0xe8e2d8

function createContactBlob(): { mesh: THREE.Mesh; dispose: () => void; setBend: (p: number) => void } {
  const geo = new THREE.PlaneGeometry(2.4, 1.35)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 124)
    g.addColorStop(0, 'rgba(40, 28, 18, 0.28)')
    g.addColorStop(0.38, 'rgba(40, 28, 18, 0.12)')
    g.addColorStop(0.72, 'rgba(40, 28, 18, 0.04)')
    g.addColorStop(1, 'rgba(40, 28, 18, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.006
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  mesh.name = 'LinarContactShadow'

  return {
    mesh,
    setBend: (percent) => {
      const t = percent / 100
      mesh.scale.set(1 + t * 0.06, 1 + t * 0.55, 1)
      mesh.position.z = t * 0.12
      mat.opacity = 0.78 + t * 0.12
    },
    dispose: () => {
      geo.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function introBendAt(elapsed: number): { value: number; done: boolean } {
  if (elapsed < 0.42) return { value: 0, done: false }
  if (elapsed < 2.15) {
    const t = easeInOut((elapsed - 0.42) / 1.73)
    return { value: INTRO_PEAK_BEND * t, done: false }
  }
  if (elapsed < 3.35) {
    const t = easeInOut((elapsed - 2.15) / 1.2)
    return { value: INTRO_PEAK_BEND + (REST_BEND - INTRO_PEAK_BEND) * t, done: false }
  }
  return { value: REST_BEND, done: true }
}

function frameCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  width: number,
  height: number,
) {
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2)
  camera.updateProjectionMatrix()
  const target = new THREE.Vector3(0, PANEL_HEIGHT * 0.46, 0.05)
  const padding = 1.2
  const fov = (camera.fov * Math.PI) / 180
  const fitH = (PANEL_HEIGHT * padding) / 2 / Math.tan(fov / 2)
  const fitW = (PANEL_WIDTH * padding * 1.08) / 2 / Math.tan(fov / 2) / camera.aspect
  const dist = Math.max(fitH, fitW, 3.2)
  const dir = new THREE.Vector3(0.9, 0.16, 0.82).normalize()
  camera.position.copy(target).addScaledVector(dir, dist)
  controls.target.copy(target)
  controls.minDistance = dist * 0.6
  controls.maxDistance = dist * 2.2
  controls.update()
}

export function LinarScene({
  targetBendRef,
  material,
  resetViewToken,
  interactedRef,
  reducedMotion,
  onUnavailable,
  onUserInteract,
  onIntroBend,
  onIntroComplete,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef(material)
  const onUserInteractRef = useRef(onUserInteract)
  const onIntroBendRef = useRef(onIntroBend)
  const onIntroCompleteRef = useRef(onIntroComplete)
  const onUnavailableRef = useRef(onUnavailable)
  const resetViewTokenRef = useRef(resetViewToken)

  materialRef.current = material
  onUserInteractRef.current = onUserInteract
  onIntroBendRef.current = onIntroBend
  onIntroCompleteRef.current = onIntroComplete
  onUnavailableRef.current = onUnavailable
  resetViewTokenRef.current = resetViewToken

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      })
      if (!renderer.getContext()) throw new Error('WebGL unavailable')
    } catch {
      onUnavailableRef.current()
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(BG, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(BG)

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = 0.22
    controls.maxPolarAngle = Math.PI / 2 + 0.08
    controls.rotateSpeed = 0.72
    controls.zoomSpeed = 0.85
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE

    const markInteract = () => {
      if (interactedRef.current) return
      interactedRef.current = true
      onUserInteractRef.current()
    }
    controls.addEventListener('start', markInteract)

    const hemi = new THREE.HemisphereLight(0xf7f1e8, 0xb7a894, 0.55)
    scene.add(hemi)

    const key = new THREE.DirectionalLight(0xfff4e8, 2.45)
    key.position.set(3.6, 7.2, 4.4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 18
    key.shadow.camera.left = -3.4
    key.shadow.camera.right = 3.4
    key.shadow.camera.top = 4.2
    key.shadow.camera.bottom = -1.2
    key.shadow.bias = -0.00018
    key.shadow.normalBias = 0.03
    scene.add(key)
    scene.add(key.target)
    key.target.position.set(0, PANEL_HEIGHT * 0.4, 0)

    const fill = new THREE.DirectionalLight(0xe8eef4, 0.42)
    fill.position.set(-4.2, 3.2, -1.4)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xf8fbff, 0.55)
    rim.position.set(-1.6, 4.8, -5.2)
    scene.add(rim)

    const floorGeo = new THREE.CircleGeometry(7.5, 64)
    const floorMat = new THREE.MeshStandardMaterial({
      color: FLOOR,
      roughness: 0.92,
      metalness: 0,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floor.name = 'StudioFloor'
    scene.add(floor)

    const blob = createContactBlob()
    scene.add(blob.mesh)

    const panel = createLinarPanel()
    scene.add(panel.group)

    let displayedBend = reducedMotion ? REST_BEND : 0
    let introTarget = reducedMotion ? REST_BEND : 0
    let introDone = reducedMotion
    let introElapsed = 0
    let lastIntroEmit = -1
    panel.setBend(displayedBend)
    panel.setMaterial(materialRef.current, true)
    blob.setBend(displayedBend)
    if (reducedMotion) {
      onIntroBendRef.current(REST_BEND)
      onIntroCompleteRef.current?.()
    }

    const initialCam = {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      minDistance: 1,
      maxDistance: 10,
    }

    const applyFrame = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      frameCamera(camera, controls, w, h)
      initialCam.position.copy(camera.position)
      initialCam.target.copy(controls.target)
      initialCam.minDistance = controls.minDistance
      initialCam.maxDistance = controls.maxDistance
    }
    applyFrame()
    renderer.render(scene, camera)

    const restoreView = () => {
      camera.position.copy(initialCam.position)
      controls.target.copy(initialCam.target)
      controls.minDistance = initialCam.minDistance
      controls.maxDistance = initialCam.maxDistance
      controls.update()
    }

    const resize = () => {
      if (disposed) return
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    let lastAppliedBend = displayedBend
    let lastMaterial = materialRef.current
    let lastReset = resetViewTokenRef.current
    let raf = 0
    let lastT = performance.now()
    let visible = document.visibilityState !== 'hidden'

    const tick = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      if (!visible) {
        lastT = now
        return
      }
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now

      if (resetViewTokenRef.current !== lastReset) {
        lastReset = resetViewTokenRef.current
        restoreView()
      }

      if (materialRef.current !== lastMaterial) {
        lastMaterial = materialRef.current
        panel.setMaterial(lastMaterial)
      }

      if (!introDone && !interactedRef.current) {
        introElapsed += dt
        const intro = introBendAt(introElapsed)
        introTarget = intro.value
        const rounded = Math.round(intro.value)
        if (rounded !== lastIntroEmit) {
          lastIntroEmit = rounded
          onIntroBendRef.current(rounded)
        }
        if (intro.done) {
          introDone = true
          onIntroCompleteRef.current?.()
        }
      }

      const goal =
        interactedRef.current || introDone ? targetBendRef.current : introTarget
      const lambda = 1 - Math.exp(-dt * 11)
      displayedBend += (goal - displayedBend) * lambda
      if (Math.abs(displayedBend - lastAppliedBend) > 0.02) {
        lastAppliedBend = displayedBend
        panel.setBend(displayedBend)
        blob.setBend(displayedBend)
      }

      panel.tickMaterials(dt)
      controls.update()
      renderer.render(scene, camera)
    }

    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden'
      if (visible) lastT = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    resetViewTokenRef.current = resetViewToken
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      controls.removeEventListener('start', markInteract)
      controls.dispose()
      panel.dispose()
      blob.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [reducedMotion])

  return <div ref={mountRef} className="linar-viewport__canvas" />
}
