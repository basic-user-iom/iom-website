import { Vector3 } from 'three'

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

const FRAMED_VIEWS = {
  hero: {
    position: [0.8188, 1.0558, -0.5247],
    target: [0, 0.2823, 0],
  },
  front: {
    position: [1.4572, 0.3864, 0.1041],
    target: [0, 0.2823, 0],
  },
  side: {
    position: [0.002, 0.7298, -1.3887],
    target: [0, 0.2823, 0],
  },
  rear: {
    position: [-0.9568, 0.3864, -1.1039],
    target: [0, 0.2823, 0],
  },
  detail: {
    position: [0.518, 0.63, -0.055],
    target: [0, 0.515, -0.055],
  },
}

/**
 * Product-photography camera placements. Hero / Front / Side / Detail are framed
 * by hand; orbit limits still follow the fitted bounding box.
 */
export function createCameraRig(bbox, _aspect = 1.4, hotspotAnchors = {}) {
  const size = new Vector3()
  const center = new Vector3()
  bbox.getSize(size)
  bbox.getCenter(center)

  const maxDim = Math.max(size.x, size.y, size.z)
  const hero = FRAMED_VIEWS.hero
  const look = hero.target
  const target = new Vector3(look[0], look[1], look[2])
  const floorY = bbox.min.y

  const intro = {
    position: [
      look[0] + (hero.position[0] - look[0]) * 1.12,
      look[1] + (hero.position[1] - look[1]) * 1.08,
      look[2] + (hero.position[2] - look[2]) * 1.12,
    ],
    target: [...look],
  }

  return {
    size,
    center,
    target,
    maxDim,
    floorY,
    minDistance: maxDim * 0.72,
    maxDistance: maxDim * 4.6,
    minPolar: 0.18,
    maxPolar: Math.PI / 2 - 0.04,
    views: {
      intro,
      hero: FRAMED_VIEWS.hero,
      front: FRAMED_VIEWS.front,
      side: FRAMED_VIEWS.side,
      rear: FRAMED_VIEWS.rear,
      detail: FRAMED_VIEWS.detail,
    },
    hotspots: hotspotAnchors,
  }
}

export function focusFromHotspot(id, rig) {
  const anchor = rig.hotspots[id]
  if (!anchor?.position) return rig.views.hero
  const point = anchor.position
  const normal = anchor.normal?.clone?.().normalize() ?? new Vector3(1, 0, 0)
  const dist = rig.maxDim * 0.68
  const cameraPoint = point.clone().addScaledVector(normal, dist)
  cameraPoint.y += dist * 0.1
  return {
    position: cameraPoint.toArray(),
    target: [point.x, point.y, point.z],
  }
}

export const FRAMEABLE_VIEWS = ['hero', 'front', 'side', 'rear', 'detail']

export function roundPose(pose, digits = 4) {
  const n = (value) => Number(value.toFixed(digits))
  return {
    position: pose.position.map(n),
    target: pose.target.map(n),
  }
}

export function resolveViewPose(rig, view, overrides = {}) {
  return overrides[view] ?? rig?.views?.[view] ?? rig?.views?.hero ?? null
}

export function formatCameraOverrides(poses) {
  const lines = ['HARP CAMERA FRAMING', '']
  for (const id of FRAMEABLE_VIEWS) {
    const pose = poses[id]
    if (!pose) continue
    const p = roundPose(pose)
    lines.push(`${id}:`)
    lines.push(`  position: [${p.position.join(', ')}]`)
    lines.push(`  target: [${p.target.join(', ')}]`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
