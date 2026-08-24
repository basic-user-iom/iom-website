import {
  Box3,
  BufferAttribute,
  Color,
  DoubleSide,
  FrontSide,
  Line,
  Mesh,
  NoColorSpace,
  Points,
  ClampToEdgeWrapping,
  RepeatWrapping,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import type { SceneBounds } from '../scene/SceneBounds'
import type { QualityConfig } from '../performance/QualityManager'

/** Color (sRGB) maps vs linear data maps — wrong space makes normals/ORM look black. */
const COLOR_TEX_KEYS = new Set([
  'map',
  'emissiveMap',
  'specularColorMap',
  'sheenColorMap',
  'envMap',
])
const DATA_TEX_KEYS = new Set([
  'normalMap',
  'bumpMap',
  'displacementMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'alphaMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'sheenRoughnessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'anisotropyMap',
  'specularIntensityMap',
  'lightMap',
])

const _worldBox = new Box3()
const _boxSize = new Vector3()
const _worldPos = new Vector3()

/** Confirmed architectural glass / glazing names (DE + EN). Avoid matching "Frame_Windows". */
const GLASS_NAME =
  /\bglas(s|ing)?\b|\bfenster\b|\bscheib|\bverglas|curtain\s*wall|curtainwall|vitrine|storefront|skylight|dachfenster|oberlicht|lichtkuppel/i

const NOT_GLASS_NAME = /frame|mullion|sash|rail|handle|seal|gasket|profil/i

/** Pools / ponds — V-Ray water uses transmission like glass, but must keep its texture. */
const WATER_NAME = /wasser|water|\bteich\b|\bsee\b|\bpond\b|\bpool\b|brunnen|fountain/i

/** Roof edges / cladding that CAD often assigns a glass material by mistake. */
const OPAQUE_ARCH_NAME =
  /dach[_-]?rand|dachkante|attika|gesims|wellblech|soffit|fascia|dach[_-]?allu|\bdach(_\d+)?\b/i

/** 2D CAD underlays / BIM exhibition planes — not architecture. */
const CAD_OVERLAY_NAME =
  /ausstellung|bim[\s._-]?world|grundriss|lageplan|floorplan|floor[\s._-]?plan|linework|zeichnung|dwg|dxf|\bcad\b|2d[\s._-]?plan|annotation/i

/** Duplicate roof fill only — never hide plaza / grass / walkway terrain. */
const CAD_FILL_MATERIAL = /^dach allu 2$/i

/** CAD massing slabs (no albedo) that sit on top of the real plaza and hide it. */
const UNTEXTURED_GROUND_FILL =
  /strasse[_\\s-]?grau|street[_\\s-]?gr[ae]y|asphalt[_\\s-]?grau|^STRASSE_GRAU$/i

/** Locator planes that are not terrain (tree locators, pivot slabs). */
const CAD_FILL_NODE = /Baum_position|gebude_123/i

/** Façade louvers — DoubleSide self-z-fights on overlapping slats. */
const SHUTTER_NAME = /lamelle|jalousie|raffstore|louver|shutter|rollladen/i

const CEILING_NAME = /decke|ceiling|soffit|untersicht|plafond|unterdecke|abgehaeng|abhäng|abhang/i

function objectPathName(obj: Object3D): string {
  const names: string[] = []
  let cur: Object3D | null = obj
  for (let i = 0; i < 8 && cur; i++) {
    if (cur.name) names.push(cur.name)
    cur = cur.parent
  }
  return names.join(' ')
}

function meshMaterialNames(mesh: Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return mats.map((m) => m?.name || '').join(' ')
}

function forEachMaterial(mesh: Mesh, fn: (mat: Material) => void): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const mat of mats) {
    if (mat) fn(mat)
  }
}

function forEachTexture(
  mat: Material,
  fn: (tex: Texture, key: string) => void,
): void {
  const m = mat as Material & Record<string, unknown>
  for (const key of Object.keys(m)) {
    const val = m[key]
    if (val && typeof val === 'object' && (val as Texture).isTexture) {
      fn(val as Texture, key)
    }
  }
}

