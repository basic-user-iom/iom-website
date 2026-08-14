import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { COLORS, DEFAULT_PARTICLES, MOBILE_PARTICLES, PIXEL_RATIO_CAP, TOTAL_H } from './constants'
import { createFuelAndFire } from './createFuelAndFire'
import { createParticles } from './createParticles'
import { createKellyKettleModel } from './KellyKettleModel'
import { measureTransferredBytes } from './webgl'
import type {
  DebugControls,
  DemoStep,
  KellyKettleModelHandle,
  LabelAnchor,
  ModelSource,
  QualityLevel,
  SceneStats,
} from './types'

type Props = {
  stepRef: { current: DemoStep }
  debugRef: { current: DebugControls }
  reducedMotion: boolean
  quality: QualityLevel
  resetViewToken: number
  interactedRef: { current: boolean }
  onUnavailable: () => void
  onUserInteract: () => void
  onAnchors: (anchors: LabelAnchor[]) => void
  onStats: (stats: SceneStats) => void
  onFireComplete: () => void
  onFirstFrame?: () => void
}

const CUTAWAY_LABELS: { id: string; text: string; local: THREE.Vector3; side: 'left' | 'right' }[] = [
  { id: 'water', text: 'Water surrounds the chimney', local: new THREE.Vector3(0.06, 0.21, 0.02), side: 'left' },
  { id: 'chamber', text: 'Central fire chamber', local: new THREE.Vector3(0, 0.16, 0), side: 'right' },
  { id: 'surface', text: 'Large heated surface', local: new THREE.Vector3(0.03, 0.24, 0), side: 'left' },
  { id: 'draw', text: 'Open chimney creates strong upward draw', local: new THREE.Vector3(0, 0.33, 0), side: 'right' },
]

