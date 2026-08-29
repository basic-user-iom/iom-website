import {
  BatchedMesh,
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js'
import type { QualityProfileId } from './QualityManager'
import { isInspectHidden } from '../scene/inspectFlags'

export type DetailLodStats = {
  tracked: number
  packed: number
  hidden: number
  visible: number
  lowDetail: number
  enabled: boolean
  geometric: boolean
}

type LodLevel = 0 | 1 | 2 // high | low | hidden

type LodEntry = {
  mesh: Mesh
  center: Vector3
  radius: number
  keepAlways: boolean
  baseVisible: boolean
  geoHigh: BufferGeometry
  geoLow: BufferGeometry | null
  level: LodLevel
  sx: number
  sy: number
  sz: number
  keepInOverview: boolean
}

type BatchInstanceLod = {
  id: number
  radius: number
  tris: number
  sx: number
  sy: number
  sz: number
}

type PackedLodEntry = {
  mesh: Mesh
  /** Object-local center of the complete packed draw, including instances. */
  localCenter: Vector3
  /** Object-local radius of the complete packed draw, including instances. */
  localRadius: number
  center: Vector3
  radius: number
  keepAlways: boolean
  baseVisible: boolean
  hidden: boolean
  batchInstances: BatchInstanceLod[] | null
  partSize: { sx: number; sy: number; sz: number } | null
  keepInOverview: boolean
}

/** Far overview: floors/walls/mass only — not mullions, fixtures, chrome trim. */
function isBuildingMass(sx: number, sy: number, sz: number): boolean {
  const footprint = sx * sz
  const slab = footprint >= 12 && sy < 2.4
  const wall = sy >= 2.4 && Math.max(sx, sz) >= 2.8 && Math.min(sx, sz) >= 0.2
  const chunk = Math.max(sx, sy, sz) >= 8 && footprint >= 8
  return slab || wall || chunk
}

function isFurnitureName(name: string): boolean {
  return /g-form|Mesh13787|chair|pillow|wardrobe|keyboard/i.test(name)
}

function isOverviewKeepName(name: string): boolean {
  return /fahne|flag|hedge|hecke|banner|zaun|fence|pole|mast|tree|baum|bush|strauch|grass|rasen|pflanz|sign|schild|logo/i.test(
    name,
  )
}

function isAlphaCutout(mesh: Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return mats.some((m) => {
    if (!m) return false
    const any = m as {
      transparent?: boolean
      opacity?: number
      alphaTest?: number
      alphaMap?: unknown
    }
    return Boolean(
      any.transparent ||
        (any.opacity != null && any.opacity < 0.98) ||
        (any.alphaTest ?? 0) > 0 ||
        any.alphaMap,
    )
  })
}

const _lodBox = new Box3()
const _lodSize = new Vector3()

/**
 * Screen-size detail LOD with optional geometric low-poly swap.
 *
 * - Large shells: always high detail
 * - Mid fixtures: high → simplified geometry → hidden
 * - Packed InstancedMesh / BatchedMesh: visibility cull (floor + screen size)
 * - Glass / transparent / collision proxies: never touched
 */
export class DetailLodController {
  private entries: LodEntry[] = []
  private packed: PackedLodEntry[] = []
  private enabled = true
  private geometric = true
  private lastUpdate = 0
  private minScreenSize = 0.012
  private lowScreenSize = 0.045
  private keepRadiusAbove = 8
  private updateIntervalMs = 120
  private maxSimplifyMeshes = 64
  private simplifyRatio = 0.45
  private readonly _camPos = new Vector3()
  private readonly _instMat = new Matrix4()
  private readonly _instPos = new Vector3()
  private readonly simplifier = new SimplifyModifier()
  private hideDistantMeshes = true
  /** Orbit: hide sub-pixel fixtures only (not floors/shells — those caused zoom pop-in). */
  private hideTinyMeshes = false
  private tinyRadius = 1.8
  /** Orbit overview: keep floors/walls, hide furniture by world size (not screen size). */
  private overviewMassOnly = false

  setHideDistant(on: boolean): void {
    if (this.hideDistantMeshes === on) return
    this.hideDistantMeshes = on
    if (!on) {
      // Keep geometric low-poly in orbit; only unhide (zoom pop-in was hide↔show).
      for (const entry of this.entries) {
        if (entry.level === 2) this.applyLevel(entry, entry.geoLow && this.geometric ? 1 : 0)
      }
      for (const entry of this.packed) {
        entry.hidden = false
        if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = true
      }
    }
  }

  setHideTiny(on: boolean): void {
    if (this.hideTinyMeshes === on) return
    this.hideTinyMeshes = on
    if (!on) {
      for (const entry of this.entries) {
        if (entry.level === 2 && entry.radius < this.tinyRadius) {
          this.applyLevel(entry, entry.geoLow && this.geometric ? 1 : 0)
        }
      }
      for (const entry of this.packed) {
        entry.hidden = false
        if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = true
        this.restoreBatchInstances(entry)
      }
    }
  }

  setOverviewMassOnly(on: boolean): void {
    if (this.overviewMassOnly === on) return
    this.overviewMassOnly = on
    this.lastUpdate = 0
    if (!on) {
      for (const entry of this.entries) {
        if (entry.level === 2) this.applyLevel(entry, 0)
      }
      for (const entry of this.packed) {
        entry.hidden = false
        if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = true
        this.restoreBatchInstances(entry)
      }
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) this.revealAll()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setGeometricEnabled(on: boolean): void {
    this.geometric = on
    if (!on) {
      for (const entry of this.entries) {
        if (entry.level === 1) this.applyLevel(entry, 0)
      }
    }
  }

  applyQuality(profileId: QualityProfileId): void {
    if (profileId === 'QUEST') {
      this.minScreenSize = 0.022
      this.lowScreenSize = 0.07
      this.keepRadiusAbove = 5
      this.updateIntervalMs = 90
      this.maxSimplifyMeshes = 96
      this.simplifyRatio = 0.35
      this.geometric = true
    } else if (profileId === 'DESKTOP_BALANCED') {
      this.minScreenSize = 0.014
      this.lowScreenSize = 0.05
      this.keepRadiusAbove = 7
      this.updateIntervalMs = 110
      this.maxSimplifyMeshes = 72
      this.simplifyRatio = 0.4
      this.geometric = true
    } else if (profileId === 'AUTO') {
      this.minScreenSize = 0.012
      this.lowScreenSize = 0.045
      this.keepRadiusAbove = 8
      this.updateIntervalMs = 120
      this.maxSimplifyMeshes = 64
      this.simplifyRatio = 0.45
      this.geometric = true
    } else {
      this.minScreenSize = 0.008
      this.lowScreenSize = 0.035
      this.keepRadiusAbove = 10
      this.updateIntervalMs = 150
      this.maxSimplifyMeshes = 48
      this.simplifyRatio = 0.5
      this.geometric = true
    }
  }

  /**
   * Rebuild the LOD index after models load / layers change.
   * Call after prepare + instancing.
   */
  rebuild(root: Object3D, sceneRadius: number): void {
    void sceneRadius
    this.revealAll()
    this.disposeLowGeometries()
    this.entries = []
    this.packed = []
    const keepFloor = Math.min(5.5, Math.max(3.2, this.keepRadiusAbove * 0.65))

    root.updateMatrixWorld(true)

    type Cand = {
      mesh: Mesh
      center: Vector3
      radius: number
      tris: number
      keepAlways: boolean
      baseVisible: boolean
      sx: number
      sy: number
      sz: number
      keepInOverview: boolean
    }
    const cands: Cand[] = []

    root.traverse((obj) => {
      if (!(obj as Mesh).isMesh) return
      const mesh = obj as Mesh
      if (mesh.userData?.collisionOnly) return
      if (mesh.userData?.cadOverlay) return
      if (mesh.userData?.detailLodIgnore) return
      if (mesh.userData?.architecturalGlass) return
      if (mesh.userData?.floorSurface) {
        mesh.userData.detailLodIgnore = true
        return
      }
      if (
        /door|window|portal|entrance|mullion|storefront|fassade|facade|lobby|fahne|flag|hedge|hecke|banner|zaun|fence|schild/i.test(
          mesh.name || '',
        )
      ) {
        mesh.userData.detailLodIgnore = true
        return
      }

      // Imported EXT_mesh_gpu_instancing nodes are InstancedMesh objects even
      // when they were authored offline and have no procedural runtime flag.
      // Treat every native packed draw as packed: simplifying it as an ordinary
      // Mesh would use one primitive's bounds and can incorrectly hide a batch
      // whose instances span a room or campus cell.
      const instanced = mesh as InstancedMesh
      const batched = mesh as BatchedMesh
      const isNativePacked = Boolean(instanced.isInstancedMesh || batched.isBatchedMesh)
      const isPacked = Boolean(
        isNativePacked || mesh.userData?.proceduralInstanced || mesh.userData?.proceduralBatched,
      )
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (!isPacked && (isAlphaCutout(mesh) || mats.some((m) => m && (m.transparent || m.opacity < 0.98)))) return
      if (!mesh.geometry) return

      if (instanced.isInstancedMesh) instanced.computeBoundingSphere()
      else if (batched.isBatchedMesh) batched.computeBoundingSphere()
      else if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
      const local = instanced.isInstancedMesh
        ? instanced.boundingSphere
        : batched.isBatchedMesh
          ? batched.boundingSphere
          : mesh.geometry.boundingSphere
      if (!local || local.radius <= 0) return

      mesh.updateWorldMatrix(true, false)
      const worldScale = mesh.matrixWorld.getMaxScaleOnAxis()
      const center = local.center.clone().applyMatrix4(mesh.matrixWorld)
      const radius = local.radius * worldScale

      const index = mesh.geometry.getIndex()
      const pos = mesh.geometry.getAttribute('position')
      const tris = index ? index.count / 3 : pos ? pos.count / 3 : 0

      if (isPacked) {
        const part =
          mesh.userData?.partSize && typeof mesh.userData.partSize.sx === 'number'
            ? (mesh.userData.partSize as { sx: number; sy: number; sz: number })
            : null
        const partMass = part ? isBuildingMass(part.sx, part.sy, part.sz) : false
        const matName = Array.isArray(mesh.material) ? mesh.material[0]?.name ?? '' : mesh.material?.name ?? ''
        const keepInOverview =
          partMass ||
          isAlphaCutout(mesh) ||
          isOverviewKeepName(mesh.name || '') ||
          isOverviewKeepName(matName)
        this.packed.push({
          mesh,
          localCenter: local.center.clone(),
          localRadius: local.radius,
          center,
          radius,
          keepAlways: partMass,
          baseVisible: mesh.visible,
          hidden: false,
          batchInstances: Array.isArray(mesh.userData?.batchInstances)
            ? (mesh.userData.batchInstances as BatchInstanceLod[])
            : null,
          partSize: part,
          keepInOverview,
        })
        mesh.userData.detailLodPacked = true
        return
      }

      _lodBox.setFromObject(mesh)
      _lodBox.getSize(_lodSize)
      const sx = Math.max(0.01, _lodSize.x)
      const sy = Math.max(0.01, _lodSize.y)
      const sz = Math.max(0.01, _lodSize.z)
      const keepAlways = radius >= keepFloor || isBuildingMass(sx, sy, sz)
      const matName = Array.isArray(mesh.material) ? mesh.material[0]?.name ?? '' : mesh.material?.name ?? ''
      const keepInOverview =
        keepAlways ||
        isOverviewKeepName(mesh.name || '') ||
        isOverviewKeepName(matName)

      cands.push({
        mesh,
        center,
        radius,
        tris,
        keepAlways,
        baseVisible: mesh.visible,
        sx,
        sy,
        sz,
        keepInOverview,
      })
      mesh.userData.detailLodTracked = true
    })

    // Prefer simplifying denser mid-size fixtures first.
    const simplifyTargets = cands
      .filter((c) => !c.keepAlways && c.tris >= 200 && c.tris <= 80_000 && c.radius < keepFloor)
      .sort((a, b) => b.tris - a.tris)
      .slice(0, this.geometric ? this.maxSimplifyMeshes : 0)

    const lowMap = new Map<Mesh, BufferGeometry>()
    for (const c of simplifyTargets) {
      const low = this.buildLowGeometry(c.mesh.geometry, c.tris)
      if (low) lowMap.set(c.mesh, low)
    }

    for (const c of cands) {
      this.entries.push({
        mesh: c.mesh,
        center: c.center,
        radius: c.radius,
        keepAlways: c.keepAlways,
        baseVisible: c.baseVisible,
        geoHigh: c.mesh.geometry,
        geoLow: lowMap.get(c.mesh) ?? null,
        level: 0,
        sx: c.sx,
        sy: c.sy,
        sz: c.sz,
        keepInOverview: c.keepInOverview,
      })
    }

    if (lowMap.size > 0) {
      console.info(`[DetailLOD] geometric LOD ready for ${lowMap.size} meshes`)
    }
    if (this.packed.length > 0) {
      console.info(`[DetailLOD] packed visibility LOD for ${this.packed.length} groups`)
    }
  }

  private buildLowGeometry(source: BufferGeometry, tris: number): BufferGeometry | null {
    try {
      for (const name of Object.keys(source.attributes)) {
        const attr = source.getAttribute(name)
        if (attr && (attr as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) {
          return null
        }
      }
      const pos = source.getAttribute('position')
      if (!pos || pos.count < 12) return null
      const remove = Math.max(1, Math.floor(pos.count * (1 - this.simplifyRatio)))
      if (remove < 4) return null
      const low = this.simplifier.modify(source, remove)
      if (!low?.getAttribute('position')) {
        low?.dispose()
        return null
      }
      low.computeVertexNormals()
      low.computeBoundingSphere()
      low.computeBoundingBox()
      // Don't keep a denser "low" than high.
      const lowPos = low.getAttribute('position')
      if (!lowPos || lowPos.count >= pos.count * 0.95) {
        low.dispose()
        return null
      }
      void tris
      return low
    } catch {
      return null
    }
  }

  update(camera: Camera, now = performance.now()): void {
    if (!this.enabled || (this.entries.length === 0 && this.packed.length === 0)) return
    if (now - this.lastUpdate < this.updateIntervalMs) return
    this.lastUpdate = now

    camera.getWorldPosition(this._camPos)
    const persp = camera as PerspectiveCamera
    const fovFactor =
      persp.isPerspectiveCamera && persp.fov
        ? Math.tan(((persp.fov * Math.PI) / 180) * 0.5)
        : 0.5

    for (const entry of this.entries) {
      if (!entry.baseVisible) continue
      if (isInspectHidden(entry.mesh)) continue
      if (entry.mesh.parent && !entry.mesh.parent.visible) continue
      let p = entry.mesh.parent?.parent ?? null
      let ancestorOk = true
      while (p) {
        if (!p.visible) {
          ancestorOk = false
          break
        }
        p = p.parent
      }
      if (!ancestorOk) continue

      if (entry.mesh.userData?.floorResidency === false) {
        if (this.hideDistantMeshes) {
          this.applyLevel(entry, 2)
        }
        continue
      }

      if (this.overviewMassOnly) {
        // The overview pass is intentionally building-mass only. The previous
        // condition ignored the precomputed size/name classification and kept
        // every non-furniture CAD detail at full resolution.
        const keep = entry.keepInOverview && !isFurnitureName(entry.mesh.name || '')
        this.applyLevel(entry, keep ? 0 : 2)
        continue
      }

      if (entry.keepAlways) {
        this.applyLevel(entry, 0)
        continue
      }

      if (entry.mesh.matrixWorldNeedsUpdate) {
        entry.mesh.getWorldPosition(entry.center)
      }

      const dist = Math.max(0.05, this._camPos.distanceTo(entry.center))
      const screenSize = entry.radius / (dist * fovFactor)

      // Hysteresis: high ↔ low ↔ hidden. Orbit never hides large shells (zoom pop-in).
      let next: LodLevel = entry.level
      const canHideTiny = this.hideTinyMeshes && entry.radius < this.tinyRadius
      if (!this.hideDistantMeshes) {
        if (canHideTiny && screenSize < this.minScreenSize * 0.55) next = 2
        else if (canHideTiny && entry.level === 2 && screenSize < this.minScreenSize * 1.15) next = 2
        else next = 0
      } else if (entry.level === 2) {
        if (screenSize >= this.minScreenSize) next = entry.geoLow && this.geometric ? 1 : 0
      } else if (entry.level === 1) {
        if (screenSize < this.minScreenSize * 0.7) next = 2
        else if (screenSize >= this.lowScreenSize) next = 0
      } else {
        if (screenSize < this.minScreenSize * 0.7) next = 2
        else if (this.geometric && entry.geoLow && screenSize < this.lowScreenSize * 0.85) next = 1
      }

      this.applyLevel(entry, next)
    }

    for (const entry of this.packed) {
      if (!entry.baseVisible) continue
      if (isInspectHidden(entry.mesh)) continue
      if (entry.mesh.parent && !entry.mesh.parent.visible) continue

      if (entry.mesh.userData?.floorResidency === false) {
        if (this.hideDistantMeshes) {
          if (entry.mesh.visible) entry.mesh.visible = false
          entry.hidden = true
        }
        continue
      }

      if (this.overviewMassOnly) {
        if (entry.keepInOverview) {
          if (entry.baseVisible && !entry.mesh.visible) entry.mesh.visible = true
          this.restoreBatchInstances(entry)
          entry.hidden = false
          continue
        }
        if (entry.batchInstances) {
          this.cullBatchInstances(entry, fovFactor, true)
          continue
        }
        const furniture = isFurnitureName(entry.mesh.name || '')
        const keep = entry.baseVisible && entry.keepInOverview && !furniture
        if (entry.mesh.visible !== keep) entry.mesh.visible = keep
        entry.hidden = !keep
        continue
      }

      if (entry.baseVisible && !entry.hidden && !entry.mesh.visible) entry.mesh.visible = true

      if (this.hideTinyMeshes && entry.batchInstances) {
        this.cullBatchInstances(entry, fovFactor)
        continue
      }

      // Packed bounds are object-local and may be offset far from the node
      // origin (typical for imported instancing). Reapply the current animated
      // matrix instead of replacing the center with getWorldPosition().
      entry.mesh.updateWorldMatrix(true, false)
      entry.center.copy(entry.localCenter).applyMatrix4(entry.mesh.matrixWorld)
      entry.radius = entry.localRadius * entry.mesh.matrixWorld.getMaxScaleOnAxis()
      const dist = Math.max(0.05, this._camPos.distanceTo(entry.center))
      if (this.hideTinyMeshes && entry.mesh.userData?.proceduralInstanced) {
        const size = entry.partSize
        const mass = size
          ? isBuildingMass(size.sx, size.sy, size.sz)
          : !/g-form|Mesh13787/i.test(entry.mesh.name || '')
        const hideFar = entry.hidden ? dist > 28 : dist > 40
        const show = mass || !hideFar
        if (entry.mesh.visible !== show) entry.mesh.visible = show
        entry.hidden = !show
        continue
      }

      if (entry.keepAlways) continue

      const screenSize = entry.radius / (dist * fovFactor)
      const show = !this.hideDistantMeshes || screenSize >= this.minScreenSize * 0.65
      if (entry.mesh.visible !== show) entry.mesh.visible = show
      entry.hidden = !show
    }
  }

  private cullBatchInstances(entry: PackedLodEntry, fovFactor: number, massOnly = false): number {
    const batched = entry.mesh as BatchedMesh
    if (!batched.isBatchedMesh || !entry.batchInstances?.length) return 0
    let hidden = 0
    let anyVisible = false
    for (const item of entry.batchInstances) {
      const mass =
        item.sx != null
          ? isBuildingMass(item.sx, item.sy, item.sz)
          : item.radius >= 6
      let show = mass
      if (!massOnly) {
        batched.getMatrixAt(item.id, this._instMat)
        this._instPos.setFromMatrixPosition(this._instMat)
        batched.localToWorld(this._instPos)
        const dist = Math.max(0.05, this._camPos.distanceTo(this._instPos))
        const screenSize = item.radius / (dist * fovFactor)
        const was = batched.getVisibleAt(item.id)
        const far = was ? dist > 28 : dist > 40
        const screenOk = was
          ? screenSize >= this.minScreenSize * 0.35
          : screenSize >= this.minScreenSize * 0.7
        show = mass || (!far && screenOk)
      }
      batched.setVisibleAt(item.id, show)
      if (!show) hidden += 1
      else anyVisible = true
    }
    if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = anyVisible
    entry.hidden = !anyVisible
    return hidden
  }

  private restoreBatchInstances(entry: PackedLodEntry): void {
    const batched = entry.mesh as BatchedMesh
    if (!batched.isBatchedMesh || !entry.batchInstances?.length) return
    for (const item of entry.batchInstances) batched.setVisibleAt(item.id, true)
  }

  private applyLevel(entry: LodEntry, level: LodLevel): void {
    if (isInspectHidden(entry.mesh)) {
      entry.level = level
      return
    }
    if (entry.level === level) {
      // Still enforce visibility/geometry in case something else mutated them.
      if (level === 2) {
        if (entry.mesh.visible) entry.mesh.visible = false
      } else if (!entry.mesh.visible) {
        entry.mesh.visible = true
      }
      return
    }
    entry.level = level
    if (level === 2) {
      entry.mesh.visible = false
      return
    }
    entry.mesh.visible = true
    const geo = level === 1 && entry.geoLow ? entry.geoLow : entry.geoHigh
    if (entry.mesh.geometry !== geo) entry.mesh.geometry = geo
  }

  getStats(): DetailLodStats {
    let hidden = 0
    let visible = 0
    let lowDetail = 0
    for (const entry of this.entries) {
      if (entry.level === 1) lowDetail += 1
      if (entry.level === 2 || !entry.mesh.visible) hidden += 1
      else visible += 1
    }
    for (const entry of this.packed) {
      if (entry.hidden || !entry.mesh.visible) hidden += 1
      else visible += 1
    }
    return {
      tracked: this.entries.length,
      packed: this.packed.length,
      hidden,
      visible,
      lowDetail,
      enabled: this.enabled,
      geometric: this.geometric,
    }
  }

  private revealAll(): void {
    for (const entry of this.entries) {
      entry.level = 0
      if (entry.mesh.geometry !== entry.geoHigh) entry.mesh.geometry = entry.geoHigh
      if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = true
    }
    for (const entry of this.packed) {
      entry.hidden = false
      if (entry.baseVisible && !isInspectHidden(entry.mesh)) entry.mesh.visible = true
      this.restoreBatchInstances(entry)
    }
  }

  private disposeLowGeometries(): void {
    for (const entry of this.entries) {
      if (entry.geoLow && entry.geoLow !== entry.geoHigh) {
        if (entry.mesh.geometry === entry.geoLow) entry.mesh.geometry = entry.geoHigh
        entry.geoLow.dispose()
      }
    }
  }

  dispose(): void {
    this.revealAll()
    this.disposeLowGeometries()
    this.entries = []
    this.packed = []
  }
}
