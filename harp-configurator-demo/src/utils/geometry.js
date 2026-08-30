import { Box3, Matrix4, Quaternion, Raycaster, Vector3 } from 'three'
import { DEBUG } from '../config/debug.js'
import { HARP_PART } from './harpParts.js'

export const ADDON_ANCHOR_REV = 10

export function warnMissing(message, extra) {
  if (import.meta.env.DEV || DEBUG) {
    console.warn(`[harp-configurator] ${message}`, extra ?? '')
  }
}

export function collectMeshes(root) {
  const meshes = []
  root.traverse((child) => {
    if (child.isMesh) meshes.push(child)
  })
  return meshes
}

export function getWorldBox(object) {
  object.updateMatrix()
  object.updateMatrixWorld(true)
  return new Box3().setFromObject(object)
}

export function placeOnFloor(root) {
  root.matrixAutoUpdate = true
  const box = getWorldBox(root)
  const center = new Vector3()
  box.getCenter(center)
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y -= box.min.y
  root.updateMatrix()
  root.updateMatrixWorld(true)
  return getWorldBox(root)
}

export function analyzeHarp(root) {
  const meshes = collectMeshes(root)
  const materials = new Set()
  const hierarchy = []

  root.traverse((child) => {
    hierarchy.push({
      name: child.name || '(unnamed)',
      type: child.type,
      mesh: Boolean(child.isMesh),
    })
    if (child.isMesh) {
      const list = Array.isArray(child.material) ? child.material : [child.material]
      list.forEach((material) => {
        if (material?.name) materials.add(material.name)
      })
    }
  })

  const box = getWorldBox(root)
  const size = new Vector3()
  box.getSize(size)

  return {
    meshes,
    meshNames: meshes.map((mesh) => mesh.name || '(unnamed)'),
    materials: [...materials],
    hierarchy,
    box,
    size,
  }
}

function worldNormal(hit, incomingDirection) {
  const normal = hit.face.normal.clone()
  normal.transformDirection(hit.object.matrixWorld).normalize()
  if (normal.dot(incomingDirection) > 0) normal.negate()
  return normal
}

function quatFacingOut(normal) {
  const n = normal.clone().normalize()
  const upGuess = Math.abs(n.y) > 0.82 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const tangent = new Vector3().crossVectors(upGuess, n)
  if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0)
  tangent.normalize()
  const bitangent = new Vector3().crossVectors(n, tangent).normalize()
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(tangent, bitangent, n))
}

function hitPart(hit) {
  const attribute = hit.object.geometry?.getAttribute('harpPart')
  if (!attribute || !hit.face) return null
  const { a, b, c } = hit.face
  return Math.round((attribute.getX(a) + attribute.getX(b) + attribute.getX(c)) / 3)
}

function surfaceAnchor(mesh, box, size, yRatio, zRatio, accepted = HARP_PART.wood) {
  const pad = Math.max(size.x, size.y, size.z) * 0.8
  const origin = new Vector3(
    box.max.x + pad,
    box.min.y + size.y * yRatio,
    box.min.z + size.z * zRatio,
  )
  const direction = new Vector3(-1, 0, 0)
  const raycaster = new Raycaster(origin, direction)

  for (const hit of raycaster.intersectObject(mesh, true)) {
    if (!hit.face || hitPart(hit) !== accepted) continue
    const normal = worldNormal(hit, direction)
    if (normal.x < 0.3 || Math.abs(normal.y) > 0.72) continue
    return {
      position: hit.point.clone(),
      normal,
      quaternion: quatFacingOut(normal),
    }
  }
  return null
}

function firstSurfaceAnchor(mesh, box, size, candidates) {
  for (const [y, z] of candidates) {
    const anchor = surfaceAnchor(mesh, box, size, y, z)
    if (anchor) return anchor
  }
  return null
}

function averageEndpoint(mesh, component, top) {
  const position = mesh.geometry.getAttribute('position')
  const localRange = component.max[1] - component.min[1]
  const extreme = top ? component.max[1] : component.min[1]
  const tolerance = Math.max(localRange * 0.018, 1e-5)
  const result = new Vector3()
  const vertex = new Vector3()
  let count = 0

  for (const index of component.vertices) {
    const y = position.getY(index)
    if (top ? extreme - y > tolerance : y - extreme > tolerance) continue
    vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
    result.add(vertex)
    count += 1
  }
  return count ? result.multiplyScalar(1 / count) : null
}

function stringEndpoints(mesh) {
  const components = mesh.geometry.userData.harpPartComponents ?? []
  return components
    .filter((component) => component.part === HARP_PART.string)
    .map((component) => ({
      top: averageEndpoint(mesh, component, true),
      bottom: averageEndpoint(mesh, component, false),
    }))
    .filter(({ top, bottom }) => top && bottom && top.distanceToSquared(bottom) > 1e-6)
    .sort((a, b) => a.top.z - b.top.z)
}

