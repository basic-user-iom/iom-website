import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  INTRO_PEAK_BEND,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  REST_BEND,
  curveElement,
  makeBendState,
  maxRenderedNormalOffsetM,
  slatLayout,
} from './bendMath'
import { createLinarPanel } from './LinarPanel'
import type { LinarTech } from './linarData'
import { clampLinarPanelCount } from './materialData'
import type {
  LinarApplication,
  LinarConfig,
  LinarLightState,
  LinarSide,
  LinarViewId,
} from './types'

type Props = {
  targetBendRef: { current: number }
  targetSecondaryCurveRef: { current: number }
  config: LinarConfig
  tech: LinarTech
  resetViewToken: number
  viewPreset: LinarViewId
  side: LinarSide
  viewToken: number
  tourActive: boolean
  cinematicActive: boolean
  cinematicToken: number
  lightState: LinarLightState
  introStarted: boolean
  interactedRef: { current: boolean }
  reducedMotion: boolean
  onUnavailable: () => void
  onUserInteract: () => void
  onLightChange: (state: LinarLightState) => void
  onSceneReady: () => void
  onCinematicStage: (stage: number) => void
  onCinematicComplete: () => void
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
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TOP_VIEW_UP = new THREE.Vector3(1, 0, 0)
const DEFAULT_MIN_POLAR_ANGLE = 0.28
const DEFAULT_MAX_POLAR_ANGLE = Math.PI / 2 + 0.02

type PlanBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  heightM: number
}

type PanelPlacement = {
  x: number
  y: number
  z: number
  rotY: number
}

type LocalPlanPose = {
  x: number
  z: number
  rotY: number
}

type ViewPlacement = {
  dir: THREE.Vector3
  target: THREE.Vector3
  dist: number
  bg: number
  up?: THREE.Vector3
  zoom?: number
}

const planPose = { x: 0, z: 0, rotY: 0 }
const TOP_VIEW_PERSPECTIVE_SCALE = 10

function clampedPanelCount(value: number): number {
  return clampLinarPanelCount(value)
}

/**
 * Repetition represents one continuous installation rather than N complete
 * copies of the same turn laid over one another. Distribute the requested
 * visual turn across the modules so the whole row retains the selected overall
 * gesture, remains tangent-connected, and never collapses into stacked loops.
 * Technical radius/status values remain the single-panel references shown in
 * the information panel.
 */
function installationPanelBend(
  bend: number,
  panelCount: number,
  referenceRadiusMm: number | null,
  bendableWidthM: number,
): number {
  const count = clampedPanelCount(panelCount)
  if (count === 1 || Math.abs(bend) < 0.000001) return bend

  // The controller is not angular: at tighter radii the active width reduces
  // and the turn caps at a half-circle. Dividing the controller value by the
  // panel count can therefore turn a four-panel row through almost 360 degrees.
  // Instead, solve for the controller value that gives every module one Nth
  // of the selected single-panel turn. The connected installation preserves
  // the requested overall gesture without wrapping modules over one another.
  const direction = Math.sign(bend)
  const requestedState = makeBendState(
    bend,
    PANEL_WIDTH_M,
    referenceRadiusMm,
    bendableWidthM,
  )
  const targetModuleAngle = requestedState.alpha / count
  let low = 0
  let high = Math.abs(bend)
  for (let step = 0; step < 24; step += 1) {
    const candidate = (low + high) * 0.5
    const candidateAngle = makeBendState(
      candidate * direction,
      PANEL_WIDTH_M,
      referenceRadiusMm,
      bendableWidthM,
    ).alpha
    if (candidateAngle < targetModuleAngle) low = candidate
    else high = candidate
  }
  return direction * (low + high) * 0.5
}

function transformPlanPoint(
  x: number,
  z: number,
  placement: PanelPlacement,
): { x: number; z: number } {
  const cos = Math.cos(placement.rotY)
  const sin = Math.sin(placement.rotY)
  return {
    x: placement.x + cos * x + sin * z,
    z: placement.z - sin * x + cos * z,
  }
}

/** Rotate a local plan offset into a repeated module's tangent frame. */
function rotatedPlanPoint(point: LocalPlanPose, rotY: number) {
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)
  return {
    x: cos * point.x + sin * point.z,
    z: -sin * point.x + cos * point.z,
  }
}

/**
 * Chain repeated modules by their real deformed edge positions and tangents.
 * All roots remain at y=0 (one installation row), while each following module
 * starts exactly where the previous module ends. The completed chain is then
 * recentred in plan so camera, light and application bounds share one origin.
 */
