import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { DEFAULT_PARTICLES, MOBILE_PARTICLES, PIXEL_RATIO_CAP, SEAT_Y, TOTAL_H } from './constants'
import { createFuelAndFire } from './createFuelAndFire'
import { createParticles } from './createParticles'
import { createKellyKettleModel } from './KellyKettleModel'
import { DEFAULT_VIEW_SETUPS } from './viewSetups'
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
  onCameraPose?: (pose: { px: number; py: number; pz: number; tx: number; ty: number; tz: number; fov: number }) => void
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
    g.addColorStop(0, 'rgba(18, 16, 12, 0.34)')
    g.addColorStop(0.45, 'rgba(18, 16, 12, 0.12)')
    g.addColorStop(1, 'rgba(18, 16, 12, 0)')
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
  onCameraPose,
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
  const cameraCb = useRef(onCameraPose)
  cameraCb.current = onCameraPose

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let firstFrameSent = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality === 'high',
        alpha: true,
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
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.shadowMap.enabled = quality === 'high' && !debugRef.current.mobilePerformance
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = null

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new RoomEnvironment()
    const envTex = pmrem.fromScene(envScene, 0.04).texture
    envScene.dispose()
    scene.environment = envTex
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 12)
    const controls = new OrbitControls(camera, renderer.domElement)
    const coarse = window.matchMedia('(pointer: coarse)').matches
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = Math.PI / 2 - 0.04
    controls.rotateSpeed = coarse ? 0.88 : 0.7
    controls.zoomSpeed = coarse ? 1.2 : 1.05
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

    scene.add(new THREE.HemisphereLight(0xd7ddd6, 0x3f4a3c, 0.88))
    const key = new THREE.DirectionalLight(0xf0f3ee, 0.82)
    key.position.set(0.28, 1.05, 0.38)
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
    const fill = new THREE.DirectionalLight(0xb7c4bc, 0.36)
    fill.position.set(-0.55, 0.4, -0.15)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xc5d0c8, 0.22)
    rim.position.set(-0.2, 0.18, -0.55)
    scene.add(rim)

    const floorGeo = new THREE.CircleGeometry(0.28, 48)
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.38 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.0006
    floor.receiveShadow = true
    floor.renderOrder = -2
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
    const camFrom = new THREE.Vector3()
    const camTo = new THREE.Vector3()
    const tgtFrom = new THREE.Vector3()
    const tgtTo = new THREE.Vector3()
    let camBlend = 1
    let lastStep: DemoStep | '' = ''
    let lastLabelKey = ''
    let lastCamReport = 0

    const fitLens = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      const aspect = w / Math.max(h, 1)
      camera.aspect = aspect
      camera.fov = aspect < 0.72 ? 44 : aspect < 0.95 ? 38 : 32
      camera.updateProjectionMatrix()
      controls.minDistance = 0.1
      controls.maxDistance = aspect < 0.95 ? 2.4 : 1.9
      return aspect
    }

    const poseFor = (step: DemoStep) => {
      const aspect = fitLens()
      const saved = DEFAULT_VIEW_SETUPS[step]?.camera
      if (saved) {
        const target = new THREE.Vector3(saved.tx, saved.ty, saved.tz)
        const offset = new THREE.Vector3(saved.px - saved.tx, saved.py - saved.ty, saved.pz - saved.tz)
        if (aspect < 0.95) offset.multiplyScalar(1.18)
        return { target, offset, fov: aspect < 0.95 ? Math.max(saved.fov, 38) : saved.fov }
      }
      const pull = aspect < 0.95 ? 1.34 : 1
      if (step === 'fire' || step === 'complete') {
        return {
          target: new THREE.Vector3(0, 0.108, 0),
          offset: new THREE.Vector3(0.58, 0.16, 0.55).normalize().multiplyScalar(0.64 * pull),
          fov: aspect < 0.95 ? 38 : 32,
        }
      }
      return {
        target: new THREE.Vector3(0, TOTAL_H * 0.46, 0),
        offset: new THREE.Vector3(0.46, 0.28, 0.66).normalize().multiplyScalar(0.7 * pull),
        fov: aspect < 0.95 ? 38 : 32,
      }
    }

    const clearOrbit = () => {
      const extras = controls as OrbitControls & {
        _sphericalDelta: THREE.Spherical
        _panOffset: THREE.Vector3
        _scale: number
        state: number
      }
      extras._sphericalDelta.set(0, 0, 0)
      extras._panOffset.set(0, 0, 0)
      extras._scale = 1
      extras.state = -1
    }

    const applyPose = (step: DemoStep) => {
      const pose = poseFor(step)
      clearOrbit()
      camera.position.copy(pose.target).add(pose.offset)
      controls.target.copy(pose.target)
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      controls.update()
      controls.saveState()
    }

    const beginPose = (step: DemoStep) => {
      camFrom.copy(camera.position)
      tgtFrom.copy(controls.target)
      const pose = poseFor(step)
      camTo.copy(pose.target).add(pose.offset)
      tgtTo.copy(pose.target)
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      camBlend = 0
      lastLabelKey = ''
    }

    const frameCamera = () => applyPose('explore')

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
      fitLens()
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
      if (camBlend < 0.92) {
        if (lastLabelKey !== 'hide') {
          lastLabelKey = 'hide'
          anchorsCb.current([])
        }
        return
      }
      const compact = mount.clientWidth <= 860
      const list: LabelAnchor[] = []
      const push = (
        item: { id: string; text: string; local: THREE.Vector3; side: 'left' | 'right' },
        show: boolean,
      ) => {
        world.copy(item.local)
        world.y += SEAT_Y
        ndc.copy(world).project(camera)
        const x = Math.round((ndc.x * 0.5 + 0.5) * 50) * 2
        const y = Math.round((-ndc.y * 0.5 + 0.5) * 50) * 2
        list.push({
          id: item.id,
          text: item.text,
          x: Math.min(92, Math.max(8, x)),
          y: Math.min(88, Math.max(10, y)),
          visible: show && ndc.z < 1 && ndc.x > -1.2 && ndc.x < 1.2,
          side: item.side,
        })
      }
      for (const item of CUTAWAY_LABELS) push(item, cut > 0.72)
      for (const item of FLOW_LABELS) push(item, fireAmt > 0.22)
      const key = compact
        ? list.map((a) => `${a.id}:${a.visible ? 1 : 0}`).join('|')
        : list.map((a) => `${a.id}:${a.visible ? 1 : 0}:${a.x}:${a.y}`).join('|')
      if (key === lastLabelKey) return
      lastLabelKey = key
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
        applyPose(stepRef.current)
        camBlend = 1
        lastLabelKey = ''
      }

      const step = stepRef.current
      const debug = debugRef.current

      if (step !== lastStep) {
        const prev = lastStep
        lastStep = step
        if (step !== 'explore') interactedRef.current = true
        if (debug.layoutEdit) {
          camBlend = 1
        } else {
          if (prev) beginPose(step)
          if (reducedMotion || !prev) {
            applyPose(step)
            camBlend = 1
          }
        }
      }

      if (camBlend < 1) {
        camBlend = Math.min(1, camBlend + dt / 0.72)
        const k = ease(camBlend)
        camera.position.lerpVectors(camFrom, camTo, k)
        controls.target.lerpVectors(tgtFrom, tgtTo, k)
      }

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

      controls.autoRotate =
        debug.autoRotate &&
        !debug.layoutEdit &&
        !interactedRef.current &&
        step === 'explore' &&
        camBlend >= 1 &&
        !debug.silhouetteCompare
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
        cutaway,
      })
      particles.update(
        dt,
        fireProg * debug.fireIntensity,
        heatProg,
        particleCount,
        reducedMotion,
        debug.airflowVisible,
        cutaway,
      )

      if (camBlend < 1) {
        camera.lookAt(controls.target)
      } else {
        controls.update()
      }
      renderer.render(scene, camera)
      projectLabels(cutaway, fireProg)
      if (debug.layoutEdit && cameraCb.current && now - lastCamReport > 120) {
        lastCamReport = now
        cameraCb.current({
          px: camera.position.x,
          py: camera.position.y,
          pz: camera.position.z,
          tx: controls.target.x,
          ty: controls.target.y,
          tz: controls.target.z,
          fov: camera.fov,
        })
      }
    }

    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden'
      if (visible) lastT = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const ro = new ResizeObserver(applySize)
    ro.observe(mount)
    window.addEventListener('resize', applySize)
    window.visualViewport?.addEventListener('resize', applySize)

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
      window.visualViewport?.removeEventListener('resize', applySize)
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