/** Ensure GLTF textures keep the correct color space after quality tweaks. */
function hardenTextureColorSpace(tex: Texture, key: string): void {
  if ((tex as Texture & { isCompressedTexture?: boolean }).isCompressedTexture) return
  if (COLOR_TEX_KEYS.has(key)) {
    if (tex.colorSpace !== SRGBColorSpace) {
      tex.colorSpace = SRGBColorSpace
      tex.needsUpdate = true
    }
    return
  }
  if (DATA_TEX_KEYS.has(key)) {
    if (tex.colorSpace !== NoColorSpace) {
      tex.colorSpace = NoColorSpace
      tex.needsUpdate = true
    }
  }
}

function materialLooksGlass(mat: Material): boolean {
  const name = mat.name || ''
  if (WATER_NAME.test(name)) return false
  if (NOT_GLASS_NAME.test(name)) return false
  if (GLASS_NAME.test(name)) return true
  const any = mat as Material & {
    transmission?: number
    opacity?: number
    transparent?: boolean
  }
  // Transmission-only: real glass. Don't treat every translucent ceramic/paint as glass.
  if ((any.transmission ?? 0) > 0.02) return true
  return false
}

function isWaterMesh(mesh: Mesh): boolean {
  const name = `${mesh.name || ''} ${objectPathName(mesh)} ${meshMaterialNames(mesh)}`
  return WATER_NAME.test(name)
}

function isGlassMesh(mesh: Mesh): boolean {
  if (isWaterMesh(mesh)) return false
  const name = `${mesh.name || ''} ${objectPathName(mesh)}`
  if (NOT_GLASS_NAME.test(name)) return false
  if (OPAQUE_ARCH_NAME.test(name)) return false
  if (GLASS_NAME.test(name)) return true
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return mats.some((m) => m && materialLooksGlass(m))
}

function hideCadOverlay(obj: Object3D): void {
  obj.visible = false
  obj.userData.cadOverlay = true
  obj.userData.detailLodIgnore = true
}

function isDegenerateGroundPlane(mesh: Mesh, size: Vector3): boolean {
  if (size.y >= 0.04) return false
  const footprint = size.x * size.z
  if (footprint < 80) return false
  // Campus-sized sheets (Plane001.001 ≈ 509×448 m) fill plaza holes — keep them.
  if (footprint >= 20_000) return false
  const label = `${objectPathName(mesh)} ${mesh.name} ${meshMaterialNames(mesh)}`
  return /baum_position|plane001|gebude_123/i.test(label)
}

function hideCadFillMaterials(mesh: Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (!mats.some((m) => m && CAD_FILL_MATERIAL.test(m.name || ''))) return false
  if (mats.every((m) => !m || CAD_FILL_MATERIAL.test(m.name || ''))) {
    hideCadOverlay(mesh)
    return true
  }
  const next = mats.map((m) => {
    if (!m || !CAD_FILL_MATERIAL.test(m.name || '')) return m
    const clone = m.clone()
    clone.visible = false
    return clone
  })
  mesh.material = Array.isArray(mesh.material) ? next : next[0]!
  return false
}

function isCadOverlayObject(obj: Object3D): boolean {
  if (obj.userData?.cadOverlay) return true
  let ancestor: Object3D | null = obj.parent
  while (ancestor) {
    if (ancestor.userData?.cadOverlay) return true
    ancestor = ancestor.parent
  }
  if ((obj as Line).isLine || (obj as Points).isPoints) return true
  const path = `${obj.name || ''} ${objectPathName(obj)}`
  if (CAD_OVERLAY_NAME.test(obj.name || '') || CAD_FILL_NODE.test(path)) return true
  if ((obj as Mesh).isMesh) {
    const mesh = obj as Mesh
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (mats.some((m) => m && CAD_OVERLAY_NAME.test(m.name || ''))) return true
    if (mats.length > 0 && mats.every((m) => !m || CAD_FILL_MATERIAL.test(m.name || ''))) return true
  }
  return false
}

/**
 * Non-glass: DoubleSide only when needed (open sheets, cutouts, foliage).
 * Closed thin volumes (roof edges, frames) stay FrontSide — DoubleSide z-fights
 * the inner/outer faces and reads as a flickering black slab.
 */
