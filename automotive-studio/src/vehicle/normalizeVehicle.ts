import { Box3, Group, Object3D, Vector3 } from 'three'
import { measureCarBounds } from '../assets/analyzeAsset'

export type AxisId = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'

export type VehicleNormalization = {
  /** Target length along current forward axis, metres. Null = keep source scale. */
  targetLengthMetres: number | null
  uniformScale: number
  forwardAxis: AxisId
  upAxis: AxisId
  groundOffsetMetres: number
  flip180: boolean
}

export type VehicleRoots = {
  placement: Group
  normalization: Group
  action: Group
  model: Object3D
}

export function createVehicleRoots(model: Object3D, name = 'Active Vehicle'): VehicleRoots {
  const placement = new Group()
  placement.name = 'VehiclePlacementRoot'
  const normalization = new Group()
  normalization.name = 'VehicleNormalizationRoot'
  const action = new Group()
  action.name = 'VehicleActionRoot'
  model.name = model.name || 'VehicleModel'
  model.userData.iomBindLocal = {
    position: model.position.clone(),
    rotation: model.rotation.clone(),
    scale: model.scale.clone(),
  }

  action.add(model)
  normalization.add(action)
  placement.add(normalization)
  placement.userData.iomRole = 'active-vehicle'
  placement.userData.iomLabel = name
  return { placement, normalization, action, model }
}

export function applyNormalization(roots: VehicleRoots, settings: VehicleNormalization) {
  const { placement, normalization, model } = roots

  // Normalize at stage origin so world AABBs match model-local metres. Free-drive
  // leaves placement at hundreds of metres — subtracting that from model.position
  // permanently corrupts the rig and beam seats.
  const savedPos = placement.position.clone()
  const savedRot = placement.rotation.clone()
  placement.position.set(0, 0, 0)
  placement.rotation.set(0, 0, 0)

  normalization.position.set(0, 0, 0)
  normalization.rotation.set(0, 0, 0)
  normalization.scale.set(1, 1, 1)

  const bind = model.userData.iomBindLocal as
    | { position: Vector3; rotation: { x: number; y: number; z: number }; scale: Vector3 }
    | undefined
  if (bind) {
    model.position.copy(bind.position)
    model.rotation.set(bind.rotation.x, bind.rotation.y, bind.rotation.z)
    model.scale.copy(bind.scale)
  }

  model.updateWorldMatrix(true, true)

  const bounds = measureCarBounds(model)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())

  const groundY = bounds.min.y
  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y -= groundY

  let scale = settings.uniformScale
  if (settings.targetLengthMetres && settings.targetLengthMetres > 0) {
    const lengthAxis = axisSize(size, settings.forwardAxis)
    if (lengthAxis > 1e-6) scale = settings.targetLengthMetres / lengthAxis
  }
  normalization.scale.setScalar(scale)

  applyAxisOrientation(normalization, settings.forwardAxis, settings.upAxis, settings.flip180)

  // Re-centre XZ + ground Y in placement space after scale/yaw.
  recentrePlacement(roots, settings.groundOffsetMetres)

  placement.position.copy(savedPos)
  placement.rotation.copy(savedRot)
  placement.updateWorldMatrix(true, true)
}

/** Keep the grounded car near placement origin (metres), even after axis remap. */
export function recentrePlacement(roots: VehicleRoots, groundOffsetMetres = 0) {
  const { placement, normalization } = roots
  placement.updateWorldMatrix(true, true)
  const after = measureCarBounds(placement)
  if (after.isEmpty()) return
  const center = after.getCenter(new Vector3())
  // Convert world centre → placement-local so free-drive offsets cancel out.
  placement.worldToLocal(center)
  normalization.position.x -= center.x
  normalization.position.z -= center.z
  normalization.updateWorldMatrix(true, true)
  const grounded = measureCarBounds(placement)
  if (grounded.isEmpty()) return
  const min = grounded.min.clone()
  placement.worldToLocal(min)
  normalization.position.y += -min.y + groundOffsetMetres
}

function axisSize(size: Vector3, axis: AxisId): number {
  if (axis === '+x' || axis === '-x') return size.x
  if (axis === '+y' || axis === '-y') return size.y
  return size.z
}

function applyAxisOrientation(
  target: Object3D,
  forward: AxisId,
  up: AxisId,
  flip180: boolean,
) {
  // Simple automotive defaults: many Sketchfab cars are Y-up with various forward axes.
  // We rotate the normalization root; we do not bake into animated nodes.
  target.rotation.set(0, 0, 0)

  const yawForForward: Record<AxisId, number> = {
    '+z': 0,
    '-z': Math.PI,
    '+x': -Math.PI / 2,
    '-x': Math.PI / 2,
    '+y': 0,
    '-y': 0,
  }
  target.rotation.y = yawForForward[forward] + (flip180 ? Math.PI : 0)

  if (up === '+z') target.rotation.x = -Math.PI / 2
  else if (up === '-z') target.rotation.x = Math.PI / 2
  else if (up === '-y') target.rotation.z = Math.PI
}

export function defaultNormalizationFromBounds(size: Vector3): VehicleNormalization {
  const longest = Math.max(size.x, size.y, size.z)
  // Lixiang-like centimetre assets (~5m car ≈ 500 units) → target 5.1m length.
  const looksLikeCm = longest > 20
  return {
    targetLengthMetres: looksLikeCm ? 5.1 : longest > 1.5 ? longest : 5.1,
    uniformScale: 1,
    forwardAxis: '+z',
    upAxis: '+y',
    groundOffsetMetres: 0,
    flip180: false,
  }
}

export function measuredLengthMetres(roots: VehicleRoots): {
  length: number
  width: number
  height: number
} {
  roots.placement.updateWorldMatrix(true, true)
  const box = measureCarBounds(roots.placement)
  const size = box.getSize(new Vector3())
  // After orientation, length ≈ Z, width ≈ X, height ≈ Y for our convention.
  return { length: size.z, width: size.x, height: size.y }
}

export function frameCameraToObject(
  camera: { position: Vector3; lookAt: (x: number, y: number, z: number) => void; updateProjectionMatrix?: () => void },
  object: Object3D,
  controls?: { target: Vector3; update: () => void } | null,
) {
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const radius = Math.max(size.x, size.y, size.z) * 0.6 + 0.5
  camera.position.set(center.x + radius * 1.4, center.y + radius * 0.55, center.z + radius * 1.6)
  camera.lookAt(center.x, center.y + size.y * 0.15, center.z)
  camera.updateProjectionMatrix?.()
  if (controls) {
    controls.target.set(center.x, center.y + size.y * 0.15, center.z)
    controls.update()
  }
}
