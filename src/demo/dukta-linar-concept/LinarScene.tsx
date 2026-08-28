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
import {
  DEFAULT_LINAR_LIGHT,
  type LinarApplication,
  type LinarConfig,
  type LinarLightState,
  type LinarMaterialId,
  type LinarSide,
  type LinarVeneerId,
  type LinarViewId,
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
  startupEasing: boolean
}

type CameraAuthority = 'user' | 'preset' | 'guided-tour' | 'startup-cinematic'

type ApplicationFrame = {
  planePoint: THREE.Vector3
  roomNormal: THREE.Vector3
  installationClearanceM: number
  cameraClearanceM: number
}

type CinematicAnchor = {
  target: THREE.Vector3
  spherical: THREE.Spherical
}

const BG = 0xe9e8e4
const LIGHT_STUDY_BG = 0x07080a
const STUDIO_EXPOSURE = 0.8
const LIGHT_STUDY_EXPOSURE = 0.9
const FLOOR_RECEIVER_SIZE_M = 96
const CONTEXT_RECEIVER_SIZE_M = 48
const CONTEXT_RECEIVER_MIN_SIZE_M = 48
const SHADOW_CAMERA_FAR_M = 44
// Provisional presentation clearances, not manufacturing specifications.
// They keep the rendered surface visibly separate from its architectural host.
const WALL_INSTALLATION_CLEARANCE_M = 0.018
const CEILING_INSTALLATION_CLEARANCE_M = 0.018
const CAMERA_SURFACE_CLEARANCE_M = 0.14
const WALL_PLANE_Z = 0
const CEILING_PLANE_Y = 2.62
const FLOOR_WALL_LIGHT_STUDY_KEY_INTENSITY = 200
const CEILING_LIGHT_STUDY_KEY_INTENSITY = 72.5
const STUDIO_KEY_INTENSITY = 26
const STUDIO_FLOOR_SHADOW_OPACITY = 0.3
const STUDIO_WALL_SHADOW_OPACITY = 0.14
const STUDIO_SHADOW_INTENSITY = 0.76
const LIGHT_STUDY_SHADOW_INTENSITY = 0.86
const LIGHT_STUDY_MIN_CONE_ANGLE = 0.38
const LIGHT_STUDY_MAX_CONE_ANGLE = 0.82
const STUDIO_MIN_SHADOW_CONE_ANGLE = 0.2
const STUDIO_MAX_SHADOW_CONE_ANGLE = 0.7
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TOP_VIEW_UP = new THREE.Vector3(1, 0, 0)
const DEFAULT_MIN_POLAR_ANGLE = 0.28
const DEFAULT_MAX_POLAR_ANGLE = Math.PI / 2 + 0.02
const LIGHT_ORB_RADIUS_M = 0.04
const LIGHT_ORB_VISUAL_BRIGHTNESS = 0.25
const CEILING_CLOSEUP_UP = new THREE.Vector3(0, 0, 1)
// Presentation controls, not manufacturing values. Distance is measured from
// the deformed installation envelope so Near can truthfully place the source
// within a few centimetres of the visible wood instead of metres from its
// centre. The default/far clearances keep the complete fixture reachable in
// the viewport while still producing distinctly different light falloff.
const LIGHT_NEAR_SURFACE_CLEARANCE_M = 0.04
const LIGHT_DEFAULT_SURFACE_CLEARANCE_M = 0.45
const LIGHT_FAR_SURFACE_CLEARANCE_M = 4.2
const LIGHT_NEAR_INTENSITY_FACTOR = 0.0015
const LIGHT_DEFAULT_INTENSITY_FACTOR = 0.02
const LIGHT_FAR_INTENSITY_FACTOR = 0.7
// Native OrbitControls applies each wheel notch immediately; these values turn
// the discrete dolly into a small target-radius change eased by the scene RAF.
const CAMERA_WHEEL_ZOOM_FACTOR = 0.00042
const CAMERA_WHEEL_ZOOM_RESPONSE = 11
const LIGHT_WHEEL_CAPTURE_LATCH_MS = 280

const FLOOR_APPLICATION_FRAME: ApplicationFrame = {
  planePoint: new THREE.Vector3(0, 0, 0),
  roomNormal: new THREE.Vector3(0, 1, 0),
  installationClearanceM: 0,
  cameraClearanceM: CAMERA_SURFACE_CLEARANCE_M,
}
const WALL_APPLICATION_FRAME: ApplicationFrame = {
  planePoint: new THREE.Vector3(0, 0, WALL_PLANE_Z),
  roomNormal: new THREE.Vector3(0, 0, 1),
  installationClearanceM: WALL_INSTALLATION_CLEARANCE_M,
  cameraClearanceM: CAMERA_SURFACE_CLEARANCE_M,
}
const CEILING_APPLICATION_FRAME: ApplicationFrame = {
  planePoint: new THREE.Vector3(0, CEILING_PLANE_Y, 0),
  roomNormal: new THREE.Vector3(0, -1, 0),
  installationClearanceM: CEILING_INSTALLATION_CLEARANCE_M,
  cameraClearanceM: CAMERA_SURFACE_CLEARANCE_M,
}

function applicationFrame(application: LinarApplication): ApplicationFrame {
  if (application === 'wall') return WALL_APPLICATION_FRAME
  if (application === 'ceiling') return CEILING_APPLICATION_FRAME
  return FLOOR_APPLICATION_FRAME
}

function lightSurfaceClearanceM(radiusControl: number): number {
  const radius = THREE.MathUtils.clamp(radiusControl, -1, 1)
  const from =
    radius < 0
      ? LIGHT_NEAR_SURFACE_CLEARANCE_M
      : LIGHT_DEFAULT_SURFACE_CLEARANCE_M
  const to =
    radius < 0
      ? LIGHT_DEFAULT_SURFACE_CLEARANCE_M
      : LIGHT_FAR_SURFACE_CLEARANCE_M
  const progress = radius < 0 ? radius + 1 : radius
  // Geometric interpolation makes direct dragging feel even across the large
  // 40 mm -> 4.2 m range and gives useful precision close to the surface.
  return Math.exp(
    THREE.MathUtils.lerp(Math.log(from), Math.log(to), progress),
  )
}

function lightStudyIntensityFactor(radiusControl: number): number {
  const radius = THREE.MathUtils.clamp(radiusControl, -1, 1)
  const from =
    radius < 0
      ? LIGHT_NEAR_INTENSITY_FACTOR
      : LIGHT_DEFAULT_INTENSITY_FACTOR
  const to =
    radius < 0
      ? LIGHT_DEFAULT_INTENSITY_FACTOR
      : LIGHT_FAR_INTENSITY_FACTOR
  const progress = radius < 0 ? radius + 1 : radius
  // These are exposure-calibrated endpoints. Geometric interpolation avoids
  // a hot mid-range while a 40 mm source retains a small readable light pool.
  return Math.exp(
    THREE.MathUtils.lerp(Math.log(from), Math.log(to), progress),
  )
}

function signedDistanceToApplicationPlane(
  point: THREE.Vector3,
  frame: ApplicationFrame,
): number {
  return frame.roomNormal.dot(point) - frame.roomNormal.dot(frame.planePoint)
}

/** Keep both camera and orbit target in the room-side half-space. */
function constrainCameraToApplication(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  application: LinarApplication,
): boolean {
  const frame = applicationFrame(application)
  let changed = false
  const targetMinimum = Math.max(0.004, frame.installationClearanceM * 0.5)
  const targetDistance = signedDistanceToApplicationPlane(controls.target, frame)
  if (targetDistance < targetMinimum) {
    controls.target.addScaledVector(frame.roomNormal, targetMinimum - targetDistance)
    changed = true
  }
  const cameraDistance = signedDistanceToApplicationPlane(camera.position, frame)
  if (cameraDistance < frame.cameraClearanceM) {
    camera.position.addScaledVector(
      frame.roomNormal,
      frame.cameraClearanceM - cameraDistance,
    )
    changed = true
  }
  if (changed) camera.lookAt(controls.target)
  return changed
}

function setApplicationOrbitLimits(
  controls: OrbitControls,
  preset: LinarViewId,
  application: LinarApplication,
) {
  if (preset === 'top') {
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
    return
  }
  if (application === 'ceiling') {
    // OrbitControls measures phi from +Y. Ceiling cameras live below the
    // ceiling plane, so their valid authored hemisphere is the lower one.
    controls.minPolarAngle = Math.PI / 2 + 0.06
    controls.maxPolarAngle = Math.PI - 0.18
    return
  }
  controls.minPolarAngle = DEFAULT_MIN_POLAR_ANGLE
  controls.maxPolarAngle = DEFAULT_MAX_POLAR_ANGLE
}

