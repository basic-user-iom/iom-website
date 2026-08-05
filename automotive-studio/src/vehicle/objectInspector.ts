import {
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  type Material,
  type Scene,
} from 'three'

export type ObjectTreeNode = {
  id: string
  name: string
  type: string
  depth: number
  visible: boolean
  mesh: boolean
  childCount: number
}

export type MaterialEditState = {
  name: string
  color: string
  metalness: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  opacity: number
  transparent: boolean
  envMapIntensity: number
  clearcoat: number
  clearcoatRoughness: number
  transmission: number
  hasPhysical: boolean
}

function colorToHex(c: Color): string {
  return `#${c.getHexString()}`
}

function objectId(obj: Object3D): string {
  return obj.uuid
}

/**
 * Hierarchy browser + material live-edit for the active vehicle.
 */
export class ObjectInspector {
  private scene: Scene | null = null
  private root: Object3D | null = null
  private camera: PerspectiveCamera | null = null
  private canvas: HTMLCanvasElement | null = null
  private selected: Object3D | null = null
  private selectedMaterialIndex = 0
  private outline: LineSegments | null = null
  private outlineMat = new LineBasicMaterial({
    color: 0xd2b48c,
    depthTest: false,
  })
  private raycaster = new Raycaster()
  private pointer = new Vector2()
  private pickEnabled = false
  private onSelectionChange: ((node: Object3D | null) => void) | null = null

  bind(
    scene: Scene,
    root: Object3D | null,
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ) {
    this.unbindCanvas()
    this.scene = scene
    this.root = root
    this.camera = camera
    this.canvas = canvas
    canvas.addEventListener('click', this.handleClick)
    this.clearOutline()
  }

  setRoot(root: Object3D | null) {
    this.root = root
    if (this.selected && root && !this.isDescendant(root, this.selected)) {
      this.select(null)
    } else if (this.selected) {
      this.refreshOutline()
    }
  }

  setPickEnabled(enabled: boolean) {
    this.pickEnabled = enabled
    if (this.canvas) this.canvas.style.cursor = enabled ? 'crosshair' : ''
  }

  isPickEnabled() {
    return this.pickEnabled
  }

  setOnSelectionChange(cb: ((node: Object3D | null) => void) | null) {
    this.onSelectionChange = cb
  }

  listTree(maxDepth = 48): ObjectTreeNode[] {
    const out: ObjectTreeNode[] = []
    if (!this.root) return out
    const walk = (obj: Object3D, depth: number) => {
      if (depth > maxDepth) return
      if (obj.name.startsWith('Hotspot_') || obj.name === 'VehicleRouteGuide') return
      // Skip outline helper meshes attached during selection.
      if (obj.type === 'LineSegments' && obj.parent === this.selected) return
      const mesh = (obj as Mesh).isMesh === true
      out.push({
        id: objectId(obj),
        name: obj.name || `(${obj.type})`,
        type: obj.type,
        depth,
        visible: obj.visible,
        mesh,
        childCount: obj.children.length,
      })
      for (const child of obj.children) walk(child, depth + 1)
    }
    walk(this.root, 0)
    return out
  }

  getSelectedId() {
    return this.selected ? objectId(this.selected) : null
  }

  selectById(id: string | null) {
    if (!id || !this.root) {
      this.select(null)
      return
    }
    let found: Object3D | null = null
    this.root.traverse((obj) => {
      if (!found && objectId(obj) === id) found = obj
    })
    this.select(found)
  }

  select(obj: Object3D | null, materialIndex = 0) {
    this.selected = obj
    this.selectedMaterialIndex = Math.max(0, materialIndex)
    this.refreshOutline()
    this.onSelectionChange?.(obj)
  }

  setVisible(id: string, visible: boolean) {
    if (!this.root) return
    this.root.traverse((obj) => {
      if (objectId(obj) === id) obj.visible = visible
    })
    if (this.selected && objectId(this.selected) === id) this.refreshOutline()
  }

  listMaterials(): Array<{ index: number; name: string }> {
    const mesh = this.selected as Mesh | null
    if (!mesh || !mesh.isMesh) return []
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    return mats.map((mat, index) => ({
      index,
      name: mat?.name || `Material ${index + 1}`,
    }))
  }

