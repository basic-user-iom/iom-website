import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { INTRO_PEAK_BEND, PANEL_HEIGHT_M, PANEL_WIDTH_M, REST_BEND } from './bendMath'
import { createLinarPanel } from './LinarPanel'
import type { LinarTech } from './linarData'
import type { LinarConfig, LinarSide, LinarViewId } from './types'

type Props = {
  targetBendRef: { current: number }
  config: LinarConfig
  tech: LinarTech
  resetViewToken: number
  viewPreset: LinarViewId
  side: LinarSide
  viewToken: number
  tourActive: boolean
  introStarted: boolean
  interactedRef: { current: boolean }
  reducedMotion: boolean
  onUnavailable: () => void
  onUserInteract: () => void
  onIntroBend: (value: number) => void
  onIntroComplete?: () => void
}

type CameraTransition = {
  fromSpherical: THREE.Spherical
  toSpherical: THREE.Spherical
  thetaDelta: number
  radiusLift: number
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromBackground: THREE.Color
  toBackground: THREE.Color
  elapsed: number
  duration: number
  restoreDamping: boolean
}

type CinematicAnchor = {
  target: THREE.Vector3
  spherical: THREE.Spherical
}

const BG = 0xe9e8e4

function geometryKey(config: LinarConfig, tech: LinarTech): string {
  return [
    config.thicknessMm,
    config.incisionLengthMm,
    config.cutWidthMm,
    config.slatWidthMm,
    config.incisedTwelfths,
    config.pattern,
    tech.previewBridgeLengthMm,
    tech.referenceMinimumRadiusMm ?? 'none',
    config.backing,
  ].join(':')
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function cinematicEase(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
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

function fitDistance(camera: THREE.PerspectiveCamera, padY: number, padX: number): number {
  const fov = (camera.fov * Math.PI) / 180
  const halfTan = Math.tan(fov / 2)
  const fitH = (PANEL_HEIGHT_M * padY) / 2 / halfTan
  const fitW = (PANEL_WIDTH_M * padX) / 2 / halfTan / Math.max(camera.aspect, 0.2)
  return Math.max(fitH, fitW, 2.4)
}

function viewPlacement(
  id: LinarViewId,
  camera: THREE.PerspectiveCamera,
  side: LinarSide,
): { dir: THREE.Vector3; target: THREE.Vector3; dist: number; bg: number } {
  const mid = new THREE.Vector3(0, PANEL_HEIGHT_M * 0.5, 0)
  if (id === 'closeup') {
    const lateral = side === 'front' ? 0.035 : 0
    return {
      // Close-up stays almost perpendicular like the supplied product photo,
      // so the pale slat faces remain dominant over their routed side walls.
      // A small front offset preserves just enough parallax to read real depth.
      // The rear remains exactly normal while its thickness is unconfirmed;
      // orbit and the radius view still allow oblique inspection.
      dir: new THREE.Vector3(
        lateral,
        side === 'back' ? 0 : 0.012,
        side === 'back' ? -1 : 1,
      ).normalize(),
      target: new THREE.Vector3(0, PANEL_HEIGHT_M * 0.5, 0),
      dist: 0.52,
      // The supplied sample is photographed over a cool grey surface. Since
      // the kerfs are true geometry, this colour remains visible through them
      // without using a black filler or painted opening texture.
      bg: 0xc7c8c6,
    }
  }
  if (id === 'side') {
    const compact = camera.aspect < 0.95
    const reveal = compact ? 0.22 : 0.13
    return {
      dir: new THREE.Vector3(1, 0.025, side === 'back' ? -reveal : reveal).normalize(),
      target: mid.clone(),
      // Keep the thickness readable while revealing enough adjacent face to
      // orient the crop, especially in the narrow portrait viewport.
      dist: compact ? 1.25 : 1.08,
      bg: BG,
    }
  }
  if (id === 'reverse') {
    return {
      dir: new THREE.Vector3(0, 0, -1),
      target: mid.clone(),
      dist: fitDistance(camera, 1.16, 1.35),
      bg: 0xc7c8c6,
    }
  }
  if (id === 'bent') {
    return {
      dir: new THREE.Vector3(0.52, 0.27, side === 'back' ? -0.81 : 0.81).normalize(),
      target: new THREE.Vector3(0, PANEL_HEIGHT_M * 0.49, 0.1),
      dist: fitDistance(camera, 1.15, 1.25),
      bg: BG,
    }
  }
  return {
    dir: new THREE.Vector3(
      side === 'back' ? 0 : 0.14,
      side === 'back' ? 0 : 0.05,
      side === 'back' ? -1 : 1,
    ).normalize(),
    target: mid,
    dist: fitDistance(camera, 1.14, 1.2),
    bg: BG,
  }
}

function applyView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  width: number,
  height: number,
  preset: LinarViewId,
  side: LinarSide,
  sceneBg: THREE.Color,
) {
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2)
  camera.updateProjectionMatrix()
  const place = viewPlacement(preset, camera, side)
  const damping = controls.enableDamping
  controls.enableDamping = false
  camera.up.set(0, 1, 0)
  camera.position.copy(place.target).addScaledVector(place.dir, place.dist)
  controls.target.copy(place.target)
  camera.lookAt(place.target)
  controls.minDistance = Math.max(0.18, place.dist * 0.22)
  controls.maxDistance = place.dist * 4.5
  controls.update()
  controls.enableDamping = damping
  sceneBg.setHex(place.bg)
}

