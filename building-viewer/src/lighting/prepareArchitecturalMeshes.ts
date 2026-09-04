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
import {
  hasAuthoredDoubleSidedReason,
  IOM_EXPLICIT_WALKABLE_KEY,
  isIcmWalkableBridgeGrating,
  isFireSafetyGlassMaterial,
  isFireSafetyAssembly,
  isFireSafetyOpaqueMaterial,
  isVisibilityCriticalAssembly,
} from '../scene/assetSemantics'
import {
  hasSurfaceVisibilityRisk,
  inspectSurfaceTopology,
} from '../scene/surfaceVisibility'
import { getGltfLogicalMeshBinding } from '../scene/GltfLogicalMeshAssociationRegistry'

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
const _worldScale = new Vector3()
const _uvWorldA = new Vector3()
const _uvWorldB = new Vector3()
const _uvWorldC = new Vector3()
const _uvWorldAB = new Vector3()
const _uvWorldAC = new Vector3()
const _uvWorldNormal = new Vector3()

/** Confirmed architectural glass / glazing names (DE + EN). Avoid matching "Frame_Windows". */
const GLASS_NAME =
  /(?:^|[\s._-])(?:glass(?:ing)?|glas|fenster|scheib\w*|verglas\w*|vitrine|storefront|skylight|dachfenster|oberlicht|lichtkuppel)(?=$|[\s._-]|\d)|curtain[\s._-]*wall/i

const NOT_GLASS_NAME =
  /frame|mullion|sash|rail|handle|seal|gasket|profil|metal|metall|alum(?:inium)?|steel|stahl|chrome|chrom/i

/** Pools / ponds — V-Ray water uses transmission like glass, but must keep its texture. */
const WATER_NAME = /wasser|water|\bteich\b|\bsee\b|\bpond\b|\bpool\b|brunnen|fountain/i
const WATER_TILE_METERS = 8

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

/** Open envelope/interior sheets that must read from either side. */
const OPEN_ARCHITECTURAL_SHELL_NAME =
  /flugturm|fassad|facade|geb[aä]?ude|gebude|building|halle|(?:^|[\s._-])hall(?:$|[\s._-]|\d)|innenw[aä]nd|waende|wände|wnde|tragwand|trennwand|walls|(?:^|[\s._-])wand(?:$|[\s._-]|\d)|(?:^|[\s._-])wall(?:$|[\s._-]|\d)|dark[_\s-]?wall|wall[_\s-]?raster|wandfarbe|wellblech|cladding|wall[_\s-]?panel/i

/** Audited open surfaces whose source node names are lost after batching. */
const AUDITED_OPEN_SHELL_MATERIAL =
  /^(?:mat_24 - Default(?:_\d+)?|Material 30_002|vray Paint - Sienna S_001|dach allu|Floor_Wood_Vray(?:_\d+)?|Treppen all(?:\.\d+)?|Rang_Dunkel)$/i

/**
 * Foyer-door faces whose owner names are lost, and whose generated mesh
 * ordinals differ between Web and Quest. Only primitives with this exact
 * retained material enter the mixed-winding audit; a topology proof is still
 * required before clean/future uses can lose FrontSide culling.
 */
const AUDITED_MIXED_WINDING_PRIMITIVE_MATERIAL = /^wall_raster_wood_002$/i

const AUDITED_MIXED_WINDING_SHELL_NAMES = new Set([
  'fassade003',
  'fassade003001',
  'fassade001001',
  'fassade001003',
  'fassadebuero1',
  'fassadebuero1001',
  'fassadebuero2',
  'fassadebuero2001',
  'fassadebuero3',
  'fassadebuero3001',
  'fassade005002',
  'fassade008002',
  'fassade005',
  'fassade005001',
  'fassade006001',
  'bt3innenwaende002',
  'bt3innenwaende006',
  'ogwaendeinnen01',
  'saal1waende004',
  'bt1kabinenwnde24',
  'bt1kabinenwnde31',
  'bt1kabinenwnde34',
  'bt1kabinenwnde43',
  'bt1kabinenwnde50',
  'bt1kabinenwnde57',
  's11trennwand',
  's12trennwand',
  's21trennwand',
  's22trennwand',
  'wandbt1001002',
  'wand40005',
  'dachdeckelturmwest',
  'foyerdachaussen1',
  'foyerdachaussen002',
  'deckenlampen',
  'egdeckebergangaussen',
  'buhneaufbaudecke',
  'saal1deckenpaneelelftung001',
  // Rear auditorium portal batches contain closed-looking but inconsistent
  // CAD winding. glTF's single-sided default otherwise drops random leaves,
  // frames, and wood panels when the doorway is approached from the foyer.
  'tuerenholz001',
  'tuer1',
  'bt3glastuergeteilt',
  'bt3glastuergeteilt001001',
  'object010',
])

const IOM_SURFACE_TOPOLOGY_REPAIRED = 'iomSurfaceTopologyRepaired'
const IOM_SURFACE_TOPOLOGY_REPAIR = 'iomSurfaceTopologyRepair'
const IOM_SURFACE_TOPOLOGY_REPAIR_VERSION =
  'weld-seams-recalculate-normals-v1'

/** Exact Blender repair-pass object identities; do not fuzzy-normalize these. */
const SURFACE_TOPOLOGY_REPAIR_TARGET_NAMES = new Set([
  'BT1_Kabinen_wnde24',
  'BT1_Kabinen_wnde31',
  'BT1_Kabinen_wnde34',
  'BT1_Kabinen_wnde43',
  'BT1_Kabinen_wnde50',
  'BT1_Kabinen_wnde57',
  'BT3_innenwaende.002',
  'BT3_innenwaende.006',
  'Buhne_aufbau_decke',
  'EG_decke_bergang_aussen',
  'Foyer_Dach_aussen_002',
  'Foyer_Dach_aussen_1',
  'S11_trennwand',
  'S12_trennwand',
  'S21_trennwand',
  'S22_trennwand',
  'Wand_40.005',
  'Wand_bt1_001.002',
  'fassade003.001',
  'fassade005.002',
  'fassade008.002',
  'fassade_001.001',
  'fassade_001.003',
  'fassade_003.001',
  'fassade_buero_1',
  'fassade_buero_1.001',
  'fassade_buero_2',
  'fassade_buero_2.001',
  'og_waendeInnen_01',
  'saal1_waende.004',
])