const LIGHT_ORB_GLOW_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const LIGHT_ORB_GLOW_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(vViewDirection);
    float facing = clamp(dot(normal, viewDirection), 0.0, 1.0);
    float softGlow = pow(facing, 1.35);
    float hotCentre = pow(facing, 5.0);
    vec3 color = mix(uColor, vec3(1.0, 0.94, 0.78), hotCentre * 0.58);
    float alpha = (softGlow * 0.16 + hotCentre * 0.1) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`

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
  alignEndToEndWithHost = false,
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

  if (alignEndToEndWithHost) {
    // A compound S has parallel end tangents but its two end points are offset
    // in Z. Repeating that unaligned module makes the complete installation
    // walk diagonally away from a flat wall or ceiling. Rotate the continuous
    // row once so its start-to-end chord lies in the host plane; the local
    // lobes remain unchanged and are translated room-side by the mounting
    // clearance below.
    const first = placements[0]
    const last = placements[placements.length - 1]
    const start = transformPlanPoint(left.x, left.z, first)
    const end = transformPlanPoint(right.x, right.z, last)
    const chordX = end.x - start.x
    const chordZ = end.z - start.z
    if (Math.hypot(chordX, chordZ) > 0.000001) {
      const alignmentYaw = Math.atan2(chordZ, chordX)
      const cos = Math.cos(alignmentYaw)
      const sin = Math.sin(alignmentYaw)
      for (const placement of placements) {
        const x = placement.x
        const z = placement.z
        placement.x = cos * x + sin * z
        placement.z = -sin * x + cos * z
        placement.rotY += alignmentYaw
      }
    }
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
  const placements = panelPlacementsForState(
    config.panelCount,
    state,
    config.application !== 'freestanding',
  )
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  // The deformation is analytically smooth; 112 samples safely bound its
  // extrema while avoiding a second 320-point sweep on every animated frame.
  const samples = 112

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

  const normalOffsetM = maxRenderedNormalOffsetM(
    layout.thicknessM,
    config.backing !== 'none',
  )
  return {
    minX: minX - normalOffsetM,
    maxX: maxX + normalOffsetM,
    minZ: minZ - normalOffsetM,
    maxZ: maxZ + normalOffsetM,
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

const STARTUP_CINEMATIC_STAGE_SECONDS = 7
const STARTUP_CINEMATIC_LIGHT_STAGE = 5
const STARTUP_CINEMATIC_EXIT_STAGE = 6
const STARTUP_CINEMATIC_LIGHT_STAGE_SECONDS = 10
const STARTUP_CINEMATIC_EXIT_STAGE_SECONDS = 4.5
const STARTUP_CINEMATIC_LIGHT_START_SECONDS =
  STARTUP_CINEMATIC_STAGE_SECONDS * STARTUP_CINEMATIC_LIGHT_STAGE
const STARTUP_CINEMATIC_EXIT_START_SECONDS =
  STARTUP_CINEMATIC_LIGHT_START_SECONDS + STARTUP_CINEMATIC_LIGHT_STAGE_SECONDS
const STARTUP_CINEMATIC_DURATION_SECONDS =
  STARTUP_CINEMATIC_EXIT_START_SECONDS + STARTUP_CINEMATIC_EXIT_STAGE_SECONDS

function startupCinematicPose(elapsed: number) {
  const time = THREE.MathUtils.clamp(elapsed, 0, STARTUP_CINEMATIC_DURATION_SECONDS)
  const stage =
    time < STARTUP_CINEMATIC_LIGHT_START_SECONDS
      ? Math.floor(time / STARTUP_CINEMATIC_STAGE_SECONDS)
      : time < STARTUP_CINEMATIC_EXIT_START_SECONDS
        ? STARTUP_CINEMATIC_LIGHT_STAGE
        : STARTUP_CINEMATIC_EXIT_STAGE
  const stageTime =
    stage < STARTUP_CINEMATIC_LIGHT_STAGE
      ? time - stage * STARTUP_CINEMATIC_STAGE_SECONDS
      : stage === STARTUP_CINEMATIC_LIGHT_STAGE
        ? time - STARTUP_CINEMATIC_LIGHT_START_SECONDS
        : time - STARTUP_CINEMATIC_EXIT_START_SECONDS
  const segment = (start: number, end: number) =>
    cinematicEase(
      THREE.MathUtils.clamp(
        (stageTime - start) / Math.max(end - start, 0.001),
        0,
        1,
      ),
    )

  let bend = 0
  let secondary = 0
  if (stage === 0) {
    bend = THREE.MathUtils.lerp(0, 8, segment(3.2, 6.5))
  } else if (stage === 1) {
    bend = THREE.MathUtils.lerp(8, 38, segment(2.8, 6.5))
  } else if (stage === 2) {
    bend = THREE.MathUtils.lerp(38, -54, segment(2.8, 6.5))
  } else if (stage === 3) {
    bend = THREE.MathUtils.lerp(-54, -66, segment(2.8, 6.3))
    secondary = THREE.MathUtils.lerp(0, 88, segment(2.8, 6.6))
  } else if (stage === 4) {
    bend = THREE.MathUtils.lerp(-66, 22, segment(2.7, 6.5))
    secondary = THREE.MathUtils.lerp(88, 0, segment(2.7, 6.5))
  } else if (stage === STARTUP_CINEMATIC_LIGHT_STAGE) {
    bend = THREE.MathUtils.lerp(22, 28, segment(2, 5.5))
  } else {
    bend = 28
  }

  let lightU = DEFAULT_LINAR_LIGHT.u
  let lightV = DEFAULT_LINAR_LIGHT.v
  if (stage === STARTUP_CINEMATIC_LIGHT_STAGE) {
    // Let the source appear at the familiar reset pose, then trace one slow,
    // shallow arc across the perforations before settling at that same pose.
    // The quintic progress has zero velocity at both ends, avoiding a visible
    // kick when LIGHT enters or when the studio handoff begins.
    const orbitProgress = cinematicEase(
      THREE.MathUtils.clamp(
        (stageTime - 1) / (STARTUP_CINEMATIC_LIGHT_STAGE_SECONDS - 2),
        0,
        1,
      ),
    )
    lightU += Math.sin(orbitProgress * Math.PI * 2) * 0.09
    lightV += Math.sin(orbitProgress * Math.PI) * 0.025
  }

  return {
    bend,
    secondary,
    lightU,
    lightV,
    stage,
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
  const bounds = planBounds ?? {
    minX: -PANEL_WIDTH_M * 0.5,
    maxX: PANEL_WIDTH_M * 0.5,
    minZ: -0.01,
    maxZ: 0.01,
    heightM: PANEL_HEIGHT_M,
  }
  const installationWidth = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
  )
  const installationDepth = Math.max(0.02, bounds.maxZ - bounds.minZ)
  const installationHeight = bounds.heightM
  const centreX = (bounds.minX + bounds.maxX) * 0.5
  const localCentreZ = (bounds.minZ + bounds.maxZ) * 0.5
  const mid =
    application === 'wall'
      ? new THREE.Vector3(
          centreX,
          installationHeight * 0.5,
          WALL_PLANE_Z + WALL_INSTALLATION_CLEARANCE_M + installationDepth * 0.5,
        )
      : application === 'ceiling'
        ? new THREE.Vector3(
            centreX,
            CEILING_PLANE_Y -
              CEILING_INSTALLATION_CLEARANCE_M -
              installationDepth * 0.5,
            0,
          )
        : new THREE.Vector3(centreX, installationHeight * 0.5, localCentreZ)

  if (id === 'top') {
    const topDirection =
      application === 'ceiling'
        ? new THREE.Vector3(0.0001, -0.0001, 1).normalize()
        : new THREE.Vector3(0.0001, 1, 0.0001).normalize()
    return {
      // A tiny off-axis component avoids the exact look/up singularity while
      // remaining visually indistinguishable from a true orthographic plan.
      // Ceiling plan inspection looks along the panel's transformed local Y
      // axis, keeping the camera below the fixed ceiling plane.
      dir: topDirection,
      target: mid.clone(),
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
  if (application === 'ceiling') {
    const target = mid.clone()
    const dist = fitDistance(camera, 1.15, 1.2, installationWidth, installationHeight)
    if (id === 'closeup') {
      return {
        // Inspect from the occupied-room side of the ceiling. This dedicated
        // placement restores the same real surface-detail distance available
        // for freestanding and wall installations without crossing the host.
        dir: new THREE.Vector3(
          side === 'back' ? -0.035 : 0.035,
          -1,
          0.012,
        ).normalize(),
        target,
        dist: 0.52,
        bg: 0xc7c8c6,
        // Looking almost exactly along world Y needs an explicit, orthogonal
        // up vector; otherwise PerspectiveCamera inherits Y-up and rolls the
        // LINAR slats diagonally during the close transition.
        up: CEILING_CLOSEUP_UP,
      }
    }
    if (id === 'side') {
      // Stay oblique enough that every viewport ray meets the ceiling plane.
      // A near-tangent camera exposed the receiver horizon and made a correctly
      // mounted panel look detached from (or sliced by) the ceiling.
      const dir = new THREE.Vector3(1, -0.52, 0.08).normalize()
      return {
        dir,
        target,
        dist: Math.max(2.6, dist * 0.76) + planDepthAllowance(planBounds, dir),
        bg: BG,
      }
    }
    if (id === 'reverse') {
      // Back-side inspection flips the same installation toward the room;
      // the camera itself never crosses above the ceiling plane.
      const dir = new THREE.Vector3(-0.2, -0.88, -0.42).normalize()
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
  if (application === 'wall') {
    const dist = fitDistance(camera, 1.15, 1.2, installationWidth, installationHeight)
    if (id === 'closeup') {
      return {
        dir: new THREE.Vector3(side === 'back' ? -0.035 : 0.035, 0.012, 1).normalize(),
        target: mid.clone(),
        dist: 0.52,
        bg: 0xc7c8c6,
      }
    }
    if (id === 'side') {
      // Preserve a readable side profile without looking so nearly parallel
      // to the wall that the architectural receiver ends at a screen-space
      // horizon beside the panel.
      const dir = new THREE.Vector3(1, 0.025, 0.52).normalize()
      return {
        dir,
        target: mid.clone(),
        dist:
          fitDistance(camera, 1.12, 1.1, installationWidth, installationHeight) +
          planDepthAllowance(planBounds, dir),
        bg: BG,
      }
    }
    if (id === 'reverse') {
      const dir = new THREE.Vector3(-0.16, 0.035, 1).normalize()
      return {
        dir,
        target: mid.clone(),
        dist: dist + planDepthAllowance(planBounds, dir),
        bg: 0xc7c8c6,
      }
    }
    if (id === 'bent') {
      const dir = new THREE.Vector3(0.48, 0.25, 0.84).normalize()
      return {
        dir,
        target: mid.clone(),
        dist: dist + planDepthAllowance(planBounds, dir),
        bg: BG,
      }
    }
    const dir = new THREE.Vector3(side === 'back' ? -0.12 : 0.12, 0.05, 1).normalize()
    return {
      dir,
      target: mid.clone(),
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
  setApplicationOrbitLimits(controls, preset, application)
  camera.up.copy(place.up ?? WORLD_UP)
  camera.zoom = place.zoom ?? 1
  camera.updateProjectionMatrix()
  camera.position.copy(place.target).addScaledVector(place.dir, place.dist)
  controls.target.copy(place.target)
  camera.lookAt(place.target)
  controls.minDistance = Math.max(0.18, place.dist * 0.22)
  controls.maxDistance = place.dist * 4.5
  controls.update()
  constrainCameraToApplication(camera, controls, application)
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

    const initialLightStudy = lightStateRef.current.enabled
    const initialBackground = initialLightStudy ? LIGHT_STUDY_BG : BG
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(initialBackground, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = initialLightStudy
      ? LIGHT_STUDY_EXPOSURE
      : STUDIO_EXPOSURE
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(initialBackground)
    const studioBackground = new THREE.Color(BG)
    const lightStudyBackground = new THREE.Color(LIGHT_STUDY_BG)

    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 200)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minPolarAngle = DEFAULT_MIN_POLAR_ANGLE
    controls.maxPolarAngle = DEFAULT_MAX_POLAR_ANGLE
    controls.rotateSpeed = 0.72
    controls.zoomSpeed = 0.55
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE

    let cameraTransition: CameraTransition | null = null
    let cameraAuthority: CameraAuthority = 'preset'
    let hasOrbited = false
    let smoothCameraZoomTargetRadius: number | null = null
    let controlsChangedSinceRender = true
    const smoothCameraZoomOffset = new THREE.Vector3()
    const markControlsChanged = () => {
      controlsChangedSinceRender = true
    }
    const claimUserCameraAuthority = () => {
      hasOrbited = true
      cameraAuthority = 'user'
      if (cameraTransition) {
        controls.enableDamping = cameraTransition.restoreDamping
        cameraTransition = null
      }
      interactedRef.current = true
      onUserInteractRef.current()
    }
    const markInteract = () => {
      smoothCameraZoomTargetRadius = null
      // Top inspection uses X as screen-up, but OrbitControls assumes the
      // camera's up axis is the world orbit axis. Hand back to canonical Y-up
      // before a manual orbit so the following drag and later presets cannot
      // inherit a rolled coordinate system.
      if (camera.up.distanceToSquared(WORLD_UP) > 0.01) {
        if (camera.zoom !== 1) {
          const previousZoom = camera.zoom
          const offset = camera.position.clone().sub(controls.target)
          offset.multiplyScalar(1 / previousZoom)
          camera.position.copy(controls.target).add(offset)
          // Top uses a long-distance zoomed perspective camera. Once that
          // optical zoom is converted back to a normal orbit radius, convert
          // its distance limits by the same factor or OrbitControls will clamp
          // the first interaction outward by roughly 2.2x.
          controls.minDistance = Math.max(0.18, controls.minDistance / previousZoom)
          controls.maxDistance = Math.max(
            controls.minDistance,
            controls.maxDistance / previousZoom,
          )
          camera.zoom = 1
          camera.updateProjectionMatrix()
        }
        camera.up.copy(WORLD_UP)
        setApplicationOrbitLimits(
          controls,
          currentPreset === 'top' ? 'hero' : currentPreset,
          configRef.current.application,
        )
        const offset = camera.position.clone().sub(controls.target)
        if (Math.abs(offset.clone().normalize().dot(WORLD_UP)) > 0.999) {
          offset.z += Math.max(0.002, offset.length() * 0.002)
          camera.position.copy(controls.target).add(offset)
        }
        camera.lookAt(controls.target)
        controls.update()
      }
      claimUserCameraAuthority()
    }
    controls.addEventListener('start', markInteract)
    controls.addEventListener('change', markControlsChanged)

    const hemi = new THREE.HemisphereLight(
      0xf4f3ef,
      0x96938d,
      initialLightStudy ? 0 : 0.3,
    )
    scene.add(hemi)

    // One persistent, real key light serves normal viewing, user interaction
    // and the startup cinematic. All other lights are non-shadowing fills.
    const initialLightStudyBaseIntensity =
      configRef.current.application === 'ceiling'
        ? CEILING_LIGHT_STUDY_KEY_INTENSITY
        : FLOOR_WALL_LIGHT_STUDY_KEY_INTENSITY
    const initialLightStudyKeyIntensity =
      initialLightStudyBaseIntensity *
      lightStudyIntensityFactor(lightStateRef.current.radius)
    const key = new THREE.SpotLight(
      0xfff7e8,
      initialLightStudy ? initialLightStudyKeyIntensity : STUDIO_KEY_INTENSITY,
      0,
      initialLightStudy ? 1.28 : 0.98,
      0.84,
      2,
    )
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
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const compactShadowMap =
      softwareRenderer ||
      coarsePointer ||
      window.innerWidth < 900 ||
      (navigator.hardwareConcurrency ?? 4) < 8
    const maximumPixelRatio = softwareRenderer ? 0.65 : compactShadowMap ? 1.15 : 1.5
    const devicePixelRatio = window.devicePixelRatio || 1
    const basePixelRatio = Math.min(devicePixelRatio, maximumPixelRatio)
    // Keep the long INTRO at a stable camera cadence. The model and 2048 px
    // shadow map retain their detail; only the temporary canvas supersample is
    // capped, then the normal device-aware ratio returns after the cinematic.
    const cinematicPixelRatio = Math.min(basePixelRatio, 1.15)
    renderer.setPixelRatio(basePixelRatio)
    // Software WebGL cannot sustain a live, perforation-accurate shadow pass
    // over thousands of manufactured elements. Preserve the full geometry and
    // lighting, but omit the shadow map on that fallback renderer so the
    // configurator remains interactive. Hardware WebGL always keeps it on.
    renderer.shadowMap.enabled = !softwareRenderer
    key.castShadow = !softwareRenderer
    const shadowMapSize = compactShadowMap ? 1024 : 2048
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    key.shadow.camera.near = 0.15
    key.shadow.camera.far = 44
    key.shadow.camera.updateProjectionMatrix()
    // The former negative clip-depth bias pulled the cast shadow away from
    // the y=0 panel foot when the studio source was several metres away. The
    // world-space normal bias below is sufficient to prevent surface acne;
    // keeping clip-depth unbiased restores a physically attached contact edge.
    key.shadow.bias = 0
    key.shadow.normalBias = 0.00018
    key.shadow.radius = initialLightStudy
      ? compactShadowMap
        ? 0.6
        : 0.7
      : compactShadowMap
        ? 0.55
        : 0.75
    key.shadow.intensity = initialLightStudy
      ? LIGHT_STUDY_SHADOW_INTENSITY
      : STUDIO_SHADOW_INTENSITY
    key.shadow.autoUpdate = false
    key.shadow.needsUpdate = true
    let keyShadowDirty = true
    let shadowRefreshElapsed = Number.POSITIVE_INFINITY
    const invalidateKeyShadow = () => {
      if (key.castShadow) keyShadowDirty = true
    }
    scene.add(key)
    scene.add(key.target)
    key.target.position.set(0, PANEL_HEIGHT_M * 0.5, 0)

    const lightOrb = new THREE.Group()
    lightOrb.name = 'LinarLightOrb'
    const lightOrbGeometry = new THREE.SphereGeometry(LIGHT_ORB_RADIUS_M, 32, 20)
    const lightOrbCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff7df,
      transparent: true,
      opacity: initialLightStudy ? 0.98 * LIGHT_ORB_VISUAL_BRIGHTNESS : 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
    const lightOrbCore = new THREE.Mesh(lightOrbGeometry, lightOrbCoreMaterial)
    lightOrbCore.name = 'LinarLightOrbCore'
    lightOrbCore.scale.setScalar(0.52)
    lightOrbCore.renderOrder = 20

    // Do not use transmission here. Even on a tiny mesh it triggers a full
    // scene transmission pre-pass, doubling LINAR's calls and triangle work.
    const lightOrbShellMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc578,
      emissive: 0xff943c,
      emissiveIntensity: 0.55 * LIGHT_ORB_VISUAL_BRIGHTNESS,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: initialLightStudy ? 0.72 * LIGHT_ORB_VISUAL_BRIGHTNESS : 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
    const lightOrbShell = new THREE.Mesh(lightOrbGeometry, lightOrbShellMaterial)
    lightOrbShell.name = 'LinarLightOrbShell'
    lightOrbShell.renderOrder = 21

    const lightOrbFillMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa64f,
      transparent: true,
      opacity: initialLightStudy ? 0.16 * LIGHT_ORB_VISUAL_BRIGHTNESS : 0,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
    const lightOrbFill = new THREE.Mesh(lightOrbGeometry, lightOrbFillMaterial)
    lightOrbFill.name = 'LinarLightOrbInnerGlow'
    lightOrbFill.scale.setScalar(1.04)
    lightOrbFill.renderOrder = 22

    const lightOrbGlowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xff9b38) },
        uOpacity: {
          value: initialLightStudy ? LIGHT_ORB_VISUAL_BRIGHTNESS : 0,
        },
      },
      vertexShader: LIGHT_ORB_GLOW_VERTEX_SHADER,
      fragmentShader: LIGHT_ORB_GLOW_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      dithering: true,
    })
    const lightOrbGlow = new THREE.Mesh(lightOrbGeometry, lightOrbGlowMaterial)
    lightOrbGlow.name = 'LinarLightOrbHalo'
    lightOrbGlow.scale.setScalar(1.62)
    lightOrbGlow.renderOrder = 23

    const lightOrbHitGeometry = new THREE.SphereGeometry(
      LIGHT_ORB_RADIUS_M * 3,
      12,
      8,
    )
    const lightOrbHitMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      colorWrite: false,
    })
    const lightOrbHitMesh = new THREE.Mesh(lightOrbHitGeometry, lightOrbHitMaterial)
    lightOrbHitMesh.name = 'LinarLightOrbHitTarget'
    // Raycaster tests explicitly requested objects even when not rendered.
    // Keep the generous pointer target out of the draw list entirely.
    lightOrbHitMesh.visible = false
    lightOrb.add(
      lightOrbCore,
      lightOrbShell,
      lightOrbFill,
      lightOrbGlow,
      lightOrbHitMesh,
    )
    lightOrb.visible = false
    scene.add(lightOrb)

    const lightGuideGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const lightGuideMaterial = new THREE.LineBasicMaterial({
      color: 0xffc36c,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
    const lightGuide = new THREE.Line(lightGuideGeometry, lightGuideMaterial)
    lightGuide.name = 'LinarLightSourceGuide'
    lightGuide.renderOrder = 19
    lightGuide.visible = false
    scene.add(lightGuide)

    // A broad, non-shadowing front key retains the pale surface and end-grain
    // response independently from the short overhead cast shadow.
    const frontKey = new THREE.DirectionalLight(
      0xfffdf8,
      initialLightStudy ? 0 : 0.48,
    )
    frontKey.position.set(-3.8, 5.2, 4.8)
    frontKey.target = key.target
    scene.add(frontKey)

    const fill = new THREE.DirectionalLight(0xeef2f4, initialLightStudy ? 0 : 0.2)
    fill.position.set(3.4, 2.5, 3.2)
    scene.add(fill)

    // A balanced rear studio key keeps the reverse birch pale and makes the
    // capsule walls readable without changing geometry when the camera flips.
    // It also remains physically consistent when the user orbits around.
    const rim = new THREE.DirectionalLight(0xf7f4ee, initialLightStudy ? 0 : 0.42)
    rim.position.set(-2.2, 3.4, -4.8)
    scene.add(rim)

    // A low opposing rear fill prevents one half of a bent panel from falling
    // into a muddy silhouette. Neither rear light casts a second fake shadow.
    const rearFill = new THREE.DirectionalLight(
      0xf0f3f4,
      initialLightStudy ? 0 : 0.22,
    )
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
    const shadowReceiverGeometry = new THREE.PlaneGeometry(
      FLOOR_RECEIVER_SIZE_M,
      FLOOR_RECEIVER_SIZE_M,
    )
    const shadowReceiverMaterial = new THREE.ShadowMaterial({
      color: 0x37342f,
      opacity: STUDIO_FLOOR_SHADOW_OPACITY,
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

    // Light mode needs a real surface rather than a transparent shadow-only
    // overlay: the single SpotLight can then describe both its warm pool and
    // the true perforated silhouette against an otherwise unlit environment.
    // A light neutral diffuse value is intentional here: the former dark
    // receiver absorbed the already distance-attenuated beam, so the real
    // 4 mm openings were present in the shadow map but unreadable on screen.
    // With no ambient, emissive or fill contribution this surface still falls
    // to black outside the physical cone of the guided light.
    const lightStudyReceiverMaterial = new THREE.MeshStandardMaterial({
      color: 0xb4aa9a,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: initialLightStudy ? 1 : 0,
      depthWrite: true,
    })
    const lightStudyReceiver = new THREE.Mesh(
      shadowReceiverGeometry,
      lightStudyReceiverMaterial,
    )
    lightStudyReceiver.name = 'LinarLightStudyReceiver'
    lightStudyReceiver.rotation.x = -Math.PI / 2
    lightStudyReceiver.position.y = -0.0008
    lightStudyReceiver.receiveShadow = true
    lightStudyReceiver.castShadow = false
    lightStudyReceiver.renderOrder = -3
    lightStudyReceiver.visible = initialLightStudy
    scene.add(lightStudyReceiver)

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
        arrangementConfig.application !== 'freestanding',
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

    const contextWallGeometry = new THREE.PlaneGeometry(
      CONTEXT_RECEIVER_SIZE_M,
      CONTEXT_RECEIVER_SIZE_M,
    )
    const contextWallMaterial = new THREE.MeshStandardMaterial({
      color: initialLightStudy ? 0x121417 : 0xdeddd9,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const contextWall = new THREE.Mesh(contextWallGeometry, contextWallMaterial)
    contextWall.name = 'LinarWallContext'
    contextWall.position.set(0, PANEL_HEIGHT_M * 0.5, WALL_PLANE_Z)
    contextWall.receiveShadow = true
    contextWall.visible = false
    scene.add(contextWall)

    const contextCeilingGeometry = new THREE.PlaneGeometry(
      CONTEXT_RECEIVER_SIZE_M,
      CONTEXT_RECEIVER_SIZE_M,
    )
    const contextCeilingMaterial = new THREE.MeshStandardMaterial({
      color: initialLightStudy ? 0x121417 : 0xe1e0dc,
      emissive: 0xe1e0dc,
      emissiveIntensity: initialLightStudy ? 0 : 0.38,
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
    contextCeiling.position.y = CEILING_PLANE_Y
    contextCeiling.receiveShadow = true
    contextCeiling.visible = false
    scene.add(contextCeiling)
    const studioWallColor = new THREE.Color(0xdeddd9)
    const studioCeilingColor = new THREE.Color(0xe1e0dc)
    const darkContextColor = new THREE.Color(0x121417)

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
    let topAutoFramePending = false
    let lastTopAutoFrameTargetKey = `${targetBendRef.current}:${targetSecondaryCurveRef.current}`
    let cinematicAnchor: CinematicAnchor | null = null
    let cameraDriftElapsed = 0
    let startupCinematicElapsed = 0
    let startupCinematicStartedAt = performance.now()
    let startupCinematicRunToken = cinematicTokenRef.current
    let startupCinematicWasActive = cinematicActiveRef.current
    let startupCinematicStage = -1
    let startupCinematicCompleted = false
    const presentationTargetPosition = new THREE.Vector3()
    const presentationTargetQuaternion = new THREE.Quaternion()
    const presentationTargetEuler = new THREE.Euler()
    const keyTargetGoal = new THREE.Vector3(0, PANEL_HEIGHT_M * 0.5, 0)
    let wallOpacityGoal = 0
    let ceilingOpacityGoal = 0
    let floorShadowOpacityGoal = STUDIO_FLOOR_SHADOW_OPACITY
    let lightStudyFloorOpacityGoal = initialLightStudy ? 1 : 0
    let ceilingLightGoal = 0

    const setPresentationTarget = (immediate = false) => {
      const technicalTop = currentPreset === 'top'
      const application = configRef.current.application
      const installationHeight = PANEL_HEIGHT_M
      presentationTargetPosition.set(0, 0, 0)
      presentationTargetEuler.set(0, 0, 0)
      wallOpacityGoal = 0
      ceilingOpacityGoal = 0
      // Inspection presets change only the camera. Keep the architectural
      // floor and its physical shadow present in Top just as they are in the
      // other views; hiding the receiver here made the shadow disappear and
      // introduced a second state that rapid view changes had to restore.
      floorShadowOpacityGoal = STUDIO_FLOOR_SHADOW_OPACITY
      lightStudyFloorOpacityGoal =
        lightStateRef.current.enabled && application !== 'ceiling' ? 1 : 0
      ceilingLightGoal = 0
      keyTargetGoal.set(0, installationHeight * 0.5, 0)

      if (application === 'wall') {
        presentationTargetPosition.z = WALL_PLANE_Z
        wallOpacityGoal = technicalTop ? 0 : 1
        floorShadowOpacityGoal = STUDIO_WALL_SHADOW_OPACITY
      } else if (application === 'ceiling') {
        presentationTargetPosition.set(0, CEILING_PLANE_Y, -installationHeight * 0.5)
        presentationTargetEuler.x = Math.PI / 2
        ceilingOpacityGoal = technicalTop ? 0 : 1
        ceilingLightGoal = technicalTop ? 0 : 0.62
        // Ceiling mode has its own contact-shadow receiver. Keeping the studio
        // floor receiver active creates a second, physically unrelated shadow.
        floorShadowOpacityGoal = 0
        keyTargetGoal.set(0, CEILING_PLANE_Y - CEILING_INSTALLATION_CLEARANCE_M, 0)
      }
      presentationTargetQuaternion.setFromEuler(presentationTargetEuler)

      if (immediate) {
        presentationRoot.position.copy(presentationTargetPosition)
        presentationRoot.quaternion.copy(presentationTargetQuaternion)
        contextWallMaterial.opacity = wallOpacityGoal
        contextCeilingMaterial.opacity = ceilingOpacityGoal
        shadowReceiverMaterial.opacity = lightStateRef.current.enabled
          ? 0
          : floorShadowOpacityGoal
        lightStudyReceiverMaterial.opacity = lightStudyFloorOpacityGoal
        lightStudyReceiver.visible = lightStudyFloorOpacityGoal > 0.001
        ceilingKey.intensity = lightStateRef.current.enabled ? 0 : ceilingLightGoal
        ceilingKey.castShadow = false
        contextWall.visible = wallOpacityGoal > 0.001
        contextCeiling.visible = ceilingOpacityGoal > 0.001
        key.target.position.copy(keyTargetGoal)
        invalidateKeyShadow()
      }
    }

    let cachedPlanBoundsKey = ''
    let cachedPlanBounds: PlanBounds | null = null
    const currentPlanBounds = (
      bend = targetBendRef.current,
      secondaryCurveAmount = targetSecondaryCurveRef.current,
    ) => {
      const nextKey = `${geometryKey(configRef.current, techRef.current)}:${
        configRef.current.panelCount
      }:${configRef.current.application}:${bend}:${secondaryCurveAmount}`
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

    const applyInstallationFrame = (bounds = currentPlanBounds()) => {
      const application = configRef.current.application
      const inspectionFlip =
        application !== 'freestanding' &&
        (sideRef.current === 'back' || currentPreset === 'reverse')
      installationRoot.rotation.set(0, inspectionFlip ? Math.PI : 0, 0)
      installationRoot.position.set(0, 0, 0)

      if (application !== 'freestanding') {
        // Both wall and ceiling use the panel's local +Z as their room-facing
        // normal. Rotating the same physical installation for Back inspection
        // swaps the relevant extremum without moving the architectural plane.
        const facingMinZ = inspectionFlip ? -bounds.maxZ : bounds.minZ
        const clearance = applicationFrame(application).installationClearanceM
        installationRoot.position.z = clearance - facingMinZ
      }

      const extentX = Math.max(0.1, bounds.maxX - bounds.minX)
      if (application === 'wall') {
        contextWall.scale.set(
          Math.max(CONTEXT_RECEIVER_MIN_SIZE_M, extentX + 1.8) /
            CONTEXT_RECEIVER_SIZE_M,
          Math.max(CONTEXT_RECEIVER_MIN_SIZE_M, bounds.heightM + 1.4) /
            CONTEXT_RECEIVER_SIZE_M,
          1,
        )
      } else if (application === 'ceiling') {
        contextCeiling.scale.set(
          Math.max(CONTEXT_RECEIVER_MIN_SIZE_M, extentX + 1.8) /
            CONTEXT_RECEIVER_SIZE_M,
          Math.max(CONTEXT_RECEIVER_MIN_SIZE_M, bounds.heightM + 1.8) /
            CONTEXT_RECEIVER_SIZE_M,
          1,
        )
      }
      installationRoot.updateWorldMatrix(true, true)
    }

    const applicationCorner = new THREE.Vector3()
    const enforceInstallationHalfSpace = (bounds = currentPlanBounds()) => {
      const frame = applicationFrame(configRef.current.application)
      installationRoot.updateWorldMatrix(true, false)
      let minimumSignedDistance = Number.POSITIVE_INFINITY
      for (const x of [bounds.minX, bounds.maxX]) {
        for (const y of [0, bounds.heightM]) {
          for (const z of [bounds.minZ, bounds.maxZ]) {
            applicationCorner.set(x, y, z).applyMatrix4(installationRoot.matrixWorld)
            minimumSignedDistance = Math.min(
              minimumSignedDistance,
              signedDistanceToApplicationPlane(applicationCorner, frame),
            )
          }
        }
      }
      if (minimumSignedDistance < frame.installationClearanceM) {
        // During an application rotation the swept assembly can otherwise pass
        // through the destination plane even though both endpoints are valid.
        // Correct the whole installation presentation, never the room surface.
        presentationRoot.position.addScaledVector(
          frame.roomNormal,
          frame.installationClearanceM - minimumSignedDistance,
        )
        installationRoot.updateWorldMatrix(true, true)
      }
    }

    setPresentationTarget(true)
    applyInstallationFrame(currentPlanBounds())
    enforceInstallationHalfSpace(currentPlanBounds())

    const lightTargetWorld = new THREE.Vector3()
    const lightPositionGoal = new THREE.Vector3()
    const lightLocalCentre = new THREE.Vector3()
    const lightDirectionWorld = new THREE.Vector3()
    const lightDirectionLocal = new THREE.Vector3()
    const lightInstallationWorldQuaternion = new THREE.Quaternion()
    const lightRaycaster = new THREE.Raycaster()
    const lightPointer = new THREE.Vector2()
    let displayedLightU = lightStateRef.current.u
    let displayedLightV = lightStateRef.current.v
    let displayedLightRadius = lightStateRef.current.radius
    let lightDragPointerId: number | null = null
    let lightDragState: LinarLightState | null = null
    let lightDragStartX = 0
    let lightDragStartY = 0
    let lightDragStartU = displayedLightU
    let lightDragStartV = displayedLightV
    let lightDragStartRadius = displayedLightRadius
    let lightDragMode: 'orbit' | 'distance' = 'orbit'
    let lightWheelCapturedUntil = 0
    let lightOrbHovered = false
    let lightOrbVisibility = initialLightStudy ? 1 : 0
    let lightOrbInteraction = 0

    const safeLightCoordinate = (value: number, fallback: number) =>
      Number.isFinite(value) ? THREE.MathUtils.clamp(value, -1, 1) : fallback

    const wrappedLightCoordinate = (value: number, fallback: number) => {
      if (!Number.isFinite(value)) return fallback
      return THREE.MathUtils.euclideanModulo(value + 1, 2) - 1
    }

    const safeLightU = (value: number, fallback: number) =>
      wrappedLightCoordinate(value, fallback)

    const updateLightTargetWorld = (bounds = currentPlanBounds()) => {
      lightLocalCentre.set(
        (bounds.minX + bounds.maxX) * 0.5,
        bounds.heightM * 0.5,
        (bounds.minZ + bounds.maxZ) * 0.5,
      )
      installationRoot.updateWorldMatrix(true, false)
      lightTargetWorld.copy(lightLocalCentre).applyMatrix4(installationRoot.matrixWorld)
      return lightTargetWorld
    }

    const updateLightOrbPosition = (
      target: THREE.Vector3,
      source: THREE.Vector3,
      _bounds: PlanBounds,
    ) => {
      // The orb is the actual SpotLight position. Previously it was a clamped
      // 34% proxy, so its apparent orbit and Near/Far distance did not match
      // the illumination or shadow source.
      lightOrb.position.copy(source)
      const position = lightGuideGeometry.getAttribute('position')
      position.setXYZ(0, lightOrb.position.x, lightOrb.position.y, lightOrb.position.z)
      position.setXYZ(1, target.x, target.y, target.z)
      position.needsUpdate = true
    }

    const lightEnvelopeSourceDistance = (
      worldDirection: THREE.Vector3,
      bounds: PlanBounds,
      surfaceClearance: number,
    ) => {
      // Transform only the direction: the target is the exact centre of this
      // local envelope. The first AABB face hit from that centre is the safe
      // exterior point along the selected orbit ray.
      installationRoot.getWorldQuaternion(lightInstallationWorldQuaternion)
      lightInstallationWorldQuaternion.invert()
      lightDirectionLocal
        .copy(worldDirection)
        .applyQuaternion(lightInstallationWorldQuaternion)

      const halfX = Math.max(0.02, (bounds.maxX - bounds.minX) * 0.5)
      const halfY = Math.max(0.02, bounds.heightM * 0.5)
      const halfZ = Math.max(0.01, (bounds.maxZ - bounds.minZ) * 0.5)
      let exitDistance = Number.POSITIVE_INFINITY
      let exitNormalComponent = 1
      if (Math.abs(lightDirectionLocal.x) > 0.000001) {
        const candidate = halfX / Math.abs(lightDirectionLocal.x)
        if (candidate < exitDistance) {
          exitDistance = candidate
          exitNormalComponent = Math.abs(lightDirectionLocal.x)
        }
      }
      if (Math.abs(lightDirectionLocal.y) > 0.000001) {
        const candidate = halfY / Math.abs(lightDirectionLocal.y)
        if (candidate < exitDistance) {
          exitDistance = candidate
          exitNormalComponent = Math.abs(lightDirectionLocal.y)
        }
      }
      if (Math.abs(lightDirectionLocal.z) > 0.000001) {
        const candidate = halfZ / Math.abs(lightDirectionLocal.z)
        if (candidate < exitDistance) {
          exitDistance = candidate
          exitNormalComponent = Math.abs(lightDirectionLocal.z)
        }
      }
      if (!Number.isFinite(exitDistance)) return halfZ + surfaceClearance
      // A radial 40 mm step is not necessarily 40 mm normal to the face that
      // the ray exits. Divide by that face-normal component so the closest
      // AABB surface is genuinely the requested distance from the source.
      return exitDistance + surfaceClearance / Math.max(0.001, exitNormalComponent)
    }

    const lightPositionForState = (
      state: Pick<LinarLightState, 'u' | 'v' | 'radius'>,
      bounds = currentPlanBounds(),
    ) => {
      const target = updateLightTargetWorld(bounds)
      const u = safeLightU(state.u, 0)
      const v = safeLightCoordinate(state.v, 0)
      const radiusControl = safeLightCoordinate(state.radius, 0)
      const application = configRef.current.application
      const azimuth = u * Math.PI
      // v controls the orbit latitude while keeping the source in the room-
      // side hemisphere. At both endpoints it remains clear of a host plane.
      const polar = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(72, 18, (v + 1) * 0.5),
      )
      const tangentWeight = Math.sin(polar)
      const normalWeight = Math.cos(polar)
      const tangentSin = Math.sin(azimuth) * tangentWeight
      const tangentCos = Math.cos(azimuth) * tangentWeight

      if (application === 'wall') {
        // A complete ring in the wall tangent plane, biased into the room.
        // This provides 360 degrees without hiding the source behind the host.
        lightDirectionWorld.set(tangentSin, tangentCos, normalWeight)
      } else if (application === 'ceiling') {
        // The ceiling room normal points down; X/Z form its complete ring.
        lightDirectionWorld.set(tangentSin, -normalWeight, tangentCos)
      } else {
        // Freestanding uses a conventional horizontal azimuth around Y.
        lightDirectionWorld.set(tangentSin, normalWeight, tangentCos)
      }
      lightDirectionWorld.normalize()

      const surfaceClearance = lightSurfaceClearanceM(radiusControl)
      const sourceDistance = lightEnvelopeSourceDistance(
        lightDirectionWorld,
        bounds,
        surfaceClearance,
      )
      lightPositionGoal
        .copy(target)
        .addScaledVector(lightDirectionWorld, sourceDistance)

      // Numerical protection for mounted transitions: the source may orbit on
      // the room side, never through a wall or above the ceiling.
      if (application !== 'freestanding') {
        const frame = applicationFrame(application)
        const minimumHostClearance =
          frame.installationClearanceM + surfaceClearance
        const signedHostDistance = signedDistanceToApplicationPlane(
          lightPositionGoal,
          frame,
        )
        if (signedHostDistance < minimumHostClearance) {
          lightPositionGoal.addScaledVector(
            frame.roomNormal,
            minimumHostClearance - signedHostDistance,
          )
        }
      }
      return lightPositionGoal
    }

    const pointerNdc = (event: { clientX: number; clientY: number }) => {
      const rect = renderer.domElement.getBoundingClientRect()
      lightPointer.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
      )
    }

    const pointerHitsLightOrb = (event: { clientX: number; clientY: number }) => {
      if (!lightOrb.visible || !lightStateRef.current.enabled) return false
      pointerNdc(event)
      lightRaycaster.setFromCamera(lightPointer, camera)
      return lightRaycaster.intersectObject(lightOrbHitMesh, false).length > 0
    }

    const updateLightOrbHover = (event: PointerEvent) => {
      const hovered = pointerHitsLightOrb(event)
      if (hovered === lightOrbHovered) return
      lightOrbHovered = hovered
      if (lightDragPointerId == null) {
        renderer.domElement.style.cursor = hovered ? 'grab' : ''
      }
    }

    const updateDraggedLight = (event: PointerEvent) => {
      if (lightDragPointerId !== event.pointerId || !lightDragState) return
      const rect = renderer.domElement.getBoundingClientRect()
      const deltaX = (event.clientX - lightDragStartX) / Math.max(rect.width, 1)
      const deltaY = (event.clientY - lightDragStartY) / Math.max(rect.height, 1)
      if (lightDragMode === 'distance') {
        // Shift-drag down brings the source closer; up moves it farther away.
        // Wheel-over-orb below offers the same radial control without a key.
        lightDragState.radius = THREE.MathUtils.clamp(
          lightDragStartRadius - deltaY * 2,
          -1,
          1,
        )
        displayedLightRadius = lightDragState.radius
      } else {
        lightDragState.u = safeLightU(lightDragStartU + deltaX * 2, 0)
        lightDragState.v = THREE.MathUtils.clamp(lightDragStartV - deltaY * 2, -1, 1)
        displayedLightU = lightDragState.u
        displayedLightV = lightDragState.v
      }
      const dragBounds = currentPlanBounds()
      const position = lightPositionForState(lightDragState, dragBounds)
      key.position.copy(position)
      updateLightOrbPosition(updateLightTargetWorld(dragBounds), position, dragBounds)
      invalidateKeyShadow()
    }

    const finishLightDrag = (event?: PointerEvent, commit = true) => {
      if (lightDragPointerId == null) return
      const pointerId = lightDragPointerId
      lightDragPointerId = null
      const committed = lightDragState
      lightDragState = null
      controls.enabled = true
      renderer.domElement.style.cursor =
        lightStateRef.current.enabled && lightOrbHovered ? 'grab' : ''
      if (renderer.domElement.hasPointerCapture(pointerId)) {
        renderer.domElement.releasePointerCapture(pointerId)
      }
      if (commit && committed) {
        const nextLightState = {
          enabled: true,
          u: safeLightU(committed.u, lightStateRef.current.u),
          v: safeLightCoordinate(committed.v, lightStateRef.current.v),
          radius: safeLightCoordinate(committed.radius, lightStateRef.current.radius),
        }
        lightStateRef.current = nextLightState
        onLightChangeRef.current(nextLightState)
      } else if (!commit) {
        displayedLightU = safeLightU(lightStateRef.current.u, displayedLightU)
        displayedLightV = safeLightCoordinate(lightStateRef.current.v, displayedLightV)
        displayedLightRadius = safeLightCoordinate(
          lightStateRef.current.radius,
          displayedLightRadius,
        )
      }
      event?.preventDefault()
    }

    const onLightPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      if (!lightStateRef.current.enabled || lightDragPointerId != null) return
      if (!pointerHitsLightOrb(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      // The guided Light step explicitly invites this drag. Preserve the tour
      // while the orb is handled; ordinary canvas orbiting still interrupts it.
      if (!tourActiveRef.current) onUserInteractRef.current()
      lightDragPointerId = event.pointerId
      const nextLightDragState: LinarLightState = {
        enabled: true,
        u: safeLightU(displayedLightU, lightStateRef.current.u),
        v: safeLightCoordinate(displayedLightV, lightStateRef.current.v),
        radius: safeLightCoordinate(
          lightStateRef.current.radius,
          lightStateRef.current.radius,
        ),
      }
      lightDragState = nextLightDragState
      lightDragStartX = event.clientX
      lightDragStartY = event.clientY
      lightDragStartU = nextLightDragState.u
      lightDragStartV = nextLightDragState.v
      lightDragStartRadius = nextLightDragState.radius
      lightDragMode = event.shiftKey || event.altKey ? 'distance' : 'orbit'
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      renderer.domElement.style.cursor =
        lightDragMode === 'distance' ? 'ns-resize' : 'grabbing'
    }

    const onLightPointerMove = (event: PointerEvent) => {
      if (lightDragPointerId === event.pointerId) {
        event.preventDefault()
        event.stopImmediatePropagation()
        updateDraggedLight(event)
        return
      }
      if (lightDragPointerId == null && event.isPrimary) updateLightOrbHover(event)
    }
    const onLightPointerEnd = (event: PointerEvent) => {
      if (lightDragPointerId !== event.pointerId) return
      event.stopImmediatePropagation()
      finishLightDrag(event, event.type !== 'pointercancel')
    }
    const onLightEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && lightDragPointerId != null) finishLightDrag(undefined, false)
    }
    const onLightPointerLeave = () => {
      if (lightDragPointerId != null) return
      lightOrbHovered = false
      renderer.domElement.style.cursor = ''
    }

    const normalizedWheelPixelDelta = (event: WheelEvent) => {
      let delta = event.deltaY
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 100
      // Browser pinch gestures arrive as ctrl+wheel with very small deltas.
      if (event.ctrlKey) delta *= 4
      return THREE.MathUtils.clamp(delta, -240, 240)
    }

    const onCanvasWheel = (event: WheelEvent) => {
      const now = performance.now()
      const lightWheelOwnsBurst =
        lightStateRef.current.enabled &&
        (now < lightWheelCapturedUntil || pointerHitsLightOrb(event))

      if (lightWheelOwnsBurst) {
        lightWheelCapturedUntil = now + LIGHT_WHEEL_CAPTURE_LATCH_MS
        event.preventDefault()
        event.stopImmediatePropagation()
        if (lightDragPointerId != null) return
        if (!tourActiveRef.current) onUserInteractRef.current()

        const normalizedDelta = THREE.MathUtils.clamp(
          normalizedWheelPixelDelta(event) / 650,
          -0.24,
          0.24,
        )
        const nextRadius = THREE.MathUtils.clamp(
          displayedLightRadius + normalizedDelta,
          -1,
          1,
        )
        if (Math.abs(nextRadius - displayedLightRadius) < 0.000001) return
        displayedLightRadius = nextRadius
        const nextLightState: LinarLightState = {
          enabled: true,
          u: safeLightU(displayedLightU, lightStateRef.current.u),
          v: safeLightCoordinate(displayedLightV, lightStateRef.current.v),
          radius: nextRadius,
        }
        lightStateRef.current = nextLightState
        onLightChangeRef.current(nextLightState)

        const wheelBounds = currentPlanBounds()
        const position = lightPositionForState(nextLightState, wheelBounds)
        key.position.copy(position)
        updateLightOrbPosition(
          updateLightTargetWorld(wheelBounds),
          position,
          wheelBounds,
        )
        invalidateKeyShadow()
        return
      }

      // Own ordinary wheel input as well so OrbitControls cannot apply one
      // immediate 4%-radius jump and then leave the render gate idle. Accumulate
      // a precise radius goal and ease the camera to it in the RAF below.
      event.preventDefault()
      event.stopImmediatePropagation()
      if (lightDragPointerId != null || !controls.enabled || !controls.enableZoom) return
      const delta = normalizedWheelPixelDelta(event)
      if (Math.abs(delta) < 0.000001) return
      // A pure dolly must preserve authored Top/ceiling camera up vectors.
      // The broader OrbitControls start handler resets axes for rotation, which
      // caused a first-wheel roll/jump in those inspection views.
      if (smoothCameraZoomTargetRadius == null) claimUserCameraAuthority()
      const currentRadius = camera.position.distanceTo(controls.target)
      const baseRadius = smoothCameraZoomTargetRadius ?? currentRadius
      const zoomScale = Math.exp(delta * CAMERA_WHEEL_ZOOM_FACTOR * controls.zoomSpeed)
      smoothCameraZoomTargetRadius = THREE.MathUtils.clamp(
        baseRadius * zoomScale,
        controls.minDistance,
        controls.maxDistance,
      )
      controlsChangedSinceRender = true
    }

    renderer.domElement.addEventListener('pointerdown', onLightPointerDown, true)
    renderer.domElement.addEventListener('pointermove', onLightPointerMove, true)
    renderer.domElement.addEventListener('pointerup', onLightPointerEnd, true)
    renderer.domElement.addEventListener('pointercancel', onLightPointerEnd, true)
    renderer.domElement.addEventListener('lostpointercapture', onLightPointerEnd, true)
    renderer.domElement.addEventListener('pointerleave', onLightPointerLeave, true)
    renderer.domElement.addEventListener('wheel', onCanvasWheel, {
      capture: true,
      passive: false,
    })
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
      smoothCameraZoomTargetRadius = null
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
      studioBackground.copy(scene.background as THREE.Color)
      if (lightStateRef.current.enabled) {
        const background = scene.background as THREE.Color
        background.copy(lightStudyBackground)
      }
      renderer.setClearColor(scene.background as THREE.Color, 1)
      initialCam.position.copy(camera.position)
      initialCam.target.copy(controls.target)
      initialCam.minDistance = controls.minDistance
      initialCam.maxDistance = controls.maxDistance
      captureCinematicAnchor()
      cameraAuthority = 'preset'
    }

    const transitionToFrame = () => {
      smoothCameraZoomTargetRadius = null
      // An explicit preset/application/count frame supersedes any delayed
      // technical Top refit queued by a slider change.
      topAutoFramePending = false
      // Every preset request is last-click-wins. In particular, Top and the
      // ceiling Close-up use authored camera-up axes and are applied as an
      // immediate cut. Leaving an older transition alive let it overwrite that
      // cut on the following RAF, so fast button presses appeared to get stuck
      // in the previous animation.
      const restoreDamping = cameraTransition?.restoreDamping ?? controls.enableDamping
      if (cameraTransition) {
        cameraTransition = null
        controls.enableDamping = restoreDamping
      }
      cinematicAnchor = null
      controlsChangedSinceRender = true
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
      if (
        cinematicActiveRef.current &&
        configRef.current.application === 'freestanding'
      ) {
        // Manual Close-up and Side are intentionally technical inspection
        // views. Their 0.52/1.08 m distances caused 6-12x dolly jumps in the
        // intro, so the cinematic uses gentler variants around the hero fit.
        const cinematicHero = viewPlacement(
          'hero',
          camera,
          sideRef.current,
          configRef.current.application,
          planBounds,
        )
        if (currentPreset === 'closeup') {
          placement.dist = Math.max(3.8, cinematicHero.dist * 0.62)
        } else if (currentPreset === 'side') {
          placement.dist = Math.max(4.6, cinematicHero.dist * 0.8)
        }
      }
      studioBackground.set(placement.bg)
      const destination = placement.target.clone().addScaledVector(placement.dir, placement.dist)
      setApplicationOrbitLimits(
        controls,
        currentPreset,
        configRef.current.application,
      )
      controls.minDistance = Math.max(0.18, placement.dist * 0.22)
      controls.maxDistance = placement.dist * 4.5

      const destinationUp = placement.up ?? WORLD_UP
      const changesCameraAxis = camera.up.distanceToSquared(destinationUp) > 0.01
      const usesAuthoredCameraAxis = destinationUp.distanceToSquared(WORLD_UP) > 0.01
      cameraAuthority = cinematicActiveRef.current
        ? 'startup-cinematic'
        : tourActiveRef.current
          ? 'guided-tour'
          : 'preset'
      if (reducedMotion || changesCameraAxis || usesAuthoredCameraAxis) {
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
        studioBackground.copy(scene.background as THREE.Color)
        if (lightStateRef.current.enabled) {
          const background = scene.background as THREE.Color
          background.copy(lightStudyBackground)
        }
        renderer.setClearColor(scene.background as THREE.Color, 1)
        return
      }

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
      const targetTravel = controls.target.distanceTo(placement.target)

      controls.enableDamping = false
      cameraTransition = {
        fromSpherical,
        toSpherical,
        thetaDelta,
        // A subtle dolly-out keeps the full object readable during wide
        // rotations and gives front-to-reverse moves a deliberate studio feel.
        radiusLift: cinematicActiveRef.current
          ? Math.min(0.015, (angularTravel / Math.PI) * 0.012)
          : Math.min(0.07, (angularTravel / Math.PI) * 0.055),
        fromTarget: controls.target.clone(),
        toTarget: placement.target.clone(),
        fromBackground: (scene.background as THREE.Color).clone(),
        toBackground: new THREE.Color(placement.bg),
        elapsed: 0,
        // Fill the complete seven-second scene so there is no authored hold.
        // The startup's gentler quadratic ease reaches zero velocity exactly
        // at direction-changing boundaries instead of snapping into a reverse.
        duration: cinematicActiveRef.current
          ? STARTUP_CINEMATIC_STAGE_SECONDS
          : THREE.MathUtils.clamp(
              2.8 +
                angularTravel * 0.48 +
                Math.log(radiusRatio) * 0.58 +
                targetTravel * 0.1,
              3.1,
              5.4,
            ),
        restoreDamping,
        startupEasing: cinematicActiveRef.current,
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

    const materialWarmupIdleIds: number[] = []
    let materialWarmupDelayTimer: number | null = null
    if (typeof window.requestIdleCallback === 'function') {
      const queueMaterialWarmup = (
        id: LinarMaterialId,
        veneer: LinarVeneerId,
        next?: () => void,
      ) => {
        const idleId = window.requestIdleCallback(
          () => {
            if (disposed) return
            panel.prewarmMaterial(id, veneer)
            next?.()
          },
          { timeout: 5000 },
        )
        materialWarmupIdleIds.push(idleId)
      }
      const beginMaterialWarmup = () => {
        if (disposed) return
        if (cinematicActiveRef.current) {
          // Never spend a measured 20–108 ms canvas-generation task inside
          // the cinematic. Try again just after the authored run completes.
          materialWarmupDelayTimer = window.setTimeout(
            beginMaterialWarmup,
            STARTUP_CINEMATIC_DURATION_SECONDS * 1000 + 500,
          )
          return
        }
        // These are the only two uncached appearances the guided tour selects.
        // Generate them during separate idle periods rather than hitching when
        // the corresponding product step opens.
        queueMaterialWarmup('plywood', 'oak', () => {
          queueMaterialWarmup('mdf', 'none')
        })
      }
      // Give the page effect time to start a fresh-load cinematic before the
      // first idle decision. Shared links skip that cinematic and warm sooner.
      materialWarmupDelayTimer = window.setTimeout(beginMaterialWarmup, 1500)
    }

    const resize = () => {
      if (disposed) return
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setPixelRatio(
        cinematicActiveRef.current ? cinematicPixelRatio : basePixelRatio,
      )
      renderer.setSize(w, h, false)
      controlsChangedSinceRender = true
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
    let lastPanelCount = clampedPanelCount(configRef.current.panelCount)
    let lastApplication = configRef.current.application
    let lastReset = resetViewTokenRef.current
    let lastView = viewTokenRef.current
    let raf = 0
    let lastT = performance.now()
    let visible = document.visibilityState !== 'hidden'
    let hiddenAt = visible ? null : performance.now()
    let lightStudyWasEnabled = initialLightStudy
    let cinematicRenderScaleWasActive = cinematicActiveRef.current
    let idleRenderElapsed = Number.POSITIVE_INFINITY
    const transitionSpherical = new THREE.Spherical()
    const transitionOffset = new THREE.Vector3()

    const tick = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      if (!visible) {
        lastT = now
        return
      }
      const elapsedSeconds = Math.max(0, (now - lastT) / 1000)
      const dt = Math.min(0.05, elapsedSeconds)
      const cameraMotionDt = Math.min(0.12, elapsedSeconds)
      const lightMotionDt = Math.min(0.2, elapsedSeconds)
      const lightModeDt = Math.min(1, elapsedSeconds)
      lastT = now
      shadowRefreshElapsed += elapsedSeconds
      if (cinematicActiveRef.current !== cinematicRenderScaleWasActive) {
        cinematicRenderScaleWasActive = cinematicActiveRef.current
        renderer.setPixelRatio(
          cinematicRenderScaleWasActive ? cinematicPixelRatio : basePixelRatio,
        )
        renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false)
        controlsChangedSinceRender = true
      }
      const lightStudyEnabled = lightStateRef.current.enabled
      if (lightStudyEnabled !== lightStudyWasEnabled) {
        lightStudyWasEnabled = lightStudyEnabled
        // Auxiliary lights, exposure and background are cross-faded below.
        // Hard-zeroing them here produced a dark flash before the key source
        // and its shadow receiver had reached their new state.
        invalidateKeyShadow()
      }

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

      const nextPanelCount = clampedPanelCount(configRef.current.panelCount)
      const nextApplication = configRef.current.application
      if (nextPanelCount !== lastPanelCount) {
        lastPanelCount = nextPanelCount
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
      if (nextApplication !== lastApplication) {
        lastApplication = nextApplication
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

      const startupCinematicIsActive = cinematicActiveRef.current
      if (
        cinematicTokenRef.current !== startupCinematicRunToken ||
        (startupCinematicIsActive && !startupCinematicWasActive)
      ) {
        startupCinematicRunToken = cinematicTokenRef.current
        startupCinematicElapsed = 0
        startupCinematicStartedAt = now
        startupCinematicStage = -1
        startupCinematicCompleted = false
      }
      startupCinematicWasActive = startupCinematicIsActive

      let activeStartupPose: ReturnType<typeof startupCinematicPose> | null = null
      if (startupCinematicIsActive && !reducedMotion && !startupCinematicCompleted) {
        // The authored duration follows visible wall-clock time, not frame
        // count. It therefore stays 42 seconds on low-power/software WebGL but
        // pauses with a hidden tab so camera and geometry cannot lose sync.
        startupCinematicElapsed = Math.max(0, (now - startupCinematicStartedAt) / 1000)
        activeStartupPose = startupCinematicPose(startupCinematicElapsed)
        if (activeStartupPose.stage !== startupCinematicStage) {
          // Reconcile every crossed stage if a very slow frame spans a scene
          // boundary. React batches these callbacks, leaving the latest stage
          // authoritative without silently skipping its view state.
          for (
            let stage = startupCinematicStage + 1;
            stage <= activeStartupPose.stage;
            stage += 1
          ) {
            onCinematicStageRef.current(stage)
          }
          startupCinematicStage = activeStartupPose.stage
        }
        if (activeStartupPose.done) {
          startupCinematicCompleted = true
          // The normal interface narrows the viewport as soon as the page
          // completion callback clears cinematic mode. Preserve the authored
          // hero pose before that layout change reaches ResizeObserver;
          // otherwise `resize()` treats it like an untouched preset and snaps
          // the camera through a second immediate `applyFrame()` fit.
          hasOrbited = true
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
      const topAutoFrameTargetKey = `${targetBendRef.current}:${targetSecondaryCurveRef.current}`
      if (topAutoFrameTargetKey !== lastTopAutoFrameTargetKey) {
        lastTopAutoFrameTargetKey = topAutoFrameTargetKey
        topAutoFramePending =
          currentPreset === 'top' &&
          !hasOrbited &&
          !activeStartupPose &&
          !tourActiveRef.current
      }
      const bendResponse = activeStartupPose
        ? 5.5
        : tourActiveRef.current && !reducedMotion
          ? 1.25
          : 11
      const lambda = 1 - Math.exp(-lightMotionDt * bendResponse)
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
      if (
        topAutoFramePending &&
        currentPreset === 'top' &&
        !hasOrbited &&
        !cameraTransition &&
        !activeStartupPose &&
        !tourActiveRef.current &&
        displayedBend === goal &&
        displayedSecondaryCurve === secondaryGoal
      ) {
        // Refit once after the animated geometry has settled. Reframing every
        // deformation frame would fight manual inspection and read as a camera
        // chase; waiting preserves a stable technical plan while keeping the
        // newly selected S shape at a useful scale.
        transitionToFrame()
      }

      const presentationLambda =
        1 - Math.exp(-lightMotionDt * (reducedMotion ? 80 : 3.8))
      const lightModeResponse =
        activeStartupPose?.stage === STARTUP_CINEMATIC_EXIT_STAGE
          ? 0.65
          : activeStartupPose
            ? 1.15
            : 4.8
      const lightModeLambda =
        1 - Math.exp(-lightModeDt * (reducedMotion ? 80 : lightModeResponse))
      const presentationMoving =
        presentationRoot.position.distanceToSquared(presentationTargetPosition) > 1e-10 ||
        1 - Math.abs(presentationRoot.quaternion.dot(presentationTargetQuaternion)) > 1e-10
      lightStudyFloorOpacityGoal =
        lightStudyEnabled && configRef.current.application !== 'ceiling'
          ? 1
          : 0
      const targetShadowReceiverOpacity = lightStudyEnabled ? 0 : floorShadowOpacityGoal
      const presentationVisualsMoving =
        Math.abs(contextWallMaterial.opacity - wallOpacityGoal) > 0.001 ||
        Math.abs(contextCeilingMaterial.opacity - ceilingOpacityGoal) > 0.001 ||
        Math.abs(shadowReceiverMaterial.opacity - targetShadowReceiverOpacity) > 0.001 ||
        Math.abs(lightStudyReceiverMaterial.opacity - lightStudyFloorOpacityGoal) > 0.001 ||
        Math.abs(
          ceilingKey.intensity - (lightStudyEnabled ? 0 : ceilingLightGoal),
        ) > 0.001
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
        (targetShadowReceiverOpacity - shadowReceiverMaterial.opacity) *
          lightModeLambda
      lightStudyReceiverMaterial.opacity +=
        (lightStudyFloorOpacityGoal - lightStudyReceiverMaterial.opacity) * lightModeLambda
      ceilingKey.intensity +=
        ((lightStudyEnabled ? 0 : ceilingLightGoal) - ceilingKey.intensity) *
        lightModeLambda
      hemi.intensity += ((lightStudyEnabled ? 0 : 0.3) - hemi.intensity) * lightModeLambda
      frontKey.intensity +=
        ((lightStudyEnabled ? 0 : 0.48) - frontKey.intensity) * lightModeLambda
      fill.intensity += ((lightStudyEnabled ? 0 : 0.2) - fill.intensity) * lightModeLambda
      rim.intensity += ((lightStudyEnabled ? 0 : 0.42) - rim.intensity) * lightModeLambda
      rearFill.intensity +=
        ((lightStudyEnabled ? 0 : 0.22) - rearFill.intensity) * lightModeLambda
      const displayedRadiusControl = safeLightCoordinate(displayedLightRadius, 0)
      // Outside the interactive study, return the one shadow-casting key to a
      // canonical distant studio rig. Reusing a 40 mm Near source at the old
      // studio intensity would overexpose the panel as LIGHT fades out.
      const activeKeyU = lightStudyEnabled
        ? displayedLightU
        : DEFAULT_LINAR_LIGHT.u
      const activeKeyV = lightStudyEnabled
        ? displayedLightV
        : DEFAULT_LINAR_LIGHT.v
      const activeKeyRadiusControl = lightStudyEnabled ? displayedRadiusControl : 1
      const activeKeySurfaceClearance = lightSurfaceClearanceM(activeKeyRadiusControl)
      const lightRadiusIntensityFactor = lightStudyIntensityFactor(
        displayedRadiusControl,
      )
      // Recalibrate emitted power for the new physical source distances. The
      // previous 200/72.5 values assumed a hidden source several metres away;
      // using them at 0.45 m or 40 mm erased the wood grain completely.
      const lightStudyBaseIntensity =
        configRef.current.application === 'ceiling'
          ? CEILING_LIGHT_STUDY_KEY_INTENSITY
          : FLOOR_WALL_LIGHT_STUDY_KEY_INTENSITY
      const targetKeyIntensity = lightStudyEnabled
        ? lightStudyBaseIntensity * lightRadiusIntensityFactor
        : STUDIO_KEY_INTENSITY
      key.intensity += (targetKeyIntensity - key.intensity) * lightModeLambda
      key.shadow.intensity +=
        ((lightStudyEnabled
          ? LIGHT_STUDY_SHADOW_INTENSITY
          : STUDIO_SHADOW_INTENSITY) -
          key.shadow.intensity) *
        lightModeLambda
      renderer.toneMappingExposure +=
        ((lightStudyEnabled ? LIGHT_STUDY_EXPOSURE : STUDIO_EXPOSURE) -
          renderer.toneMappingExposure) *
        lightModeLambda
      lightOrbShellMaterial.emissiveIntensity +=
        ((lightStudyEnabled ? 0.58 : 0.42) * LIGHT_ORB_VISUAL_BRIGHTNESS -
          lightOrbShellMaterial.emissiveIntensity) *
        lightModeLambda
      contextWallMaterial.color.lerp(
        lightStudyEnabled ? darkContextColor : studioWallColor,
        lightModeLambda,
      )
      contextCeilingMaterial.color.lerp(
        lightStudyEnabled ? darkContextColor : studioCeilingColor,
        lightModeLambda,
      )
      contextCeilingMaterial.emissiveIntensity +=
        ((lightStudyEnabled ? 0 : 0.38) - contextCeilingMaterial.emissiveIntensity) *
        lightModeLambda
      ceilingKey.castShadow = false
      contextWall.visible = contextWallMaterial.opacity > 0.004 || wallOpacityGoal > 0
      contextCeiling.visible =
        contextCeilingMaterial.opacity > 0.004 || ceilingOpacityGoal > 0
      lightStudyReceiver.visible =
        lightStudyReceiverMaterial.opacity > 0.004 || lightStudyFloorOpacityGoal > 0
      if (presentationMoving) invalidateKeyShadow()

      if (activeStartupPose && !lightDragState) {
        displayedLightU = activeStartupPose.lightU
        displayedLightV = activeStartupPose.lightV
      } else if (!lightDragState) {
        const lightLambda = 1 - Math.exp(-lightMotionDt * (reducedMotion ? 80 : 6.5))
        const targetLightU = safeLightU(lightStateRef.current.u, displayedLightU)
        const lightUDelta =
          THREE.MathUtils.euclideanModulo(targetLightU - displayedLightU + 1, 2) - 1
        displayedLightU = wrappedLightCoordinate(
          displayedLightU + lightUDelta * lightLambda,
          targetLightU,
        )
        displayedLightV +=
          (safeLightCoordinate(lightStateRef.current.v, displayedLightV) - displayedLightV) *
          lightLambda
        displayedLightRadius +=
          (safeLightCoordinate(lightStateRef.current.radius, displayedLightRadius) -
            displayedLightRadius) *
          lightLambda
      }
      const lightBounds = currentPlanBounds(displayedBend, displayedSecondaryCurve)
      // The architectural planes are fixed. Re-anchor the one installation
      // root from its complete deformed bounds on every geometry update.
      applyInstallationFrame(lightBounds)
      enforceInstallationHalfSpace(lightBounds)
      presentationRoot.updateWorldMatrix(true, false)
      const nextLightPosition = lightPositionForState(
        {
          u: activeKeyU,
          v: activeKeyV,
          radius: activeKeyRadiusControl,
        },
        lightBounds,
      )
      const lightPositionMoving = key.position.distanceToSquared(nextLightPosition) > 1e-10
      const lightPositionLambda = lightDragState
        ? 1
        : 1 -
          Math.exp(-lightMotionDt * (activeStartupPose ? 2 : reducedMotion ? 80 : 7.5))
      key.position.lerp(nextLightPosition, lightPositionLambda)
      if (configRef.current.application !== 'freestanding') {
        // A smoothed move between application states must obey the same host-
        // plane rule as its destination. Otherwise one transition frame can
        // place the real source inside the wall or above the ceiling even
        // though both authored endpoints are valid.
        const frame = applicationFrame(configRef.current.application)
        const minimumHostClearance =
          frame.installationClearanceM + activeKeySurfaceClearance
        const signedHostDistance = signedDistanceToApplicationPlane(key.position, frame)
        if (signedHostDistance < minimumHostClearance) {
          key.position.addScaledVector(
            frame.roomNormal,
            minimumHostClearance - signedHostDistance,
          )
        }
      }
      const nextLightTarget = updateLightTargetWorld(lightBounds)
      const casterRadius = Math.hypot(
        (lightBounds.maxX - lightBounds.minX) * 0.5,
        (lightBounds.maxZ - lightBounds.minZ) * 0.5,
        lightBounds.heightM * 0.5,
      )
      const sourceDistance = nextLightPosition.distanceTo(nextLightTarget)
      // The old 60 mm minimum clipped the caster when Near placed the real
      // source only 40 mm from the surface. Keep the near plane safely inside
      // the selected clearance while retaining the stable 60 mm default.
      const fittedShadowNear = Math.max(
        0.003,
        Math.min(0.06, activeKeySurfaceClearance * 0.3),
      )
      const fittedShadowFar = Math.max(
        fittedShadowNear + 1,
        sourceDistance + casterRadius * 3.2,
        SHADOW_CAMERA_FAR_M,
      )
      // Preserve inverse-square decay without a second hard light cutoff
      // before the receiver and shadow-camera limits.
      key.distance = 0
      const casterFitAngle = Math.atan2(
        casterRadius * 1.08,
        Math.max(sourceDistance, 0.1),
      )
      const fittedLightStudyAngle = THREE.MathUtils.clamp(
        casterFitAngle,
        LIGHT_STUDY_MIN_CONE_ANGLE,
        LIGHT_STUDY_MAX_CONE_ANGLE,
      )
      const fittedStudioShadowAngle = THREE.MathUtils.clamp(
        Math.atan2(casterRadius * 1.2, Math.max(sourceDistance, 0.1)),
        STUDIO_MIN_SHADOW_CONE_ANGLE,
        STUDIO_MAX_SHADOW_CONE_ANGLE,
      )
      // Studio presentation keeps its broad artistic light pool, while the
      // documented SpotLightShadow focus crops only the shadow-camera field of
      // view around the real caster. This gives the 4 mm openings enough texel
      // coverage without changing the visible studio illumination.
      const targetKeyAngle = lightStudyEnabled ? fittedLightStudyAngle : 0.98
      const targetShadowFocus = lightStudyEnabled
        ? 1
        : THREE.MathUtils.clamp(
            fittedStudioShadowAngle / Math.max(targetKeyAngle, 0.001),
            0.16,
            1,
          )
      // Keep a broad, even core in LIGHT mode so rays that pass through the
      // narrow LINAR apertures still illuminate the receiver behind them.
      // The former 0.84 penumbra reduced the full-strength core to only 16%
      // of the fitted cone and made most transmitted detail disappear before
      // it reached the floor. Normal studio presentation retains that softer
      // falloff.
      const targetKeyPenumbra = lightStudyEnabled ? 0.38 : 0.84
      const targetShadowRadius = lightStudyEnabled
        ? compactShadowMap
          ? 0.6
          : 0.7
        : compactShadowMap
          ? 0.55
          : 0.75
      // Changing the cone and PCF kernel instantly re-quantises every narrow
      // aperture in the shadow map. Ease both values with the light crossfade.
      const nextKeyAngle = THREE.MathUtils.lerp(key.angle, targetKeyAngle, lightModeLambda)
      key.penumbra = THREE.MathUtils.lerp(
        key.penumbra,
        targetKeyPenumbra,
        lightModeLambda,
      )
      const nextShadowFocus = THREE.MathUtils.lerp(
        key.shadow.focus,
        targetShadowFocus,
        lightModeLambda,
      )
      const nextShadowRadius = THREE.MathUtils.lerp(
        key.shadow.radius,
        targetShadowRadius,
        lightModeLambda,
      )
      if (
        Math.abs(key.angle - nextKeyAngle) > 0.0001 ||
        Math.abs(key.shadow.focus - nextShadowFocus) > 0.0001 ||
        Math.abs(key.shadow.radius - nextShadowRadius) > 0.0001 ||
        Math.abs(key.shadow.camera.near - fittedShadowNear) > 0.015 ||
        Math.abs(key.shadow.camera.far - fittedShadowFar) > 0.04
      ) {
        key.angle = nextKeyAngle
        key.shadow.focus = nextShadowFocus
        key.shadow.radius = nextShadowRadius
        key.shadow.camera.near = fittedShadowNear
        key.shadow.camera.far = fittedShadowFar
        key.shadow.camera.updateProjectionMatrix()
        invalidateKeyShadow()
      }
      const lightTargetMoving = key.target.position.distanceToSquared(nextLightTarget) > 1e-10
      key.target.position.lerp(nextLightTarget, presentationLambda)
      updateLightOrbPosition(nextLightTarget, key.position, lightBounds)
      shadowReceiver.position.x +=
        (nextLightTarget.x - shadowReceiver.position.x) * presentationLambda
      shadowReceiver.position.z +=
        (nextLightTarget.z - shadowReceiver.position.z) * presentationLambda
      lightStudyReceiver.position.x = shadowReceiver.position.x
      lightStudyReceiver.position.z = shadowReceiver.position.z
      if (lightPositionMoving || lightTargetMoving) invalidateKeyShadow()
      const lightOrbShouldShow =
        lightStateRef.current.enabled ||
        Boolean(
          activeStartupPose &&
            activeStartupPose.stage === STARTUP_CINEMATIC_LIGHT_STAGE,
        )
      const orbVisibilityResponse = activeStartupPose ? 3.2 : 11
      const lightOrbVisibilityLambda =
        1 - Math.exp(-dt * (reducedMotion ? 80 : orbVisibilityResponse))
      lightOrbVisibility +=
        ((lightOrbShouldShow ? 1 : 0) - lightOrbVisibility) *
        lightOrbVisibilityLambda
      if (!lightStateRef.current.enabled && lightDragPointerId == null) {
        lightOrbHovered = false
        renderer.domElement.style.cursor = ''
      }
      lightOrb.visible = lightOrbShouldShow || lightOrbVisibility > 0.002
      lightGuide.visible = lightOrb.visible
      lightGuideMaterial.opacity = lightOrbVisibility * 0.18

      if (cameraTransition) {
        // Camera timing is authored in seconds and must not stretch on a
        // low-frame-rate device. Visibility changes already reset `lastT`, so
        // wall-clock progression is safe here.
        cameraTransition.elapsed += elapsedSeconds
        const progress = Math.min(1, cameraTransition.elapsed / cameraTransition.duration)
        const eased = cameraTransition.startupEasing
          ? easeInOut(progress)
          : cinematicEase(progress)
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
        constrainCameraToApplication(
          camera,
          controls,
          configRef.current.application,
        )
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
        cameraAuthority === 'guided-tour' &&
        tourActiveRef.current &&
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

      const background = scene.background as THREE.Color
      if (lightStudyEnabled) {
        background.lerp(lightStudyBackground, lightModeLambda)
      } else if (!cameraTransition) {
        background.lerp(studioBackground, lightModeLambda)
      }
      renderer.setClearColor(background, 1)

      // Keep the panel/camera on every available RAF while limiting the costly
      // perforation-accurate 2048 px shadow pass to 30 Hz. This preserves a
      // stable silhouette without making the dolly wait for a shadow redraw.
      const shadowRefreshInterval = activeStartupPose
        ? 1 / 30
        : lightDragState
          ? compactShadowMap
            ? 1 / 24
            : 1 / 30
          : 0
      if (
        key.castShadow &&
        keyShadowDirty &&
        (shadowRefreshInterval === 0 || shadowRefreshElapsed >= shadowRefreshInterval)
      ) {
        key.shadow.needsUpdate = true
        keyShadowDirty = false
        shadowRefreshElapsed = 0
      }

      const materialsMoving = panel.tickMaterials(dt)
      const controlsMoving = controls.update()
      let smoothCameraZoomMoving = false
      if (smoothCameraZoomTargetRadius != null && !cameraTransition) {
        smoothCameraZoomOffset.subVectors(camera.position, controls.target)
        const currentRadius = Math.max(smoothCameraZoomOffset.length(), 0.0001)
        const targetRadius = THREE.MathUtils.clamp(
          smoothCameraZoomTargetRadius,
          controls.minDistance,
          controls.maxDistance,
        )
        const zoomLambda = 1 - Math.exp(-cameraMotionDt * CAMERA_WHEEL_ZOOM_RESPONSE)
        const remainingRadius = targetRadius - currentRadius
        const nextRadius =
          Math.abs(remainingRadius) < 0.00025
            ? targetRadius
            : THREE.MathUtils.lerp(currentRadius, targetRadius, zoomLambda)
        smoothCameraZoomOffset.setLength(nextRadius)
        camera.position.copy(controls.target).add(smoothCameraZoomOffset)
        camera.lookAt(controls.target)
        smoothCameraZoomMoving = Math.abs(nextRadius - currentRadius) > 0.000001
        if (nextRadius === targetRadius) smoothCameraZoomTargetRadius = null
      }
      const cameraConstrained = constrainCameraToApplication(
        camera,
        controls,
        configRef.current.application,
      )
      if (cameraConstrained && smoothCameraZoomTargetRadius != null) {
        // Do not keep pushing against a wall/ceiling half-space after the safe
        // clamp has become the effective nearest camera position.
        smoothCameraZoomTargetRadius = camera.position.distanceTo(controls.target)
      }

      // Keep the fixture legible as a small light source in every camera preset
      // without letting its hit target grow into the surrounding orbit area.
      // The core is about 16 CSS px across and the invisible target about 48 px.
      const orbDistance = Math.max(camera.position.distanceTo(lightOrb.position), 0.01)
      const worldHeightAtOrb =
        2 *
        Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) * 0.5) *
        orbDistance
      const worldPerCssPixel =
        worldHeightAtOrb / Math.max(renderer.domElement.clientHeight, 1)
      const desiredOrbRadiusPx = coarsePointer ? 9 : 8
      const lightOrbWorldScale = THREE.MathUtils.clamp(
        (worldPerCssPixel * desiredOrbRadiusPx) / LIGHT_ORB_RADIUS_M,
        0.12,
        8,
      )
      lightOrb.scale.setScalar(lightOrbWorldScale)

      const lightOrbInteractionGoal =
        lightDragPointerId != null ? 1 : lightOrbHovered ? 0.72 : 0
      const lightOrbInteractionLambda = 1 - Math.exp(-dt * 15)
      lightOrbInteraction +=
        (lightOrbInteractionGoal - lightOrbInteraction) * lightOrbInteractionLambda
      lightOrbCore.scale.setScalar(0.52 * (1 + lightOrbInteraction * 0.035))
      lightOrbShell.scale.setScalar(1 + lightOrbInteraction * 0.035)
      lightOrbFill.scale.setScalar(1.04 * (1 + lightOrbInteraction * 0.05))
      lightOrbGlow.scale.setScalar(1.62 * (1 + lightOrbInteraction * 0.1))
      lightOrbCoreMaterial.opacity =
        lightOrbVisibility * 0.98 * LIGHT_ORB_VISUAL_BRIGHTNESS
      lightOrbShellMaterial.opacity =
        lightOrbVisibility * 0.72 * LIGHT_ORB_VISUAL_BRIGHTNESS
      lightOrbFillMaterial.opacity =
        lightOrbVisibility * 0.16 * LIGHT_ORB_VISUAL_BRIGHTNESS
      lightOrbGlowMaterial.uniforms.uOpacity.value =
        lightOrbVisibility *
        (1 + lightOrbInteraction * 0.34) *
        LIGHT_ORB_VISUAL_BRIGHTNESS

      const bendMoving =
        Math.abs(goal - displayedBend) > 0.004 ||
        Math.abs(secondaryGoal - displayedSecondaryCurve) > 0.004
      const lightModeMoving =
        Math.abs(key.intensity - targetKeyIntensity) > 0.01 ||
        Math.abs(key.penumbra - targetKeyPenumbra) > 0.001 ||
        Math.abs(key.shadow.focus - targetShadowFocus) > 0.001 ||
        Math.abs(
          renderer.toneMappingExposure -
            (lightStudyEnabled ? LIGHT_STUDY_EXPOSURE : STUDIO_EXPOSURE),
        ) > 0.001
      const orbMoving =
        Math.abs((lightOrbShouldShow ? 1 : 0) - lightOrbVisibility) > 0.002 ||
        Math.abs(lightOrbInteractionGoal - lightOrbInteraction) > 0.002
      const continuouslyAnimated =
        Boolean(activeStartupPose) ||
        Boolean(cameraTransition) ||
        (cameraAuthority === 'guided-tour' && tourActiveRef.current) ||
        Boolean(lightDragState)
      const sceneMoving =
        continuouslyAnimated ||
        bendMoving ||
        presentationMoving ||
        presentationVisualsMoving ||
        lightPositionMoving ||
        lightTargetMoving ||
        lightModeMoving ||
        orbMoving ||
        materialsMoving ||
        controlsMoving ||
        smoothCameraZoomMoving ||
        cameraConstrained ||
        controlsChangedSinceRender

      idleRenderElapsed += elapsedSeconds
      // Keep the RAF authority alive for immediate input, but stop sending the
      // 400k–1.7m triangle scene to the GPU while it is visually unchanged.
      // A slow safety refresh covers external canvas exposure/occlusion events.
      if (sceneMoving || idleRenderElapsed >= 0.5) {
        renderer.render(scene, camera)
        idleRenderElapsed = 0
        controlsChangedSinceRender = false
      }
    }

    const onVisibility = () => {
      const now = performance.now()
      const nextVisible = document.visibilityState !== 'hidden'
      if (!nextVisible) {
        if (visible) hiddenAt = now
        visible = false
        return
      }
      if (
        !visible &&
        hiddenAt != null &&
        cinematicActiveRef.current &&
        !startupCinematicCompleted
      ) {
        startupCinematicStartedAt += Math.max(0, now - hiddenAt)
      }
      hiddenAt = null
      visible = true
      lastT = now
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
      renderer.domElement.removeEventListener('pointerleave', onLightPointerLeave, true)
      renderer.domElement.removeEventListener('wheel', onCanvasWheel, true)
      window.removeEventListener('keydown', onLightEscape)
      ro.disconnect()
      for (const idleId of materialWarmupIdleIds) {
        window.cancelIdleCallback(idleId)
      }
      if (materialWarmupDelayTimer != null) {
        window.clearTimeout(materialWarmupDelayTimer)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      controls.removeEventListener('start', markInteract)
      controls.removeEventListener('change', markControlsChanged)
      controls.dispose()
      clearPanelReplicas()
      panel.dispose()
      shadowReceiverGeometry.dispose()
      shadowReceiverMaterial.dispose()
      lightStudyReceiverMaterial.dispose()
      contextWallGeometry.dispose()
      contextWallMaterial.dispose()
      contextCeilingGeometry.dispose()
      contextCeilingMaterial.dispose()
      lightOrbGeometry.dispose()
      lightOrbCoreMaterial.dispose()
      lightOrbShellMaterial.dispose()
      lightOrbFillMaterial.dispose()
      lightOrbGlowMaterial.dispose()
      lightOrbHitGeometry.dispose()
      lightOrbHitMaterial.dispose()
      lightGuideGeometry.dispose()
      lightGuideMaterial.dispose()
      key.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [reducedMotion])

  return <div ref={mountRef} className="linar-viewport__canvas" />
}
