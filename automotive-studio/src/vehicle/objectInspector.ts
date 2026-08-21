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
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Material,
  type Scene,
  type Texture,
} from 'three'
import { texturePreviewUrl } from './materialMapPreview'
import {
  isTriplanarEnabled,
  readTriplanarSeed,
  readTriplanarVariation,
  syncMaterialMapProjection,
} from './materialTriplanar'

export type ObjectTreeNode = {
  id: string
  name: string
  type: string
  depth: number
  /** This node's own `visible` flag. */
  visible: boolean
  /** True only when this node and every ancestor are visible. */
  effectiveVisible: boolean
  mesh: boolean
  childCount: number
}

/** Live hover payload for the Materials eyedropper cursor menu. */
export type MaterialHoverInfo = {
  clientX: number
  clientY: number
  meshName: string
  materialName: string
  slot: number
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
  /** UV tiling for material maps (1 = default). */
  mapRepeat: number
  mapProjection: 'uv' | 'triplanar'
  mapTriSeed: number
  mapTriVariation: number
}

export type MaterialMapSlotKey =
  | 'map'
  | 'normal'
  | 'roughness'
  | 'metalness'
  | 'displacement'
  | 'ao'
  | 'emissive'

export type MaterialLiveMapSlot = {
  key: MaterialMapSlotKey
  hasTexture: boolean
  previewUrl: string | null
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
  private pickMode: 'object' | 'material' = 'object'
  private onSelectionChange: ((node: Object3D | null) => void) | null = null
  private onHoverPick: ((info: MaterialHoverInfo | null) => void) | null = null
  private lastHoverKey = ''

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
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
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

  setPickEnabled(enabled: boolean, mode: 'object' | 'material' = 'object') {
    this.pickEnabled = enabled
    this.pickMode = mode
    if (this.canvas) {
      this.canvas.classList.toggle('as-canvas--mat-pick', enabled && mode === 'material')
      this.canvas.classList.toggle('as-canvas--obj-pick', enabled && mode === 'object')
      this.canvas.style.cursor = enabled
        ? mode === 'material'
          ? 'none'
          : 'crosshair'
        : ''
    }
    if (!enabled) {
      this.lastHoverKey = ''
      this.onHoverPick?.(null)
    }
  }

  isPickEnabled() {
    return this.pickEnabled
  }

  setOnSelectionChange(cb: ((node: Object3D | null) => void) | null) {
    this.onSelectionChange = cb
  }

  setOnHoverPick(cb: ((info: MaterialHoverInfo | null) => void) | null) {
    this.onHoverPick = cb
  }

  listTree(maxDepth = 48): ObjectTreeNode[] {
    const out: ObjectTreeNode[] = []
    if (!this.root) return out
    const walk = (obj: Object3D, depth: number, ancestorsVisible: boolean) => {
      if (depth > maxDepth) return
      if (isHotspotObject(obj) || obj.name === 'VehicleRouteGuide') return
      // Skip outline helper meshes attached during selection.
      if (obj.type === 'LineSegments' && obj.parent === this.selected) return
      // Sketchfab logo / discord lettering — hidden and not useful in the picker.
      if (obj.userData?.iomDecor) return
      const mesh = (obj as Mesh).isMesh === true
      if (mesh) {
        const raw = (obj as Mesh).material
        const mats = Array.isArray(raw) ? raw : [raw]
        const matNames = mats.map((m) => m?.name || '').join(' ')
        if (
          /\b(logo|discord|sketchfab|watermark)\b/i.test(matNames) ||
          /\b(logo|discord|sketchfab|watermark)\b/i.test(obj.name)
        ) {
          return
        }
      }
      const selfVisible = obj.visible
      out.push({
        id: objectId(obj),
        name: obj.name || `(${obj.type})`,
        type: obj.type,
        depth,
        visible: selfVisible,
        effectiveVisible: ancestorsVisible && selfVisible,
        mesh,
        childCount: obj.children.length,
      })
      for (const child of obj.children) walk(child, depth + 1, ancestorsVisible && selfVisible)
    }
    walk(this.root, 0, true)
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

  findById(id: string): Object3D | null {
    if (!this.root) return null
    let found: Object3D | null = null
    this.root.traverse((obj) => {
      if (!found && objectId(obj) === id) found = obj
    })
    return found
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
      if (!mesh.isMesh || isHotspotObject(mesh)) return
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
      mapRepeat: readMapRepeat(std),
      mapProjection: isTriplanarEnabled(std) ? 'triplanar' : 'uv',
      mapTriSeed: readTriplanarSeed(std),
      mapTriVariation: readTriplanarVariation(std),
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
    if (patch.mapRepeat != null) {
      const targets =
        this.root && std.name
          ? this.listSharedMaterials(std)
          : [std]
      for (const target of targets) {
        if ((patch.mapProjection ?? (isTriplanarEnabled(target) ? 'triplanar' : 'uv')) === 'triplanar') {
          syncMaterialMapProjection(
            target,
            'triplanar',
            patch.mapRepeat,
            patch.mapTriSeed ?? readTriplanarSeed(target),
            patch.mapTriVariation ?? readTriplanarVariation(target),
            this.root,
          )
        } else {
          applyMapRepeat(target, patch.mapRepeat)
        }
      }
    }
    if (
      patch.mapProjection != null ||
      patch.mapTriSeed != null ||
      patch.mapTriVariation != null
    ) {
      const targets =
        this.root && std.name
          ? this.listSharedMaterials(std)
          : [std]
      const scale = patch.mapRepeat ?? readMapRepeat(std)
      const mode =
        patch.mapProjection ??
        (isTriplanarEnabled(std) ? 'triplanar' : 'uv')
      const seed = patch.mapTriSeed ?? readTriplanarSeed(std)
      const variation = patch.mapTriVariation ?? readTriplanarVariation(std)
      for (const target of targets) {
        syncMaterialMapProjection(target, mode, scale, seed, variation, this.root)
      }
    }
    std.needsUpdate = true
    return this.getMaterialEdit()
  }

  /** Live map presence + GLB thumbnail URLs for the Materials panel. */
  getMaterialLiveMaps(): MaterialLiveMapSlot[] {
    const mat = this.getActiveMaterial()
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return []
    const std = mat as MeshStandardMaterial
    const slots: Array<{ key: MaterialMapSlotKey; tex: Texture | null }> = [
      { key: 'map', tex: std.map },
      { key: 'normal', tex: std.normalMap },
      { key: 'roughness', tex: std.roughnessMap },
      { key: 'metalness', tex: std.metalnessMap },
      { key: 'displacement', tex: std.displacementMap },
      { key: 'ao', tex: std.aoMap },
      { key: 'emissive', tex: std.emissiveMap },
    ]
    return slots.map(({ key, tex }) => ({
      key,
      hasTexture: Boolean(tex),
      previewUrl: texturePreviewUrl(tex),
    }))
  }

  setMaterialMap(slot: MaterialMapSlotKey, texture: Texture | null, opts?: { normalYFlip?: boolean }) {
    const mat = this.getActiveMaterial()
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return false
    const std = mat as MeshStandardMaterial
    const targets = this.listSharedMaterials(std)
    const repeat = readMapRepeat(std)
    for (const target of targets) {
      // Per-material Texture wrapper so UV repeat cannot leak between panels.
      const tex = texture ? texture.clone() : null
      writeMaterialMapSlot(target, slot, tex, repeat, opts)
    }
    return true
  }

  clearAllMaterialMaps() {
    const mat = this.getActiveMaterial()
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) return
    const keys: MaterialMapSlotKey[] = [
      'map',
      'normal',
      'roughness',
      'metalness',
      'displacement',
      'ao',
      'emissive',
    ]
    for (const target of this.listSharedMaterials(mat as MeshStandardMaterial)) {
      for (const key of keys) writeMaterialMapSlot(target, key, null, 1)
    }
  }

  /** Same-named materials across the vehicle (GLBs often clone per panel). */
  private listSharedMaterials(primary: MeshStandardMaterial): MeshStandardMaterial[] {
    if (!this.root || !primary.name) return [primary]
    const found: MeshStandardMaterial[] = []
    const seen = new Set<MeshStandardMaterial>()
    this.root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
        const std = mat as MeshStandardMaterial
        if (std.name !== primary.name) continue
        if (seen.has(std)) continue
        seen.add(std)
        found.push(std)
      }
    })
    return found.length ? found : [primary]
  }

  dispose() {
    this.unbindCanvas()
    this.clearOutline()
    this.outlineMat.dispose()
    this.scene = null
    this.root = null
    this.camera = null
    this.onSelectionChange = null
    this.onHoverPick = null
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
    const hit = this.hitTest(event.clientX, event.clientY)
    if (!hit) {
      this.select(null)
      return
    }
    this.select(hit.object, hit.slot)
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.pickEnabled || this.pickMode !== 'material' || !this.onHoverPick) return
    const hit = this.hitTest(event.clientX, event.clientY)
    if (!hit) {
      this.lastHoverKey = ''
      this.onHoverPick({
        clientX: event.clientX,
        clientY: event.clientY,
        meshName: '',
        materialName: 'Click a panel',
        slot: 0,
      })
      return
    }
    const key = `${hit.object.uuid}:${hit.slot}`
    this.lastHoverKey = key
    this.onHoverPick({
      clientX: event.clientX,
      clientY: event.clientY,
      meshName: hit.object.name || hit.object.type,
      materialName: hit.materialName,
      slot: hit.slot,
    })
  }

  private readonly handlePointerLeave = () => {
    if (!this.lastHoverKey && !this.onHoverPick) return
    this.lastHoverKey = ''
    this.onHoverPick?.(null)
  }

  private hitTest(clientX: number, clientY: number): {
    object: Object3D
    slot: number
    materialName: string
  } | null {
    if (!this.camera || !this.canvas || !this.root) return null
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.root, true)
    const hit = hits.find(
      (h) =>
        (h.object as Mesh).isMesh &&
        !isHotspotObject(h.object) &&
        h.object.type !== 'LineSegments',
    )
    if (!hit) return null
    const slot = materialSlotFromHit(hit)
    const mesh = hit.object as Mesh
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const mat = mats[slot] ?? mats[0]
    return {
      object: hit.object,
      slot,
      materialName: mat?.name || `Slot ${slot}`,
    }
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
    this.canvas?.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas?.removeEventListener('pointerleave', this.handlePointerLeave)
    this.canvas?.classList.remove('as-canvas--mat-pick', 'as-canvas--obj-pick')
    this.canvas = null
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function materialTextures(std: MeshStandardMaterial): Texture[] {
  return [
    std.map,
    std.normalMap,
    std.roughnessMap,
    std.metalnessMap,
    std.displacementMap,
    std.aoMap,
    std.emissiveMap,
  ].filter((t): t is Texture => Boolean(t))
}

