import { Mesh, Object3D, Vector3 } from 'three'
import type { FreeDriveState, VehicleRigManifest } from '../persistence/schema'
import { measureCarBounds } from '../assets/analyzeAsset'
import { lampGroupForNames, isLetterLikeMesh } from '../vehicle/vehicleLights'
import { speedKmhToMetresPerSecond } from './routeMath'
import {
  applyFrontSteer,
  applyWheelRoll,
  calibrateWheelBindings,
  describeBindings,
  frontSteerVisualSign,
  headingOffsetForLengthAxis,
  measureAxleGeometry,
  resolveWheelBindings,
  worldForwardFromYaw,
  type WheelRuntimeBinding,
} from './wheelRoll'

const _forward = new Vector3()
const _probe = new Vector3()

const STEER_RESPONSE_PER_SEC = 14
/** Arcade bicycle yaw felt too snappy — scale path turn rate (1 = full model). */
const YAW_RATE_SCALE = 0.7
const BODY_ROLL_SMOOTHING_METRES = 0.9
const DEFAULT_WHEELBASE_METRES = 3.1
const DEFAULT_BODY_ROLL_DEG = 0
const DEFAULT_ACCEL_MPS2 = 6
const DEFAULT_BRAKE_MPS2 = 10
const DEFAULT_CRUISE_KMH = 50
const DEFAULT_MAX_STEER_DEG = 38

type VehicleAlignment = {
  yawOffset: number
  wheelbaseMetres: number
  halfTrackMetres: number
  source: 'wheel-rig' | 'bounds'
}

export type FreeDriveInput = {
  /** +1 = W / forward, -1 = S / reverse, 0 = coast */
  throttle: number
  /** +1 = D (right), -1 = A (left) */
  steer: number
}

/**
 * Arcade free-drive: bicycle model on XZ with WASD input.
 * Reuses route wheel roll / steer / body lean; no rigid-body physics.
 */
export class FreeDriveSession {
  private placement: Object3D | null = null
  private actionRoot: Object3D | null = null
  private bindings: WheelRuntimeBinding[] = []
  private alignment: VehicleAlignment | null = null
  private enabled = false
  private cruiseKmh = DEFAULT_CRUISE_KMH
  private accelMps2 = DEFAULT_ACCEL_MPS2
  private brakeMps2 = DEFAULT_BRAKE_MPS2
  private maxSteerRadians = (DEFAULT_MAX_STEER_DEG * Math.PI) / 180
  private maxBodyRollRadians = (DEFAULT_BODY_ROLL_DEG * Math.PI) / 180
  private tireRollRate = 1
  private wheelRollEnabled = true
  private velocityMps = 0
  private headingYaw = 0
  private lastSteer = 0
  private lastBodyRoll = 0
  private rollDistanceMetres = 0
  private calibrationNote = ''
  private input: FreeDriveInput = { throttle: 0, steer: 0 }
  /** Extra π on yawOffset when W still drives toward the tail (saved with the project). */
  private headingFlip = false

  /** Toggle when W goes toward the rear; spins the body so keys stay W=forward. */
  setHeadingFlip(on: boolean) {
    if (this.headingFlip === on) return
    this.headingFlip = on
    this.alignment = null
    for (const b of this.bindings) {
      b.calibrated = false
      b.steerCalibrated = false
    }
    if (this.placement && this.enabled) {
      const yawOffset = this.ensureAlignment().yawOffset
      this.headingYaw = this.placement.rotation.y - yawOffset
    }
  }

  getHeadingFlip() {
    return this.headingFlip
  }