const REJECTED_SURFACE_TOPOLOGY_REPAIR_TARGET_NAMES = new Set([
  'BT3_innenwaende.002',
  'BT3_innenwaende.006',
])

function isAuditedMixedWindingShellName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return (
    AUDITED_MIXED_WINDING_SHELL_NAMES.has(normalized) ||
    /^tuerhinten\d*$/.test(normalized)
  )
}

function hasAuditedMixedWindingShellName(obj: Object3D): boolean {
  for (let current: Object3D | null = obj; current; current = current.parent) {
    if (isAuditedMixedWindingShellName(current.name || '')) return true
  }
  return false
}

function hasExactSurfaceTopologyRepairCertificate(obj: Object3D): boolean {
  return Boolean(
    obj.userData?.[IOM_SURFACE_TOPOLOGY_REPAIRED] === true &&
      obj.userData?.[IOM_SURFACE_TOPOLOGY_REPAIR] ===
        IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
  )
}

function hasAnySurfaceTopologyRepairClaim(obj: Object3D): boolean {
  const userData = obj.userData
  return Boolean(
    userData &&
      (Object.prototype.hasOwnProperty.call(
        userData,
        IOM_SURFACE_TOPOLOGY_REPAIRED,
      ) ||
        Object.prototype.hasOwnProperty.call(
          userData,
          IOM_SURFACE_TOPOLOGY_REPAIR,
        )),
  )
}

function hasSurfaceTopologyRepairClaimInHierarchy(obj: Object3D): boolean {
  for (let current: Object3D | null = obj; current; current = current.parent) {
    if (hasAnySurfaceTopologyRepairClaim(current)) return true
  }
  return false
}

function hasMalformedSurfaceTopologyRepairClaimInHierarchy(
  obj: Object3D,
): boolean {
  for (let current: Object3D | null = obj; current; current = current.parent) {
    if (
      hasAnySurfaceTopologyRepairClaim(current) &&
      !hasExactSurfaceTopologyRepairCertificate(current)
    ) {
      return true
    }
  }
  return false
}

function hasExactRepairTargetName(
  obj: Object3D,
  names: ReadonlySet<string>,
): boolean {
  for (let current: Object3D | null = obj; current; current = current.parent) {
    const sourceName = current.userData?.name
    if (typeof sourceName === 'string' && names.has(sourceName)) return true
    if (names.has(current.name || '')) return true
  }
  return false
}

type LogicalSurfaceTopology = {
  vertices: number
  weldedVertices: number
  triangles: number
  edges: number
  boundaryEdges: number
  nonManifoldEdges: number
  windingConflictEdges: number
  looseEdges: number
  looseVertices: number
  degenerateTriangles: number
  invalidIndexReferences: number
  malformedPrimitives: number
  invalidPositionValues: number
  unsupportedPrimitives: number
}

function hasIdentityLocalTransform(obj: Object3D): boolean {
  const epsilon = 1e-8
  return Boolean(
    obj.position.lengthSq() <= epsilon &&
      Math.abs(obj.quaternion.x) <= epsilon &&
      Math.abs(obj.quaternion.y) <= epsilon &&
      Math.abs(obj.quaternion.z) <= epsilon &&
      Math.abs(obj.quaternion.w - 1) <= epsilon &&
      Math.abs(obj.scale.x - 1) <= epsilon &&
      Math.abs(obj.scale.y - 1) <= epsilon &&
      Math.abs(obj.scale.z - 1) <= epsilon,
  )
}

