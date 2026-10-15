import { Box3, Sphere, Vector3, type Object3D } from 'three'

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()
const _sphere = new Sphere()

export type SceneBounds = {
  box: Box3
  size: Vector3
  center: Vector3
  sphere: Sphere
  radius: number
  maxDim: number
}

export function computeSceneBounds(root: Object3D): SceneBounds {
  _box.setFromObject(root)
  if (_box.isEmpty()) {
    _box.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1))
  }
  _box.getSize(_size)
  _box.getCenter(_center)
  _box.getBoundingSphere(_sphere)

  const maxDim = Math.max(_size.x, _size.y, _size.z, 0.001)
  return {
    box: _box.clone(),
    size: _size.clone(),
    center: _center.clone(),
    sphere: _sphere.clone(),
    radius: Math.max(_sphere.radius, 0.001),
    maxDim,
  }
}

export function nearFarFromBounds(bounds: SceneBounds): { near: number; far: number } {
  // Keep the depth range tight — wide near/far causes plaza z-fighting on large campuses.
  const near = Math.max(0.05, Math.min(1, bounds.radius * 0.0008))
  const far = Math.max(bounds.radius * 5, bounds.maxDim * 2.5, 80)
  return { near, far }
}