  setVehicle(placement: Object3D | null, rig: VehicleRigManifest | null, actionRoot?: Object3D | null, modelRoot?: Object3D | null) {
    this.resetBodyRoll()
    this.placement = placement
    this.actionRoot =
      actionRoot ??
      (placement?.getObjectByName('VehicleActionRoot') as Object3D | null) ??
      null
    // Same bind root as route / rig validation — manifesto names live under the model.
    const bindRoot =
      modelRoot ??
      (this.actionRoot?.children[0] as Object3D | undefined) ??
      placement
    this.bindings = bindRoot ? resolveWheelBindings(bindRoot, rig) : []
    this.alignment = null
    this.calibrationNote = this.bindings.some((b) => b.rolling || b.steering)
      ? describeBindings(this.bindings)
      : rig
        ? 'Rig loaded but wheel nodes not found on model — check manifesto names.'
        : 'Import *-rigged.glb + manifesto for tire steer/spin (same as oval route).'
    if (placement) {
      const yawOffset = this.ensureAlignment().yawOffset
      this.headingYaw = placement.rotation.y - yawOffset
    }
  }

  isEnabled() {
    return this.enabled
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) {
      this.input = { throttle: 0, steer: 0 }
      this.velocityMps = 0
      this.lastSteer = 0
      this.rollDistanceMetres = 0
      this.resetBodyRoll()
      if (this.bindings.length) {
        applyWheelRoll(this.bindings, 0)
        applyFrontSteer(this.bindings, 0)
      }
    } else if (this.placement) {
      // Remeasure + recalibrate so HMR / Flip 180 / heading fixes take effect.
      this.alignment = null
      for (const b of this.bindings) {
        b.calibrated = false
        b.steerCalibrated = false
      }
      const yawOffset = this.ensureAlignment().yawOffset
      this.headingYaw = this.placement.rotation.y - yawOffset
    }
  }

  /** Restore tire / steer quaternions without moving the car (used by Clip → Stop). */
  resetWheelPoseOnly() {
    this.rollDistanceMetres = 0
    this.lastSteer = 0
    if (this.bindings.length) {
      applyWheelRoll(this.bindings, 0)
      applyFrontSteer(this.bindings, 0)
    }
  }

  /** Park the car back at stage centre with wheels at rest and motion cleared. */
  resetToOrigin() {
    this.input = { throttle: 0, steer: 0 }
    this.velocityMps = 0
    this.lastSteer = 0
    this.rollDistanceMetres = 0
    this.resetBodyRoll()
    this.headingYaw = -this.ensureAlignment().yawOffset
    if (this.placement) {
      this.placement.position.set(0, 0, 0)
      this.placement.rotation.set(0, 0, 0)
      this.placement.updateWorldMatrix(false, true)
    }
    if (this.bindings.length) {
      applyWheelRoll(this.bindings, 0)
      applyFrontSteer(this.bindings, 0)
    }
  }

  setInput(input: FreeDriveInput) {
    this.input = {
      throttle: Math.max(-1, Math.min(1, input.throttle)),
      steer: Math.max(-1, Math.min(1, input.steer)),
    }
  }

  getInput() {
    return { ...this.input }
  }

  applyState(state: FreeDriveState) {
    this.cruiseKmh = state.cruiseKmh
    this.accelMps2 = state.accelMps2
    this.brakeMps2 = state.brakeMps2
    this.setMaxSteerDegrees(state.maxSteerDeg)
    this.setMaxBodyRollDegrees(state.bodyRollDeg)
    this.tireRollRate = state.tireRollRate > 0 ? state.tireRollRate : 1
    this.setHeadingFlip(Boolean(state.headingFlip))
    this.setEnabled(state.enabled)
  }

  toState(chaseCamera: boolean): FreeDriveState {
    return {
      enabled: this.enabled,
      cruiseKmh: this.cruiseKmh,
      accelMps2: this.accelMps2,
      brakeMps2: this.brakeMps2,
      maxSteerDeg: this.getMaxSteerDegrees(),
      bodyRollDeg: this.getMaxBodyRollDegrees(),
      tireRollRate: this.tireRollRate,
      chaseCamera,
      headingFlip: this.headingFlip,
    }
  }

  setCruiseKmh(kmh: number) {
    this.cruiseKmh = Math.min(120, Math.max(5, kmh))
  }

  getCruiseKmh() {
    return this.cruiseKmh
  }

  setAccelMps2(value: number) {
    this.accelMps2 = Math.min(16, Math.max(0.5, value))
  }

  setBrakeMps2(value: number) {
    this.brakeMps2 = Math.min(24, Math.max(1, value))
  }

  setMaxSteerDegrees(degrees: number) {
    this.maxSteerRadians = (Math.min(60, Math.max(5, degrees)) * Math.PI) / 180
  }

  getMaxSteerDegrees() {
    return (this.maxSteerRadians * 180) / Math.PI
  }

  setMaxBodyRollDegrees(degrees: number) {
    this.maxBodyRollRadians = (Math.min(12, Math.max(0, degrees)) * Math.PI) / 180
  }

  getMaxBodyRollDegrees() {
    return (this.maxBodyRollRadians * 180) / Math.PI
  }

  setTireRollRate(rate: number) {
    this.tireRollRate = Number.isFinite(rate) && rate > 0 ? rate : 1
  }

  setWheelRollEnabled(on: boolean) {
    this.wheelRollEnabled = on
  }

  /** World yaw of the travel / chase heading (radians). */
  getVisualHeadingYaw(): number | null {
    if (!this.placement || !this.enabled) return null
    return this.headingYaw
  }

  getVelocityMps() {
    return this.velocityMps
  }

  advance(dtSeconds: number) {
    if (!this.enabled || !this.placement) return
    const dt = Math.max(0, Math.min(0.05, dtSeconds))
    const alignment = this.ensureAlignment()
    const cruise = speedKmhToMetresPerSecond(this.cruiseKmh)

    // Target speed from throttle: W → cruise, S → reverse, none → coast/brake.
    let target = 0
    let rate = this.brakeMps2
    if (this.input.throttle > 0.05) {
      target = this.input.throttle * cruise
      const speedingUp = this.velocityMps < target - 1e-3
      rate = speedingUp ? this.accelMps2 : this.brakeMps2
    } else if (this.input.throttle < -0.05) {
      target = this.input.throttle * (cruise * 0.4)
      // Brake harder when flipping from forward to reverse.
      const flipping = this.velocityMps > 0.4
      rate = flipping ? this.brakeMps2 * 1.25 : this.accelMps2
    } else {
      target = 0
      rate = this.brakeMps2 * 0.7
    }

    const step = rate * dt
    if (Math.abs(target - this.velocityMps) <= step) this.velocityMps = target
    else this.velocityMps += Math.sign(target - this.velocityMps) * step

    // Game-style steer: time-based snap so wheels turn immediately at standstill.
    // D (+1) → positive yaw → car's right when facing +Z (worldForwardFromYaw).
    const targetSteer = this.input.steer * this.maxSteerRadians
    const steerAlpha = 1 - Math.exp(-dt * STEER_RESPONSE_PER_SEC)
    this.lastSteer += (targetSteer - this.lastSteer) * steerAlpha

    // Match path yaw to tire facing (X/Z uprights flip visual vs probe — Lixiang).
    const pathSteer = frontSteerVisualSign(this.bindings) * this.lastSteer

    // Bicycle yaw — scale with speed so high-speed turns don't spin out.
    const speedAbs = Math.abs(this.velocityMps)
    const yawAuthority = Math.min(1, speedAbs / 2.5)
    const yawRate =
      ((speedAbs / Math.max(0.8, alignment.wheelbaseMetres)) *
        Math.tan(pathSteer) *
        Math.max(0.15, yawAuthority) *
        YAW_RATE_SCALE)
    const travelSign = this.velocityMps >= -0.05 ? 1 : -1
    this.headingYaw += travelSign * yawRate * dt

    // Travel uses headingYaw; placement adds yawOffset so authored model-forward matches.
    // When lamps sit opposite the axle FL→nose, yawOffset includes +π so the visual
    // hood (and tire roll) face the same way as travel — no key-invert hack.
    worldForwardFromYaw(this.headingYaw, _forward)
    this.placement.position.x += _forward.x * this.velocityMps * dt
    this.placement.position.z += _forward.z * this.velocityMps * dt

    const lift =
      Math.abs(this.lastBodyRoll) > 1e-5
        ? Math.abs(Math.sin(this.lastBodyRoll)) * Math.max(0.55, alignment.halfTrackMetres)
        : 0
    this.placement.position.y = lift
    this.placement.rotation.set(0, this.headingYaw + alignment.yawOffset, 0)
    this.placement.updateWorldMatrix(false, true)

    this.rollDistanceMetres += this.velocityMps * dt
    this.updateBodyRoll(Math.max(speedAbs * dt, dt * 2), pathSteer)

    if (this.bindings.some((b) => b.rolling && !b.calibrated)) {
      // Calibrate against actual travel (flip when reversing) so rollSign matches motion.
      const calibYaw = this.headingYaw + (travelSign < 0 ? Math.PI : 0)
      calibrateWheelBindings(this.bindings, worldForwardFromYaw(calibYaw, _forward))
      this.calibrationNote = describeBindings(this.bindings)
    }
    // Identical to RouteSession: roll then front steer (separate pivots from manifesto).
    if (this.wheelRollEnabled) {
      applyWheelRoll(this.bindings, this.rollDistanceMetres * this.tireRollRate)
    }
    applyFrontSteer(this.bindings, this.lastSteer)
  }

  getStatus() {
    return {
      enabled: this.enabled,
      speedKmh: this.cruiseKmh,
      velocityKmh: this.velocityMps * 3.6,
      distanceMetres: this.rollDistanceMetres,
      lengthMetres: 0,
      steerDeg: (this.lastSteer * 180) / Math.PI,
      maxSteerDeg: this.getMaxSteerDegrees(),
      bodyRollDeg: (this.lastBodyRoll * 180) / Math.PI,
      maxBodyRollDeg: this.getMaxBodyRollDegrees(),
      accelMps2: this.accelMps2,
      brakeMps2: this.brakeMps2,
      tireRollRate: this.tireRollRate,
      bindingCount: this.bindings.filter((b) => b.rolling).length,
      alignmentSource: this.alignment?.source ?? 'pending',
      wheelbaseMetres: this.alignment?.wheelbaseMetres ?? 0,
      freeDrive: true as const,
      throttle: this.input.throttle,
      steerInput: this.input.steer,
      calibration: this.calibrationNote,
      note: this.calibrationNote,
    }
  }

  getCalibrationNote() {
    return this.calibrationNote
  }

  private updateBodyRoll(travelledMetres: number, pathSteer = this.lastSteer) {
    if (!this.actionRoot) return
    if (this.maxBodyRollRadians <= 1e-6) {
      this.lastBodyRoll = 0
      this.actionRoot.rotation.z = 0
      return
    }
    const target = -pathSteer * this.maxBodyRollRadians
    const alpha = 1 - Math.exp(-travelledMetres / BODY_ROLL_SMOOTHING_METRES)
    this.lastBodyRoll += (target - this.lastBodyRoll) * alpha
    this.actionRoot.rotation.z = this.lastBodyRoll
  }

  private resetBodyRoll() {
    this.lastBodyRoll = 0
    if (this.actionRoot) this.actionRoot.rotation.z = 0
  }

  private ensureAlignment(): VehicleAlignment {
    if (this.alignment) return this.alignment
    if (!this.placement) {
      return {
        yawOffset: 0,
        wheelbaseMetres: DEFAULT_WHEELBASE_METRES,
        halfTrackMetres: 0.8,
        source: 'bounds',
      }
    }
    this.alignment = this.measureAlignment(this.placement)
    return this.alignment
  }

  private measureAlignment(placement: Object3D): VehicleAlignment {
    const prev = placement.rotation.clone()
    placement.rotation.set(0, 0, 0)
    placement.updateWorldMatrix(true, true)

    const axles = measureAxleGeometry(this.bindings)

    let result: VehicleAlignment
    if (axles) {
      const { forward } = axles
      let yawOffset = forward.lengthSq() > 1e-8 ? -Math.atan2(forward.x, forward.z) : 0
      // Axle FL→nose can point at the visual rear. Spin the body 180° so W, tire roll,
      // and the hood share one direction.
      if (forward.lengthSq() > 1e-8 && bodyFacesOppositeAxles(placement, forward, axles.centre)) {
        yawOffset += Math.PI
      }
      if (this.headingFlip) yawOffset += Math.PI
      result = {
        yawOffset,
        wheelbaseMetres:
          axles.wheelbaseMetres > 0.5 ? axles.wheelbaseMetres : DEFAULT_WHEELBASE_METRES,
        halfTrackMetres: Math.max(0.55, axles.halfTrackMetres),
        source: 'wheel-rig',
      }
    } else {
      const box = measureCarBounds(placement)
      const size = box.getSize(new Vector3())
      let yawOffset = headingOffsetForLengthAxis(size.x >= size.z ? 'x' : 'z')
      const centre = box.getCenter(new Vector3())
      const guess = worldForwardFromYaw(-yawOffset, _forward).clone()
      if (bodyFacesOppositeAxles(placement, guess, centre)) {
        yawOffset += Math.PI
      }
      if (this.headingFlip) yawOffset += Math.PI
      result = {
        yawOffset,
        wheelbaseMetres: Math.max(size.x, size.z) * 0.6 || DEFAULT_WHEELBASE_METRES,
        halfTrackMetres: Math.max(0.55, Math.min(size.x, size.z) * 0.45),
        source: 'bounds',
      }
    }

    placement.rotation.copy(prev)
    placement.updateWorldMatrix(true, true)
    return result
  }
}