function wantsDoubleSide(
  mesh: Mesh,
  mat: Material,
  isThinSheet: boolean,
  isLargeHorizontal: boolean,
  treatOpaque: boolean,
  _minDim: number,
): boolean {
  const name = `${mesh.name} ${objectPathName(mesh)} ${mat.name}`
  if (SHUTTER_NAME.test(name)) return false
  // Roof-edge boxes: winding is repaired; DoubleSide still z-fights at some zooms.
  if (OPAQUE_ARCH_NAME.test(name)) return false
  // Floors, plaza, and ceilings must read from above and below.
  // FrontSide + "faces up" hid foyer slabs when looking at the ceiling.
  if (mesh.userData?.paperThinGround) return true
  if (isLargeHorizontal) return true
  if (isThinSheet) return true
  if (!treatOpaque && (mat.transparent || mat.opacity < 0.98)) return true
  if (mat.side === DoubleSide) return true
  const alphaTest = (mat as Material & { alphaTest?: number }).alphaTest ?? 0
  if (alphaTest > 0) return true
  return /curtain|panel|plane|sign|fence|rail|leaf|foliage|double|twosided|2sided|decal|logo|icon/.test(
    name.toLowerCase(),
  )
}

type CadMat = Material & {
  opacity?: number
  transparent?: boolean
  metalness?: number
  roughness?: number
  color?: Color
  map?: Texture | null
  alphaMap?: Texture | null
  envMapIntensity?: number
  forceSinglePass?: boolean
}

function uvSpanIsWild(geom: Mesh['geometry']): boolean {
  const uv = geom.getAttribute('uv')
  if (!uv || uv.count < 1) return true
  let minU = Infinity
  let minV = Infinity
  let maxU = -Infinity
  let maxV = -Infinity
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    if (u < minU) minU = u
    if (v < minV) minV = v
    if (u > maxU) maxU = u
    if (v > maxV) maxV = v
  }
  const span = Math.max(maxU - minU, maxV - minV)
  if (!Number.isFinite(span)) return true
  // Tiled plazas routinely span >> 12 UV units. Only rewrite collapsed or garbage UVs.
  return span > 512 || span < 0.02
}

function ensurePlanarGroundUvs(mesh: Mesh, size: Vector3): void {
  const geom = mesh.geometry
  if (!geom || geom.userData?.planarUvApplied) return
  if (size.y > 1.2 || size.x * size.z < 80) return
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const mapped = mats.some((m) => m && (m as CadMat).map)
  if (!mapped) return
  if (geom.getAttribute('uv') && !uvSpanIsWild(geom) && !isWaterMesh(mesh)) return
  const pos = geom.getAttribute('position')
  if (!pos || pos.count < 3) return
  const owned = geom.clone()
  const src = owned.getAttribute('position')
  if (!src) return
  const uvs = new Float32Array(src.count * 2)
  const v = new Vector3()
  mesh.updateWorldMatrix(true, false)
  if (isWaterMesh(mesh)) {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld)
      if (v.x < minX) minX = v.x
      if (v.x > maxX) maxX = v.x
      if (v.z < minZ) minZ = v.z
      if (v.z > maxZ) maxZ = v.z
    }
    const dx = Math.max(1e-4, maxX - minX)
    const dz = Math.max(1e-4, maxZ - minZ)
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld)
      uvs[i * 2] = (v.x - minX) / dx
      uvs[i * 2 + 1] = (v.z - minZ) / dz
    }
  } else {
    const tile = 4
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld)
      uvs[i * 2] = v.x / tile
      uvs[i * 2 + 1] = v.z / tile
    }
  }
  owned.setAttribute('uv', new BufferAttribute(uvs, 2))
  owned.userData.planarUvApplied = true
  mesh.geometry = owned
  forEachMaterial(mesh, (mat) => {
    const map = (mat as CadMat).map
    if (!map) return
    map.wrapS = isWaterMesh(mesh) ? ClampToEdgeWrapping : RepeatWrapping
    map.wrapT = isWaterMesh(mesh) ? ClampToEdgeWrapping : RepeatWrapping
    map.needsUpdate = true
  })
}

/** Max default / numeric CAD paints at ~0,0,0 — skip named black/chrome. */
function shouldLiftCadBlack(mat: Material): boolean {
  const m = mat as CadMat
  if (m.map) return false
  if ((m.metalness ?? 0) > 0.45) return false
  if (!m.color) return false
  const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722
  if (lum >= 0.035) return false
  const name = mat.name || ''
  if (/schwarz|black|chrome|chrom|rubber|leather|\bdark\b|dunkel|anthrazit|asphalt|royal/i.test(name)) {
    return false
  }
  return /mat[_\s]?\d+|default|material\s*\d+|material\.\d+/i.test(name) || lum < 0.008
}