function quatAlongSurface(normal, direction) {
  const zAxis = normal.clone().normalize()
  const yAxis = direction.clone().addScaledVector(zAxis, -direction.dot(zAxis))
  if (yAxis.lengthSq() < 1e-8) yAxis.set(0, 1, 0)
  yAxis.normalize()
  const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize()
  yAxis.crossVectors(zAxis, xAxis).normalize()
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis))
}

/**
 * Position one lever per string just below that string's top endpoint. This
 * follows the real harp geometry instead of distributing decorative shapes
 * over the neck's bounding box.
 */
function findNeckLevers(mesh, box, size, endpoints) {
  const levers = []
  const flush = Math.max(size.y * 0.0025, 0.0008)

  for (const { top, bottom } of endpoints) {
    const along = top.clone().sub(bottom).normalize()
    const intended = top.clone().lerp(bottom, 0.057)
    const yRatio = (intended.y - box.min.y) / size.y
    const zRatio = (intended.z - box.min.z) / size.z
    const surface = surfaceAnchor(mesh, box, size, yRatio, zRatio)
    if (!surface) continue

    levers.push({
      position: surface.position.addScaledVector(surface.normal, flush),
      quaternion: quatAlongSurface(surface.normal, along),
      scale: size.y * 0.023,
      stringPoint: intended,
    })
  }
  return levers
}

function offsetAnchor(anchor, amount) {
  if (!anchor) return null
  return {
    ...anchor,
    position: anchor.position.clone().addScaledVector(anchor.normal, amount),
  }
}

function stringHotspot(endpoints, box, size) {
  if (!endpoints.length) return null
  const targetZ = box.min.z + size.z * 0.52
  const string = endpoints.reduce((best, candidate) =>
    Math.abs(candidate.top.z - targetZ) < Math.abs(best.top.z - targetZ) ? candidate : best,
  )
  const position = string.top.clone().lerp(string.bottom, 0.54)
  const normal = new Vector3(1, 0, 0)
  position.addScaledVector(normal, size.x * 0.035)
  return { position, normal, quaternion: quatFacingOut(normal) }
}

/**
 * Resolve optional parts and interaction markers against the fitted model. The
 * broad presentation face of this source asset points toward +X.
 */
export function findAddOnAnchors(root) {
  const mesh = collectMeshes(root)[0]
  if (!mesh) return null
  root.updateMatrixWorld(true)
  mesh.updateMatrixWorld(true)
  const box = getWorldBox(root)
  const size = new Vector3()
  box.getSize(size)
  const flush = Math.max(size.y * 0.0013, 0.00045)

  const endpoints = stringEndpoints(mesh)
  const emblem = firstSurfaceAnchor(mesh, box, size, [
    [0.43, 0.76],
    [0.48, 0.73],
    [0.37, 0.79],
  ])
  const carving = firstSurfaceAnchor(mesh, box, size, [
    [0.43, 0.76],
    [0.48, 0.73],
    [0.37, 0.79],
  ])
  const pickupSensor = firstSurfaceAnchor(mesh, box, size, [
    [0.36, 0.68],
    [0.42, 0.62],
    [0.31, 0.74],
  ])
  const pickupJack = firstSurfaceAnchor(mesh, box, size, [
    [0.12, 0.56],
    [0.1, 0.66],
    [0.16, 0.48],
  ])
  const neck = firstSurfaceAnchor(mesh, box, size, [
    [0.89, 0.46],
    [0.86, 0.55],
    [0.92, 0.36],
  ])
  const column = firstSurfaceAnchor(mesh, box, size, [
    [0.53, 0.92],
    [0.42, 0.88],
    [0.65, 0.95],
  ])
  const soundboard = firstSurfaceAnchor(mesh, box, size, [
    [0.38, 0.72],
    [0.46, 0.66],
    [0.29, 0.78],
  ])

  return {
    size: Math.max(size.x, size.y, size.z),
    emblem: emblem
      ? {
          ...offsetAnchor(emblem, size.y * 0.012),
          width: size.y * 0.048,
          height: size.y * 0.058,
        }
      : null,
    carving: carving
      ? {
          ...offsetAnchor(carving, flush * 0.7),
          width: size.y * 0.078,
          height: size.y * 0.24,
        }
      : null,
    pickup: pickupSensor
      ? {
          sensor: offsetAnchor(pickupSensor, size.y * 0.004),
          jack: pickupJack ? offsetAnchor(pickupJack, size.y * 0.004) : null,
        }
      : null,
    levers: findNeckLevers(mesh, box, size, endpoints),
    hotspots: {
      soundboard: offsetAnchor(soundboard, size.y * 0.008),
      strings: stringHotspot(endpoints, box, size),
      neck: offsetAnchor(neck, size.y * 0.008),
      column: offsetAnchor(column, size.y * 0.008),
    },
  }
}