export function LinarScene({
  targetBendRef,
  config,
  tech,
  resetViewToken,
  viewPreset,
  side,
  viewToken,
  tourActive,
  introStarted,
  interactedRef,
  reducedMotion,
  onUnavailable,
  onUserInteract,
  onIntroBend,
  onIntroComplete,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const configRef = useRef(config)
  const techRef = useRef(tech)
  const onUserInteractRef = useRef(onUserInteract)
  const onIntroBendRef = useRef(onIntroBend)
  const onIntroCompleteRef = useRef(onIntroComplete)
  const onUnavailableRef = useRef(onUnavailable)
  const resetViewTokenRef = useRef(resetViewToken)
  const viewPresetRef = useRef(viewPreset)
  const sideRef = useRef(side)
  const viewTokenRef = useRef(viewToken)
  const tourActiveRef = useRef(tourActive)
  const introStartedRef = useRef(introStarted)

  configRef.current = config
  techRef.current = tech
  onUserInteractRef.current = onUserInteract
  onIntroBendRef.current = onIntroBend
  onIntroCompleteRef.current = onIntroComplete
  onUnavailableRef.current = onUnavailable
  resetViewTokenRef.current = resetViewToken
  viewPresetRef.current = viewPreset
  sideRef.current = side
  viewTokenRef.current = viewToken
  tourActiveRef.current = tourActive
  introStartedRef.current = introStarted

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
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(BG)

    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 80)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = 0.28
    controls.maxPolarAngle = Math.PI / 2 + 0.02
    controls.rotateSpeed = 0.72
    controls.zoomSpeed = 0.85
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE

    let cameraTransition: CameraTransition | null = null
    let hasOrbited = false
    const markInteract = () => {
      hasOrbited = true
      if (cameraTransition) {
        controls.enableDamping = cameraTransition.restoreDamping
        cameraTransition = null
      }
      interactedRef.current = true
      onUserInteractRef.current()
    }
    controls.addEventListener('start', markInteract)

    const hemi = new THREE.HemisphereLight(0xf4f3ef, 0x96938d, 0.42)
    scene.add(hemi)

    // Keep the shadow-casting source high so a three-metre panel produces a
    // compact studio-floor shadow rather than a long architectural silhouette.
    const key = new THREE.DirectionalLight(0xfffdf8, 0.95)
    key.position.set(-0.65, 8.2, 0.9)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.4
    key.shadow.camera.far = 16
    key.shadow.camera.left = -1.25
    key.shadow.camera.right = 1.25
    key.shadow.camera.top = 1.75
    key.shadow.camera.bottom = -1.75
    key.shadow.camera.updateProjectionMatrix()
    key.shadow.bias = -0.00002
    key.shadow.normalBias = 0.00014
    key.shadow.radius = 3.5
    key.shadow.intensity = 0.54
    scene.add(key)
    scene.add(key.target)
    key.target.position.set(0, PANEL_HEIGHT_M * 0.5, 0)

    // A broad, non-shadowing front key retains the pale surface and end-grain
    // response independently from the short overhead cast shadow.
    const frontKey = new THREE.DirectionalLight(0xfffdf8, 0.82)
    frontKey.position.set(-3.8, 5.2, 4.8)
    frontKey.target = key.target
    scene.add(frontKey)

    const fill = new THREE.DirectionalLight(0xeef2f4, 0.36)
    fill.position.set(3.4, 2.5, 3.2)
    scene.add(fill)

    // A balanced rear studio key keeps the reverse birch pale and makes the
    // capsule walls readable without changing geometry when the camera flips.
    // It also remains physically consistent when the user orbits around.
    const rim = new THREE.DirectionalLight(0xf7f4ee, 0.7)
    rim.position.set(-2.2, 3.4, -4.8)
    scene.add(rim)

    // A low opposing rear fill prevents one half of a bent panel from falling
    // into a muddy silhouette. Neither rear light casts a second fake shadow.
    const rearFill = new THREE.DirectionalLight(0xf0f3f4, 0.42)
    rearFill.position.set(3.1, 2.7, -4.2)
    scene.add(rearFill)

    // Receive only the shadow: the studio background remains visually clean,
    // while the real panel footprint (including a deep bend) defines the shape.
    const shadowReceiverGeometry = new THREE.PlaneGeometry(10, 10)
    const shadowReceiverMaterial = new THREE.ShadowMaterial({
      color: 0x37342f,
      opacity: 0.22,
      transparent: true,
      depthWrite: false,
    })
    const shadowReceiver = new THREE.Mesh(shadowReceiverGeometry, shadowReceiverMaterial)
    shadowReceiver.name = 'LinarShadowReceiver'
    shadowReceiver.rotation.x = -Math.PI / 2
    shadowReceiver.position.y = -0.0002
    shadowReceiver.receiveShadow = true
    shadowReceiver.castShadow = false
    shadowReceiver.renderOrder = -2
    scene.add(shadowReceiver)

    const panel = createLinarPanel({ config: configRef.current, tech: techRef.current })
    scene.add(panel.group)

    let displayedBend = reducedMotion ? REST_BEND : 0
    let introTarget = reducedMotion ? REST_BEND : 0
    let introDone = reducedMotion
    let introElapsed = 0
    let lastIntroEmit = -1
    panel.setBend(displayedBend, techRef.current.referenceMinimumRadiusMm)
    panel.setMaterial(configRef.current.material, true)
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

    let currentPreset: LinarViewId = viewPresetRef.current
    let cinematicAnchor: CinematicAnchor | null = null
    let cinematicElapsed = 0

    const captureCinematicAnchor = () => {
      cinematicAnchor = {
        target: controls.target.clone(),
        spherical: new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target),
        ),
      }
      cinematicAnchor.spherical.makeSafe()
      cinematicElapsed = 0
    }

    const applyFrame = () => {
      if (cameraTransition) {
        controls.enableDamping = cameraTransition.restoreDamping
        cameraTransition = null
      }
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      if (w < 16 || h < 16) return
      renderer.setSize(w, h, false)
      applyView(
        camera,
        controls,
        w,
        h,
        currentPreset,
        sideRef.current,
        scene.background as THREE.Color,
      )
      renderer.setClearColor(scene.background as THREE.Color, 1)
      initialCam.position.copy(camera.position)
      initialCam.target.copy(controls.target)
      initialCam.minDistance = controls.minDistance
      initialCam.maxDistance = controls.maxDistance
      captureCinematicAnchor()
    }

    const transitionToFrame = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      if (w < 16 || h < 16) return
      renderer.setSize(w, h, false)
      camera.aspect = Math.max(w / Math.max(h, 1), 0.2)
      camera.updateProjectionMatrix()
      const placement = viewPlacement(currentPreset, camera, sideRef.current)
      const destination = placement.target.clone().addScaledVector(placement.dir, placement.dist)
      controls.minDistance = Math.max(0.18, placement.dist * 0.22)
      controls.maxDistance = placement.dist * 4.5

      if (reducedMotion) {
        applyView(
          camera,
          controls,
          w,
          h,
          currentPreset,
          sideRef.current,
          scene.background as THREE.Color,
        )
        renderer.setClearColor(scene.background as THREE.Color, 1)
        return
      }

      const restoreDamping = cameraTransition?.restoreDamping ?? controls.enableDamping
      const fromSpherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      )
      const toSpherical = new THREE.Spherical().setFromVector3(
        destination.clone().sub(placement.target),
      )
      fromSpherical.makeSafe()
      toSpherical.makeSafe()
      const thetaDelta = shortestAngleDelta(fromSpherical.theta, toSpherical.theta)
      const angularTravel = Math.abs(thetaDelta)
      const radiusRatio =
        Math.max(fromSpherical.radius, toSpherical.radius) /
        Math.max(Math.min(fromSpherical.radius, toSpherical.radius), 0.01)

      controls.enableDamping = false
      cinematicAnchor = null
      cameraTransition = {
        fromSpherical,
        toSpherical,
        thetaDelta,
        // A subtle dolly-out keeps the full object readable during wide
        // rotations and gives front-to-reverse moves a deliberate studio feel.
        radiusLift: Math.min(0.2, (angularTravel / Math.PI) * 0.18),
        fromTarget: controls.target.clone(),
        toTarget: placement.target.clone(),
        fromBackground: (scene.background as THREE.Color).clone(),
        toBackground: new THREE.Color(placement.bg),
        elapsed: 0,
        duration: THREE.MathUtils.clamp(
          3.2 + angularTravel * 0.5 + Math.log(radiusRatio) * 0.65,
          3.4,
          5.4,
        ),
        restoreDamping,
      }
    }
    applyFrame()
    requestAnimationFrame(() => {
      if (!disposed && !hasOrbited) applyFrame()
    })
    renderer.render(scene, camera)

    const resize = () => {
      if (disposed) return
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(w, h, false)
      if (!hasOrbited) {
        applyFrame()
        return
      }
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    let lastAppliedBend = displayedBend
    let lastMaterial = configRef.current.material
    let lastGeomKey = geometryKey(configRef.current, techRef.current)
    let lastReset = resetViewTokenRef.current
    let lastView = viewTokenRef.current
    let raf = 0
    let lastT = performance.now()
    let visible = document.visibilityState !== 'hidden'
    const transitionSpherical = new THREE.Spherical()
    const transitionOffset = new THREE.Vector3()

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
        currentPreset = 'hero'
        transitionToFrame()
      }

      if (viewTokenRef.current !== lastView) {
        lastView = viewTokenRef.current
        currentPreset = viewPresetRef.current
        hasOrbited = false
        transitionToFrame()
      }

      const nextGeom = geometryKey(configRef.current, techRef.current)
      if (nextGeom !== lastGeomKey) {
        lastGeomKey = nextGeom
        panel.setConfig(configRef.current, techRef.current)
        lastAppliedBend = displayedBend
        panel.setBend(displayedBend, techRef.current.referenceMinimumRadiusMm)
      }

      if (configRef.current.material !== lastMaterial) {
        lastMaterial = configRef.current.material
        panel.setMaterial(lastMaterial)
      }

      if (!introDone && introStartedRef.current && !interactedRef.current) {
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

      const goal = interactedRef.current || introDone ? targetBendRef.current : introTarget
      const bendResponse = tourActiveRef.current && !reducedMotion ? 1.25 : 11
      const lambda = 1 - Math.exp(-dt * bendResponse)
      displayedBend += (goal - displayedBend) * lambda
      if (Math.abs(displayedBend - lastAppliedBend) > 0.02) {
        lastAppliedBend = displayedBend
        panel.setBend(displayedBend, techRef.current.referenceMinimumRadiusMm)
      }

      if (cameraTransition) {
        cameraTransition.elapsed += dt
        const progress = Math.min(1, cameraTransition.elapsed / cameraTransition.duration)
        const eased = cinematicEase(progress)
        controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, eased)

        const directRadius = THREE.MathUtils.lerp(
          cameraTransition.fromSpherical.radius,
          cameraTransition.toSpherical.radius,
          eased,
        )
        transitionSpherical.radius =
          directRadius * (1 + Math.sin(Math.PI * eased) * cameraTransition.radiusLift)
        transitionSpherical.phi = THREE.MathUtils.lerp(
          cameraTransition.fromSpherical.phi,
          cameraTransition.toSpherical.phi,
          eased,
        )
        transitionSpherical.theta =
          cameraTransition.fromSpherical.theta + cameraTransition.thetaDelta * eased
        transitionOffset.setFromSpherical(transitionSpherical)
        camera.position.copy(controls.target).add(transitionOffset)

        const background = scene.background as THREE.Color
        background.lerpColors(
          cameraTransition.fromBackground,
          cameraTransition.toBackground,
          eased,
        )
        camera.lookAt(controls.target)
        if (progress >= 1) {
          const completedTransition = cameraTransition
          controls.enableDamping = completedTransition.restoreDamping
          cinematicAnchor = {
            target: completedTransition.toTarget.clone(),
            spherical: completedTransition.toSpherical.clone(),
          }
          cinematicElapsed = 0
          cameraTransition = null
        }
      }

      if (!cameraTransition && tourActiveRef.current && !reducedMotion && cinematicAnchor) {
        cinematicElapsed += dt
        const driftBlend = cinematicEase(Math.min(1, cinematicElapsed / 1.15))
        const thetaDrift = Math.sin(cinematicElapsed * 0.34) * 0.018 * driftBlend
        const phiDrift = Math.sin(cinematicElapsed * 0.27) * 0.006 * driftBlend
        const dollyDrift = Math.sin(cinematicElapsed * 0.38) * 0.012 * driftBlend

        transitionSpherical.radius = cinematicAnchor.spherical.radius * (1 + dollyDrift)
        transitionSpherical.phi = cinematicAnchor.spherical.phi + phiDrift
        transitionSpherical.theta = cinematicAnchor.spherical.theta + thetaDrift
        transitionSpherical.makeSafe()
        transitionOffset.setFromSpherical(transitionSpherical)
        controls.target.copy(cinematicAnchor.target)
        camera.position.copy(controls.target).add(transitionOffset)
        camera.lookAt(controls.target)
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
      shadowReceiverGeometry.dispose()
      shadowReceiverMaterial.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [reducedMotion])

  return <div ref={mountRef} className="linar-viewport__canvas" />
}