/** V-Ray/CAD often exports solid paint as BLEND with alpha ≈ 1 — draws black, no depth. */
function isNearOpaqueCadBlend(mat: Material): boolean {
  const m = mat as CadMat
  const opacity = m.opacity ?? 1
  const blendish = m.transparent === true || opacity < 1
  if (!blendish) return false
  if (opacity < 0.95) return false
  if (m.alphaMap) return false
  if ((m as Material & { alphaTest?: number }).alphaTest) return false
  if ((m as Material & { transmission?: number }).transmission) return false
  return true
}

type GlassMat = Material & {
  transmission?: number
  thickness?: number
  roughness?: number
  envMapIntensity?: number
  forceSinglePass?: boolean
  metalness?: number
  color?: Color
  map?: Texture | null
  specularColor?: Color
  specularIntensity?: number
  normalMap?: Texture | null
  normalScale?: { set: (x: number, y: number) => void }
  bumpMap?: Texture | null
  clearcoatNormalMap?: Texture | null
  transmissionMap?: Texture | null
  thicknessMap?: Texture | null
}

/**
 * Remove the physical-transmission pass from materials that this pipeline has
 * deliberately classified as opaque. Even a tiny non-zero transmission value
 * makes Three.js render the material in an additional transmission prepass.
 */
function stripOpaqueTransmission(mat: Material): void {
  const physical = mat as GlassMat
  if ((physical.transmission ?? 0) !== 0) physical.transmission = 0
  if ((physical.thickness ?? 0) !== 0) physical.thickness = 0
  if (physical.transmissionMap) physical.transmissionMap = null
  if (physical.thicknessMap) physical.thicknessMap = null
}

/** Keep the authored water albedo. Transmission-as-glass punched holes in the plaza. */
function applyWaterMaterial(mat: Material): void {
  const g = mat as GlassMat
  mat.transparent = false
  mat.opacity = 1
  mat.depthTest = true
  mat.depthWrite = true
  mat.side = FrontSide
  g.forceSinglePass = true
  if ((g.transmission ?? 0) > 0) g.transmission = 0
  if (g.thickness != null) g.thickness = 0
  if (g.metalness != null && g.metalness > 0.2) g.metalness = 0
  if (g.roughness != null) g.roughness = Math.max(0.18, Math.min(0.55, g.roughness))
  if (g.envMapIntensity != null) g.envMapIntensity = Math.min(1.1, Math.max(0.35, g.envMapIntensity))
  forEachTexture(mat, (tex, key) => hardenTextureColorSpace(tex, key))
  if (g.map) {
    g.map.wrapS = ClampToEdgeWrapping
    g.map.wrapT = ClampToEdgeWrapping
    g.map.needsUpdate = true
  }
  mat.polygonOffset = false
  mat.polygonOffsetFactor = 0
  mat.polygonOffsetUnits = 0
  mat.needsUpdate = true
}

/**
 * Glass panes from CAD often have flipped vertex normals and/or a damaged normal atlas.
 * Prefer opacity+env glass over MeshPhysical transmission: transmission into empty or
 * floor-culled interiors draws as solid black rectangles in door openings.
 */