function panelPlacementsForState(
  panelCount: number,
  state: ReturnType<typeof makeBendState>,
): PanelPlacement[] {
  const count = clampedPanelCount(panelCount)
  const left = { x: 0, z: 0, rotY: 0 }
  const right = { x: 0, z: 0, rotY: 0 }
  curveElement(-PANEL_WIDTH_M * 0.5, state, PANEL_WIDTH_M, left)
  curveElement(PANEL_WIDTH_M * 0.5, state, PANEL_WIDTH_M, right)
  const tangentDelta = right.rotY - left.rotY
  const placements: PanelPlacement[] = [{ x: 0, y: 0, z: 0, rotY: 0 }]

  for (let index = 1; index < count; index += 1) {
    const previous = placements[index - 1]
    const previousRight = transformPlanPoint(right.x, right.z, previous)
    const rotY = previous.rotY + tangentDelta
    const nextLeftOffset = rotatedPlanPoint(left, rotY)
    placements.push({
      x: previousRight.x - nextLeftOffset.x,
      y: 0,
      z: previousRight.z - nextLeftOffset.z,
      rotY,
    })
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  const sample = { x: 0, z: 0, rotY: 0 }
  for (const placement of placements) {
    for (let step = 0; step <= 64; step += 1) {
      const originalX = -PANEL_WIDTH_M * 0.5 + (PANEL_WIDTH_M * step) / 64
      curveElement(originalX, state, PANEL_WIDTH_M, sample)
      const world = transformPlanPoint(sample.x, sample.z, placement)
      minX = Math.min(minX, world.x)
      maxX = Math.max(maxX, world.x)
      minZ = Math.min(minZ, world.z)
      maxZ = Math.max(maxZ, world.z)
    }
  }
  const centreX = (minX + maxX) * 0.5
  const centreZ = (minZ + maxZ) * 0.5
  for (const placement of placements) {
    placement.x -= centreX
    placement.z -= centreZ
  }
  return placements
}

function panelPlanBounds(
  config: LinarConfig,
  tech: LinarTech,
  bend: number,
  secondaryCurveAmount: number,
): PlanBounds {
  const layout = slatLayout(config)
  const effectiveBend = installationPanelBend(
    bend,
    config.panelCount,
    tech.referenceMinimumRadiusMm,
    layout.incisedWidthM,
  )
  const state = makeBendState(
    effectiveBend,
    PANEL_WIDTH_M,
    tech.referenceMinimumRadiusMm,
    layout.incisedWidthM,
    secondaryCurveAmount,
    maxRenderedNormalOffsetM(layout.thicknessM, config.backing !== 'none'),
  )
  const placements = panelPlacementsForState(config.panelCount, state)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  const samples = 320

  for (const placement of placements) {
    for (let i = 0; i <= samples; i += 1) {
      const originalX = -PANEL_WIDTH_M * 0.5 + PANEL_WIDTH_M * (i / samples)
      curveElement(originalX, state, PANEL_WIDTH_M, planPose)
      const point = transformPlanPoint(planPose.x, planPose.z, placement)
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    }
  }

  const halfThicknessM = config.thicknessMm / 2000
  return {
    minX: minX - halfThicknessM,
    maxX: maxX + halfThicknessM,
    minZ: minZ - halfThicknessM,
    maxZ: maxZ + halfThicknessM,
    heightM: PANEL_HEIGHT_M,
  }
}

function fitPlanDistance(camera: THREE.PerspectiveCamera, bounds: PlanBounds): number {
  const fov = (camera.fov * Math.PI) / 180
  const halfTan = Math.tan(fov / 2)
  const extentX = Math.max(0.04, bounds.maxX - bounds.minX)
  const extentZ = Math.max(0.04, bounds.maxZ - bounds.minZ)
  const verticalFit = (extentX * 1.26) / 2 / halfTan
  const horizontalFit =
    (extentZ * 1.26) / 2 / halfTan / Math.max(camera.aspect, 0.2)
  return Math.max(verticalFit, horizontalFit, 0.42)
}

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

function appearanceKey(config: LinarConfig): string {
  return `${config.material}:${config.veneer}:${config.mdfColour}:${config.backing}:${config.feltColour}`
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

function fitDistance(
  camera: THREE.PerspectiveCamera,
  padY: number,
  padX: number,
  objectWidthM = PANEL_WIDTH_M,
  objectHeightM = PANEL_HEIGHT_M,
): number {
  const fov = (camera.fov * Math.PI) / 180
  const halfTan = Math.tan(fov / 2)
  const fitH = (objectHeightM * padY) / 2 / halfTan
  const fitW = (objectWidthM * padX) / 2 / halfTan / Math.max(camera.aspect, 0.2)
  return Math.max(fitH, fitW, 2.4)
}

function planDepthAllowance(bounds: PlanBounds | undefined, direction: THREE.Vector3): number {
  if (!bounds) return 0
  const extentX = Math.max(0, bounds.maxX - bounds.minX)
  const extentZ = Math.max(0, bounds.maxZ - bounds.minZ)
  // Perspective fitting must reserve space for geometry in front of the
  // target plane. Otherwise deep C bends become larger than their nominal
  // target-plane fit and can clip even when their plan width is correct.
  return (
    (Math.abs(direction.x) * extentX + Math.abs(direction.z) * extentZ) * 0.5
  )
}

const STARTUP_CINEMATIC_DURATION_SECONDS = 24

function startupCinematicPose(elapsed: number) {
  const time = THREE.MathUtils.clamp(elapsed, 0, STARTUP_CINEMATIC_DURATION_SECONDS)
  const segment = (start: number, end: number) =>
    cinematicEase(THREE.MathUtils.clamp((time - start) / Math.max(end - start, 0.001), 0, 1))

  let bend = 0
  let secondary = 0
  if (time < 4) {
    bend = THREE.MathUtils.lerp(0, 8, segment(1.5, 4))
  } else if (time < 8) {
    bend = THREE.MathUtils.lerp(8, 38, segment(4, 8))
  } else if (time < 12) {
    bend = THREE.MathUtils.lerp(38, -54, segment(8, 12))
  } else if (time < 16) {
    bend = THREE.MathUtils.lerp(-54, -66, segment(12, 14))
    secondary = THREE.MathUtils.lerp(0, 88, segment(12, 16))
  } else if (time < 20) {
    bend = THREE.MathUtils.lerp(-66, 22, segment(16, 20))
    secondary = THREE.MathUtils.lerp(88, 0, segment(16, 20))
  } else {
    bend = THREE.MathUtils.lerp(22, 28, segment(20, 22.5))
  }

  return {
    bend,
    secondary,
    lightU: THREE.MathUtils.clamp(-0.26 + Math.sin(time * 0.54) * 0.58, -0.92, 0.92),
    lightV: THREE.MathUtils.clamp(-0.18 + Math.cos(time * 0.41) * 0.45, -0.7, 0.3),
    stage: Math.min(5, Math.floor(time / 4)),
    done: elapsed >= STARTUP_CINEMATIC_DURATION_SECONDS,
  }
}

function viewPlacement(
  id: LinarViewId,
  camera: THREE.PerspectiveCamera,
  side: LinarSide,
  application: LinarApplication,
  planBounds?: PlanBounds,
): ViewPlacement {
  if (id === 'top') {
    const bounds = planBounds ?? {
      minX: -PANEL_WIDTH_M * 0.5,
      maxX: PANEL_WIDTH_M * 0.5,
      minZ: -0.01,
      maxZ: 0.01,
      heightM: PANEL_HEIGHT_M,
    }
    return {
      // A tiny off-axis component avoids the exact look/up singularity while
      // remaining visually indistinguishable from a true orthographic plan.
      dir: new THREE.Vector3(0.0001, 1, 0.0001).normalize(),
      target: new THREE.Vector3(
        (bounds.minX + bounds.maxX) * 0.5,
        bounds.heightM * 0.5,
        (bounds.minZ + bounds.maxZ) * 0.5,
      ),
      // Retain the one PerspectiveCamera authority, but use a long focal
      // setup for this technical plan. It removes the false wide band caused
      // by the 2.8 m panel height being projected from a nearby camera.
      dist: fitPlanDistance(camera, bounds) * TOP_VIEW_PERSPECTIVE_SCALE,
      bg: BG,
      // The serpentine runs along world X. Using it as screen-up makes the
      // three legs read vertically, matching the supplied top-view reference.
      up: TOP_VIEW_UP,
      zoom: TOP_VIEW_PERSPECTIVE_SCALE,
    }
  }
  const installationWidth = planBounds
    ? Math.max(planBounds.maxX - planBounds.minX, planBounds.maxZ - planBounds.minZ)
    : PANEL_WIDTH_M
  const installationHeight = planBounds?.heightM ?? PANEL_HEIGHT_M
  const mid = new THREE.Vector3(0, installationHeight * 0.5, 0)
  if (application === 'ceiling') {
    const target = new THREE.Vector3(0, 2.5, 0)
    const dist = fitDistance(camera, 1.15, 1.2, installationWidth, installationHeight)
    if (id === 'side') {
      const dir = new THREE.Vector3(1, -0.22, 0.08).normalize()
      return {
        dir,
        target,
        dist: Math.max(2.6, dist * 0.76) + planDepthAllowance(planBounds, dir),
        bg: BG,
      }
    }
    if (id === 'reverse') {
      const dir = new THREE.Vector3(0.12, 0.8, 0.58).normalize()
      return {
        dir,
        target,
        dist: dist + planDepthAllowance(planBounds, dir),
        bg: BG,
      }
    }
    const dir = new THREE.Vector3(0.28, -0.9, 0.34).normalize()
    return {
      dir,
      target,
      dist: dist + planDepthAllowance(planBounds, dir),
      bg: BG,
    }
  }
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
    const repeatedInstallation = installationWidth > PANEL_WIDTH_M + 0.001
    const dir = new THREE.Vector3(
      1,
      0.025,
      side === 'back' ? -reveal : reveal,
    ).normalize()
    return {
      dir,
      target: mid.clone(),
      // Keep the thickness readable while revealing enough adjacent face to
      // orient the crop, especially in the narrow portrait viewport.
      dist: repeatedInstallation
        ? fitDistance(camera, 1.12, 1.1, installationWidth, installationHeight) +
          planDepthAllowance(planBounds, dir)
        : compact
          ? 1.25
          : 1.08,
      bg: BG,
    }
  }
  if (id === 'reverse') {
    const dir = new THREE.Vector3(0, 0, -1)
    return {
      dir,
      target: mid.clone(),
      dist:
        fitDistance(camera, 1.16, 1.35, installationWidth, installationHeight) +
        planDepthAllowance(planBounds, dir),
      bg: 0xc7c8c6,
    }
  }
  if (id === 'bent') {
    const dir = new THREE.Vector3(
      0.52,
      0.27,
      side === 'back' ? -0.81 : 0.81,
    ).normalize()
    return {
      dir,
      target: new THREE.Vector3(0, installationHeight * 0.49, 0.1),
      dist:
        fitDistance(camera, 1.15, 1.25, installationWidth, installationHeight) +
        planDepthAllowance(planBounds, dir),
      bg: BG,
    }
  }
  const dir = new THREE.Vector3(
    side === 'back' ? 0 : 0.14,
    side === 'back' ? 0 : 0.05,
    side === 'back' ? -1 : 1,
  ).normalize()
  return {
    dir,
    target: mid,
    dist:
      fitDistance(camera, 1.14, 1.2, installationWidth, installationHeight) +
      planDepthAllowance(planBounds, dir),
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
  application: LinarApplication,
  sceneBg: THREE.Color,
  planBounds?: PlanBounds,
) {
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2)
  camera.updateProjectionMatrix()
  const place = viewPlacement(preset, camera, side, application, planBounds)
  const damping = controls.enableDamping
  controls.enableDamping = false
  controls.minPolarAngle = preset === 'top' ? 0 : DEFAULT_MIN_POLAR_ANGLE
  controls.maxPolarAngle =
    preset === 'top' ? Math.PI : DEFAULT_MAX_POLAR_ANGLE
  camera.up.copy(place.up ?? WORLD_UP)
  camera.zoom = place.zoom ?? 1
  camera.updateProjectionMatrix()
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
  targetSecondaryCurveRef,
  config,
  tech,
  resetViewToken,
  viewPreset,
  side,
  viewToken,
  tourActive,
  cinematicActive,
  cinematicToken,
  lightState,
  introStarted,
  interactedRef,
  reducedMotion,
  onUnavailable,
  onUserInteract,
  onLightChange,
  onSceneReady,
  onCinematicStage,
  onCinematicComplete,
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
  const cinematicActiveRef = useRef(cinematicActive)
  const cinematicTokenRef = useRef(cinematicToken)
  const lightStateRef = useRef(lightState)
  const introStartedRef = useRef(introStarted)
  const onLightChangeRef = useRef(onLightChange)
  const onSceneReadyRef = useRef(onSceneReady)
  const onCinematicStageRef = useRef(onCinematicStage)
  const onCinematicCompleteRef = useRef(onCinematicComplete)

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
  cinematicActiveRef.current = cinematicActive
  cinematicTokenRef.current = cinematicToken
  lightStateRef.current = lightState
  introStartedRef.current = introStarted
  onLightChangeRef.current = onLightChange
  onSceneReadyRef.current = onSceneReady
  onCinematicStageRef.current = onCinematicStage
  onCinematicCompleteRef.current = onCinematicComplete

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
    renderer.toneMappingExposure = 0.86
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

    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 200)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = DEFAULT_MIN_POLAR_ANGLE
    controls.maxPolarAngle = DEFAULT_MAX_POLAR_ANGLE
    controls.rotateSpeed = 0.72
    controls.zoomSpeed = 0.85
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE

    let cameraTransition: CameraTransition | null = null
    let hasOrbited = false
    const markInteract = () => {
      // Top inspection uses X as screen-up, but OrbitControls assumes the
      // camera's up axis is the world orbit axis. Hand back to canonical Y-up
      // before a manual orbit so the following drag and later presets cannot
      // inherit a rolled coordinate system.
      if (camera.up.distanceToSquared(WORLD_UP) > 0.01) {
        if (camera.zoom !== 1) {
          const offset = camera.position.clone().sub(controls.target)
          offset.multiplyScalar(1 / camera.zoom)
          camera.position.copy(controls.target).add(offset)
          camera.zoom = 1
          camera.updateProjectionMatrix()
        }
        camera.up.copy(WORLD_UP)
        controls.minPolarAngle = DEFAULT_MIN_POLAR_ANGLE
        controls.maxPolarAngle = DEFAULT_MAX_POLAR_ANGLE
        const offset = camera.position.clone().sub(controls.target)
        if (Math.abs(offset.clone().normalize().dot(WORLD_UP)) > 0.999) {
          offset.z += Math.max(0.002, offset.length() * 0.002)
          camera.position.copy(controls.target).add(offset)
        }
        camera.lookAt(controls.target)
        controls.update()
      }
      hasOrbited = true
      if (cameraTransition) {
        controls.enableDamping = cameraTransition.restoreDamping
        cameraTransition = null
      }
      interactedRef.current = true
      onUserInteractRef.current()
    }
    controls.addEventListener('start', markInteract)

    const hemi = new THREE.HemisphereLight(0xf4f3ef, 0x96938d, 0.3)
    scene.add(hemi)

    // One persistent, real key light serves normal viewing, user interaction
    // and the startup cinematic. All other lights are non-shadowing fills.
    const key = new THREE.SpotLight(0xfff7e8, 11, 14, 0.98, 0.84, 1.1)
    key.name = 'LinarInteractiveKeyLight'
    key.position.set(-1.2, 4.8, 2.5)
    key.castShadow = true
    const gl = renderer.getContext()
    const rendererInfo = String(gl.getParameter(gl.RENDERER) ?? '')
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const unmaskedRenderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '')
      : rendererInfo
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(
      `${rendererInfo} ${unmaskedRenderer}`,
    )
    const compactShadowMap =
      softwareRenderer ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 900 ||
      (navigator.hardwareConcurrency ?? 4) < 8
    const maximumPixelRatio = softwareRenderer ? 0.65 : compactShadowMap ? 1.15 : 1.5
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maximumPixelRatio))
    // Software WebGL cannot sustain a live, perforation-accurate shadow pass
    // over thousands of manufactured elements. Preserve the full geometry and
    // lighting, but omit the shadow map on that fallback renderer so the
    // configurator remains interactive. Hardware WebGL always keeps it on.
    renderer.shadowMap.enabled = !softwareRenderer
    key.castShadow = !softwareRenderer
    const shadowMapSize = compactShadowMap ? 1024 : 2048
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    key.shadow.camera.near = 0.15
    key.shadow.camera.far = 14
    key.shadow.camera.updateProjectionMatrix()
    key.shadow.bias = -0.00004
    key.shadow.normalBias = 0.00018
    key.shadow.radius = compactShadowMap ? 2.2 : 3
    key.shadow.intensity = 0.62
    key.shadow.autoUpdate = false
    key.shadow.needsUpdate = true
    const invalidateKeyShadow = () => {
      if (key.castShadow) key.shadow.needsUpdate = true
    }
    scene.add(key)
    scene.add(key.target)
    key.target.position.set(0, PANEL_HEIGHT_M * 0.5, 0)

    const lightOrb = new THREE.Group()
    lightOrb.name = 'LinarLightOrb'
    const lightOrbGeometry = new THREE.SphereGeometry(0.04, 24, 16)
    const lightOrbMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff2cf,
      emissive: 0xffc96d,
      emissiveIntensity: 2.4,
      roughness: 0.2,
      metalness: 0,
      depthWrite: true,
    })
    const lightOrbVisibleMesh = new THREE.Mesh(lightOrbGeometry, lightOrbMaterial)
    lightOrbVisibleMesh.name = 'LinarLightOrbVisible'
    const lightOrbHitGeometry = new THREE.SphereGeometry(0.15, 12, 8)
    const lightOrbHitMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
    const lightOrbHitMesh = new THREE.Mesh(lightOrbHitGeometry, lightOrbHitMaterial)
    lightOrbHitMesh.name = 'LinarLightOrbHitTarget'
    lightOrb.add(lightOrbVisibleMesh, lightOrbHitMesh)
    lightOrb.visible = false
    scene.add(lightOrb)

    // A broad, non-shadowing front key retains the pale surface and end-grain
    // response independently from the short overhead cast shadow.
    const frontKey = new THREE.DirectionalLight(0xfffdf8, 0.48)
    frontKey.position.set(-3.8, 5.2, 4.8)
    frontKey.target = key.target
    scene.add(frontKey)

    const fill = new THREE.DirectionalLight(0xeef2f4, 0.2)
    fill.position.set(3.4, 2.5, 3.2)
    scene.add(fill)

    // A balanced rear studio key keeps the reverse birch pale and makes the
    // capsule walls readable without changing geometry when the camera flips.
    // It also remains physically consistent when the user orbits around.
    const rim = new THREE.DirectionalLight(0xf7f4ee, 0.42)
    rim.position.set(-2.2, 3.4, -4.8)
    scene.add(rim)

    // A low opposing rear fill prevents one half of a bent panel from falling
    // into a muddy silhouette. Neither rear light casts a second fake shadow.
    const rearFill = new THREE.DirectionalLight(0xf0f3f4, 0.22)
    rearFill.position.set(3.1, 2.7, -4.2)
    scene.add(rearFill)

    // Ceiling fill remains non-shadowing: the interactive SpotLight above is
    // the only shadow authority in every application.
    const ceilingKey = new THREE.DirectionalLight(0xfffcf5, 0)
    ceilingKey.position.set(1.1, 0.35, 1.6)
    ceilingKey.target.position.set(0, 2.5, 0)
    ceilingKey.castShadow = false
    scene.add(ceilingKey)
    scene.add(ceilingKey.target)

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

    const presentationRoot = new THREE.Group()
    presentationRoot.name = 'LinarPresentationRoot'
    const installationRoot = new THREE.Group()
    installationRoot.name = 'LinarInstallation'
    presentationRoot.add(installationRoot)
    scene.add(presentationRoot)

    // Shared links and restored sessions should render and frame their selected
    // pose on the first frame, before replica transforms are calculated.
    let displayedBend = targetBendRef.current
    let displayedSecondaryCurve = targetSecondaryCurveRef.current

    const panel = createLinarPanel({ config: configRef.current, tech: techRef.current })
    let arrangementLayout = slatLayout(configRef.current)
    installationRoot.add(panel.group)

    type ReplicaBinding = {
      source: THREE.Object3D
      replica: THREE.Object3D
    }
    let panelRoots: THREE.Object3D[] = [panel.group]
    let replicaBindings: ReplicaBinding[] = []

    const bindReplicaObjects = (source: THREE.Object3D, replica: THREE.Object3D) => {
      replicaBindings.push({ source, replica })
      if (source instanceof THREE.InstancedMesh && replica instanceof THREE.InstancedMesh) {
        // Share the dynamic instance buffer rather than copying thousands of
        // transforms for each repeated panel.
        replica.instanceMatrix = source.instanceMatrix
        replica.instanceColor = source.instanceColor
      }
      for (let i = 0; i < source.children.length; i += 1) {
        bindReplicaObjects(source.children[i], replica.children[i])
      }
    }

    const clearPanelReplicas = () => {
      for (let i = 1; i < panelRoots.length; i += 1) {
        installationRoot.remove(panelRoots[i])
      }
      panelRoots = [panel.group]
      replicaBindings = []
    }

    const rebuildPanelReplicas = () => {
      clearPanelReplicas()
      const count = clampedPanelCount(configRef.current.panelCount)
      for (let i = 1; i < count; i += 1) {
        const replica = panel.group.clone(true)
        replica.name = `LinarPanelReplica${i + 1}`
        bindReplicaObjects(panel.group, replica)
        installationRoot.add(replica)
        panelRoots.push(replica)
      }
    }

    const syncPanelReplicas = () => {
      for (const binding of replicaBindings) {
        binding.replica.visible = binding.source.visible
        binding.replica.castShadow = binding.source.castShadow
        binding.replica.receiveShadow = binding.source.receiveShadow
        if (
          binding.source instanceof THREE.InstancedMesh &&
          binding.replica instanceof THREE.InstancedMesh
        ) {
          binding.replica.count = binding.source.count
        }
      }
    }

    const applyPanelArrangement = () => {
      const arrangementConfig = configRef.current
      const arrangementState = makeBendState(
        installationPanelBend(
          displayedBend,
          arrangementConfig.panelCount,
          techRef.current.referenceMinimumRadiusMm,
          arrangementLayout.incisedWidthM,
        ),
        PANEL_WIDTH_M,
        techRef.current.referenceMinimumRadiusMm,
        arrangementLayout.incisedWidthM,
        displayedSecondaryCurve,
        maxRenderedNormalOffsetM(
          arrangementLayout.thicknessM,
          arrangementConfig.backing !== 'none',
        ),
      )
      const placements = panelPlacementsForState(
        arrangementConfig.panelCount,
        arrangementState,
      )
      for (let i = 0; i < panelRoots.length; i += 1) {
        const placement = placements[i] ?? placements[placements.length - 1]
        panelRoots[i].position.set(placement.x, placement.y, placement.z)
        panelRoots[i].rotation.set(0, placement.rotY, 0)
      }
      syncPanelReplicas()
      invalidateKeyShadow()
    }

    rebuildPanelReplicas()

    const contextWallGeometry = new THREE.PlaneGeometry(9, PANEL_HEIGHT_M + 1.2)
    const contextWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xdeddd9,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const contextWall = new THREE.Mesh(contextWallGeometry, contextWallMaterial)
    contextWall.name = 'LinarWallContext'
    contextWall.position.set(0, PANEL_HEIGHT_M * 0.5, -0.095)
    contextWall.receiveShadow = true
    contextWall.visible = false
    scene.add(contextWall)

    const contextCeilingGeometry = new THREE.PlaneGeometry(9, 9)
    const contextCeilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xe1e0dc,
      emissive: 0xe1e0dc,
      emissiveIntensity: 0.38,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const contextCeiling = new THREE.Mesh(contextCeilingGeometry, contextCeilingMaterial)
    contextCeiling.name = 'LinarCeilingContext'
    contextCeiling.rotation.x = Math.PI / 2
    contextCeiling.position.y = 2.62
    contextCeiling.receiveShadow = true
    contextCeiling.visible = false
    scene.add(contextCeiling)

    // Starting shared geometry flat while fitting the camera to a compact
    // target bend caused a conspicuous clipped flash.
    let introTarget = reducedMotion ? REST_BEND : 0
    let introDone = reducedMotion
    let introElapsed = 0
    let lastIntroEmit = -1
    panel.setBend(
      installationPanelBend(
        displayedBend,
        configRef.current.panelCount,
        techRef.current.referenceMinimumRadiusMm,
        arrangementLayout.incisedWidthM,
      ),
      techRef.current.referenceMinimumRadiusMm,
      displayedSecondaryCurve,
    )
    applyPanelArrangement()
    panel.setMaterial(
      configRef.current.material,
      configRef.current.veneer,
      configRef.current.mdfColour,
      true,
    )
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
    let cameraDriftElapsed = 0
    let startupCinematicElapsed = 0
    let startupCinematicStartedAt = performance.now()
    let startupCinematicRunToken = cinematicTokenRef.current
    let startupCinematicStage = -1
    let startupCinematicCompleted = false
    const presentationTargetPosition = new THREE.Vector3()
    const presentationTargetQuaternion = new THREE.Quaternion()
    const presentationTargetEuler = new THREE.Euler()
    const keyTargetGoal = new THREE.Vector3(0, PANEL_HEIGHT_M * 0.5, 0)
    let wallOpacityGoal = 0
    let wallZGoal = contextWall.position.z
    let ceilingOpacityGoal = 0
    let floorShadowOpacityGoal = 0.22
    let ceilingLightGoal = 0

    const setPresentationTarget = (immediate = false) => {
      const technicalTop = currentPreset === 'top'
      const application = configRef.current.application
      const installationHeight = PANEL_HEIGHT_M
      const backInspection = sideRef.current === 'back' || currentPreset === 'reverse'
      presentationTargetPosition.set(0, 0, 0)
      presentationTargetEuler.set(0, 0, 0)
      wallOpacityGoal = 0
      ceilingOpacityGoal = 0
      floorShadowOpacityGoal = technicalTop ? 0 : 0.22
      ceilingLightGoal = 0
      keyTargetGoal.set(0, installationHeight * 0.5, 0)

      if (!technicalTop && application === 'wall') {
        presentationTargetPosition.z = 0.025
        // The context is useful from the room side, but an opaque wall between
        // a reverse camera and the panel would make Back view impossible.
        wallOpacityGoal = backInspection ? 0 : 1
        floorShadowOpacityGoal = 0.1
      } else if (!technicalTop && application === 'ceiling') {
        presentationTargetPosition.set(0, 2.5, -installationHeight * 0.5)
        presentationTargetEuler.x = Math.PI / 2
        // Back inspection looks down from above the ceiling plane; hide that
        // contextual receiver so it cannot cover the configured panel.
        ceilingOpacityGoal = backInspection ? 0 : 1
        ceilingLightGoal = backInspection ? 0 : 0.62
        // Ceiling mode has its own contact-shadow receiver. Keeping the studio
        // floor receiver active creates a second, physically unrelated shadow.
        floorShadowOpacityGoal = 0
        keyTargetGoal.set(0, 2.46, 0)
      }
      presentationTargetQuaternion.setFromEuler(presentationTargetEuler)

      if (immediate) {
        presentationRoot.position.copy(presentationTargetPosition)
        presentationRoot.quaternion.copy(presentationTargetQuaternion)
        contextWallMaterial.opacity = wallOpacityGoal
        contextCeilingMaterial.opacity = ceilingOpacityGoal
        shadowReceiverMaterial.opacity = floorShadowOpacityGoal
        ceilingKey.intensity = ceilingLightGoal
        ceilingKey.castShadow = false
        contextWall.visible = wallOpacityGoal > 0.001
        contextCeiling.visible = ceilingOpacityGoal > 0.001
        key.target.position.copy(keyTargetGoal)
        invalidateKeyShadow()
      }
    }

    setPresentationTarget(true)

    let cachedPlanBoundsKey = ''
    let cachedPlanBounds: PlanBounds | null = null
    const currentPlanBounds = (
      bend = targetBendRef.current,
      secondaryCurveAmount = targetSecondaryCurveRef.current,
    ) => {
      const nextKey = `${geometryKey(configRef.current, techRef.current)}:${
        configRef.current.panelCount
      }:${bend}:${secondaryCurveAmount}`
      if (cachedPlanBounds && nextKey === cachedPlanBoundsKey) return cachedPlanBounds
      cachedPlanBoundsKey = nextKey
      cachedPlanBounds = panelPlanBounds(
        configRef.current,
        techRef.current,
        bend,
        secondaryCurveAmount,
      )
      return cachedPlanBounds
    }

    const lightTargetWorld = new THREE.Vector3()
    const lightPositionGoal = new THREE.Vector3()
    const lightLocalCentre = new THREE.Vector3()
    const lightRaycaster = new THREE.Raycaster()
    const lightPointer = new THREE.Vector2()
    const lightDragPlane = new THREE.Plane()
    const lightDragPoint = new THREE.Vector3()
    let displayedLightU = lightStateRef.current.u
    let displayedLightV = lightStateRef.current.v
    let lightDragPointerId: number | null = null
    let lightDragState: LinarLightState | null = null

    const safeLightCoordinate = (value: number, fallback: number) =>
      Number.isFinite(value) ? THREE.MathUtils.clamp(value, -1, 1) : fallback

    const updateLightTargetWorld = (bounds = currentPlanBounds()) => {
      lightLocalCentre.set(
        (bounds.minX + bounds.maxX) * 0.5,
        bounds.heightM * 0.5,
        (bounds.minZ + bounds.maxZ) * 0.5,
      )
      presentationRoot.updateWorldMatrix(true, false)
      lightTargetWorld.copy(lightLocalCentre).applyMatrix4(presentationRoot.matrixWorld)
      return lightTargetWorld
    }

    const lightPositionForState = (
      state: Pick<LinarLightState, 'u' | 'v'>,
      bounds = currentPlanBounds(),
    ) => {
      const target = updateLightTargetWorld(bounds)
      const u = safeLightCoordinate(state.u, 0)
      const v = safeLightCoordinate(state.v, 0)
      const installationSpan = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxZ - bounds.minZ,
      )
      const horizontalReach = Math.max(1.35, installationSpan * 0.62 + 0.72)

      if (configRef.current.application === 'ceiling') {
        lightPositionGoal.set(
          target.x + u * horizontalReach,
          Math.max(0.38, target.y - 2.08),
          target.z + v * Math.max(1.45, horizontalReach * 0.82),
        )
      } else {
        lightPositionGoal.set(
          target.x + u * horizontalReach,
          0.52 + ((v + 1) * 0.5) * 4.15,
          target.z + (configRef.current.application === 'wall' ? 2.65 : 2.35),
        )
      }
      return lightPositionGoal
    }

    const pointerNdc = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      lightPointer.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
      )
    }

    const updateDraggedLight = (event: PointerEvent) => {
      if (lightDragPointerId !== event.pointerId || !lightDragState) return
      pointerNdc(event)
      lightRaycaster.setFromCamera(lightPointer, camera)
      if (!lightRaycaster.ray.intersectPlane(lightDragPlane, lightDragPoint)) return
      const bounds = currentPlanBounds()
      const target = updateLightTargetWorld(bounds)
      const installationSpan = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxZ - bounds.minZ,
      )
      const horizontalReach = Math.max(1.35, installationSpan * 0.62 + 0.72)
      if (configRef.current.application === 'ceiling') {
        lightDragState.u = THREE.MathUtils.clamp(
          (lightDragPoint.x - target.x) / horizontalReach,
          -1,
          1,
        )
        lightDragState.v = THREE.MathUtils.clamp(
          (lightDragPoint.z - target.z) / Math.max(1.45, horizontalReach * 0.82),
          -1,
          1,
        )
      } else {
        lightDragState.u = THREE.MathUtils.clamp(
          (lightDragPoint.x - target.x) / horizontalReach,
          -1,
          1,
        )
        lightDragState.v = THREE.MathUtils.clamp(
          ((lightDragPoint.y - 0.52) / 4.15) * 2 - 1,
          -1,
          1,
        )
      }
      displayedLightU = lightDragState.u
      displayedLightV = lightDragState.v
      const position = lightPositionForState(lightDragState, bounds)
      key.position.copy(position)
      lightOrb.position.copy(position)
      invalidateKeyShadow()
    }

    const finishLightDrag = (event?: PointerEvent, commit = true) => {
      if (lightDragPointerId == null) return
      const pointerId = lightDragPointerId
      lightDragPointerId = null
      const committed = lightDragState
      lightDragState = null
      controls.enabled = true
      renderer.domElement.style.cursor = lightStateRef.current.enabled ? 'grab' : ''
      if (renderer.domElement.hasPointerCapture(pointerId)) {
        renderer.domElement.releasePointerCapture(pointerId)
      }
      if (commit && committed) {
        onLightChangeRef.current({
          enabled: true,
          u: safeLightCoordinate(committed.u, lightStateRef.current.u),
          v: safeLightCoordinate(committed.v, lightStateRef.current.v),
        })
      }
      event?.preventDefault()
    }

    const onLightPointerDown = (event: PointerEvent) => {
      if (!lightStateRef.current.enabled || lightDragPointerId != null) return
      pointerNdc(event)
      lightRaycaster.setFromCamera(lightPointer, camera)
      const hit = lightRaycaster.intersectObject(lightOrbHitMesh, false)[0]
      if (!hit) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onUserInteractRef.current()
      lightDragPointerId = event.pointerId
      lightDragState = {
        enabled: true,
        u: safeLightCoordinate(displayedLightU, lightStateRef.current.u),
        v: safeLightCoordinate(displayedLightV, lightStateRef.current.v),
      }
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
      if (configRef.current.application === 'ceiling') {
        lightDragPlane.setFromNormalAndCoplanarPoint(WORLD_UP, key.position)
      } else {
        lightDragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1),
          key.position,
        )
      }
    }

    const onLightPointerMove = (event: PointerEvent) => {
      if (lightDragPointerId !== event.pointerId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      updateDraggedLight(event)
    }
    const onLightPointerEnd = (event: PointerEvent) => {
      if (lightDragPointerId !== event.pointerId) return
      event.stopImmediatePropagation()
      finishLightDrag(event, event.type !== 'pointercancel')
    }
    const onLightEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && lightDragPointerId != null) finishLightDrag(undefined, false)
    }

    renderer.domElement.addEventListener('pointerdown', onLightPointerDown, true)
    renderer.domElement.addEventListener('pointermove', onLightPointerMove, true)
    renderer.domElement.addEventListener('pointerup', onLightPointerEnd, true)
    renderer.domElement.addEventListener('pointercancel', onLightPointerEnd, true)
    renderer.domElement.addEventListener('lostpointercapture', onLightPointerEnd, true)
    window.addEventListener('keydown', onLightEscape)

    const captureCinematicAnchor = () => {
      cinematicAnchor = {
        target: controls.target.clone(),
        spherical: new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target),
        ),
      }
      cinematicAnchor.spherical.makeSafe()
      cameraDriftElapsed = 0
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
      const planBounds = currentPlanBounds()
      applyView(
        camera,
        controls,
        w,
        h,
        currentPreset,
        sideRef.current,
        configRef.current.application,
        scene.background as THREE.Color,
        planBounds,
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
      const planBounds = currentPlanBounds()
      const placement = viewPlacement(
        currentPreset,
        camera,
        sideRef.current,
        configRef.current.application,
        planBounds,
      )
      const destination = placement.target.clone().addScaledVector(placement.dir, placement.dist)
      controls.minPolarAngle = currentPreset === 'top' ? 0 : DEFAULT_MIN_POLAR_ANGLE
      controls.maxPolarAngle =
        currentPreset === 'top' ? Math.PI : DEFAULT_MAX_POLAR_ANGLE
      controls.minDistance = Math.max(0.18, placement.dist * 0.22)
      controls.maxDistance = placement.dist * 4.5

      const changesCameraAxis =
        currentPreset === 'top' || camera.up.distanceToSquared(TOP_VIEW_UP) < 0.01
      if (reducedMotion || changesCameraAxis) {
        applyView(
          camera,
          controls,
          w,
          h,
          currentPreset,
          sideRef.current,
          configRef.current.application,
          scene.background as THREE.Color,
          planBounds,
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
    renderer.compile(scene, camera)
    renderer.render(scene, camera)
    requestAnimationFrame(() => {
      if (!disposed) onSceneReadyRef.current()
    })

    const resize = () => {
      if (disposed) return
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maximumPixelRatio))
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
    let lastAppliedSecondaryCurve = displayedSecondaryCurve
    let lastAppearance = appearanceKey(configRef.current)
    let lastGeomKey = geometryKey(configRef.current, techRef.current)
    let lastPresentationKey = `${configRef.current.application}:${clampedPanelCount(configRef.current.panelCount)}`
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
        setPresentationTarget(reducedMotion)
        transitionToFrame()
      }

      if (viewTokenRef.current !== lastView) {
        lastView = viewTokenRef.current
        currentPreset = viewPresetRef.current
        hasOrbited = false
        setPresentationTarget(reducedMotion || currentPreset === 'top')
        transitionToFrame()
      }

      const nextPresentationKey = `${configRef.current.application}:${clampedPanelCount(configRef.current.panelCount)}`
      if (nextPresentationKey !== lastPresentationKey) {
        lastPresentationKey = nextPresentationKey
        rebuildPanelReplicas()
        panel.setBend(
          installationPanelBend(
            displayedBend,
            configRef.current.panelCount,
            techRef.current.referenceMinimumRadiusMm,
            arrangementLayout.incisedWidthM,
          ),
          techRef.current.referenceMinimumRadiusMm,
          displayedSecondaryCurve,
        )
        applyPanelArrangement()
        setPresentationTarget(reducedMotion)
        hasOrbited = false
        transitionToFrame()
      }

      const nextGeom = geometryKey(configRef.current, techRef.current)
      if (nextGeom !== lastGeomKey) {
        lastGeomKey = nextGeom
        clearPanelReplicas()
        arrangementLayout = slatLayout(configRef.current)
        panel.setConfig(configRef.current, techRef.current)
        lastAppliedBend = displayedBend
        lastAppliedSecondaryCurve = displayedSecondaryCurve
        panel.setBend(
          installationPanelBend(
            displayedBend,
            configRef.current.panelCount,
            techRef.current.referenceMinimumRadiusMm,
            arrangementLayout.incisedWidthM,
          ),
          techRef.current.referenceMinimumRadiusMm,
          displayedSecondaryCurve,
        )
        rebuildPanelReplicas()
        applyPanelArrangement()
      }

      const nextAppearance = appearanceKey(configRef.current)
      if (nextAppearance !== lastAppearance) {
        lastAppearance = nextAppearance
        panel.setMaterial(
          configRef.current.material,
          configRef.current.veneer,
          configRef.current.mdfColour,
        )
        panel.setBacking(configRef.current.backing, configRef.current.feltColour)
        invalidateKeyShadow()
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

      if (cinematicTokenRef.current !== startupCinematicRunToken) {
        startupCinematicRunToken = cinematicTokenRef.current
        startupCinematicElapsed = 0
        startupCinematicStartedAt = now
        startupCinematicStage = -1
        startupCinematicCompleted = false
      }

      let activeStartupPose: ReturnType<typeof startupCinematicPose> | null = null
      if (cinematicActiveRef.current && !reducedMotion && !startupCinematicCompleted) {
        // The authored duration follows wall-clock time, not frame count. This
        // keeps a 24-second intro at 24 seconds on low-power/software WebGL.
        startupCinematicElapsed = Math.max(0, (now - startupCinematicStartedAt) / 1000)
        activeStartupPose = startupCinematicPose(startupCinematicElapsed)
        if (activeStartupPose.stage !== startupCinematicStage) {
          startupCinematicStage = activeStartupPose.stage
          onCinematicStageRef.current(activeStartupPose.stage)
        }
        if (activeStartupPose.done) {
          startupCinematicCompleted = true
          onCinematicCompleteRef.current()
        }
      }

      let goal = interactedRef.current || introDone ? targetBendRef.current : introTarget
      let secondaryGoal =
        interactedRef.current || introDone ? targetSecondaryCurveRef.current : 0
      if (activeStartupPose) {
        goal = activeStartupPose.bend
        secondaryGoal = activeStartupPose.secondary
      }
      const bendResponse = activeStartupPose
        ? 5.5
        : tourActiveRef.current && !reducedMotion
          ? 1.25
          : 11
      const lambda = 1 - Math.exp(-dt * bendResponse)
      displayedBend += (goal - displayedBend) * lambda
      displayedSecondaryCurve += (secondaryGoal - displayedSecondaryCurve) * lambda
      if (Math.abs(goal - displayedBend) < 0.005) displayedBend = goal
      if (Math.abs(secondaryGoal - displayedSecondaryCurve) < 0.005) {
        displayedSecondaryCurve = secondaryGoal
      }
      if (
        Math.abs(displayedBend - lastAppliedBend) > 0.02 ||
        Math.abs(displayedSecondaryCurve - lastAppliedSecondaryCurve) > 0.02 ||
        (displayedBend === goal && lastAppliedBend !== goal) ||
        (displayedSecondaryCurve === secondaryGoal &&
          lastAppliedSecondaryCurve !== secondaryGoal)
      ) {
        lastAppliedBend = displayedBend
        lastAppliedSecondaryCurve = displayedSecondaryCurve
        panel.setBend(
          installationPanelBend(
            displayedBend,
            configRef.current.panelCount,
            techRef.current.referenceMinimumRadiusMm,
            arrangementLayout.incisedWidthM,
          ),
          techRef.current.referenceMinimumRadiusMm,
          displayedSecondaryCurve,
        )
        applyPanelArrangement()
      }

      const presentationLambda = 1 - Math.exp(-dt * (reducedMotion ? 80 : 3.8))
      const presentationMoving =
        presentationRoot.position.distanceToSquared(presentationTargetPosition) > 1e-10 ||
        1 - Math.abs(presentationRoot.quaternion.dot(presentationTargetQuaternion)) > 1e-10
      presentationRoot.position.lerp(presentationTargetPosition, presentationLambda)
      presentationRoot.quaternion.slerp(
        presentationTargetQuaternion,
        presentationLambda,
      )
      contextWallMaterial.opacity +=
        (wallOpacityGoal - contextWallMaterial.opacity) * presentationLambda
      contextCeilingMaterial.opacity +=
        (ceilingOpacityGoal - contextCeilingMaterial.opacity) * presentationLambda
      shadowReceiverMaterial.opacity +=
        (floorShadowOpacityGoal - shadowReceiverMaterial.opacity) * presentationLambda
      ceilingKey.intensity +=
        (ceilingLightGoal - ceilingKey.intensity) * presentationLambda
      ceilingKey.castShadow = false
      contextWall.visible = contextWallMaterial.opacity > 0.004 || wallOpacityGoal > 0
      contextCeiling.visible =
        contextCeilingMaterial.opacity > 0.004 || ceilingOpacityGoal > 0
      if (presentationMoving) invalidateKeyShadow()

      if (activeStartupPose && !lightDragState) {
        displayedLightU = activeStartupPose.lightU
        displayedLightV = activeStartupPose.lightV
      } else if (!lightDragState) {
        const lightLambda = 1 - Math.exp(-dt * (reducedMotion ? 80 : 6.5))
        displayedLightU +=
          (safeLightCoordinate(lightStateRef.current.u, displayedLightU) - displayedLightU) *
          lightLambda
        displayedLightV +=
          (safeLightCoordinate(lightStateRef.current.v, displayedLightV) - displayedLightV) *
          lightLambda
      }
      const lightBounds = currentPlanBounds(displayedBend, displayedSecondaryCurve)
      wallZGoal =
        configRef.current.application === 'wall' && currentPreset !== 'top'
          ? presentationRoot.position.z + lightBounds.minZ - 0.045
          : -0.095
      contextWall.position.z +=
        (wallZGoal - contextWall.position.z) * presentationLambda
      const nextLightPosition = lightPositionForState(
        { u: displayedLightU, v: displayedLightV },
        lightBounds,
      )
      const lightPositionMoving = key.position.distanceToSquared(nextLightPosition) > 1e-10
      const lightPositionLambda = lightDragState
        ? 1
        : 1 - Math.exp(-dt * (activeStartupPose ? 5.2 : reducedMotion ? 80 : 7.5))
      key.position.lerp(nextLightPosition, lightPositionLambda)
      lightOrb.position.copy(key.position)
      const nextLightTarget = updateLightTargetWorld(lightBounds)
      const lightTargetMoving = key.target.position.distanceToSquared(nextLightTarget) > 1e-10
      key.target.position.lerp(nextLightTarget, presentationLambda)
      if (lightPositionMoving || lightTargetMoving) invalidateKeyShadow()
      lightOrb.visible = lightStateRef.current.enabled || Boolean(activeStartupPose)
      if (lightDragPointerId == null) {
        renderer.domElement.style.cursor = lightStateRef.current.enabled ? 'grab' : ''
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
          cameraDriftElapsed = 0
          cameraTransition = null
        }
      }

      if (
        !cameraTransition &&
        (tourActiveRef.current || cinematicActiveRef.current) &&
        !reducedMotion &&
        cinematicAnchor
      ) {
        cameraDriftElapsed += dt
        const driftBlend = cinematicEase(Math.min(1, cameraDriftElapsed / 1.15))
        const thetaDrift = Math.sin(cameraDriftElapsed * 0.34) * 0.018 * driftBlend
        const phiDrift = Math.sin(cameraDriftElapsed * 0.27) * 0.006 * driftBlend
        const dollyDrift = Math.sin(cameraDriftElapsed * 0.38) * 0.012 * driftBlend

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
      finishLightDrag(undefined, false)
      renderer.domElement.removeEventListener('pointerdown', onLightPointerDown, true)
      renderer.domElement.removeEventListener('pointermove', onLightPointerMove, true)
      renderer.domElement.removeEventListener('pointerup', onLightPointerEnd, true)
      renderer.domElement.removeEventListener('pointercancel', onLightPointerEnd, true)
      renderer.domElement.removeEventListener('lostpointercapture', onLightPointerEnd, true)
      window.removeEventListener('keydown', onLightEscape)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      controls.removeEventListener('start', markInteract)
      controls.dispose()
      clearPanelReplicas()
      panel.dispose()
      shadowReceiverGeometry.dispose()
      shadowReceiverMaterial.dispose()
      contextWallGeometry.dispose()
      contextWallMaterial.dispose()
      contextCeilingGeometry.dispose()
      contextCeilingMaterial.dispose()
      lightOrbGeometry.dispose()
      lightOrbMaterial.dispose()
      lightOrbHitGeometry.dispose()
      lightOrbHitMaterial.dispose()
      key.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [reducedMotion])

  return <div ref={mountRef} className="linar-viewport__canvas" />
}
