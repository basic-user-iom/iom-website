import { Box3, Mesh, Vector3, type BufferGeometry, type Object3D, type PerspectiveCamera } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

type Mode = 'auto' | 'lod0' | 'lod1'
type Part = { mesh: Mesh; high: BufferGeometry; low: BufferGeometry }
type Row = { sourceRoot: Object3D; owner: Object3D; parts: Part[]; center: Vector3; radius: number; low: boolean }
const materialKey = (mesh: Mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
  .map(m => m.name.toLowerCase()).join('|')

/** Local review only. Geometry switches preserve the authored owners and materials. */
export class ReviewedSeatLod {
  mode: Mode = 'auto'
  private rows: Row[] = []
  private roots = new WeakSet<Object3D>()
  private source: Promise<Object3D> | null = null
  private lastUpdate = -Infinity
  private switches = 0
  private maxProjectedError = 0

  async attach(root: Object3D): Promise<void> {
    if (this.roots.has(root)) return
    const owners: Object3D[] = []
    root.traverse(o => { if (o.userData.iomReviewSeatRow) owners.push(o) })
    if (!owners.length) return
    if (owners.length !== 78) throw new Error(`Expected 78 reviewed seat owners, got ${owners.length}`)
    this.source ??= new GLTFLoader().loadAsync('/models/review-v4/seats-lod1-v4.glb').then(g => g.scene)
    const source = await this.source
    const prepared: Row[] = []
    root.updateMatrixWorld(true)
    for (const owner of owners) {
      const name = String(owner.userData.iomReviewSeatRow)
      // GLTFLoader sanitizes periods in authored names.
      const normalized = name.replace(/[.\[\]:/]/g, '')
      const candidate = source.getObjectByName(normalized) ?? source.getObjectByName(name)
      if (!candidate) throw new Error('LOD row missing: ' + name)
      const lowParts = new Map<string, Mesh>()
      candidate.traverse(o => { if ((o as Mesh).isMesh) lowParts.set(materialKey(o as Mesh), o as Mesh) })
      const parts: Part[] = []
      owner.traverse(o => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        const low = lowParts.get(materialKey(mesh))
        if (!low) throw new Error('LOD material mismatch: ' + name + '/' + materialKey(mesh))
        // Both packages preserve the same local source coordinates. Do not silently
        // attach an unrelated mesh if a later optimizer bakes transforms into it.
        mesh.geometry.computeBoundingBox(); low.geometry.computeBoundingBox()
        const highBox = mesh.geometry.boundingBox!
        const lowBox = low.geometry.boundingBox!
        const scale = mesh.getWorldScale(new Vector3()).length()
        if (Math.max(highBox.min.distanceTo(lowBox.min), highBox.max.distanceTo(lowBox.max)) * scale > 0.01) {
          throw new Error('LOD local geometry coordinates differ: ' + name)
        }
        mesh.userData.reviewedSeatLod = true
        parts.push({ mesh, high: mesh.geometry, low: low.geometry })
      })
      const box = new Box3().setFromObject(owner)
      const center = owner.worldToLocal(box.getCenter(new Vector3()))
      prepared.push({ sourceRoot: root, owner, parts, center, radius: box.getSize(new Vector3()).length() / 2, low: false })
    }
    this.rows.push(...prepared)
    this.roots.add(root)
  }

  retainRoots(loadedRoots: Object3D[]): void {
    const keep = new Set(loadedRoots)
    this.rows = this.rows.filter(row => {
      if (keep.has(row.sourceRoot)) return true
      this.roots.delete(row.sourceRoot)
      // ModelManager disposes the currently attached geometry; release the
      // detached original too if this row was using the candidate on unload.
      if (row.low) for (const part of row.parts) part.high.dispose()
      return false
    })
  }

  dispose(): void {
    for (const row of this.rows) for (const part of row.parts) part.mesh.geometry = part.high
    this.rows = []
    this.roots = new WeakSet()
    void this.source?.then(root => root.traverse(o => {
      if ((o as Mesh).isMesh) {
        const mesh = o as Mesh
        mesh.geometry.dispose()
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
      }
    }))
    this.source = null
  }

  setMode(mode: Mode): void { this.mode = mode; this.lastUpdate = -Infinity }

  update(camera: PerspectiveCamera, pixelHeight: number, now: number): boolean {
    if (now - this.lastUpdate < 100) return false
    this.lastUpdate = now
    camera.updateMatrixWorld()
    const projection = pixelHeight / (2 * Math.tan(camera.fov * Math.PI / 360))
    let changed = false
    this.maxProjectedError = 0
    for (const row of this.rows) {
      const view = row.owner.localToWorld(row.center.clone()).applyMatrix4(camera.matrixWorldInverse)
      // Use the nearest part of the row, rather than just its centre, to keep
      // perspective close-ups on LOD0. Error bound comes from the Blender audit.
      const depth = Math.max(0.01, -view.z - row.radius)
      const errorPixels = 0.004951 * projection / depth
      const low = this.mode === 'lod1' || (this.mode === 'auto' && errorPixels < (row.low ? 0.35 : 0.25))
      if (low) this.maxProjectedError = Math.max(this.maxProjectedError, errorPixels)
      if (low === row.low) continue
      row.low = low
      for (const part of row.parts) part.mesh.geometry = low ? part.low : part.high
      this.switches++
      changed = true
    }
    return changed
  }

  stats() {
    return { mode: this.mode, rows: this.rows.length, lod1: this.rows.filter(r => r.low).length,
      switches: this.switches, maxProjectedErrorPixels: this.maxProjectedError,
      enterPixels: 0.25, exitPixels: 0.35, footIK: false }
  }
}