function applyGlassMaterial(mat: Material, _bothSides: boolean, depthBias = 0): void {
  const g = mat as GlassMat
  mat.transparent = true
  mat.depthTest = true
  mat.depthWrite = false

  // Always both sides — CAD winding/normals are unreliable on curtain walls & skylights.
  mat.side = DoubleSide
  g.forceSinglePass = true

  // Broken normal / transmission maps produce view-dependent black tiles on glass.
  if (g.normalMap) {
    g.normalMap = null
    g.normalScale?.set(1, 1)
  }
  if (g.bumpMap) g.bumpMap = null
  if (g.clearcoatNormalMap) g.clearcoatNormalMap = null
  if (g.transmissionMap) g.transmissionMap = null
  if (g.thicknessMap) g.thicknessMap = null

  // Glass path previously skipped color-space hardening on maps.
  forEachTexture(mat, (tex, key) => hardenTextureColorSpace(tex, key))

  // Source CAD often authors pure-black glass factors.
  if (g.color) {
    const lum = g.color.r * 0.2126 + g.color.g * 0.7152 + g.color.b * 0.0722
    if (lum < 0.12) g.color.setRGB(0.72, 0.8, 0.84)
    else if (lum < 0.35) g.color.lerp(new Color(0.78, 0.85, 0.88), 0.35)
  }

  // Metallic glass + near-0 roughness → mirror voids / black rectangles.
  if (g.metalness != null && g.metalness > 0.15) g.metalness = 0.02
  if (g.specularColor) {
    const sc = g.specularColor
    if (sc.r > 1 || sc.g > 1 || sc.b > 1) sc.setRGB(Math.min(1, sc.r), Math.min(1, sc.g), Math.min(1, sc.b))
  }
  if (g.specularIntensity != null && g.specularIntensity > 1) g.specularIntensity = 1

  // Convert transmission → opacity glass (stable through door openings).
  const hadTransmission = (g.transmission ?? 0) > 0.01
  if (hadTransmission) {
    const t = Math.min(1, g.transmission ?? 0)
    g.transmission = 0
    if (g.thickness != null) g.thickness = 0
    const targetOpacity = 0.22 + (1 - t) * 0.35
    mat.opacity = Math.min(mat.opacity ?? 1, targetOpacity)
    if (g.roughness != null) g.roughness = Math.max(0.12, Math.min(0.45, g.roughness))
    if (g.envMapIntensity != null) g.envMapIntensity = Math.max(0.85, Math.min(1.4, g.envMapIntensity))
    else g.envMapIntensity = 1.05
  } else {
    if ((mat.opacity ?? 1) > 0.85) mat.opacity = 0.45
    if (g.roughness != null && g.roughness < 0.12) g.roughness = 0.12
    if (g.envMapIntensity != null && g.envMapIntensity < 0.7) g.envMapIntensity = 0.9
  }

  // Bias separates coplanar exterior+animated glass (camera-dependent z-fight).
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -2 - depthBias
  mat.polygonOffsetUnits = -2 - depthBias * 2
  mat.needsUpdate = true
}

/** Flip inverted CAD triangles so Front/DoubleSide lighting is consistent. */
function hardenCadWinding(mesh: Mesh): void {
  const geom = mesh.geometry
  if (!geom || geom.userData?.cadWindingHardened) return
  geom.userData.cadWindingHardened = true
  const pos = geom.getAttribute('position')
  const index = geom.getIndex()
  if (!pos || !index || index.count < 9) return

  let cx = 0
  let cy = 0
  let cz = 0
  const n = pos.count
  for (let i = 0; i < n; i++) {
    cx += pos.getX(i)
    cy += pos.getY(i)
    cz += pos.getZ(i)
  }
  cx /= n
  cy /= n
  cz /= n

  const arr = index.array as Uint16Array | Uint32Array | number[]
  let flipped = 0
  for (let i = 0; i < index.count; i += 3) {
    const ia = arr[i]!
    const ib = arr[i + 1]!
    const ic = arr[i + 2]!
    const ax = pos.getX(ia)
    const ay = pos.getY(ia)
    const az = pos.getZ(ia)
    const bx = pos.getX(ib)
    const by = pos.getY(ib)
    const bz = pos.getZ(ib)
    const cxv = pos.getX(ic)
    const cyv = pos.getY(ic)
    const czv = pos.getZ(ic)
    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cxv - ax
    const vy = cyv - ay
    const vz = czv - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const mx = (ax + bx + cxv) / 3 - cx
    const my = (ay + by + cyv) / 3 - cy
    const mz = (az + bz + czv) / 3 - cz
    if (nx * mx + ny * my + nz * mz < 0) {
      arr[i + 1] = ic
      arr[i + 2] = ib
      flipped += 1
    }
  }
  if (flipped > 0) {
    index.needsUpdate = true
    geom.computeVertexNormals()
  }
}
function hardenGlassGeometry(mesh: Mesh): void {
  const geom = mesh.geometry
  if (!geom?.getAttribute('position')) return
  if (!geom.getAttribute('normal')) {
    geom.computeVertexNormals()
  }
  // Mark so we don't repeatedly process.
  if (geom.userData?.glassNormalsHardened) return
  geom.userData.glassNormalsHardened = true
}