function readMapRepeat(std: MeshStandardMaterial): number {
  if (isTriplanarEnabled(std) && typeof std.userData.iomTriScale === 'number') {
    const s = std.userData.iomTriScale as number
    if (Number.isFinite(s) && s > 0) return Math.max(0.0625, Math.min(1024, s))
  }
  const tex = materialTextures(std)[0]
  const r = tex?.repeat?.x
  if (typeof r === 'number' && Number.isFinite(r) && r > 0) {
    return Math.max(0.0625, Math.min(1024, r))
  }
  return 1
}

function applyMapRepeat(std: MeshStandardMaterial, repeat: number) {
  const r = Math.max(0.0625, Math.min(1024, repeat))
  for (const tex of materialTextures(std)) {
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(r, r)
    tex.updateMatrix()
    tex.needsUpdate = true
  }
}

function writeMaterialMapSlot(
  std: MeshStandardMaterial,
  slot: MaterialMapSlotKey,
  texture: Texture | null,
  repeat: number,
  opts?: { normalYFlip?: boolean },
) {
  switch (slot) {
    case 'map':
      std.map = texture
      break
    case 'normal':
      std.normalMap = texture
      break
    case 'roughness':
      std.roughnessMap = texture
      break
    case 'metalness':
      std.metalnessMap = texture
      break
    case 'displacement':
      std.displacementMap = texture
      break
    case 'ao':
      std.aoMap = texture
      break
    case 'emissive':
      std.emissiveMap = texture
      break
  }
  if (texture) {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(repeat, repeat)
    texture.updateMatrix()
    if (slot === 'map' || slot === 'emissive') {
      texture.colorSpace = SRGBColorSpace
    }
    texture.needsUpdate = true
  }
  if (slot === 'displacement') {
    std.displacementScale = 0
    std.displacementBias = 0
  }
  if (slot === 'ao' && texture) {
    std.aoMapIntensity = 1
  }
  if (slot === 'normal' || opts?.normalYFlip != null) {
    const flip = opts?.normalYFlip === true
    std.normalScale = new Vector2(1, flip ? -1 : 1)
  }
  std.needsUpdate = true
}

function isHotspotObject(obj: Object3D): boolean {
  let cur: Object3D | null = obj
  while (cur) {
    if (cur.name.startsWith('Hotspot_') || typeof cur.userData.hotspotId === 'string') {
      return true
    }
    cur = cur.parent
  }
  return false
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
