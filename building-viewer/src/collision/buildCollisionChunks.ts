import {
  Box3,
  BufferGeometry,
  InstancedMesh,
  Mesh,
  SkinnedMesh,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  analyzeStairSupport,
  inferStairAscent,
  inferStairAscentFromTreads,
  makeStairProxyGeometry,
} from './stairGeometry'

const CELL_SIZE = 12
const Y_BAND = 4
const TRI_BUDGET = 900_000

/** Must keep for walk — never dropped by the triangle budget. */
const WALK_SURFACE_NAME =
  /floor|stairs?|steps?|ground|slab|ramp|landing|tread|riser|plaza|terrain|walkway|path|pavement|sidewalk|kerb|curb|platform|lobby|foyer|corridor|hallway|mezzanine|galerie|gallery|storey|geschoss|etage|flur|diele|gang|treppe|stufen?|podest|boden|lauf_treppe|etagentreppe|laufband|rolltreppe|escalator|tile|fliese|\.bt\d?|(?<![a-z])deck(?![a-z])/i

/**
 * Handrails / balustrades — checked BEFORE walk names so `Treppe_handlauf`
 * is not treated as a climbable tread (that blocks mid-stair walk-up).
 */
const RAILING_NAME =
  /handlauf|handrail|geländer|gelander|gelnder|balustrade|baluster|railing|banister|guardrail|griffe?|door.?handle|tuergriff|türgriff|gitter|grille/i

/** Stair hardware that matches `treppe` in the material name but is not a tread. */
const STAIR_DETAIL_SKIP =
  /gitter|grille|gelnd|unterbau|sockel|schraube|trager|träger|sign[_\\s-]?red|sign[_\\s-]?gruen/i

const WALL_NAME =
  /wall|column|pillar|beam|corridor|railing|balustrade|wand|pfeiler|geländer|gelander|handlauf/i

/** Never use for walking collision (glass, decor, ceilings, fixtures). */
const SKIP_COLLISION_NAME =
  /glass|window|glazing|fenster|scheib|sign|schild|light|lamp|furniture|chair|(?:^|[^a-z])stuhl(?:$|[^a-z])|(?:^|[^a-z])sitz(?:$|[^a-z])|table|desk|sofa|plant|foliage|curtain|decal|logo|icon|screen|monitor|speaker|sprecher|sprinkler|decke|ceiling|soffit|abgehaengte|abhäng|abhang|fixture|cabinet|shelf|bookshelf|handrail.?detail|ornament|sculpture|artwork|picture|frame(?!work)|ausstellung|grundriss|lageplan|floorplan|bim[\s._-]?world|baum_position|^plane001(\.|$)|gebude_123|bt3_innenwaende|tu_(?:links|rechts)_hinten/i

const COLLIDER_NAME = /^COLLIDER_/i
const NO_WALK_NAME = /^NO_WALK_/i

/** Strip COLLIDER_ prefix so name heuristics still see `treppe_handlauf`. */
function classifyName(raw: string): string {
  return raw.replace(/^COLLIDER_/i, '')
}

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()

export type CollisionChunkSource = {
  geometry: BufferGeometry
  box: Box3
  triangles: number
  name: string
  /** Stair assemblies stay in dedicated chunks and get extra Y activation pad. */
  stairZone?: boolean
  /** Raycast both windings (for exact open bridge-grating supplements). */
  doubleSided?: boolean
  /** Original meshes merged into this chunk (used to prevent proxy duplication). */
  sourceNames?: string[]
}

export type CollisionCandidateLog = {
  name: string
  material: string
  triangles: number
  bounds: { min: [number, number, number]; max: [number, number, number] }
  reason: string
}

export type CollisionBuildReport = {
  layerHint?: string
  sourceMeshes: number
  usedMeshes: number
  skippedMeshes: number
  chunks: number
  triangles: number
  preferredColliders: boolean
  ms: number
  boundsMin: [number, number, number] | null
  boundsMax: [number, number, number] | null
  selected: CollisionCandidateLog[]
  skipped: CollisionCandidateLog[]
}