  /** Unique materials across the vehicle for the Materials panel picker. */
  listUniqueMaterials(limit = 200): Array<{
    key: string
    name: string
    meshId: string
    meshName: string
    slot: number
  }> {
    if (!this.root) return []
    const seen = new Set<string>()
    const out: Array<{
      key: string
      name: string
      meshId: string
      meshName: string
      slot: number
    }> = []
    this.root.traverse((obj) => {
      if (out.length >= limit) return
      const mesh = obj as Mesh
      if (!mesh.isMesh || mesh.name.startsWith('Hotspot_')) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat, slot) => {
        if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return
        const key = mat.uuid || `${mat.name || 'mat'}:${objectId(mesh)}:${slot}`
        if (seen.has(key)) return
        seen.add(key)
        out.push({
          key,
          name: mat.name || `Material ${out.length + 1}`,
          meshId: objectId(mesh),
          meshName: mesh.name || '(unnamed mesh)',
          slot,
        })
      })
    })
    out.sort((a, b) => a.name.localeCompare(b.name) || a.meshName.localeCompare(b.meshName))
    return out
  }

  selectMaterial(meshId: string, slot: number) {
    if (!this.root) return
    let found: Object3D | null = null
    this.root.traverse((obj) => {
      if (!found && objectId(obj) === meshId) found = obj
    })
    this.select(found, slot)
  }

  setMaterialIndex(index: number) {
    this.selectedMaterialIndex = Math.max(0, index)
  }

  getMaterialEdit(): MaterialEditState | null {
    const mat = this.getActiveMaterial()
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return null
    const std = mat as MeshStandardMaterial
    const physical = mat as MeshPhysicalMaterial
    const hasPhysical = (mat as MeshPhysicalMaterial).isMeshPhysicalMaterial === true
    return {
      name: std.name || 'Material',
      color: colorToHex(std.color),
      metalness: std.metalness,
      roughness: std.roughness,
      emissive: colorToHex(std.emissive),
      emissiveIntensity: std.emissiveIntensity,
      opacity: std.opacity,
      transparent: std.transparent,
      envMapIntensity: std.envMapIntensity ?? 1,
      clearcoat: hasPhysical ? physical.clearcoat ?? 0 : 0,
      clearcoatRoughness: hasPhysical ? physical.clearcoatRoughness ?? 0 : 0,
      transmission: hasPhysical ? physical.transmission ?? 0 : 0,
      hasPhysical,
    }
  }

  getSelectedMaterialIndex() {
    return this.selectedMaterialIndex
  }

  getSelectedObject() {
    return this.selected
  }

  patchMaterial(patch: Partial<MaterialEditState>) {
    const mat = this.getActiveMaterial()
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return null
    const std = mat as MeshStandardMaterial
    const physical = mat as MeshPhysicalMaterial
    if (patch.color != null) std.color.set(patch.color)
    if (patch.metalness != null) std.metalness = clamp01(patch.metalness)
    if (patch.roughness != null) std.roughness = clamp01(patch.roughness)
    if (patch.emissive != null) std.emissive.set(patch.emissive)
    if (patch.emissiveIntensity != null) std.emissiveIntensity = Math.max(0, patch.emissiveIntensity)
    if (patch.opacity != null) {
      std.opacity = clamp01(patch.opacity)
      if (std.opacity < 0.999) std.transparent = true
    }
    if (patch.transparent != null) std.transparent = patch.transparent
    if (patch.envMapIntensity != null) std.envMapIntensity = Math.max(0, patch.envMapIntensity)
    if (physical.isMeshPhysicalMaterial) {
      if (patch.clearcoat != null) physical.clearcoat = clamp01(patch.clearcoat)
      if (patch.clearcoatRoughness != null) physical.clearcoatRoughness = clamp01(patch.clearcoatRoughness)
      if (patch.transmission != null) {
        physical.transmission = clamp01(patch.transmission)
        if (physical.transmission > 0.01) {
          std.transparent = true
          physical.thickness = Math.max(physical.thickness || 0, 0.2)
        }
      }
    }
    std.needsUpdate = true
    return this.getMaterialEdit()
  }

  dispose() {
    this.unbindCanvas()
    this.clearOutline()
    this.outlineMat.dispose()
    this.scene = null
    this.root = null
    this.camera = null
    this.onSelectionChange = null
  }

  private getActiveMaterial(): Material | null {
    const mesh = this.selected as Mesh | null
    if (!mesh || !mesh.isMesh) return null
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    return mats[this.selectedMaterialIndex] ?? mats[0] ?? null
  }

  private refreshOutline() {
    this.clearOutline()
    if (!this.selected || !this.scene) return
    const mesh = this.selected as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const edges = new EdgesGeometry(mesh.geometry, 28)
    this.outline = new LineSegments(edges, this.outlineMat)
    this.outline.renderOrder = 20
    mesh.add(this.outline)
  }

  private clearOutline() {
    if (!this.outline) return
    this.outline.parent?.remove(this.outline)
    this.outline.geometry.dispose()
    this.outline = null
  }

  private readonly handleClick = (event: MouseEvent) => {
    if (!this.pickEnabled || !this.camera || !this.canvas || !this.root) return
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.root, true)
    const hit = hits.find(
      (h) =>
        (h.object as Mesh).isMesh &&
        !h.object.name.startsWith('Hotspot_') &&
        h.object.type !== 'LineSegments',
    )
    if (!hit) {
      this.select(null)
      return
    }
    const slot = materialSlotFromHit(hit)
    this.select(hit.object, slot)
  }

  private isDescendant(root: Object3D, node: Object3D) {
    let cur: Object3D | null = node
    while (cur) {
      if (cur === root) return true
      cur = cur.parent
    }
    return false
  }

  private unbindCanvas() {
    this.canvas?.removeEventListener('click', this.handleClick)
    this.canvas = null
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

/** Resolve multi-material slot from a raycast hit (face / groups). */
function materialSlotFromHit(hit: {
  object: Object3D
  face?: { materialIndex?: number } | null
  faceIndex?: number | null
}): number {
  const mesh = hit.object as Mesh
  if (!mesh.isMesh) return 0
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (mats.length <= 1) return 0
  if (hit.face && typeof hit.face.materialIndex === 'number') {
    return Math.max(0, Math.min(mats.length - 1, hit.face.materialIndex))
  }
  const groups = mesh.geometry?.groups
  const faceIndex = hit.faceIndex
  if (groups?.length && faceIndex != null && faceIndex >= 0) {
    const vert = faceIndex * 3
    for (const g of groups) {
      const start = g.start
      const count = g.count
      if (vert >= start && vert < start + count) {
        return Math.max(0, Math.min(mats.length - 1, g.materialIndex ?? 0))
      }
    }
  }
  return 0
}