/** Audit all material primitives as one logical mesh owner. */
function inspectLogicalSurfaceTopology(
  meshes: readonly Mesh[],
): LogicalSurfaceTopology {
  let vertices = 0
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let malformedPrimitives = 0
  let invalidPositionValues = 0
  let unsupportedPrimitives = 0
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position')
    if (!position || position.itemSize !== 3) {
      unsupportedPrimitives += 1
      continue
    }
    vertices += position.count
    const index = mesh.geometry.getIndex()
    const elementCount = index?.count ?? position.count
    if (elementCount % 3 !== 0) malformedPrimitives += 1
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const x = position.getX(vertex)
      const y = position.getY(vertex)
      const z = position.getZ(vertex)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        invalidPositionValues += 1
        continue
      }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)
    }
  }
  if (!Number.isFinite(minX)) {
    return {
      vertices,
      weldedVertices: 0,
      triangles: 0,
      edges: 0,
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      windingConflictEdges: 0,
      looseEdges: 0,
      looseVertices: vertices,
      degenerateTriangles: 0,
      invalidIndexReferences: 0,
      malformedPrimitives,
      invalidPositionValues,
      unsupportedPrimitives,
    }
  }

  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  const tolerance = Math.max(1e-6, maxDim * 1e-6)
  const vertexByPosition = new Map<string, number>()
  const weldedByMesh = new Map<Mesh, Uint32Array>()
  let weldedVertices = 0
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position')
    if (!position || position.itemSize !== 3) continue
    const welded = new Uint32Array(position.count)
    welded.fill(0xffffffff)
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const x = position.getX(vertex)
      const y = position.getY(vertex)
      const z = position.getZ(vertex)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const key = `${Math.round(x / tolerance)},${Math.round(
        y / tolerance,
      )},${Math.round(z / tolerance)}`
      let canonical = vertexByPosition.get(key)
      if (canonical === undefined) {
        canonical = weldedVertices
        weldedVertices += 1
        vertexByPosition.set(key, canonical)
      }
      welded[vertex] = canonical
    }
    weldedByMesh.set(mesh, welded)
  }

  const edgeState = new Map<string, { count: number; balance: number }>()
  const referencedVertices = new Set<number>()
  const addEdge = (from: number, to: number): void => {
    if (from === to) return
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    const key = `${low},${high}`
    const state = edgeState.get(key) ?? { count: 0, balance: 0 }
    state.count += 1
    state.balance += from === low ? 1 : -1
    edgeState.set(key, state)
  }

  let triangles = 0
  let degenerateTriangles = 0
  let invalidIndexReferences = 0
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position')
    const welded = weldedByMesh.get(mesh)
    if (!position || position.itemSize !== 3 || !welded) continue
    const index = mesh.geometry.getIndex()
    const count = index?.count ?? position.count
    for (let offset = 0; offset + 2 < count; offset += 3) {
      const a = index ? index.getX(offset) : offset
      const b = index ? index.getX(offset + 1) : offset + 1
      const c = index ? index.getX(offset + 2) : offset + 2
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        !Number.isInteger(c) ||
        a < 0 ||
        b < 0 ||
        c < 0 ||
        a >= position.count ||
        b >= position.count ||
        c >= position.count
      ) {
        invalidIndexReferences += 1
        continue
      }
      const wa = welded[a]!
      const wb = welded[b]!
      const wc = welded[c]!
      if (
        wa === 0xffffffff ||
        wb === 0xffffffff ||
        wc === 0xffffffff
      ) continue
      if (wa === wb || wb === wc || wc === wa) {
        degenerateTriangles += 1
        continue
      }
      triangles += 1
      referencedVertices.add(wa)
      referencedVertices.add(wb)
      referencedVertices.add(wc)
      addEdge(wa, wb)
      addEdge(wb, wc)
      addEdge(wc, wa)
    }
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  let windingConflictEdges = 0
  for (const state of edgeState.values()) {
    if (state.count === 1) boundaryEdges += 1
    else if (state.count > 2) nonManifoldEdges += 1
    else if (Math.abs(state.balance) === 2) windingConflictEdges += 1
  }
  const looseVertices = Math.max(0, weldedVertices - referencedVertices.size)
  return {
    vertices,
    weldedVertices,
    triangles,
    edges: edgeState.size,
    boundaryEdges,
    nonManifoldEdges,
    windingConflictEdges,
    looseEdges: 0,
    looseVertices,
    degenerateTriangles,
    invalidIndexReferences,
    malformedPrimitives,
    invalidPositionValues,
    unsupportedPrimitives,
  }
}

function cleanCertifiedTopology(topology: LogicalSurfaceTopology): boolean {
  return Boolean(
    topology.triangles > 0 &&
      topology.boundaryEdges === 0 &&
      topology.nonManifoldEdges === 0 &&
      topology.windingConflictEdges === 0 &&
      topology.looseEdges === 0 &&
      topology.looseVertices === 0 &&
      topology.degenerateTriangles === 0 &&
      topology.invalidIndexReferences === 0 &&
      topology.malformedPrimitives === 0 &&
      topology.invalidPositionValues === 0 &&
      topology.unsupportedPrimitives === 0,
  )
}

/**
 * A certificate applies to the exact render mesh, or to the strict direct
 * primitive children of one glTF logical-mesh group. It never leaks through
 * an arbitrary ancestor. The geometry is independently re-audited so a stale
 * or forged certificate cannot disable the conservative DoubleSide path.
 */
function hasCertifiedSurfaceTopologyRepair(
  mesh: Mesh,
  logicalSurfaceCache: WeakMap<Object3D, boolean>,
): boolean {
  const logicalBinding = getGltfLogicalMeshBinding(mesh)
  if (!logicalBinding) {
    if (!hasExactSurfaceTopologyRepairCertificate(mesh)) return false
    // Do not use inspectSurfaceTopology here: its application-wide cache is
    // correct for immutable runtime visibility audits but a certificate must
    // be revalidated against current geometry on every preparation pass.
    return cleanCertifiedTopology(inspectLogicalSurfaceTopology([mesh]))
  }

  const { owner, primitives: renderMeshes } = logicalBinding
  if (!hasExactSurfaceTopologyRepairCertificate(owner)) return false
  const cached = logicalSurfaceCache.get(owner)
  if (cached !== undefined) return cached

  // The module-private binding comes directly from GLTFParser.associations:
  // owner and children share one glTF mesh index, while the children have the
  // complete unique primitive-index set and no node associations. Shape or
  // serializable userData alone can never create this exemption.
  const structurallyScoped = Boolean(
    renderMeshes.length > 1 &&
      renderMeshes.length === owner.children.length &&
      renderMeshes.every(
        (child) =>
          child.parent === owner &&
          child.children.length === 0 &&
          hasIdentityLocalTransform(child),
      ),
  )
  const topology = structurallyScoped
    ? inspectLogicalSurfaceTopology(renderMeshes)
    : null
  const valid = Boolean(topology && cleanCertifiedTopology(topology))
  owner.userData.surfaceTopologyRepairAudit = {
    structurallyScoped,
    valid,
    topology,
  }
  logicalSurfaceCache.set(owner, valid)
  return valid
}

/** Ground finishes whose source UVs should read at a real pedestrian scale. */
const PAVING_SURFACE_NAME =
  /kopfstein|pflaster|cobblestone|cobble|paving|steinplatten|steinboden|seeweg|fussweg|fußweg|gehweg/i

const LANDSCAPE_SURFACE_NAME =
  /(?:^|[\s._-])(?:grass|gras|rasen|gruen|grün)(?=$|[\s._-]|\d)/i