const FLOW_LABELS: { id: string; text: string; local: THREE.Vector3; side: 'left' | 'right' }[] = [
  { id: 'cool', text: 'Cool air in →', local: new THREE.Vector3(0.02, 0.03, 0.12), side: 'right' },
  { id: 'hot', text: '↑ Hot air rises', local: new THREE.Vector3(0.02, 0.28, 0), side: 'right' },
]

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function createContactBlob() {
  const geo = new THREE.PlaneGeometry(0.42, 0.42)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62)
    g.addColorStop(0, 'rgba(40, 32, 24, 0.28)')
    g.addColorStop(0.45, 'rgba(40, 32, 24, 0.1)')
    g.addColorStop(1, 'rgba(40, 32, 24, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  const map = new THREE.CanvasTexture(canvas)
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.001
  mesh.renderOrder = -1
  return {
    mesh,
    dispose: () => {
      geo.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}

export function KellyKettleScene({
  stepRef,
  debugRef,
  reducedMotion,
  quality,
  resetViewToken,
  interactedRef,
  onUnavailable,
  onUserInteract,
  onAnchors,
  onStats,
  onFireComplete,
  onFirstFrame,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef(resetViewToken)
  resetRef.current = resetViewToken
  const interactCb = useRef(onUserInteract)
  interactCb.current = onUserInteract
  const unavailableCb = useRef(onUnavailable)
  unavailableCb.current = onUnavailable
  const anchorsCb = useRef(onAnchors)
  anchorsCb.current = onAnchors
  const statsCb = useRef(onStats)
  statsCb.current = onStats
  const fireDoneCb = useRef(onFireComplete)
  fireDoneCb.current = onFireComplete
  const firstFrameCb = useRef(onFirstFrame)
  firstFrameCb.current = onFirstFrame

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let firstFrameSent = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality === 'high',
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      })
      if (!renderer.getContext()) throw new Error('WebGL unavailable')
    } catch {
      unavailableCb.current()
      return
    }

    const dprCap = debugRef.current.mobilePerformance ? 1 : PIXEL_RATIO_CAP
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
    renderer.setClearColor(COLORS.bg, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.96
    renderer.shadowMap.enabled = quality === 'high' && !debugRef.current.mobilePerformance
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS.bg)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new RoomEnvironment()
    const envTex = pmrem.fromScene(envScene, 0.12).texture
    envScene.dispose()
    scene.environment = envTex
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 12)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = Math.PI / 2 - 0.04
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 1.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.55
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE

    const stopIdle = () => {
      controls.autoRotate = false
      if (!interactedRef.current) {
        interactedRef.current = true
        interactCb.current()
      }
    }
    controls.addEventListener('start', stopIdle)

    scene.add(new THREE.HemisphereLight(0xf7f3ea, 0x9a9288, 0.72))
    const key = new THREE.DirectionalLight(0xfff6ea, 1.15)
    key.position.set(0.55, 0.9, 0.45)
    key.castShadow = renderer.shadowMap.enabled
    key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512)
    key.shadow.camera.near = 0.2
    key.shadow.camera.far = 3
    key.shadow.camera.left = -0.4
    key.shadow.camera.right = 0.4
    key.shadow.camera.top = 0.5
    key.shadow.camera.bottom = -0.15
    key.shadow.bias = -0.0002
    key.shadow.normalBias = 0.01
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xdde4ee, 0.4)
    fill.position.set(-0.6, 0.35, -0.2)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffc58a, 0.35)
    rim.position.set(-0.15, 0.12, -0.55)
    scene.add(rim)

    const floorGeo = new THREE.CircleGeometry(0.85, 48)
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.floor,
      roughness: 0.92,
      metalness: 0,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const blob = createContactBlob()
    scene.add(blob.mesh)

    let model: KellyKettleModelHandle | null = null
    const fire = createFuelAndFire(debugRef.current.mobilePerformance ? 'mobile' : quality)
    const particles = createParticles()
    scene.add(fire.fuel, fire.flames, fire.light, fire.chimneyLight)
    scene.add(particles.airflow, particles.heatflow, particles.steam, particles.reducedGroup)

    const world = new THREE.Vector3()
    const ndc = new THREE.Vector3()
    const camPos = new THREE.Vector3()

    const frameCamera = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      const target = new THREE.Vector3(0, TOTAL_H * 0.46, 0)
      const dist = 0.66
      camera.position.set(0.5, 0.24, 0.52).normalize().multiplyScalar(dist).add(target)
      controls.target.copy(target)
      controls.minDistance = 0.08
      controls.maxDistance = 1.85
      controls.update()
    }

    const initialCam = {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }

    const applySize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, debugRef.current.mobilePerformance ? 1 : PIXEL_RATIO_CAP),
      )
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }

    const greyMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a8a,
      metalness: 0,
      roughness: 0.92,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
    let lastSilhouette = false
    let cutaway = 0
    let fireProg = 0
    let heatProg = 0
    let lastReset = resetRef.current
    let fireCompleted = false
    let lastT = performance.now()
    let visible = document.visibilityState !== 'hidden'
    let frames = 0
    let fpsT = performance.now()
    let fps = 0
    let raf = 0
    let source: ModelSource = debugRef.current.modelSource

    const projectLabels = (cut: number, fireAmt: number) => {
      const list: LabelAnchor[] = []
      const push = (
        item: { id: string; text: string; local: THREE.Vector3; side: 'left' | 'right' },
        show: boolean,
      ) => {
        world.copy(item.local)
        ndc.copy(world).project(camera)
        list.push({
          id: item.id,
          text: item.text,
          x: (ndc.x * 0.5 + 0.5) * 100,
          y: (-ndc.y * 0.5 + 0.5) * 100,
          visible: show && ndc.z < 1,
          side: item.side,
        })
      }
      for (const item of CUTAWAY_LABELS) push(item, cut > 0.55)
      for (const item of FLOW_LABELS) push(item, fireAmt > 0.15)
      anchorsCb.current(list)
    }

    const tick = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      if (!visible) {
        lastT = now
        return
      }
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      frames++
      if (now - fpsT > 500) {
        fps = (frames * 1000) / (now - fpsT)
        frames = 0
        fpsT = now
        statsCb.current({
          fps,
          triangles: model?.triangleCount ?? 0,
          transferredBytes: measureTransferredBytes(),
          modelSource: model?.source ?? 'procedural',
        })
      }

      if (resetRef.current !== lastReset) {
        lastReset = resetRef.current
        camera.position.copy(initialCam.position)
        controls.target.copy(initialCam.target)
        controls.update()
      }

      const step = stepRef.current
      const debug = debugRef.current

      if (debug.silhouetteCompare !== lastSilhouette) {
        lastSilhouette = debug.silhouetteCompare
        scene.overrideMaterial = lastSilhouette ? greyMat : null
        camera.fov = lastSilhouette ? 24 : 32
        if (lastSilhouette) {
          controls.autoRotate = false
          controls.target.set(0, TOTAL_H * 0.48, 0)
          camera.position.set(0.18, 0.2, 0.72)
          camera.lookAt(controls.target)
        } else {
          camera.position.copy(initialCam.position)
          controls.target.copy(initialCam.target)
        }
        camera.updateProjectionMatrix()
        controls.update()
      }

      const cutTarget = debug.forceCutaway || step === 'cutaway' || step === 'fire' || step === 'complete' ? 1 : 0
      const lambda = 1 - Math.exp(-dt * (reducedMotion ? 8 : 2.4))
      cutaway += (cutTarget - cutaway) * lambda
      if (step === 'fire' && fireProg < 1) {
        fireProg = Math.min(1, fireProg + dt / (reducedMotion ? 2.2 : 7.5))
        heatProg = ease(Math.max(0, (fireProg - 0.28) / 0.72))
        if (fireProg >= 1 && !fireCompleted) {
          fireCompleted = true
          fireDoneCb.current()
        }
      } else if (step === 'complete') {
        fireProg = 1
        heatProg = 1
      } else if (step === 'explore' || step === 'cutaway') {
        fireProg += (0 - fireProg) * lambda
        heatProg += (0 - heatProg) * lambda
        fireCompleted = false
      }

      controls.autoRotate = debug.autoRotate && !interactedRef.current && !debug.silhouetteCompare
      const particleCount = debug.particleCount || (quality === 'mobile' ? MOBILE_PARTICLES : DEFAULT_PARTICLES)

      model?.update({
        cutawayProgress: cutaway,
        fireProgress: fireProg * debug.fireIntensity,
        waterHeatProgress: heatProg,
        airflowVisible: debug.airflowVisible,
        waterVisible: debug.waterVisible,
        particleCount,
        reducedMotion,
        fireIntensity: debug.fireIntensity,
        handleAngle: debug.handleAngle,
        whistleInserted: debug.whistleInserted,
        chainVisible: debug.chainVisible,
        chainDebug: debug.chainDebug,
        handleCollisionDebug: debug.handleCollisionDebug,
        emberIntensity: debug.emberIntensity,
        chimneyFlameHeight: debug.chimneyFlameHeight,
        exteriorOrCutaway: debug.exteriorOrCutaway,
        metalRoughness: debug.metalRoughness,
      })

      camera.getWorldPosition(camPos)
      fire.update(fireProg * debug.fireIntensity, dt, reducedMotion, camPos, {
        emberIntensity: debug.emberIntensity,
        chimneyFlameHeight: debug.chimneyFlameHeight,
        mobile: debug.mobilePerformance || quality === 'mobile',
      })
      particles.update(
        dt,
        fireProg * debug.fireIntensity,
        heatProg,
        particleCount,
        reducedMotion,
        debug.airflowVisible,
      )

      controls.update()
      renderer.render(scene, camera)
      projectLabels(cutaway, fireProg)
    }

    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden'
      if (visible) lastT = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const ro = new ResizeObserver(applySize)
    ro.observe(mount)
    window.addEventListener('resize', applySize)

    let loadGen = 0
    const loadModel = async (next: ModelSource) => {
      const gen = ++loadGen
      source = next
      if (model) {
        scene.remove(model.group)
        model.dispose()
        model = null
      }
      const created = await createKellyKettleModel({
        source: next,
        quality: debugRef.current.mobilePerformance ? 'mobile' : quality,
      })
      if (disposed || gen !== loadGen) {
        created.dispose()
        return
      }
      model = created
      scene.add(model.group)
      if (!model.parts.fuel_group) model.parts.fuel_group = fire.fuel
      if (!model.parts.fuel_twigs) model.parts.fuel_twigs = fire.fuel.getObjectByName('fuel_twigs') ?? fire.fuel
      if (!model.parts.ember_core) model.parts.ember_core = fire.fuel.getObjectByName('ember_core') ?? fire.fuel
      if (!model.parts.flame_group) model.parts.flame_group = fire.flames
      if (!model.parts.base_flames) model.parts.base_flames = fire.flames.getObjectByName('base_flames') ?? fire.flames
      if (!model.parts.chimney_flame) model.parts.chimney_flame = fire.flames.getObjectByName('chimney_flame') ?? fire.flames
      if (!model.parts.ember_sparks) model.parts.ember_sparks = fire.flames.getObjectByName('ember_sparks') ?? fire.flames
      if (!model.parts.fire_light_base) model.parts.fire_light_base = fire.light
      if (!model.parts.fire_light_chimney) model.parts.fire_light_chimney = fire.chimneyLight
      if (!model.parts.airflow_particles) model.parts.airflow_particles = particles.airflow
      if (!model.parts.heatflow_particles) model.parts.heatflow_particles = particles.heatflow
      if (!model.parts.educational_cool_air_particles) {
        model.parts.educational_cool_air_particles = particles.airflow
      }
      if (!model.parts.educational_heat_particles) {
        model.parts.educational_heat_particles = particles.heatflow
      }
      if (!model.parts.steam_particles) model.parts.steam_particles = particles.steam
      applySize()
      frameCamera()
      initialCam.position.copy(camera.position)
      initialCam.target.copy(controls.target)
      renderer.render(scene, camera)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (firstFrameSent || disposed) return
          firstFrameSent = true
          firstFrameCb.current?.()
        })
      })
    }

    void loadModel(debugRef.current.modelSource)

    if (import.meta.env.DEV) {
      ;(window as unknown as { __kk?: object }).__kk = {
        scene,
        camera,
        controls,
        count(name: string) {
          let n = 0
          scene.traverse((obj) => {
            if (obj.name === name) n += 1
          })
          return n
        },
        names() {
          const map: Record<string, number> = {}
          scene.traverse((obj) => {
            if (!obj.name) return
            map[obj.name] = (map[obj.name] || 0) + 1
          })
          return map
        },
        cam(x: number, y: number, z: number, tx = 0, ty = 0.15, tz = 0) {
          controls.autoRotate = false
          camera.position.set(x, y, z)
          controls.target.set(tx, ty, tz)
          camera.lookAt(tx, ty, tz)
          controls.update()
        },
      }
    }

    const sourcePoll = window.setInterval(() => {
      if (debugRef.current.modelSource !== source) void loadModel(debugRef.current.modelSource)
    }, 400)

    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearInterval(sourcePoll)
      ro.disconnect()
      window.removeEventListener('resize', applySize)
      document.removeEventListener('visibilitychange', onVisibility)
      controls.removeEventListener('start', stopIdle)
      controls.dispose()
      if (import.meta.env.DEV) delete (window as unknown as { __kk?: object }).__kk
      model?.dispose()
      fire.dispose()
      particles.dispose()
      scene.overrideMaterial = null
      blob.dispose()
      greyMat.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      envTex.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [quality, reducedMotion])

  return <div ref={mountRef} className="kk-viewport__canvas" />
}