/**
 * True when headlamp meshes sit opposite the axle-forward vector (visual nose ≠ rig nose).
 * Uses the same lamp classifier as vehicle lights (material + node names).
 */
function bodyFacesOppositeAxles(root: Object3D, axleForward: Vector3, axleCentre: Vector3): boolean {
  const f = axleForward.clone().setY(0)
  if (f.lengthSq() < 1e-8) return false
  f.normalize()

  let frontAlong = 0
  let frontWeight = 0
  let rearAlong = 0
  let rearWeight = 0

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const matName = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m?.name || '').join(' ')
      : mesh.material?.name || ''
    const group = lampGroupForNames(mesh.name || '', mesh.parent?.name || '', matName)
    const front = group === 'lowBeam' || group === 'highBeam' || group === 'drl'
    const rear = group === 'tail' || group === 'brake' || group === 'reverse'
    if (!front && !rear) return
    if (isLetterLikeMesh(mesh)) return
    // Prefer geometry centre — Sketchfab letter meshes often have an offset origin.
    if (mesh.geometry) {
      mesh.geometry.computeBoundingSphere()
      const c = mesh.geometry.boundingSphere?.center
      if (c) {
        _probe.copy(c)
        mesh.localToWorld(_probe)
      } else {
        mesh.getWorldPosition(_probe)
      }
    } else {
      mesh.getWorldPosition(_probe)
    }
    const along = _probe.x * f.x + _probe.z * f.z - (axleCentre.x * f.x + axleCentre.z * f.z)
    if (front) {
      frontAlong += along
      frontWeight += 1
    }
    if (rear) {
      rearAlong += along
      rearWeight += 1
    }
  })

  if (frontWeight > 0) {
    // Headlamps behind the axle mid-point ⇒ body faces opposite the rig forward.
    return frontAlong / frontWeight < -0.05
  }
  if (rearWeight > 0) {
    // Taillights ahead of mid-point ⇒ same mismatch.
    return rearAlong / rearWeight > 0.05
  }
  return false
}