/**
 * Prepare architectural meshes for stable depth + shadows.
 * Glass: no shadows, FrontSide flat panes, depthWrite off — stops black squares
 * when glass is viewed through other glass / reflective surfaces.
 */
export function prepareArchitecturalMeshes(
  root: Object3D,
  bounds: SceneBounds,
  options?: {
    freezeStatic?: boolean
    animatedNodeNames?: ReadonlySet<string>
    glassDepthBias?: number
    lightmapped?: boolean
  },
): void {
  const areaThreshold = Math.max(bounds.maxDim * bounds.maxDim * 0.0015, 40)
  const freezeStatic = options?.freezeStatic !== false
  const animatedNodeNames = options?.animatedNodeNames
  const glassDepthBias = Math.max(0, options?.glassDepthBias ?? 0)
  const lightmapped = Boolean(options?.lightmapped)
  /** Reuse cloned glass materials per (source, sides, bias). */
  const glassMatCache = new Map<string, Material>()
  /** Opaque: clone per (source uuid, side) so shared materials are not mutated last-wins. */
  const sideMatCache = new Map<string, Material>()

  root.updateMatrixWorld(true)
  let cadHidden = 0
  root.traverse((obj) => {
    if (isCadOverlayObject(obj)) {
      if (!obj.userData?.cadOverlay) cadHidden += 1
      hideCadOverlay(obj)
    }

    const animationTarget = Boolean(obj.name && animatedNodeNames?.has(obj.name))
    if (
      freezeStatic &&
      !animationTarget &&
      !(obj as Mesh).isMesh &&
      !(obj as SkinnedMesh).isSkinnedMesh
    ) {
      if (!obj.userData?.proceduralInstanced && !obj.userData?.proceduralBatched) {
        obj.matrixAutoUpdate = false
        obj.updateMatrix()
      }
    }

    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    if (mesh.userData?.collisionOnly || mesh.userData?.cadOverlay) return
    const skinned = (obj as SkinnedMesh).isSkinnedMesh

    _worldBox.setFromObject(mesh)
    _worldBox.getSize(_boxSize)
    if (isDegenerateGroundPlane(mesh, _boxSize)) {
      cadHidden += 1
      hideCadOverlay(mesh)
      return
    }
    if (hideCadFillMaterials(mesh)) {
      cadHidden += 1
      return
    }
    const fillMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const campusGroundFill =
      (UNTEXTURED_GROUND_FILL.test(meshMaterialNames(mesh)) || /^plane001/i.test(mesh.name || '')) &&
      fillMats.every((m) => !m || !(m as CadMat).map) &&
      _boxSize.x * _boxSize.z >= 500
    if (campusGroundFill) {
      // Campus-sized untextured street massing sits above cobble and hides it.
      // Keep it as a hole-fill, but drop it under the textured decks (world Y).
      _worldBox.setFromObject(mesh)
      const dy = -0.04 - _worldBox.max.y
      if (dy < 0) {
        mesh.getWorldPosition(_worldPos)
        _worldPos.y += dy
        if (mesh.parent) mesh.parent.worldToLocal(_worldPos)
        mesh.position.copy(_worldPos)
        mesh.updateMatrixWorld(true)
      }
      mesh.userData.groundUnderlay = true
      mesh.renderOrder = -2
      _worldBox.setFromObject(mesh)
      _worldBox.getSize(_boxSize)
    }
    const path = objectPathName(mesh)
    ensurePlanarGroundUvs(mesh, _boxSize)

    const footprint = _boxSize.x * _boxSize.z
    const minDim = Math.min(_boxSize.x, _boxSize.y, _boxSize.z)
    const thin = _boxSize.y <= Math.max(_boxSize.x, _boxSize.z) * 0.06 + 0.45
    const isThinSheet = minDim <= 0.08
    const isLargeHorizontal = thin && footprint >= areaThreshold
    const water = isWaterMesh(mesh)
    const glass = !water && isGlassMesh(mesh)
    const opaqueArch = OPAQUE_ARCH_NAME.test(`${mesh.name || ''} ${path}`)
    const shutter = SHUTTER_NAME.test(`${mesh.name} ${path} ${meshMaterialNames(mesh)}`)
    if (shutter) mesh.userData.shutter = true
    if (water) {
      mesh.userData.waterSurface = true
      mesh.userData.floorSurface = true
      mesh.userData.detailLodIgnore = true
      mesh.userData.floorZoneAlways = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.renderOrder = 1
    } else if (!glass && !opaqueArch && footprint >= 80 && _boxSize.y < 0.45) {
      mesh.userData.paperThinGround = true
    }

    mesh.frustumCulled = true
    if (glass) {
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.userData.architecturalGlass = true
      // Detail LOD / floor zoning must never hide glass — edge-on panes flicker black.
      mesh.userData.detailLodIgnore = true
      mesh.userData.floorZoneAlways = true
      // Draw after opaque so opacity glass composites over lobby/backdrop.
      mesh.renderOrder = 2
      hardenGlassGeometry(mesh)
    } else if (lightmapped) {
      // Baked GI: realtime shadows on paper-thin CAD flicker (acne + z-fight).
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.userData.detailLodIgnore = true
      mesh.userData.floorZoneAlways = true
      mesh.userData.lightmappedSlice = true
    } else {
      // Thin closed shells (roof edges ~0.5 m) self-shadow black on a coarse map.
      const selfShadowRisk = minDim > 0 && minDim < 0.9 && !isLargeHorizontal
      mesh.receiveShadow = !selfShadowRisk && (isLargeHorizontal || footprint > 0.35)
      mesh.castShadow = !isLargeHorizontal && !selfShadowRisk
      const keepHorizontal =
        (isLargeHorizontal || Boolean(mesh.userData.paperThinGround) || CEILING_NAME.test(path)) &&
        !opaqueArch
      if (keepHorizontal) {
        mesh.userData.floorSurface = true
        mesh.userData.detailLodIgnore = true
        mesh.userData.floorZoneAlways = true
      }
      if (!skinned && !lightmapped) {
        // Don't flip paper-thin slabs to +Y — that hides ceilings from below.
        if (!mesh.userData.paperThinGround) hardenCadWinding(mesh)
      }
    }

    if (freezeStatic && !animationTarget && !skinned) {
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
    }

    forEachMaterial(mesh, (mat) => {
      if (water) {
        const key = `${mat.uuid}|water`
        let target = sideMatCache.get(key)
        if (!target) {
          target = mat.clone()
          applyWaterMaterial(target)
          sideMatCache.set(key, target)
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target! : m))
        } else if (mesh.material === mat) {
          mesh.material = target
        }
        return
      }

      if (glass) {
        const key = `${mat.uuid}|ds|${glassDepthBias}`
        let target = glassMatCache.get(key)
        if (!target) {
          target = mat.clone()
          applyGlassMaterial(target, true, glassDepthBias)
          glassMatCache.set(key, target)
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target! : m))
        } else if (mesh.material === mat) {
          mesh.material = target
        }
        return
      }

      forEachTexture(mat, (tex, key) => hardenTextureColorSpace(tex, key))

      const alphaTest = (mat as Material & { alphaTest?: number }).alphaTest ?? 0
      const shutterMat = Boolean(mesh.userData.shutter) || SHUTTER_NAME.test(`${mesh.name} ${mat.name}`)
      const physicalTransmission = (mat as GlassMat).transmission ?? 0
      const cadBlend =
        isNearOpaqueCadBlend(mat) ||
        (opaqueArch &&
          (mat.transparent || (mat.opacity ?? 1) < 0.98 || physicalTransmission > 0))
      const liftBlack = shouldLiftCadBlack(mat)
      const groundFill =
        Boolean(mesh.userData.paperThinGround) && !(mat as CadMat).map
      const nextSide =
        lightmapped && !shutterMat
          ? DoubleSide
          : wantsDoubleSide(
                mesh,
                mat,
                isThinSheet,
                isLargeHorizontal,
                cadBlend,
                minDim,
              )
            ? DoubleSide
            : FrontSide
      const needsOffset = alphaTest > 0 || shutterMat || groundFill || lightmapped
      const needsDepthOff =
        !cadBlend && mat.transparent && mat.opacity < 0.98 && alphaTest <= 0
      const needsTwoSidedLight = nextSide === DoubleSide
      const cad = mat as CadMat
      const needsClone =
        mat.side !== nextSide ||
        cadBlend ||
        liftBlack ||
        (needsTwoSidedLight && cad.forceSinglePass !== true) ||
        (needsOffset && !mat.polygonOffset) ||
        (!needsOffset && mat.polygonOffset) ||
        (needsDepthOff && mat.depthWrite !== false)

      let target = mat
      if (needsClone) {
        const key = `${mat.uuid}|s${nextSide}|o${needsOffset ? (shutterMat ? 2 : groundFill ? 3 : lightmapped ? 4 : 1) : 0}|d${needsDepthOff ? 0 : 1}|b${glassDepthBias}|c${cadBlend ? 1 : 0}|k${liftBlack ? 1 : 0}|lm${lightmapped ? 1 : 0}`
        let cached = sideMatCache.get(key)
        if (!cached) {
          cached = mat.clone()
          cached.side = nextSide
          if (needsTwoSidedLight) (cached as CadMat).forceSinglePass = true
          if (cadBlend) {
            cached.transparent = false
            cached.opacity = 1
            cached.depthWrite = true
            stripOpaqueTransmission(cached)
          }
          if (liftBlack) {
            const lifted = cached as CadMat
            lifted.color?.setRGB(0.16, 0.16, 0.17)
            if (lifted.roughness != null && lifted.roughness < 0.25) lifted.roughness = 0.45
          }
          if (needsOffset) {
            cached.polygonOffset = true
            // Blinds: pull slightly forward of coplanar façade glass. Cutouts: push back.
            // Untextured plaza fills sit behind textured cobble/grass so holes stay filled.
            // Lightmapped slices pull forward of the campus copy when both are visible.
            cached.polygonOffsetFactor = shutterMat || lightmapped ? -1 : 1
            cached.polygonOffsetUnits = shutterMat || lightmapped ? -1 : 1
          } else {
            cached.polygonOffset = false
            cached.polygonOffsetFactor = 0
            cached.polygonOffsetUnits = 0
          }
          if (needsDepthOff) cached.depthWrite = false
          cached.needsUpdate = true
          sideMatCache.set(key, cached)
        }
        target = cached
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target : m))
        } else if (mesh.material === mat) {
          mesh.material = target
        }
      }
    })
  })
  if (cadHidden > 0) {
    console.info(`[Viewer] hid ${cadHidden} CAD overlay object${cadHidden === 1 ? '' : 's'}`)
  }
}

