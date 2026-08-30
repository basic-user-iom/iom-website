import { Box3, Matrix4, Quaternion, Raycaster, Vector3 } from 'three'
import { DEBUG } from '../config/debug.js'
import { HARP_PART } from './harpParts.js'

export const ADDON_ANCHOR_REV = 16

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

function surfaceAnchor(
  mesh,
  box,
  size,
  yRatio,
  zRatio,
  accepted = HARP_PART.wood,
  minNormalX = 0.3,
) {
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
    if (normal.x < minNormalX || Math.abs(normal.y) > 0.72) continue
    return {
      position: hit.point.clone(),
      normal,
      quaternion: quatFacingOut(normal),
    }
  }
  return null
}

function firstSurfaceAnchor(mesh, box, size, candidates, minNormalX = 0.82) {
  for (const [y, z] of candidates) {
    const anchor = surfaceAnchor(mesh, box, size, y, z, HARP_PART.wood, minNormalX)
    if (anchor) return anchor
  }
  return null
}

function backSurfaceAnchor(
  mesh,
  box,
  size,
  yRatio,
  zRatio,
  accepted = HARP_PART.wood,
  minNormalX = 0.82,
) {
  const pad = Math.max(size.x, size.y, size.z) * 0.8
  const origin = new Vector3(
    box.min.x - pad,
    box.min.y + size.y * yRatio,
    box.min.z + size.z * zRatio,
  )
  const direction = new Vector3(1, 0, 0)
  const raycaster = new Raycaster(origin, direction)

  for (const hit of raycaster.intersectObject(mesh, true)) {
    if (!hit.face || hitPart(hit) !== accepted) continue
    const normal = worldNormal(hit, direction)
    if (normal.x > -minNormalX || Math.abs(normal.y) > 0.72) continue
    return {
      position: hit.point.clone(),
      normal,
      quaternion: quatFacingOut(normal),
    }
  }
  return null
}

function firstBackSurfaceAnchor(mesh, box, size, candidates, minNormalX = 0.82) {
  for (const [y, z] of candidates) {
    const anchor = backSurfaceAnchor(mesh, box, size, y, z, HARP_PART.wood, minNormalX)
    if (anchor) return anchor
  }
  return null
}

function sideSurfaceAnchor(
  mesh,
  box,
  size,
  yRatio,
  xRatio,
  accepted = HARP_PART.wood,
  minNormalZ = 0.82,
) {
  const pad = Math.max(size.x, size.y, size.z) * 0.8
  const origin = new Vector3(
    box.min.x + size.x * xRatio,
    box.min.y + size.y * yRatio,
    box.max.z + pad,
  )
  const direction = new Vector3(0, 0, -1)
  const raycaster = new Raycaster(origin, direction)

  for (const hit of raycaster.intersectObject(mesh, true)) {
    if (!hit.face || hitPart(hit) !== accepted) continue
    const normal = worldNormal(hit, direction)
    if (normal.z < minNormalZ || Math.abs(normal.y) > 0.45) continue
    return {
      position: hit.point.clone(),
      normal,
      quaternion: quatFacingOut(normal),
    }
  }
  return null
}

function firstSideSurfaceAnchor(mesh, box, size, candidates, minNormalZ = 0.82) {
  for (const [y, x] of candidates) {
    const anchor = sideSurfaceAnchor(
      mesh,
      box,
      size,
      y,
      x,
      HARP_PART.wood,
      minNormalZ,
    )
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
 * Keep generated details effectively seated on the source mesh. The former
 * offsets were based on whole-harp percentages, which turned a render-depth
 * allowance into a visible centimetre-scale air gap at grazing angles.
 */
function surfaceClearance(size) {
  return Math.max(size.y * 0.00015, 0.00006)
}

/**
 * Position one lever per string just below that string's top endpoint. This
 * follows the real harp geometry instead of distributing decorative shapes
 * over the neck's bounding box.
 */
function findNeckLevers(mesh, box, size, endpoints) {
  const levers = []
  const flush = surfaceClearance(size)

  for (const { top, bottom } of endpoints) {
    const along = top.clone().sub(bottom).normalize()
    const intended = top.clone().lerp(bottom, 0.065)
    const yRatio = (intended.y - box.min.y) / size.y
    const zRatio = (intended.z - box.min.z) / size.z
    const surface = surfaceAnchor(mesh, box, size, yRatio, zRatio)
    if (!surface) continue

    levers.push({
      position: surface.position.addScaledVector(surface.normal, flush),
      quaternion: quatAlongSurface(surface.normal, along),
      scale: size.y * 0.014,
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
  const flush = surfaceClearance(size)
  const hotspotClearance = flush * 1.5

  const endpoints = stringEndpoints(mesh)
  const emblem = firstBackSurfaceAnchor(mesh, box, size, [
    [0.6, 0.7],
    [0.58, 0.7],
    [0.62, 0.72],
  ])
  const pickupJack = firstSideSurfaceAnchor(mesh, box, size, [
    [0.095, 0.5],
    [0.11, 0.5],
    [0.13, 0.5],
  ])
  const neck = firstSurfaceAnchor(mesh, box, size, [
    [0.78, 0.32],
    [0.76, 0.36],
    [0.8, 0.28],
  ])
  const column = firstSurfaceAnchor(mesh, box, size, [
    [0.53, 0.08],
    [0.42, 0.1],
    [0.65, 0.08],
  ])
  const soundboard = firstSurfaceAnchor(mesh, box, size, [
    [0.54, 0.7],
    [0.52, 0.68],
    [0.56, 0.72],
  ])

  return {
    size: Math.max(size.x, size.y, size.z),
    decalTarget: mesh,
    emblem: emblem
      ? {
          ...offsetAnchor(emblem, flush),
          width: size.y * 0.095,
          height: size.y * 0.04,
        }
      : null,
    pickup: pickupJack
      ? {
          jack: offsetAnchor(pickupJack, flush),
        }
      : null,
    levers: findNeckLevers(mesh, box, size, endpoints),
    hotspots: {
      soundboard: offsetAnchor(soundboard, hotspotClearance),
      neck: offsetAnchor(neck, hotspotClearance),
      column: offsetAnchor(column, hotspotClearance),
    },
  }
}