/** Genuine interior timber floors sharing the V-Ray wood-floor material. */
const INTERIOR_WOOD_FLOOR_MATERIAL = /^Floor_Wood_Vray(?:_\d+)?$/i
const INTERIOR_WOOD_FLOOR_BASE_TEXTURE = /^wood-flooring-008\(3000px\)_d$/i
const INTERIOR_WOOD_FLOOR_BUMP_TEXTURE = /^wood-flooring-008\(3000px\)_b$/i
const INTERIOR_WOOD_FLOOR_NAME = /floor|boden|saal\s*13|zwischengeschoss/i
const GENERATED_MESH_NAME = /^mesh[_\s.-]*\d+$/i
const NOT_INTERIOR_WOOD_FLOOR_NAME =
  /electro|stufen|stair|treppe|gelaender|geländer|handlauf|bodenleist|laufband|decke|ceiling|moebel|möbel|furniture/i

/**
 * The Foyer green roof is a unique aerial/baked atlas, not seamless grass.
 * Its authored 0..1 UVs must select the one roof image instead of repeating
 * the complete atlas at pedestrian ground-cover scale.
 */
const AUTHORED_ROOF_ATLAS_NAME =
  /dach[_\s.-]*foyer[_\s.-]*inner[_\s.-]*grass|BT\s*7\s*Foyer\s*dach\s*(?:gruen|grün)/i

type GroundTilingPolicy = {
  role: 'paving' | 'landscape' | 'interior-wood'
  tileMeters: number
  repairAboveMeters: number
  maxVerticalSpan: number
  minFootprint?: number
  forceWorldAligned?: boolean
}

function groundTilingPolicy(mesh: Mesh, size: Vector3): GroundTilingPolicy | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const objectLabel = `${mesh.name || ''} ${objectPathName(mesh)}`
  const textureNames = mats
    .map((mat) => ((mat as CadMat | null)?.map?.name || ''))
    .join(' ')
  const label = `${mesh.name || ''} ${objectPathName(mesh)} ${meshMaterialNames(mesh)} ${textureNames}`
  if (AUTHORED_ROOF_ATLAS_NAME.test(label)) return null
  const hasWoodFloorMaterial = mats.some((mat) =>
    Boolean(mat && INTERIOR_WOOD_FLOOR_MATERIAL.test(mat.name || '')),
  )
  const generatedPlanarFloor =
    (!mesh.name || GENERATED_MESH_NAME.test(mesh.name)) &&
    size.y <= 0.05 &&
    size.x * size.z >= 8
  const genuineWoodFloor =
    hasWoodFloorMaterial &&
    !NOT_INTERIOR_WOOD_FLOOR_NAME.test(objectLabel) &&
    (INTERIOR_WOOD_FLOOR_NAME.test(objectLabel) || generatedPlanarFloor)
  if (genuineWoodFloor) {
    return {
      role: 'interior-wood',
      // Runtime measurement of the authored floor texture. A shared world
      // origin removes the BT2/Saal 13 phase and density discontinuity.
      tileMeters: 3.25,
      repairAboveMeters: 3.25,
      maxVerticalSpan: 1.2,
      minFootprint: 8,
      forceWorldAligned: true,
    }
  }
  if (PAVING_SURFACE_NAME.test(label)) {
    return {
      role: 'paving',
      // Correctly authored ICM cobble paths measure 1.0–1.52 m/repeat.
      tileMeters: 1.5,
      repairAboveMeters: 1.9,
      maxVerticalSpan: 1.2,
    }
  }
  if (LANDSCAPE_SURFACE_NAME.test(label) && !/hecke|hedge|bush|shrub/i.test(label)) {
    return {
      role: 'landscape',
      // Match the authored grass detail without exposing obvious repetition.
      tileMeters: 1.5,
      repairAboveMeters: 1.9,
      // Landscape islands span several campus elevations in one mesh.
      maxVerticalSpan: 16,
    }
  }
  return null
}

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

/**
 * Decide glass per material slot, not per Mesh. glTF commonly packs an opaque
 * cabinet/frame and one glass pane into a single grouped Mesh; treating one
 * transmissive slot as proof for the whole Mesh made opaque contents vanish.
 */
function isGlassMaterial(mesh: Mesh, mat: Material): boolean {
  if (isWaterMesh(mesh)) return false

  if (isFireSafetyOpaqueMaterial(mat)) return false
  if (isFireSafetyGlassMaterial(mat)) return true

  const materialName = mat.name || ''
  if (NOT_GLASS_NAME.test(materialName)) return false
  if (GLASS_NAME.test(materialName)) return true

  const path = `${mesh.name || ''} ${objectPathName(mesh)}`
  // Fire cabinets are mixed-material safety assemblies. Only an explicitly
  // named glazing slot is allowed onto the transparent path.
  if (isFireSafetyAssembly(mesh)) return false
  if (NOT_GLASS_NAME.test(path)) return false
  if (OPAQUE_ARCH_NAME.test(path)) return false
  if (GLASS_NAME.test(path)) return true
  return materialLooksGlass(mat)
}