type Candidate = {
  mesh: Mesh
  dedicated: boolean
  triangles: number
  footprint: number
  walkSurface: boolean
  wallLike: boolean
  box: Box3
  reason: string
}

function triangleCount(geom: BufferGeometry): number {
  const index = geom.getIndex()
  if (index) return index.count / 3
  const pos = geom.getAttribute('position')
  return pos ? pos.count / 3 : 0
}

function isCadOverlayMesh(obj: Object3D): boolean {
  let p: Object3D | null = obj
  while (p) {
    if (p.userData?.cadOverlay) return true
    p = p.parent
  }
  return false
}

function isAncestorVisible(obj: Object3D): boolean {
  let p: Object3D | null = obj
  while (p) {
    if (!p.visible) return false
    p = p.parent
  }
  return true
}

function matNames(mesh: Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return mats
    .map((m) => (m as Material | null)?.name || '')
    .filter(Boolean)
    .join('|')
}

function logBounds(box: Box3): { min: [number, number, number]; max: [number, number, number] } {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  }
}

function cellKey(x: number, y: number, z: number): string {
  const cx = Math.floor(x / CELL_SIZE)
  const cy = Math.floor(y / Y_BAND)
  const cz = Math.floor(z / CELL_SIZE)
  return `${cx}|${cy}|${cz}`
}

function isStairLabel(label: string): boolean {
  if (RAILING_NAME.test(label) || STAIR_DETAIL_SKIP.test(label)) return false
  return /stair|step|tread|riser|landing|treppe|stufe|stufen|podest|laufband|rolltreppe|escalator/i.test(
    label,
  )
}

function prepareWorldCollisionGeometry(mesh: Mesh): BufferGeometry | null {
  mesh.updateWorldMatrix(true, false)
  const src = mesh.geometry
  if (!src?.getAttribute('position')) return null

  // Always non-indexed so mergeGeometries cannot fail on mixed index state.
  let geo = src.index ? src.toNonIndexed() : src.clone()
  for (const attr of Object.keys(geo.attributes)) {
    if (attr !== 'position') geo.deleteAttribute(attr)
  }
  geo.applyMatrix4(mesh.matrixWorld)
  geo.computeBoundingBox()

  const pos = geo.getAttribute('position')
  if (!pos || pos.count < 3) {
    geo.dispose()
    return null
  }
  return geo
}

/**
 * Extract walk geometry from a model root (call BEFORE visual packing).
 * Prefers COLLIDER_* / userData.collisionOnly meshes when present;
 * otherwise floors/stairs/walls only (no furniture/decor fallback).
 */
