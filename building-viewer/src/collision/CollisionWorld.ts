import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from 'three'
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  MeshBVH,
} from 'three-mesh-bvh'
import type { CapsuleQueryResult, CollisionHit, ICollisionWorld } from './types'
import type { CollisionBuildReport, CollisionChunkSource } from './buildCollisionChunks'

Mesh.prototype.raycast = acceleratedRaycast
;(BufferGeometry.prototype as BufferGeometry & { computeBoundsTree?: typeof computeBoundsTree }).computeBoundsTree =
  computeBoundsTree
;(BufferGeometry.prototype as BufferGeometry & { disposeBoundsTree?: typeof disposeBoundsTree }).disposeBoundsTree =
  disposeBoundsTree

const _raycaster = new Raycaster()
;(_raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true

// Ground probes must be able to look past a nearby non-walkable face in the
// same stair assembly (for example a nosing, soffit, or sloped trim face).
// Keep this separate from the first-hit raycaster used by ordinary picking.
const _groundRaycaster = new Raycaster()
;(_groundRaycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = false

const _localOrigin = new Vector3()
const _localEnd = new Vector3()
const _capsuleCenter = new Vector3()
const _closest = new Vector3()
const _delta = new Vector3()
const _hitPoint = new Vector3()
const _hitNormal = new Vector3()
const _resultNormal = new Vector3()
const _queryBox = new Box3()
const _rayEnd = new Vector3()
const _focus = new Vector3()
const _downGround = new Vector3(0, -1, 0)
const _bestGroundNormal = new Vector3()
const _fallbackGroundPoint = new Vector3()
const _fallbackGroundNormal = new Vector3()

export type CollisionFrameStats = {
  raycasts: number
  capsuleQueries: number
  bvhQueries: number
  chunksQueried: number
  cpuMs: number
  activeChunks: number
  residentChunks: number
  triangles: number
  residentTriangles: number
}

type ChunkCollider = {
  mesh: Mesh
  bvh: MeshBVH | null
  box: Box3
  triangles: number
  stairZone: boolean
  layerBridge: boolean
  layerId: string
  sourceName: string
  /** Squared XZ distance hysteresis latch. */
  active: boolean
}

const sharedMat = new MeshBasicMaterial({ visible: false })
const sharedDoubleSidedMat = new MeshBasicMaterial({ visible: false, side: DoubleSide })
const debugMat = new MeshBasicMaterial({
  color: 0xff3344,
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: true,
  depthWrite: false,
})

/** Default walk activation — ~4 cells of 12 m; Y pad covers ~4–5 storeys. */
const DEFAULT_ACTIVATE_RADIUS = 48
const DEFAULT_DEACTIVATE_RADIUS = 64
const DEFAULT_Y_PAD = 28

/**
 * Chunked static collision world with AABB broadphase + nearby-region activation.
 * Geometry is world-space; chunk meshes must stay at identity transform.
 */
export class CollisionWorld implements ICollisionWorld {
  /** Chunks used by ray/capsule queries (nearby subset). */
  private chunks: ChunkCollider[] = []
  /** All BVH-built chunks for visible layers. */
  private resident: ChunkCollider[] = []
  private layerChunks = new Map<string, CollisionChunkSource[]>()
  private totalTriangles = 0
  private residentTriangles = 0
  private broadphaseEnabled = true
  private regionEnabled = true
  private activateRadius = DEFAULT_ACTIVATE_RADIUS
  private deactivateRadius = DEFAULT_DEACTIVATE_RADIUS
  private yPad = DEFAULT_Y_PAD
  private forceAll = false
  private placementMode = false
  /** Null while picking; fixed to the visible surface owner while walking. */
  private queryLayerId: string | null = null
  readonly debugRoot = new Group()

  private frameRaycasts = 0
  private frameCapsules = 0
  private frameBvh = 0
  private frameChunks = 0
  private frameCpuMs = 0
  private lastBuild: CollisionBuildReport | null = null
  private debugVisible = false
  private lastFocus = new Vector3(Number.NaN, Number.NaN, Number.NaN)

  constructor() {
    this.debugRoot.name = 'CollisionDebug'
    this.debugRoot.visible = false
  }

  beginFrame(): void {
    this.frameRaycasts = 0
    this.frameCapsules = 0
    this.frameBvh = 0
    this.frameChunks = 0
    this.frameCpuMs = 0
  }

  getFrameStats(): CollisionFrameStats {
    return {
      raycasts: this.frameRaycasts,
      capsuleQueries: this.frameCapsules,
      bvhQueries: this.frameBvh,
      chunksQueried: this.frameChunks,
      cpuMs: this.frameCpuMs,
      activeChunks: this.chunks.length,
      residentChunks: this.resident.length,
      triangles: this.totalTriangles,
      residentTriangles: this.residentTriangles,
    }
  }

  getLastBuildReport(): CollisionBuildReport | null {
    return this.lastBuild
  }

  setBroadphaseEnabled(on: boolean): void {
    this.broadphaseEnabled = on
  }

  /** When false, every resident chunk stays queryable (orbit / debug). */
  setRegionActivationEnabled(on: boolean): void {
    this.regionEnabled = on
    if (!on) this.activateAll()
  }

  setActivationRadii(activate: number, deactivate = activate * 1.3, yPad = DEFAULT_Y_PAD): void {
    this.activateRadius = activate
    this.deactivateRadius = Math.max(activate, deactivate)
    this.yPad = yPad
  }

  setDebugVisible(on: boolean): void {
    this.debugVisible = on
    this.debugRoot.visible = on
    this.rebuildDebugMeshes()
  }

  isDebugVisible(): boolean {
    return this.debugVisible
  }

  setQueryLayer(layerId: string | null): void {
    this.queryLayerId = layerId
  }

  getQueryLayer(): string | null {
    return this.queryLayerId
  }

  /** Store extracted chunks for a model layer (pre-packing). */
  setLayerChunks(
    layerId: string,
    chunks: CollisionChunkSource[],
    report?: CollisionBuildReport,
    opts?: { disposeRemoved?: boolean },
  ): void {
    const prev = this.layerChunks.get(layerId)
    const keep = new Set(chunks.map((c) => c.geometry))
    const disposeRemoved = opts?.disposeRemoved !== false
    if (prev && disposeRemoved) {
      for (const src of prev) {
        if (keep.has(src.geometry)) continue
        this.disposeChunkGeometry(src)
      }
    }
    this.layerChunks.set(layerId, chunks)
    if (report) this.lastBuild = report
  }

  /** True if this layer already has extracted collision geometry. */
  hasLayerChunks(layerId: string): boolean {
    const chunks = this.layerChunks.get(layerId)
    return Boolean(chunks && chunks.length > 0)
  }

  layerTriangleCount(layerId: string): number {
    const chunks = this.layerChunks.get(layerId)
    if (!chunks) return 0
    return chunks.reduce((s, c) => s + c.triangles, 0)
  }

  clearLayer(layerId: string): void {
    this.disposeLayerGeometries(layerId)
    this.layerChunks.delete(layerId)
    if (this.queryLayerId === layerId) this.queryLayerId = null
  }

  clearAllLayers(): void {
    this.clearDebugMeshes()
    this.chunks.length = 0
    this.resident.length = 0
    for (const id of [...this.layerChunks.keys()]) this.disposeLayerGeometries(id)
    this.layerChunks.clear()
    this.totalTriangles = 0
    this.residentTriangles = 0
    this.queryLayerId = null
  }

  /** Dispose cached source chunks that are no longer part of the committed model set. */
  retainLayers(layerIds: Iterable<string>): void {
    const keep = new Set(layerIds)
    for (const id of [...this.layerChunks.keys()]) {
      if (!keep.has(id)) this.clearLayer(id)
    }
  }

  /**
   * Build BVHs for the given layer ids (typically all loaded layers that have chunks).
   * Swaps resident atomically so walk never sees an empty world mid-rebuild.
   */
  async rebuildFromLayers(
    layerIds: string[],
    focus?: Vector3 | null,
  ): Promise<{ ms: number; triangles: number }> {
    const t0 = performance.now()
    const wanted = new Set(layerIds)
    const nextResident: ChunkCollider[] = []
    let nextTris = 0

    for (const [id, sources] of this.layerChunks) {
      if (!wanted.has(id)) continue
      for (const src of sources) {
        src.geometry.computeBoundingBox()
        const box = src.geometry.boundingBox?.clone() ?? src.box.clone()
        if (box.isEmpty()) {
          console.warn(`[Collision] skipping empty AABB chunk ${src.name}`)
          continue
        }

        let bvh = (src.geometry as BufferGeometry & { boundsTree?: MeshBVH }).boundsTree ?? null

        const mesh = new Mesh(
          src.geometry,
          src.doubleSided ? sharedDoubleSidedMat : sharedMat,
        )
        mesh.name = src.name
        mesh.visible = true
        mesh.frustumCulled = false
        mesh.matrixAutoUpdate = false
        mesh.position.set(0, 0, 0)
        mesh.rotation.set(0, 0, 0)
        mesh.scale.set(1, 1, 1)
        mesh.matrix.identity()
        mesh.matrixWorld.identity()

        nextResident.push({
          mesh,
          bvh,
          box,
          triangles: src.triangles,
          stairZone: Boolean(src.stairZone),
          layerBridge: Boolean(src.layerBridge),
          layerId: id,
          sourceName: src.name,
          active: false,
        })
        nextTris += src.triangles
      }
    }

    // Atomic swap — keep previous world if the new set is empty but we had data.
    if (nextResident.length === 0 && this.resident.length > 0 && layerIds.length > 0) {
      console.warn(
        '[Collision] rebuild produced 0 chunks; keeping previous resident',
        [...wanted],
      )
      return { ms: performance.now() - t0, triangles: Math.round(this.residentTriangles) }
    }

    this.resident = nextResident
    this.residentTriangles = nextTris
    this.chunks = []
    this.totalTriangles = 0

    // The resident objects have just been replaced. A numerically unchanged
    // focus must still rebuild the active set; otherwise setFocus() can take
    // its small-movement early return and leave collision empty.
    this.lastFocus.set(Number.NaN, Number.NaN, Number.NaN)

    if (focus) this.setFocus(focus)
    else this.activateAll()

    this.rebuildDebugMeshes()
    return { ms: performance.now() - t0, triangles: Math.round(this.residentTriangles) }
  }

  async rebuild(_fromRoot: import('three').Object3D): Promise<{ ms: number; triangles: number }> {
    return this.rebuildFromLayers([...this.layerChunks.keys()])
  }

  /**
   * Activate nearby collision chunks around a world-space focus (player feet / camera).
   * Uses hysteresis so chunks don't thrash at the boundary.
   */
  setFocus(center: Vector3, opts?: { forceAll?: boolean }): void {
    _focus.copy(center)
    this.forceAll = Boolean(opts?.forceAll) || !this.regionEnabled || this.placementMode
    if (this.forceAll) {
      this.activateAll()
      this.lastFocus.copy(center)
      return
    }

    // Skip tiny moves — activation is coarse.
    if (
      Number.isFinite(this.lastFocus.x) &&
      this.lastFocus.distanceToSquared(center) < 1.5 * 1.5
    ) {
      return
    }
    this.lastFocus.copy(center)
    this.refreshActiveSet()
  }

  /** Pegman / orbit picking — query every resident chunk, ignore nearby activation. */
  setPlacementMode(on: boolean): void {
    this.placementMode = on
    if (on) {
      this.forceAll = true
      this.activateAll()
    } else if (this.regionEnabled) {
      this.forceAll = false
      if (Number.isFinite(this.lastFocus.x)) this.refreshActiveSet()
      else this.activateAll()
    }
  }

  private ensureChunkBvh(chunk: ChunkCollider): boolean {
    if (chunk.bvh) return true
    try {
      const bvh = new MeshBVH(chunk.mesh.geometry)
      ;(chunk.mesh.geometry as BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = bvh
      chunk.bvh = bvh
      return true
    } catch (err) {
      console.warn(`[Collision] lazy BVH failed for ${chunk.mesh.name}`, err)
      return false
    }
  }

  private activateAll(): void {
    for (const c of this.resident) {
      c.active = true
      this.ensureChunkBvh(c)
    }
    this.chunks = this.resident.filter((c) => c.bvh)
    this.totalTriangles = this.chunks.reduce((s, c) => s + c.triangles, 0)
    for (const c of this.resident) c.active = this.chunks.includes(c)
    this.rebuildDebugMeshes()
  }

  private refreshActiveSet(): void {
    const actR2 = this.activateRadius * this.activateRadius
    const deactR2 = this.deactivateRadius * this.deactivateRadius
    const y0 = _focus.y - this.yPad
    const y1 = _focus.y + this.yPad

    this.chunks = []
    this.totalTriangles = 0

    for (const chunk of this.resident) {
      // Always keep the chunk under the player's feet.
      const containsFocus =
        _focus.x >= chunk.box.min.x - 0.5 &&
        _focus.x <= chunk.box.max.x + 0.5 &&
        _focus.z >= chunk.box.min.z - 0.5 &&
        _focus.z <= chunk.box.max.z + 0.5 &&
        _focus.y >= chunk.box.min.y - this.yPad &&
        _focus.y <= chunk.box.max.y + this.yPad

      // Y band — stairs get extra pad so multi-flight assemblies stay live.
      const yPadExtra = chunk.stairZone ? this.yPad : 0
      const yOverlap =
        chunk.box.max.y >= y0 - yPadExtra && chunk.box.min.y <= y1 + yPadExtra
      if (!containsFocus && !yOverlap) {
        chunk.active = false
        continue
      }

      // Closest XZ point on AABB to focus.
      const cx = Math.min(Math.max(_focus.x, chunk.box.min.x), chunk.box.max.x)
      const cz = Math.min(Math.max(_focus.z, chunk.box.min.z), chunk.box.max.z)
      const dx = cx - _focus.x
      const dz = cz - _focus.z
      const d2 = dx * dx + dz * dz

      if (containsFocus) {
        chunk.active = true
      } else if (chunk.active) {
        if (d2 > deactR2) chunk.active = false
      } else if (d2 <= actR2) {
        chunk.active = true
      }

      if (chunk.active) {
        if (this.ensureChunkBvh(chunk)) {
          this.chunks.push(chunk)
          this.totalTriangles += chunk.triangles
        }
      }
    }

    // Safety: never leave walk with zero collision if we have residents.
    if (this.chunks.length === 0 && this.resident.length > 0) {
      this.activateAll()
      return
    }

    this.rebuildDebugMeshes()
  }

  raycast(origin: Vector3, direction: Vector3, maxDistance = 200): CollisionHit | null {
    const t0 = performance.now()
    this.frameRaycasts += 1
    if (this.chunks.length === 0) {
      this.frameCpuMs += performance.now() - t0
      return null
    }

    _rayEnd.copy(origin).addScaledVector(direction, maxDistance)
    _queryBox.setFromPoints([origin, _rayEnd])
    _queryBox.expandByScalar(0.75)

    _raycaster.set(origin, direction)
    _raycaster.far = maxDistance
    _raycaster.near = 0
    ;(_raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true

    let bestDist = Infinity
    let found = false
    let bestLayerId: string | undefined
    let bestSourceName: string | undefined
    let bestStair = false
    let bestLayerBridge = false

    for (const chunk of this.chunks) {
      // The placement layer remains authoritative for ordinary architecture,
      // but a reachable stair owned by another visible model must be queryable
      // so locomotion can hand support ownership across model boundaries.
      if (
        this.queryLayerId &&
        chunk.layerId !== this.queryLayerId &&
        !chunk.stairZone &&
        !chunk.layerBridge
      ) continue
      if (this.broadphaseEnabled && !_queryBox.intersectsBox(chunk.box)) continue
      this.frameChunks += 1
      this.frameBvh += 1
      const hits = _raycaster.intersectObject(chunk.mesh, false)
      const hit = hits[0]
      if (!hit || hit.distance >= bestDist) continue
      bestDist = hit.distance
      found = true
      bestLayerId = chunk.layerId
      bestSourceName = chunk.sourceName
      bestStair = chunk.stairZone
      bestLayerBridge = chunk.layerBridge
      _hitPoint.copy(hit.point)
      if (hit.face?.normal) {
        _hitNormal.copy(hit.face.normal).normalize()
      } else {
        _hitNormal.set(0, 1, 0)
      }
      if (_hitNormal.dot(direction) > 0) _hitNormal.negate()
    }

    this.frameCpuMs += performance.now() - t0
    if (!found) return null
    return {
      point: _hitPoint,
      normal: _hitNormal,
      distance: bestDist,
      layerId: bestLayerId,
      sourceName: bestSourceName,
      stairZone: bestStair,
      layerBridge: bestLayerBridge,
    }
  }

  /**
   * Cast straight down and keep the highest walkable hit across chunks.
   * Needed when exterior + animated layers both contribute floor slabs at different Y.
   */
  raycastBestGround(origin: Vector3, maxDistance = 8, minUpDot = 0.45): CollisionHit | null {
    const t0 = performance.now()
    this.frameRaycasts += 1
    if (this.chunks.length === 0) {
      this.frameCpuMs += performance.now() - t0
      return null
    }

    _rayEnd.copy(origin).addScaledVector(_downGround, maxDistance)
    _queryBox.setFromPoints([origin, _rayEnd])
    _queryBox.expandByScalar(0.5)

    _groundRaycaster.set(origin, _downGround)
    _groundRaycaster.far = maxDistance
    _groundRaycaster.near = 0
    _raycaster.set(origin, _downGround)
    _raycaster.far = maxDistance
    _raycaster.near = 0
    ;(_raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true

    let bestY = -Infinity
    let found = false
    let bestDist = 0
    let bestLayerId: string | undefined
    let bestSourceName: string | undefined
    let bestStair = false
    let bestLayerBridge = false
    let fallbackY = -Infinity
    let fallbackDist = 0
    let fallbackLayerId: string | undefined
    let fallbackSourceName: string | undefined
    let fallbackStair = false
    let fallbackLayerBridge = false

    for (const chunk of this.chunks) {
      const foreignOrdinary = Boolean(
        this.queryLayerId &&
          chunk.layerId !== this.queryLayerId &&
          !chunk.stairZone &&
          !chunk.layerBridge,
      )
      if (this.broadphaseEnabled && !_queryBox.intersectsBox(chunk.box)) continue
      this.frameChunks += 1
      this.frameBvh += 1
      const firstHits = _raycaster.intersectObject(chunk.mesh, false)
      const firstHit = firstHits[0]
      if (!firstHit) continue
      if (firstHit.face?.normal) {
        _hitNormal.copy(firstHit.face.normal).normalize()
      } else {
        _hitNormal.set(0, 1, 0)
      }
      if (_hitNormal.dot(_downGround) > 0) _hitNormal.negate()
      // Preserve the first-hit fast path for ordinary floors. Only request all
      // BVH intersections when the nearest surface is actually non-walkable.
      const hits = _hitNormal.y >= minUpDot
        ? firstHits
        : _groundRaycaster.intersectObject(chunk.mesh, false)
      for (const hit of hits) {
        if (hit.face?.normal) {
          _hitNormal.copy(hit.face.normal).normalize()
        } else {
          _hitNormal.set(0, 1, 0)
        }
        if (_hitNormal.dot(_downGround) > 0) _hitNormal.negate()
        if (_hitNormal.y < minUpDot) continue
        if (foreignOrdinary) {
          // Ordinary geometry from another layer is only a continuity fallback.
          // It must never promote a player above valid support in the layer
          // selected by visible-surface placement (the original floating bug).
          if (hit.point.y > fallbackY) {
            fallbackY = hit.point.y
            fallbackDist = hit.distance
            fallbackLayerId = chunk.layerId
            fallbackSourceName = chunk.sourceName
            fallbackStair = chunk.stairZone
            fallbackLayerBridge = chunk.layerBridge
            _fallbackGroundPoint.copy(hit.point)
            _fallbackGroundNormal.copy(_hitNormal)
          }
        } else if (hit.point.y > bestY) {
          bestY = hit.point.y
          found = true
          bestDist = hit.distance
          bestLayerId = chunk.layerId
          bestSourceName = chunk.sourceName
          bestStair = chunk.stairZone
          bestLayerBridge = chunk.layerBridge
          _hitPoint.copy(hit.point)
          _bestGroundNormal.copy(_hitNormal)
        }
        // Intersections are distance-sorted. Once this chunk supplies its first
        // walkable surface, deeper surfaces from the same chunk cannot be higher.
        break
      }
    }

    this.frameCpuMs += performance.now() - t0
    if (!found && Number.isFinite(fallbackY)) {
      return {
        point: _fallbackGroundPoint,
        normal: _fallbackGroundNormal,
        distance: fallbackDist,
        layerId: fallbackLayerId,
        sourceName: fallbackSourceName,
        stairZone: fallbackStair,
        layerBridge: fallbackLayerBridge,
      }
    }
    if (!found) return null
    return {
      point: _hitPoint,
      normal: _bestGroundNormal,
      distance: bestDist,
      layerId: bestLayerId,
      sourceName: bestSourceName,
      stairZone: bestStair,
      layerBridge: bestLayerBridge,
    }
  }

  stairWellAt(x: number, y: number, z: number): { minY: number; maxY: number } | null {
    const pad = 0.35
    let best: { minY: number; maxY: number } | null = null
    for (const chunk of this.chunks) {
      if (this.queryLayerId && chunk.layerId !== this.queryLayerId && !chunk.stairZone) continue
      if (!chunk.stairZone) continue
      const b = chunk.box
      if (x < b.min.x - pad || x > b.max.x + pad) continue
      if (z < b.min.z - pad || z > b.max.z + pad) continue
      if (y < b.min.y - 0.85 || y > b.max.y + 0.45) continue
      // Overlapping flights (treppe_zg under a taller well): climb the local
      // run — smallest maxY still above the feet — not the tallest AABB.
      const room = b.max.y > y + 0.18
      if (room) {
        if (!best || b.max.y < best.maxY) best = { minY: b.min.y, maxY: b.max.y }
      } else if (!best) {
        best = { minY: b.min.y, maxY: b.max.y }
      }
    }
    return best
  }

  capsuleIntersect(start: Vector3, end: Vector3, radius: number): CapsuleQueryResult | null {
    const t0 = performance.now()
    this.frameCapsules += 1
    if (this.chunks.length === 0) {
      this.frameCpuMs += performance.now() - t0
      return null
    }

    _queryBox.setFromPoints([start, end])
    _queryBox.expandByScalar(radius + 0.2)

    let bestDepth = 0
    let bestStair = false
    let bestLayerBridge = false
    let bestLayerId: string | undefined
    let bestSourceName: string | undefined
    _resultNormal.set(0, 0, 0)
    const steps = 3

    for (const chunk of this.chunks) {
      if (
        this.queryLayerId &&
        chunk.layerId !== this.queryLayerId &&
        !chunk.stairZone &&
        !chunk.layerBridge
      ) continue
      if (this.broadphaseEnabled && !_queryBox.intersectsBox(chunk.box)) continue
      if (!this.ensureChunkBvh(chunk)) continue
      this.frameChunks += 1

      _localOrigin.copy(start)
      _localEnd.copy(end)

      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        _capsuleCenter.lerpVectors(_localOrigin, _localEnd, t)
        const hitTarget = { point: _closest, distance: 0, faceIndex: 0 }
        this.frameBvh += 1
        const hit = chunk.bvh!.closestPointToPoint(_capsuleCenter, hitTarget, 0, radius)
        if (!hit) continue
        const dist = hit.distance
        if (dist >= radius) continue
        const depth = radius - dist
        if (depth <= bestDepth) continue
        _delta.subVectors(_capsuleCenter, hit.point)
        if (_delta.lengthSq() < 1e-10) continue
        _delta.normalize()
        bestDepth = depth
        bestStair = chunk.stairZone
        bestLayerBridge = chunk.layerBridge
        bestLayerId = chunk.layerId
        bestSourceName = chunk.sourceName
        _resultNormal.copy(_delta)
      }
    }

    this.frameCpuMs += performance.now() - t0
    if (bestDepth <= 0) return null
    return {
      depth: bestDepth,
      normal: _resultNormal,
      stairZone: bestStair,
      layerId: bestLayerId,
      sourceName: bestSourceName,
      layerBridge: bestLayerBridge,
    }
  }

  private rebuildDebugMeshes(): void {
    this.clearDebugMeshes()
    if (!this.debugVisible) return
    for (const chunk of this.chunks) {
      const viz = new Mesh(chunk.mesh.geometry, debugMat)
      viz.name = `debug_${chunk.mesh.name}`
      viz.frustumCulled = false
      viz.matrixAutoUpdate = false
      viz.matrix.identity()
      viz.matrixWorld.identity()
      this.debugRoot.add(viz)
    }
  }

  private clearDebugMeshes(): void {
    while (this.debugRoot.children.length) {
      this.debugRoot.remove(this.debugRoot.children[0]!)
    }
  }

  private disposeChunkGeometry(src: CollisionChunkSource): void {
    const geom = src.geometry as BufferGeometry & { boundsTree?: MeshBVH; disposeBoundsTree?: () => void }
    if (geom.boundsTree) {
      geom.disposeBoundsTree?.()
      geom.boundsTree = undefined
    }
    geom.dispose()
  }

  private disposeLayerGeometries(layerId: string): void {
    const prev = this.layerChunks.get(layerId)
    if (!prev) return
    for (const src of prev) this.disposeChunkGeometry(src)
  }

  dispose(): void {
    this.clearDebugMeshes()
    this.chunks.length = 0
    this.resident.length = 0
    for (const id of [...this.layerChunks.keys()]) this.disposeLayerGeometries(id)
    this.layerChunks.clear()
    this.totalTriangles = 0
    this.residentTriangles = 0
    this.queryLayerId = null
  }
}