function meshIsEntirelyGlass(mesh: Mesh): boolean {
  const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
    (mat): mat is Material => Boolean(mat),
  )
  return mats.length > 0 && mats.every((mat) => isGlassMaterial(mesh, mat))
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
    if (m.visible === false) return m
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
  certifiedSurfaceTopologyRepair: boolean,
  surfaceTopologyRepairFailClosed: boolean,
  isThinSheet: boolean,
  isLargeHorizontal: boolean,
  surfaceVisibilityRisk: boolean,
  authoredDoubleSided: boolean,
  treatOpaque: boolean,
  _minDim: number,
): boolean {
  const name = `${mesh.name} ${objectPathName(mesh)} ${mat.name}`
  if (surfaceTopologyRepairFailClosed) return true
  if (SHUTTER_NAME.test(name)) return false
  if (authoredDoubleSided) return true
  // A validated certificate proves this exact opaque logical mesh is closed
  // and consistently wound. It supersedes generic thin/AABB heuristics, while
  // authored sheet, glass, foliage, and safety reasons above remain two-sided.
  if (certifiedSurfaceTopologyRepair) return false
  // A combined CAD primitive can occupy all three axes while still being a
  // collection of open wall/façade sheets. Position-welded topology catches
  // those cases (including Flugturm) without disabling culling on closed boxes.
  if (surfaceVisibilityRisk) return true
  // Roof-edge boxes: winding is repaired; DoubleSide still z-fights at some zooms.
  if (OPAQUE_ARCH_NAME.test(name)) return false
  // Floors, plaza, and ceilings must read from above and below.
  // FrontSide + "faces up" hid foyer slabs when looking at the ceiling.
  if (mesh.userData?.paperThinGround) return true
  if (isLargeHorizontal) return true
  if (isThinSheet) return true
  if (!treatOpaque && (mat.transparent || mat.opacity < 0.98)) return true
  // CAD exporters mark the entire document double-sided. Treat authored side
  // as a hint only through the semantic/geometry tests above and below; keeping
  // it unconditionally disables back-face culling for every closed wall/object.
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
  normalMap?: Texture | null
  bumpMap?: Texture | null
  roughnessMap?: Texture | null
  metalnessMap?: Texture | null
  envMapIntensity?: number
  forceSinglePass?: boolean
}

function hasInvalidInteriorWoodFloorNormal(mat: Material): boolean {
  const wood = mat as CadMat
  return Boolean(
    INTERIOR_WOOD_FLOOR_MATERIAL.test(mat.name || '') &&
      wood.map &&
      INTERIOR_WOOD_FLOOR_BASE_TEXTURE.test(wood.map.name || '') &&
      ((wood.normalMap && INTERIOR_WOOD_FLOOR_BUMP_TEXTURE.test(wood.normalMap.name || '')) ||
        (wood.bumpMap && INTERIOR_WOOD_FLOOR_BUMP_TEXTURE.test(wood.bumpMap.name || ''))),
  )
}

/**
 * The source `_b` image is grayscale V-Ray height data, not a tangent-space
 * normal map. Its periodic dark rows become broad lighting bands in WebGL.
 * Keep the valid albedo/roughness response and remove only the bad binding.
 */
function repairInteriorWoodFloorNormal(mat: Material): void {
  const wood = mat as CadMat
  if (wood.normalMap && INTERIOR_WOOD_FLOOR_BUMP_TEXTURE.test(wood.normalMap.name || '')) {
    wood.normalMap = null
  }
  if (wood.bumpMap && INTERIOR_WOOD_FLOOR_BUMP_TEXTURE.test(wood.bumpMap.name || '')) {
    wood.bumpMap = null
  }
  mat.userData = { ...mat.userData, iomInteriorWoodFloorNormalPrepared: true }
  mat.needsUpdate = true
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
  // Valid ICM pedestrian paving exceeds 1,000 UV units. The former 512-unit
  // ceiling replaced those dense authored UVs with a visibly coarse 4 m grid.
  return span > 1_000_000 || span < 0.02
}

/** Physical size represented by one repeat over the horizontal triangles. */
function horizontalMetersPerRepeat(mesh: Mesh, map: Texture): number | null {
  const geom = mesh.geometry
  const position = geom.getAttribute('position')
  const uv = geom.getAttribute('uv')
  if (!position || !uv || uv.count !== position.count) return null
  const index = geom.getIndex()
  const count = index ? index.count : position.count
  let worldArea = 0
  let uvArea = 0

  for (let i = 0; i + 2 < count; i += 3) {
    const ia = index ? index.getX(i) : i
    const ib = index ? index.getX(i + 1) : i + 1
    const ic = index ? index.getX(i + 2) : i + 2
    _uvWorldA.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
    _uvWorldB.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)
    _uvWorldC.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld)
    _uvWorldAB.subVectors(_uvWorldB, _uvWorldA)
    _uvWorldAC.subVectors(_uvWorldC, _uvWorldA)
    _uvWorldNormal.crossVectors(_uvWorldAB, _uvWorldAC)
    const doubleWorldArea = _uvWorldNormal.length()
    if (doubleWorldArea <= 1e-12) continue
    if (Math.abs(_uvWorldNormal.y) / doubleWorldArea < 0.75) continue

    const au = uv.getX(ia)
    const av = uv.getY(ia)
    const bu = uv.getX(ib)
    const bv = uv.getY(ib)
    const cu = uv.getX(ic)
    const cv = uv.getY(ic)
    const triangleUvArea = Math.abs((bu - au) * (cv - av) - (bv - av) * (cu - au)) * 0.5
    if (!Number.isFinite(triangleUvArea)) return null
    worldArea += doubleWorldArea * 0.5
    uvArea += triangleUvArea
  }

  const repeatArea = Math.abs(map.repeat.x * map.repeat.y)
  const effectiveUvArea = uvArea * repeatArea
  if (worldArea < 1 || effectiveUvArea <= 1e-10) return null
  return Math.sqrt(worldArea / effectiveUvArea)
}