/** Apply quality-dependent texture / shadow caster knobs without reloading the GLB. */
export function applyMeshQuality(root: Object3D, config: QualityConfig): void {
  const anisotropy = Math.max(1, config.anisotropy)
  const cullTinyCasters = config.id === 'QUEST' || config.id === 'DESKTOP_BALANCED'
  const tinyArea = config.id === 'QUEST' ? 2 : 1.25

  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    if (mesh.userData?.collisionOnly) return

    if (mesh.userData?.architecturalGlass || isGlassMesh(mesh)) {
      mesh.castShadow = false
      mesh.receiveShadow = false
    } else {
      const part = mesh.userData?.partSize as { sx?: number; sy?: number; sz?: number } | undefined
      const instanced = Boolean(mesh.userData?.proceduralInstanced)
      if (instanced && part && typeof part.sx === 'number' && typeof part.sz === 'number') {
        const footprint = part.sx * part.sz
        const mass = footprint >= 12 || Math.max(part.sx, part.sy ?? 0, part.sz) >= 8
        if (!mass) mesh.castShadow = false
      } else if (
        cullTinyCasters &&
        mesh.castShadow &&
        !instanced &&
        estimateMeshArea(mesh) < tinyArea
      ) {
        mesh.castShadow = false
      }
      if (config.id === 'QUEST' && mesh.receiveShadow && estimateMeshArea(mesh) < 0.8) {
        mesh.receiveShadow = false
      }
    }

    forEachMaterial(mesh, (mat) => {
      forEachTexture(mat, (tex, key) => {
        hardenTextureColorSpace(tex, key)
        if ((tex as Texture & { isCompressedTexture?: boolean }).isCompressedTexture) return
        const ani = mesh.userData?.floorSurface ? Math.max(anisotropy, 8) : anisotropy
        if (tex.anisotropy !== ani) tex.anisotropy = ani
      })
    })
  })
}

function estimateMeshArea(mesh: Mesh): number {
  _worldBox.setFromObject(mesh)
  _worldBox.getSize(_boxSize)
  return _boxSize.x * _boxSize.z
}