export function buildCollisionChunks(
  root: Object3D,
  options?: {
    layerId?: string
    verbose?: boolean
    ignoreVisibility?: boolean
    /** After instancing/batching, allow extracting from packed meshes. */
    includeProcedural?: boolean
    /** Floors/stairs/large slabs only — no walls (for visual fill under dedicated). */
    walkSurfacesOnly?: boolean
    /** Restrict extraction to a caller-authored mesh subset. */
    includeMesh?: (mesh: Mesh) => boolean
    /** Bypass generic grille/decor rejection for an explicitly authored deck. */
    isExplicitWalkable?: (mesh: Mesh) => boolean
    /** Mark emitted chunks for double-sided collision raycasts. */
    doubleSided?: boolean
  },
): {
  chunks: CollisionChunkSource[]
  report: CollisionBuildReport
} {
  const t0 = performance.now()
  const verbose = options?.verbose !== false
  // Collision extract must work even when the render layer is temporarily hidden.
  const ignoreVisibility = options?.ignoreVisibility !== false
  // The exterior proxy contains known campus-scale CAD volumes mislabeled as
  // inferred walk surfaces. Animated collision has an approved coverage pin,
  // so apply this model-specific cleanup only to the affected exterior layer.
  const strictBroadVolumeFilter = options?.layerId?.startsWith('icm-ext') === true
  root.updateMatrixWorld(true)

  const colliderTagged: Candidate[] = []
  const candidates: Candidate[] = []
  const skipped: CollisionCandidateLog[] = []

  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    if ((obj as SkinnedMesh).isSkinnedMesh) return
    const mesh = obj as Mesh
    if (!mesh.geometry?.getAttribute('position')) return
    if (options?.includeMesh && !options.includeMesh(mesh)) return
    if (
      !ignoreVisibility &&
      !isAncestorVisible(mesh) &&
      !mesh.userData?.collisionOnly &&
      !COLLIDER_NAME.test(mesh.name || '')
    ) {
      return
    }
    const name = mesh.name || ''
    const label = classifyName(name)
    const parentName = mesh.parent?.name || ''
    const material = matNames(mesh)
    const pathLabel = `${label} ${parentName}`
    const explicitWalkable = Boolean(options?.isExplicitWalkable?.(mesh))

    if (NO_WALK_NAME.test(name) || NO_WALK_NAME.test(label)) {
      skipped.push({
        name,
        material,
        triangles: triangleCount(mesh.geometry),
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
        reason: 'NO_WALK_',
      })
      return
    }
    if (isCadOverlayMesh(mesh)) {
      skipped.push({
        name,
        material,
        triangles: triangleCount(mesh.geometry),
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
        reason: 'cad-overlay',
      })
      return
    }
    if (mesh.userData?.proceduralInstanced || mesh.userData?.proceduralBatched) {
      if (!options?.includeProcedural) return
    }

    if (strictBroadVolumeFilter && (mesh as InstancedMesh).isInstancedMesh) {
      // A Mesh world matrix does not include EXT_mesh_gpu_instancing instance
      // transforms. Treating it as an ordinary Mesh collapses remote geometry
      // around the origin in the affected exterior proxy (the former invisible
      // 300x10x300 m Y=10 platform). Other validated proxy layers retain their
      // pinned geometry until their instances are explicitly flattened offline.
      skipped.push({
        name,
        material,
        triangles: triangleCount(mesh.geometry) * (mesh as InstancedMesh).count,
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
        reason: 'instanced collision requires flattened proxy',
      })
      return
    }

    const tris = triangleCount(mesh.geometry)
    if (tris < 1) return

    _box.setFromObject(mesh)
    if (_box.isEmpty()) return
    _box.getSize(_size)
    const footprint = Math.max(0, _size.x) * Math.max(0, _size.z)
    const thin =
      _size.y <= Math.max(_size.x, _size.z) * 0.08 + 0.5 &&
      (!strictBroadVolumeFilter || _size.y <= 1.25)
    const largeHorizontal = thin && footprint >= 2

    const semanticWalk =
      explicitWalkable ||
      WALK_SURFACE_NAME.test(pathLabel) ||
      WALK_SURFACE_NAME.test(material) ||
      isStairLabel(`${pathLabel} ${material}`)
    const suspiciousBroadVolume =
      strictBroadVolumeFilter &&
      !semanticWalk &&
      footprint >= 20_000 &&
      _size.y >= 2
    if (suspiciousBroadVolume) {
      skipped.push({
        name,
        material,
        triangles: tris,
        bounds: logBounds(_box),
        reason: 'exterior broad-volume phantom',
      })
      return
    }
    const isDedicated =
      COLLIDER_NAME.test(name) || Boolean(mesh.userData?.collisionOnly || mesh.userData?.collisionMesh)

    // Railings / handles / grilles — even COLLIDER_* and names like Treppe_handlauf.
    // Keeping them as walk surfaces blocks mid-stair climb.
    if (
      !explicitWalkable &&
      (RAILING_NAME.test(pathLabel) ||
        RAILING_NAME.test(material) ||
        STAIR_DETAIL_SKIP.test(pathLabel) ||
        STAIR_DETAIL_SKIP.test(material))
    ) {
      skipped.push({
        name,
        material,
        triangles: tris,
        bounds: logBounds(_box),
        reason: 'railing/handle skip',
      })
      return
    }

    if (
      !explicitWalkable &&
      (SKIP_COLLISION_NAME.test(pathLabel) || SKIP_COLLISION_NAME.test(material))
    ) {
      skipped.push({
        name,
        material,
        triangles: tris,
        bounds: logBounds(_box),
        reason: 'decorative/glass skip',
      })
      return
    }

    const namedWalk = semanticWalk
    const namedWall = WALL_NAME.test(pathLabel) || WALL_NAME.test(material)
    // Dedicated proxies still need name/shape classification — otherwise every
    // COLLIDER_* wall/fixture becomes a walk surface and stairs get blocked.
    const walkSurface = namedWalk || largeHorizontal
    const wallLike = namedWall || (!thin && _size.y > 1.2)

    const entry: Candidate = {
      mesh,
      dedicated: isDedicated,
      triangles: tris,
      footprint,
      walkSurface,
      wallLike,
      box: _box.clone(),
      reason: explicitWalkable
        ? 'explicit-walk-surface'
        : isDedicated
        ? walkSurface
          ? 'COLLIDER_* walk'
          : wallLike
            ? 'COLLIDER_* wall'
            : 'COLLIDER_* other'
        : walkSurface
          ? largeHorizontal && !namedWalk
            ? 'large-horizontal'
            : 'walk-surface-name'
          : wallLike
            ? 'wall-like'
            : 'size-fallback',
    }

    if (isDedicated) {
      colliderTagged.push(entry)
      // Hide dedicated collider meshes from the visual pass when still in the render graph.
      mesh.userData.collisionOnly = true
      mesh.visible = false
    } else {
      candidates.push(entry)
    }
  })

  const preferredColliders = colliderTagged.length > 0
  let pool: Candidate[] = []
  const walkSurfacesOnly = Boolean(options?.walkSurfacesOnly)

  if (preferredColliders && !walkSurfacesOnly) {
    // Dedicated COLLIDER_* can be huge (walls, fixtures). Prefer walk-like meshes
    // first so interior floors stay when triangle budget kicks in.
    const dedicatedWalk: Candidate[] = []
    const dedicatedOther: Candidate[] = []
    for (const c of colliderTagged) {
      c.box.getSize(_size)
      const footprint = Math.max(0, _size.x) * Math.max(0, _size.z)
      const thin =
        _size.y <= Math.max(_size.x, _size.z) * 0.08 + 0.5 &&
        (!strictBroadVolumeFilter || _size.y <= 1.25)
      const nameWalk = WALK_SURFACE_NAME.test(
        `${classifyName(c.mesh.name || '')} ${c.mesh.parent?.name || ''}`,
      )
      if (c.walkSurface || nameWalk || (thin && footprint >= 4)) dedicatedWalk.push(c)
      else dedicatedOther.push(c)
    }
    pool = [...dedicatedWalk]
    let total = pool.reduce((s, c) => s + c.triangles, 0)
    dedicatedOther.sort((a, b) => b.triangles - a.triangles)
    for (const c of dedicatedOther) {
      if (total + c.triangles > TRI_BUDGET && pool.length > 40) {
        skipped.push({
          name: c.mesh.name || '(unnamed)',
          material: matNames(c.mesh),
          triangles: c.triangles,
          bounds: logBounds(c.box),
          reason: 'triangle-budget (dedicated)',
        })
        continue
      }
      pool.push(c)
      total += c.triangles
    }
  } else {
    const walkFirst = (preferredColliders ? colliderTagged : candidates).filter((c) => c.walkSurface)
    const walls = walkSurfacesOnly
      ? []
      : candidates.filter((c) => !c.walkSurface && c.wallLike)

    for (const c of candidates) {
      if (walkFirst.includes(c) || walls.includes(c)) {
        continue
      }
      skipped.push({
        name: c.mesh.name || '(unnamed)',
        material: matNames(c.mesh),
        triangles: c.triangles,
        bounds: logBounds(c.box),
        reason: walkSurfacesOnly ? 'non-walk (walkSurfacesOnly)' : 'non-structural (strict collision)',
      })
    }

    // Walk surfaces (+ walls unless walkSurfacesOnly).
    pool = [...walkFirst]
    let total = pool.reduce((s, c) => s + c.triangles, 0)
    const addLimited = (list: Candidate[]) => {
      list.sort((a, b) => b.triangles - a.triangles)
      for (const c of list) {
        if (total + c.triangles > TRI_BUDGET && pool.length > 20) {
          skipped.push({
            name: c.mesh.name || '(unnamed)',
            material: matNames(c.mesh),
            triangles: c.triangles,
            bounds: logBounds(c.box),
            reason: 'triangle-budget',
          })
          continue
        }
        pool.push(c)
        total += c.triangles
      }
    }
    addLimited(walls)
  }

  type CellBucket = { geos: BufferGeometry[]; names: string[]; stairZone: boolean }
  const byCell = new Map<string, CellBucket>()

  for (const c of pool) {
    c.box.getCenter(_center)
    c.box.getSize(_size)
    const stairLabel = `${classifyName(c.mesh.name || '')} ${c.mesh.parent?.name || ''} ${matNames(c.mesh)}`
    const stairZone = isStairLabel(stairLabel)
    const dx = c.box.max.x - c.box.min.x
    const dz = c.box.max.z - c.box.min.z
    const dy = c.box.max.y - c.box.min.y
    const maxXZ = Math.max(dx, dz)
    const minXZ = Math.min(dx, dz)
    // Only synthesize for narrow single flights. Wide U-stairs / wells
    // (foyer Mesh2148 ~12×9 m) already have tread tops around the void —
    // dual AABB proxies fill that well and block climb at floor Y.
    const thickFlight =
      stairZone &&
      dy > 0.45 &&
      maxXZ >= 1 &&
      maxXZ <= 16 &&
      minXZ <= 3.2 &&
      dx * dz <= 48
    const authoredGeometry = prepareWorldCollisionGeometry(c.mesh)
    let geo = authoredGeometry
    if (thickFlight && authoredGeometry) {
      const support = analyzeStairSupport(authoredGeometry)
      if (support.usable) {
        c.reason += c.dedicated ? ' + authored-stair-support' : ' + authored-visual-support'
      } else {
        const envelopeAscent = inferStairAscent(authoredGeometry)
        const ascent = envelopeAscent ?? inferStairAscentFromTreads(authoredGeometry)
        const proxy = ascent ? makeStairProxyGeometry(ascent) : null
        if (proxy) {
          authoredGeometry.dispose()
          geo = proxy
          const source = envelopeAscent ? 'envelope' : 'treads'
          c.reason += ` + inferred-stair-proxy:${source}(${ascent!.axis.x.toFixed(2)},${ascent!.axis.y.toFixed(2)};${ascent!.confidence.toFixed(2)})`
        } else {
          // Ambiguous single-flight geometry is safer than an AABB proxy that
          // can rise backwards or bridge a multi-flight stair well.
          c.reason += ' + stair-proxy-skipped-ambiguous'
          if (verbose) {
            console.warn(
              `[Collision] preserving ambiguous authored stair geometry: ${c.mesh.name || '(unnamed)'}`,
              {
                dedicated: c.dedicated,
                supportTriangles: support.topFacingTriangles,
                supportCoverage: Number(support.coverage.toFixed(3)),
                supportVerticalSpan: Number(support.verticalSpan.toFixed(3)),
              },
            )
          }
        }
      }
    }
    if (!geo) {
      skipped.push({
        name: c.mesh.name || '(unnamed)',
        material: matNames(c.mesh),
        triangles: c.triangles,
        bounds: logBounds(c.box),
        reason: 'invalid-geometry-after-world-bake',
      })
      continue
    }
    // Keep stair assemblies in dedicated chunks so tread/riser queries stay local.
    // Unique per mesh — duplicate CAD names (Mesh870 at two landings) must not merge.
    const key = stairZone
      ? `stair:${c.mesh.name || 'm'}_${c.mesh.uuid}`
      : cellKey(_center.x, _center.y, _center.z)

    const bucket = byCell.get(key)
    if (bucket) {
      bucket.geos.push(geo)
      bucket.names.push(c.mesh.name || '(unnamed)')
    } else {
      byCell.set(key, { geos: [geo], names: [c.mesh.name || '(unnamed)'], stairZone })
    }
  }

  const chunks: CollisionChunkSource[] = []
  const worldBounds = new Box3()

  for (const [key, bucket] of byCell) {
    const geos = bucket.geos
    let merged: BufferGeometry | null = null

    if (geos.length === 1) {
      merged = geos[0]!
    } else {
      try {
        merged = mergeGeometries(geos, false)
        if (!merged) throw new Error('mergeGeometries returned null')
      } catch (err) {
        console.warn(
          `[Collision] merge failed for ${key} (${bucket.names.join(', ')}):`,
          err instanceof Error ? err.message : err,
          '— emitting separate per-mesh chunks',
        )
        for (let i = 0; i < geos.length; i++) {
          const g = geos[i]!
          g.computeBoundingBox()
          const box = g.boundingBox?.clone() ?? new Box3()
          if (!box.isEmpty()) worldBounds.union(box)
          const tris = triangleCount(g)
          if (tris < 1) {
            g.dispose()
            continue
          }
          chunks.push({
            geometry: g,
            box,
            triangles: tris,
            name: `chunk_${key}_${i}_${bucket.names[i]}`,
            stairZone: bucket.stairZone,
            doubleSided: Boolean(options?.doubleSided),
            sourceNames: [bucket.names[i] ?? '(unnamed)'],
          })
        }
        continue
      }
      for (const g of geos) {
        if (g !== merged) g.dispose()
      }
    }

    if (!merged.getAttribute('position') || triangleCount(merged) < 1) {
      console.warn(`[Collision] empty chunk discarded: ${key}`)
      merged.dispose()
      continue
    }

    merged.computeBoundingBox()
    const box = merged.boundingBox?.clone() ?? new Box3()
    if (box.isEmpty()) {
      console.warn(`[Collision] empty AABB discarded: ${key}`)
      merged.dispose()
      continue
    }
    worldBounds.union(box)
    chunks.push({
      geometry: merged,
      box,
      triangles: triangleCount(merged),
      name: `chunk_${key}`,
      stairZone: bucket.stairZone,
      doubleSided: Boolean(options?.doubleSided),
      sourceNames: [...new Set(bucket.names)],
    })
  }

  const selected: CollisionCandidateLog[] = pool.slice(0, 80).map((c) => ({
    name: c.mesh.name || '(unnamed)',
    material: matNames(c.mesh),
    triangles: c.triangles,
    bounds: logBounds(c.box),
    reason: c.reason,
  }))

  const report: CollisionBuildReport = {
    layerHint: options?.layerId,
    sourceMeshes: preferredColliders ? colliderTagged.length : candidates.length,
    usedMeshes: pool.length,
    skippedMeshes: skipped.length,
    chunks: chunks.length,
    triangles: chunks.reduce((s, c) => s + c.triangles, 0),
    preferredColliders,
    ms: performance.now() - t0,
    boundsMin: worldBounds.isEmpty()
      ? null
      : [worldBounds.min.x, worldBounds.min.y, worldBounds.min.z],
    boundsMax: worldBounds.isEmpty()
      ? null
      : [worldBounds.max.x, worldBounds.max.y, worldBounds.max.z],
    selected,
    skipped: skipped.slice(0, 80),
  }

  if (verbose) {
    console.info(
      `[Collision] layer=${options?.layerId ?? '?'} sources=${report.sourceMeshes} used=${report.usedMeshes} chunks=${report.chunks} tris=${Math.round(report.triangles)} colliderMode=${report.preferredColliders} bounds=${JSON.stringify(report.boundsMin)}..${JSON.stringify(report.boundsMax)} (${report.ms.toFixed(0)}ms)`,
    )
    if (report.selected.some((s) => /stair|step|tread|riser|landing|floor|ground|treppe|stufe|boden|podest/i.test(s.name))) {
      console.info(
        '[Collision] walk/stair selected sample',
        report.selected.filter((s) =>
          /stair|step|tread|riser|landing|floor|ground|deck|ramp|treppe|stufe|boden|podest/i.test(
            s.name + s.reason,
          ),
        ).slice(0, 20),
      )
    }
  }

  return { chunks, report }
}