function ensurePlanarGroundUvs(mesh: Mesh, size: Vector3): void {
  const geom = mesh.geometry
  if (!geom || geom.userData?.planarUvApplied) return
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const mappedMats = mats.filter(
    (mat): mat is Material & { map: Texture } => Boolean(mat && (mat as CadMat).map),
  )
  if (!mappedMats.length) return
  const policy = groundTilingPolicy(mesh, size)
  if (policy?.role === 'interior-wood') {
    // The material is also used by stairs and miscellaneous details. Record the
    // audited floor owner so only its clone loses the invalid normal binding.
    mesh.userData.interiorWoodFloorSurface = true
  }
  if (
    size.y > (policy?.maxVerticalSpan ?? 1.2) ||
    size.x * size.z < (policy?.minFootprint ?? 80)
  ) return

  const water = isWaterMesh(mesh)
  const uv = geom.getAttribute('uv')
  const invalidUvs = !uv || uvSpanIsWild(geom)
  const primaryMap = mappedMats[0].map
  const metersPerRepeat =
    !invalidUvs && !water && policy && mappedMats.length === mats.filter(Boolean).length
      ? horizontalMetersPerRepeat(mesh, primaryMap)
      : null
  const oversized = Boolean(
    policy && metersPerRepeat != null && metersPerRepeat > policy.repairAboveMeters,
  )
  if (!invalidUvs && !water && !oversized && !policy?.forceWorldAligned) return

  const pos = geom.getAttribute('position')
  if (!pos || pos.count < 3) return
  const owned = geom.clone()
  const src = owned.getAttribute('position')
  if (!src) return
  const uvs = new Float32Array(src.count * 2)
  const v = new Vector3()
  mesh.updateWorldMatrix(true, false)
  const tile = water ? WATER_TILE_METERS : (policy?.tileMeters ?? 4)
  // KHR_texture_transform becomes Texture.repeat in Three.js. Divide it out
  // so the shader-space result still represents the requested metre scale.
  const repeatX = Math.abs(primaryMap.repeat.x) > 1e-8 ? primaryMap.repeat.x : 1
  const repeatY = Math.abs(primaryMap.repeat.y) > 1e-8 ? primaryMap.repeat.y : 1
  for (let i = 0; i < src.count; i++) {
    v.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld)
    uvs[i * 2] = v.x / (tile * repeatX)
    uvs[i * 2 + 1] = v.z / (tile * repeatY)
  }
  owned.setAttribute('uv', new BufferAttribute(uvs, 2))
  // Reprojecting UVs invalidates imported tangent frames. Remove them even when
  // this release strips the source floor's invalid normal-map binding.
  if (owned.getAttribute('tangent')) owned.deleteAttribute('tangent')
  owned.userData.planarUvApplied = true
  owned.userData.textureTileMeters = tile
  if ((oversized || policy?.forceWorldAligned) && policy) {
    owned.userData.textureScaleCorrected = true
    owned.userData.textureScaleBeforeMeters = metersPerRepeat
    mesh.userData.textureScaleCorrected = true
    mesh.userData.textureTileMeters = policy.tileMeters
  }
  mesh.geometry = owned
  forEachMaterial(mesh, (mat) => {
    const map = (mat as CadMat).map
    if (!map) return
    map.wrapS = RepeatWrapping
    map.wrapT = RepeatWrapping
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

function collectVisibilityCriticalHierarchy(root: Object3D): Set<Object3D> {
  const protectedObjects = new Set<Object3D>()
  root.traverse((obj) => {
    if (!isVisibilityCriticalAssembly(obj)) return
    let current: Object3D | null = obj
    while (current) {
      protectedObjects.add(current)
      if (current === root) break
      current = current.parent
    }
  })
  return protectedObjects
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

/** Stable low-cost water. The source albedo is a non-seamless checker pattern. */
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
  if (g.metalness != null) g.metalness = 0
  if (g.color) g.color.set(0x32939b)
  if (g.roughness != null) g.roughness = 0.28
  if (g.envMapIntensity != null) g.envMapIntensity = Math.min(1.1, Math.max(0.35, g.envMapIntensity))
  forEachTexture(mat, (tex, key) => hardenTextureColorSpace(tex, key))
  // One low-frequency blue square per source image reads as pool tiles at any
  // repeat. A clean reflective tint is more plausible and saves a sampler.
  if (g.map) g.map = null
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
  /** Keep the source V-Ray material intact while replacing its invalid normal binding. */
  const woodFloorMatCache = new Map<string, Material>()
  /** Opaque: clone per (source uuid, side) so shared materials are not mutated last-wins. */
  const sideMatCache = new Map<string, Material>()
  /** Share one logical-mesh audit only within this preparation pass. */
  const certifiedLogicalSurfaceCache = new WeakMap<Object3D, boolean>()

  root.updateMatrixWorld(true)
  const visibilityCriticalHierarchy = collectVisibilityCriticalHierarchy(root)
  let cadHidden = 0
  let topologyInspected = 0
  let topologyRiskMeshes = 0
  let topologyRiskTriangles = 0
  root.traverse((obj) => {
    if (!visibilityCriticalHierarchy.has(obj) && isCadOverlayObject(obj)) {
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
    const materialSlots = fillMats.filter((mat): mat is Material => Boolean(mat))
    const bridgeGrating = materialSlots.some((mat) =>
      isIcmWalkableBridgeGrating(mesh, mat),
    )
    const glassMaterials = new Set(
      materialSlots.filter((mat) => !water && isGlassMaterial(mesh, mat)),
    )
    const hasGlass = glassMaterials.size > 0
    const glass = hasGlass && materialSlots.every((mat) => glassMaterials.has(mat))
    const fireSafetyAssembly = isFireSafetyAssembly(mesh)
    const visibilityCritical = fireSafetyAssembly || isVisibilityCriticalAssembly(mesh)
    const opaqueArch = OPAQUE_ARCH_NAME.test(`${mesh.name || ''} ${path}`)
    const surfaceLabel = `${mesh.name} ${path} ${meshMaterialNames(mesh)}`
    const shutter = SHUTTER_NAME.test(surfaceLabel)
    const openShellSemantic = OPEN_ARCHITECTURAL_SHELL_NAME.test(surfaceLabel)
    const auditedOpenShellMaterial = materialSlots.some((mat) =>
      AUDITED_OPEN_SHELL_MATERIAL.test(mat.name || ''),
    )
    const certifiedSurfaceTopologyRepair = hasCertifiedSurfaceTopologyRepair(
      mesh,
      certifiedLogicalSurfaceCache,
    )
    const repairTarget = hasExactRepairTargetName(
      mesh,
      SURFACE_TOPOLOGY_REPAIR_TARGET_NAMES,
    )
    const rejectedRepairTarget = hasExactRepairTargetName(
      mesh,
      REJECTED_SURFACE_TOPOLOGY_REPAIR_TARGET_NAMES,
    )
    const hasSurfaceRepairClaim = hasSurfaceTopologyRepairClaimInHierarchy(mesh)
    const malformedSurfaceRepairClaim =
      hasMalformedSurfaceTopologyRepairClaimInHierarchy(mesh)
    const surfaceTopologyRepairFailClosed = Boolean(
      rejectedRepairTarget ||
        malformedSurfaceRepairClaim ||
        (hasSurfaceRepairClaim && !certifiedSurfaceTopologyRepair) ||
        (repairTarget && !certifiedSurfaceTopologyRepair),
    )
    if (surfaceTopologyRepairFailClosed) {
      mesh.userData.surfaceTopologyRepairRejected = true
      mesh.userData.surfaceTopologyRepairRejectionReason = rejectedRepairTarget
        ? 'blender-rejected-target'
        : malformedSurfaceRepairClaim
          ? 'malformed-certificate'
          : hasSurfaceRepairClaim
            ? 'unbound-or-damaged-certificate'
            : 'missing-required-certificate'
    }
    const auditedMixedWindingShell =
      !certifiedSurfaceTopologyRepair &&
      (hasAuditedMixedWindingShellName(mesh) ||
        materialSlots.some((mat) =>
          AUDITED_MIXED_WINDING_PRIMITIVE_MATERIAL.test(mat.name || ''),
        ))
    const allMaterialsAuthoredDoubleSided =
      materialSlots.length > 0 && materialSlots.every(hasAuthoredDoubleSidedReason)

    if (bridgeGrating) {
      // These authored bridge tops are wound downward. Their exact semantics
      // make them safe to render two-sided and to retain through visual packing.
      mesh.userData[IOM_EXPLICIT_WALKABLE_KEY] = true
      mesh.userData.floorSurface = true
      mesh.userData.detailLodIgnore = true
      mesh.userData.floorZoneAlways = true
    }
    // Cheap bbox/semantic rules already cover ordinary planar sheets, campus
    // decks, glass, and lightmapped slices. Inspect topology for 3D-looking
    // semantic CAD assemblies and for the narrowly audited thin/large shells
    // whose source winding is known to be damaged. Closed roof boxes still
    // fail the topology-risk test and retain back-face culling.
    const topology =
      !water &&
      !glass &&
      !shutter &&
      !lightmapped &&
      !certifiedSurfaceTopologyRepair &&
      ((!isThinSheet && !isLargeHorizontal) ||
        auditedOpenShellMaterial ||
        auditedMixedWindingShell) &&
      (openShellSemantic ||
        auditedOpenShellMaterial ||
        auditedMixedWindingShell ||
        visibilityCritical) &&
      !allMaterialsAuthoredDoubleSided
        ? inspectSurfaceTopology(mesh.geometry)
        : null
    mesh.getWorldScale(_worldScale)
    const physicalTopologySize = topology
      ? [
          topology.localSize[0] * Math.abs(_worldScale.x),
          topology.localSize[1] * Math.abs(_worldScale.y),
          topology.localSize[2] * Math.abs(_worldScale.z),
        ].sort((a, b) => b - a)
      : null
    const meaningfulSurface = Boolean(
      physicalTopologySize &&
        physicalTopologySize[0]! >= 0.75 &&
        physicalTopologySize[0]! * physicalTopologySize[1]! >= 0.2,
    )
    const auditedWindingRisk = Boolean(
      topology &&
        auditedMixedWindingShell &&
        (topology.boundaryEdges > 0 ||
          topology.windingConflictEdges > 0 ||
          topology.nonManifoldEdges > 0),
    )
    const persistedSurfaceVisibilityRisk =
      !certifiedSurfaceTopologyRepair && mesh.userData?.surfaceVisibilityRisk === true
    const surfaceVisibilityRisk = persistedSurfaceVisibilityRisk || Boolean(
      topology &&
        (auditedWindingRisk ||
          (hasSurfaceVisibilityRisk(topology) &&
            (visibilityCritical ||
              auditedOpenShellMaterial ||
              (openShellSemantic && meaningfulSurface)))),
    )
    if (topology) topologyInspected += 1
    if (surfaceVisibilityRisk && topology) {
      topologyRiskMeshes += 1
      topologyRiskTriangles += topology.triangles
      mesh.userData.surfaceVisibilityRisk = true
      mesh.userData.surfaceVisibilityReason = visibilityCritical
        ? 'visibility-critical'
        : auditedWindingRisk
          ? 'audited-mixed-winding-shell'
        : auditedOpenShellMaterial
          ? 'audited-open-shell'
          : 'architectural-open-shell'
      mesh.userData.surfaceTopology = {
        triangles: topology.triangles,
        boundaryEdges: topology.boundaryEdges,
        boundaryRatio: topology.boundaryRatio,
        nonManifoldEdges: topology.nonManifoldEdges,
        windingConflictEdges: topology.windingConflictEdges,
      }
    }
    if (shutter) {
      mesh.userData.shutter = true
      mesh.userData.orbitDuplicateRole = 'facade-shutter'
    }
    if (visibilityCritical) {
      mesh.userData.visibilityCritical = true
      mesh.userData.detailLodIgnore = true
      mesh.userData.floorZoneAlways = true
    }
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
    } else if (hasGlass) {
      // Mixed assemblies keep opaque depth/shadows. Only their pane material
      // slots are converted below; the whole mesh must not become "glass".
      mesh.userData.containsArchitecturalGlass = true
      mesh.userData.architecturalGlass = false
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
      // Never mutate triangle winding at runtime. A global-centroid test is
      // invalid for open/concave CAD assemblies and can flip correct front
      // faces. Winding repair belongs in the offline Blender/source pass.
    }

    if (freezeStatic && !animationTarget && !skinned) {
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
    }

    forEachMaterial(mesh, (mat) => {
      if (water) {
        const requiredWaterSide = surfaceTopologyRepairFailClosed
          ? DoubleSide
          : FrontSide
        const failClosedReason = 'surface-topology-repair-fail-closed'
        let target = mat
        if (
          mat.userData?.iomArchitecturalWaterPrepared !== true ||
          mat.side !== requiredWaterSide ||
          (surfaceTopologyRepairFailClosed &&
            mat.userData?.iomDoubleSidedReason !== failClosedReason)
        ) {
          const key = `${mat.uuid}|water|${requiredWaterSide}`
          target = sideMatCache.get(key) ?? mat.clone()
          if (!sideMatCache.has(key)) {
            applyWaterMaterial(target)
            target.side = requiredWaterSide
            target.userData = {
              ...target.userData,
              iomArchitecturalWaterPrepared: true,
              ...(surfaceTopologyRepairFailClosed
                ? { iomDoubleSidedReason: failClosedReason }
                : {}),
            }
            target.needsUpdate = true
            sideMatCache.set(key, target)
          }
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target! : m))
        } else if (mesh.material === mat) {
          mesh.material = target
        }
        return
      }

      if (glassMaterials.has(mat)) {
        let target = mat
        const preparedBias = mat.userData?.iomArchitecturalGlassDepthBias
        if (preparedBias !== glassDepthBias) {
          const key = `${mat.uuid}|ds|${glassDepthBias}`
          target = glassMatCache.get(key) ?? mat.clone()
          if (!glassMatCache.has(key)) {
            applyGlassMaterial(target, true, glassDepthBias)
            target.userData = {
              ...target.userData,
              iomArchitecturalGlassDepthBias: glassDepthBias,
            }
            glassMatCache.set(key, target)
          }
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target! : m))
        } else if (mesh.material === mat) {
          mesh.material = target
        }
        return
      }

      if (
        mat.userData?.iomInteriorWoodFloorNormalPrepared !== true &&
        hasInvalidInteriorWoodFloorNormal(mat)
      ) {
        const source = mat
        const key = `${source.uuid}|interior-wood-normal-v1`
        let target = woodFloorMatCache.get(key)
        if (!target) {
          target = source.clone()
          repairInteriorWoodFloorNormal(target)
          woodFloorMatCache.set(key, target)
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((entry) => (entry === source ? target! : entry))
        } else if (mesh.material === source) {
          mesh.material = target
        }
        // Continue the ordinary side/depth preparation on the repaired clone.
        mat = target
      }

      forEachTexture(mat, (tex, key) => hardenTextureColorSpace(tex, key))

      const alphaTest = (mat as Material & { alphaTest?: number }).alphaTest ?? 0
      const shutterMat = Boolean(mesh.userData.shutter) || SHUTTER_NAME.test(`${mesh.name} ${mat.name}`)
      const physicalTransmission = (mat as GlassMat).transmission ?? 0
      const cadBlend =
        isNearOpaqueCadBlend(mat) ||
        (fireSafetyAssembly &&
          (mat.transparent || (mat.opacity ?? 1) < 0.98 || physicalTransmission > 0)) ||
        (opaqueArch &&
          (mat.transparent || (mat.opacity ?? 1) < 0.98 || physicalTransmission > 0))
      const liftBlack = shouldLiftCadBlack(mat)
      const groundFill =
        Boolean(mesh.userData.paperThinGround) && !(mat as CadMat).map
      const bridgeGratingMaterial = isIcmWalkableBridgeGrating(mesh, mat)
      const nextSide =
        bridgeGratingMaterial
          ? DoubleSide
          : lightmapped && !shutterMat
          ? DoubleSide
           : wantsDoubleSide(
                 mesh,
                 mat,
                 certifiedSurfaceTopologyRepair,
                 surfaceTopologyRepairFailClosed,
                 isThinSheet,
                isLargeHorizontal,
                surfaceVisibilityRisk,
                hasAuthoredDoubleSidedReason(mat),
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
  root.userData.surfaceVisibilityAudit = {
    topologyInspected,
    topologyRiskMeshes,
    topologyRiskTriangles,
  }
  if (topologyRiskMeshes > 0) {
    console.info(
      `[Viewer] protected ${topologyRiskMeshes} open/non-manifold surface mesh${topologyRiskMeshes === 1 ? '' : 'es'} ` +
        `(${topologyRiskTriangles.toLocaleString()} triangles) from back-face disappearance`,
    )
  }
}

/** Apply quality-dependent texture / shadow caster knobs without reloading the GLB. */
export function applyMeshQuality(root: Object3D, config: QualityConfig): void {
  const anisotropy = Math.max(1, config.anisotropy)
  const cullTinyCasters = config.id === 'QUEST' || config.id === 'DESKTOP_BALANCED'
  const tinyArea = config.id === 'QUEST' ? 2 : 1.25
  const requestedAnisotropy = new Map<Texture, number>()

  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    if (mesh.userData?.collisionOnly) return

    if (mesh.userData?.architecturalGlass || meshIsEntirelyGlass(mesh)) {
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
        // Anisotropic filtering is valid for KTX2/compressed textures too.
        // Skipping it made the newly corrected paving blur at grazing angles.
        const ani = mesh.userData?.floorSurface ? Math.max(anisotropy, 8) : anisotropy
        requestedAnisotropy.set(tex, Math.max(requestedAnisotropy.get(tex) ?? 1, ani))
      })
    })
  })

  // Textures are shared across floor and non-floor owners. Apply the maximum
  // request once so traversal order cannot downgrade a floor from 8x to 2x.
  for (const [tex, ani] of requestedAnisotropy) {
    if (tex.anisotropy === ani) continue
    tex.anisotropy = ani
    tex.needsUpdate = true
  }
}

function estimateMeshArea(mesh: Mesh): number {
  _worldBox.setFromObject(mesh)
  _worldBox.getSize(_boxSize)
  return _boxSize.x * _boxSize.z
}
