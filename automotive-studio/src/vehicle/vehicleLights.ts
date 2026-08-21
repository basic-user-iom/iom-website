import {
  Box3,
  BufferAttribute,
  DoubleSide,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SpotLight,
  Vector3,
  type Material,
  type Side,
} from 'three'
import type {
  VehicleBeamGroupId,
  VehicleBeamProxy,
  VehicleLightGroupId,
  VehicleLightSequenceId,
  VehicleLightTarget,
  VehicleLightsState,
} from '../persistence/schema'
import { VEHICLE_LIGHT_GROUP_IDS } from '../persistence/schema'
import { resolveSemanticNode, refFromObject } from '../hotspots/resolveAnchor'

type MatBackup = {
  emissive: number
  emissiveIntensity: number
  side: Side
  color: number
  metalness: number
  roughness: number
  transmission: number
  transparent: boolean
  opacity: number
}

type BoundTarget = {
  groupId: VehicleLightGroupId
  mesh: Mesh
  material: MeshStandardMaterial
  backup: MatBackup
  localCenter: Vector3
  manual: boolean
}

function captureMatBackup(std: MeshStandardMaterial): MatBackup {
  const phys = std as MeshPhysicalMaterial
  return {
    emissive: std.emissive.getHex(),
    emissiveIntensity: std.emissiveIntensity,
    side: std.side,
    color: std.color.getHex(),
    metalness: std.metalness,
    roughness: std.roughness,
    transmission: 'transmission' in phys ? (phys.transmission ?? 0) : 0,
    transparent: Boolean(std.transparent),
    opacity: std.opacity,
  }
}

/** Make amber/red lamp emissive actually visible on transmitted metal glass. */
function applyLitLampLook(
  mat: MeshStandardMaterial,
  backup: MatBackup,
  opts: { emissive: number; intensity: number; darkenColor: boolean },
): boolean {
  let structural = false
  mat.emissive.setHex(opts.emissive)
  mat.emissiveIntensity = opts.intensity
  if (mat.toneMapped !== false) {
    mat.toneMapped = false
    structural = true
  }
  if (backup.side === DoubleSide && mat.side !== FrontSide) {
    mat.side = FrontSide
    structural = true
  }
  if (opts.darkenColor && mat.color.getHex() !== 0x140800) {
    mat.color.setHex(0x140800)
  }
  if (mat.metalness > 0.15) mat.metalness = 0
  if (mat.roughness < 0.35) mat.roughness = 0.45
  const phys = mat as MeshPhysicalMaterial
  if ('transmission' in phys && (phys.transmission ?? 0) > 0.02) {
    phys.transmission = 0
    structural = true
  }
  if (mat.transparent || mat.opacity < 0.98) {
    mat.transparent = false
    mat.opacity = 1
    structural = true
  }
  return structural
}

function restoreMatBackup(mat: MeshStandardMaterial, backup: MatBackup): boolean {
  let structural = false
  mat.emissive.setHex(backup.emissive)
  mat.emissiveIntensity = backup.emissiveIntensity
  mat.color.setHex(backup.color)
  mat.metalness = backup.metalness
  mat.roughness = backup.roughness
  mat.side = backup.side
  const phys = mat as MeshPhysicalMaterial
  if ('transmission' in phys) {
    const cur = phys.transmission ?? 0
    if (Math.abs(cur - backup.transmission) > 1e-4) {
      phys.transmission = backup.transmission
      structural = true
    }
  }
  if (mat.transparent !== backup.transparent || Math.abs(mat.opacity - backup.opacity) > 1e-4) {
    mat.transparent = backup.transparent
    mat.opacity = backup.opacity
    structural = true
  }
  return structural
}

const GROUP_NAME_PATTERNS: Record<VehicleLightGroupId, RegExp> = {
  drl: /\b(drl|day.?running|running.?light|position.?light|front.?pos)/i,
  lowBeam: /\b(low.?beam|dipped|headlight|head.?lamp)(?!.*high)/i,
  highBeam: /\b(high.?beam|main.?beam|full.?beam)/i,
  // Red lenses / reflectors are rear-cluster parts by convention, and on merged
  // exports they are the only geometry covering half the tail light.
  tail: /\b(tail|rear.?light|rear.?lamp|stop.?tail|rueck|rück|red.?(glass|lens))/i,
  brake: /\b(brake|stop.?light|brems)/i,
  indicatorLeft: /\b(indicator|turn.?signal|blinker|flasher).*(l(eft)?|fl)\b|\b(l(eft)?|fl).*(indicator|turn|blinker)/i,
  indicatorRight: /\b(indicator|turn.?signal|blinker|flasher).*(r(ight)?|fr)\b|\b(r(ight)?|fr).*(indicator|turn|blinker)/i,
  hazards: /\b(hazard|warn.?blink)/i,
  reverse: /\b(reverse|backup|rueckfahr|rückfahr)/i,
  interior: /\b(interior|cabin|dome|courtesy|ambient.?light)/i,
}

/** Shared amber for Indicator L/R and Hazards — must stay identical. */
const INDICATOR_AMBER = 0xffa020

const GROUP_COLOR: Record<VehicleLightGroupId, number> = {
  drl: 0xe8f0ff,
  lowBeam: 0xfff2d0,
  highBeam: 0xfff8e8,
  tail: 0xff3030,
  brake: 0xff1010,
  indicatorLeft: INDICATOR_AMBER,
  indicatorRight: INDICATOR_AMBER,
  hazards: INDICATOR_AMBER,
  reverse: 0xf0f4ff,
  interior: 0xffe8c8,
}

const GROUP_BASE_INTENSITY: Record<VehicleLightGroupId, number> = {
  drl: 4.2,
  lowBeam: 2.2,
  highBeam: 3.2,
  tail: 0.088,
  brake: 3.5,
  indicatorLeft: 3.2,
  indicatorRight: 3.2,
  hazards: 3.2,
  reverse: 2.0,
  interior: 0.9,
}

const PROXY_POWER: Record<VehicleLightGroupId, number> = {
  drl: 2.4,
  lowBeam: 18,
  highBeam: 28,
  tail: 0.088,
  brake: 1.8,
  indicatorLeft: 1.3,
  indicatorRight: 1.3,
  hazards: 1.3,
  reverse: 3,
  interior: 1.2,
}

const INDICATOR_HZ = 1.5
/** Upper bound of the Lamp intensity slider; 1.0 is the tuned baseline. */
const MAX_LAMP_GAIN = 4
/**
 * Three.js skips lights with intensity === 0 (and invisible lights) when building
 * NUM_SPOT_LIGHTS / NUM_POINT_LIGHTS — flipping that count recompiles every
 * MeshStandardMaterial on the car. Keep proxies in the light list at this floor.
 */
const PROXY_INTENSITY_FLOOR = 1e-4

/** A material name only joins lamp classification when it reads like a lamp. */
const LAMP_MATERIAL_WORD = /(light|lamp|lens|led|drl|beam|blink|signal|indicator|red.?glass)/i

/** Beams must reach the road; marker lamps stay a local outward glow. */
const PROXY_DISTANCE: Partial<Record<VehicleLightGroupId, number>> = {
  lowBeam: 18,
  highBeam: 26,
  reverse: 10,
  drl: 3.5,
  tail: 3.2,
  brake: 4,
  indicatorLeft: 3,
  indicatorRight: 3,
  hazards: 3,
  interior: 2.2,
}
const PROXY_DISTANCE_DEFAULT = 3.5

/**
 * Groups that throw a cone instead of a bare bulb, so the bodywork behind the lamp
 * and the road under the car stay dark. `reachBodies` aims the cone at the ground
 * that many car-lengths away, which keeps the aim right whatever the model scale.
 */
const BEAM_SPEC: Partial<
  Record<
    VehicleLightGroupId,
    { angle: number; penumbra: number; reachBodies: number; pair: boolean }
  >
> = {
  // Short soft signature cone — editable separately from low-beam headlamp seats.
  drl: { angle: 1.15, penumbra: 0.9, reachBodies: 0.28, pair: true },
  lowBeam: { angle: 0.7, penumbra: 0.7, reachBodies: 0.9, pair: true },
  // Twin high beams — a single centre cone from skewed lamps looked like a 45° side spray.
  highBeam: { angle: 0.48, penumbra: 0.55, reachBodies: 2.4, pair: true },
  reverse: { angle: 0.85, penumbra: 0.8, reachBodies: 0.65, pair: false },
}

/**
 * Marker / signature lamps: outward SpotLights (not PointLights) so the cone never
 * washes seats and dash red/white through the shell.
 */
const MARKER_SPOT_SPEC: Partial<
  Record<VehicleLightGroupId, { angle: number; penumbra: number; outNudge: number }>
> = {
  drl: { angle: 0.95, penumbra: 0.8, outNudge: 0.1 },
  tail: { angle: 1.0, penumbra: 0.85, outNudge: 0.12 },
  brake: { angle: 1.0, penumbra: 0.8, outNudge: 0.12 },
  indicatorLeft: { angle: 1.05, penumbra: 0.85, outNudge: 0.1 },
  indicatorRight: { angle: 1.05, penumbra: 0.85, outNudge: 0.1 },
  hazards: { angle: 1.05, penumbra: 0.85, outNudge: 0.1 },
}

/** Sketchfab watermarks, plate lettering, floating logos — not the car. */
const DECOR_NAME =
  /\b(logo|discord|sketchfab|watermark|attribution|license\s*plate|number.?plate|badge\s*text)\b/i

/**
 * Paper-thin meshes (LED letter bars, badge type) look like lamps by material name
 * (FrontLight) but are typography — binding them makes the letters glow instead of
 * the headlamp pods, and their off-centre mass pulls proxies around.
 */
type BodyFrame = {
  axis: Vector3
  centre: Vector3
  groundY: number
  lengthLocal: number
  widthLocal: number
  heightLocal: number
}

export function isLetterLikeMesh(mesh: Mesh): boolean {
  if (!mesh.geometry) return false
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const bb = mesh.geometry.boundingBox
  if (!bb || bb.isEmpty()) return false
  const size = bb.getSize(new Vector3())
  // Bake the node's scale in so a uniformly scaled letter strip still reads thin.
  const sx = Math.abs(mesh.scale.x) || 1
  const sy = Math.abs(mesh.scale.y) || 1
  const sz = Math.abs(mesh.scale.z) || 1
  const dims = [size.x * sx, size.y * sy, size.z * sz].sort((a, b) => a - b)
  const min = dims[0]
  const max = dims[2]
  return max > 1e-8 && min / max < 0.08
}

/**
 * Cabin / windscreen panes — must never bind as tail/brake/indicators.
 * On Lixiang, side/rear windows are often named DarkGlass (same as some lamp
 * docs), so size — not only the material name — decides.
 */
export function isCabinWindowMesh(mesh: Mesh, body?: BodyFrame | null): boolean {
  if (!mesh.isMesh) return false
  const matName = normalizeLampMatName(
    (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name || '',
  )
  const bareCabinName = /^(glass|window|windscreen|windshield|side\s*glass|rear\s*glass)$/i.test(
    matName,
  )
  const darkGlass = /^dark\s+glass$/i.test(matName)

  mesh.updateWorldMatrix(true, false)
  const wbox = new Box3().setFromObject(mesh)
  if (wbox.isEmpty()) return bareCabinName || darkGlass
  const ws = wbox.getSize(new Vector3())
  const sorted = [ws.x, ws.y, ws.z].sort((a, b) => a - b)
  const min = sorted[0]
  const mid = sorted[1]
  const max = sorted[2]
  // Real LED/lamp strips are paper-thin in one axis; windows are boxy panes.
  const thinLampStrip = min < 0.14 && mid < 0.28

  // Thin RedGlass / Orange / TailLight bars are lamps even when long.
  if (thinLampStrip && isLampLensMaterialName(matName) && !bareCabinName && !darkGlass) {
    return false
  }

  // DarkGlass + bare Glass: anything not a thin strip is cabin glazing.
  if ((darkGlass || bareCabinName) && !thinLampStrip) return true
  if ((darkGlass || bareCabinName) && max > 0.55 && mid > 0.22) return true

  if (body && bodyFrameLooksReasonable(body)) {
    const tall = ws.y > body.heightLocal * 0.25
    const wide = ws.x > body.widthLocal * 0.35 || ws.z > body.lengthLocal * 0.2
    const huge = max > body.lengthLocal * 0.4
    if ((bareCabinName || darkGlass) && ((tall && wide) || huge)) return true
    // Mis-labelled RedGlass on a windscreen-sized pane.
    if (isLampLensMaterialName(matName) && tall && huge && !thinLampStrip) return true
  }

  return bareCabinName && max > 0.85
}

/** True lamp lens materials — safe to darken when emissive is on. */
function isLampLensMaterialName(name: string): boolean {
  const n = normalizeLampMatName(name)
  return /\b(red\s*glass|dark\s*glass|orange|amber|tail\s*light|front\s*light|brake|indicator|blinker|flasher|headlight|head\s*lamp|drl)\b/i.test(
    n,
  )
}

const BEAM_GROUP_IDS = ['drl', 'lowBeam', 'highBeam', 'reverse'] as const satisfies readonly VehicleBeamGroupId[]

type ProxyLight = PointLight | SpotLight

/** One seat per cone; each has its own ground aim so twin beams don't cross-eye. */
type BeamRig = {
  seats: Vector3[]
  aims: Vector3[]
}

type SequenceStep = {
  at: number
  groups: Partial<Record<VehicleLightGroupId, boolean>>
}

const WELCOME_STEPS: SequenceStep[] = [
  { at: 0, groups: { drl: true, interior: true } },
  { at: 0.45, groups: { indicatorLeft: true, indicatorRight: true } },
  { at: 1.1, groups: { indicatorLeft: false, indicatorRight: false, lowBeam: true, tail: true } },
  { at: 1.7, groups: { highBeam: true } },
  { at: 2.2, groups: { highBeam: false } },
]

const FAREWELL_STEPS: SequenceStep[] = [
  { at: 0, groups: { highBeam: false, lowBeam: true, drl: true, tail: true, interior: true } },
  { at: 0.4, groups: { indicatorLeft: true, indicatorRight: true } },
  { at: 1.0, groups: { indicatorLeft: false, indicatorRight: false, lowBeam: false } },
  { at: 1.5, groups: { drl: false, tail: false, interior: false, brake: false, reverse: false } },
]

/**
 * Semantic vehicle lamps: heuristics + optional manual targets, emissive, proxies,
 * and welcome/farewell sequences.
 */
export class VehicleLightsController {
  private root: Object3D | null = null
  private proxyHost: Group | null = null
  private targets: BoundTarget[] = []
  private proxies = new Map<VehicleLightGroupId, ProxyLight[]>()
  /** SpotLight (or its target Object3D) keyed by persisted beam proxy id. */
  private beamById = new Map<string, SpotLight>()
  /** Cached body frame — measureBodyFrame walks every mesh and freezes large GLBs. */
  private bodyFrame: BodyFrame | null = null
  private proxiesWarmed = false
  private onProxiesBuilt: (() => void) | null = null

  setOnProxiesBuilt(cb: (() => void) | null) {
    this.onProxiesBuilt = cb
  }
  private state: VehicleLightsState | null = null
  private blinkPhase = 0
  private routeBrake = false
  private routeReverse = false
  /** Soft running/tail lights while driving (free drive / route) — until brake fires. */
  private routeRunning = false
  private routeIndicatorLeft = false
  private routeIndicatorRight = false
  private sequenceId: VehicleLightSequenceId | null = null
  private sequenceElapsed = 0
  private onSequenceCommit: ((groups: Record<VehicleLightGroupId, boolean>) => void) | null = null

  setOnSequenceCommit(cb: ((groups: Record<VehicleLightGroupId, boolean>) => void) | null) {
    this.onSequenceCommit = cb
  }

  bind(root: Object3D | null) {
    this.restoreAll()
    this.clearProxies()
    this.root = root
    this.targets = []
    this.proxies.clear()
    this.beamById.clear()
    this.bodyFrame = null
    this.proxiesWarmed = false
    this.stopSequence(false)
    if (!root) {
      this.proxyHost = null
      return
    }
    this.proxyHost = new Group()
    this.proxyHost.name = 'iom-vehicle-light-proxies'
    root.add(this.proxyHost)
    // Hide Sketchfab logo / discord text so headlight cones don't light up floating letters.
    suppressDecorMeshes(root)
    this.bodyFrame = measureBodyFrame(root)
    this.rebuildTargets()
    this.buildProxies()
    if (this.state) {
      this.applyEmissive()
      this.syncProxyVisibility()
    }
    this.onProxiesBuilt?.()
  }

  /** Drop cached body AABB and rebuild auto seats (e.g. after parking at stage origin). */
  remeasureAndRebuildProxies() {
    this.bodyFrame = null
    if (!this.root) return
    this.bodyFrame = measureBodyFrame(this.root)
    this.buildProxies()
    if (this.state) {
      this.applyEmissive()
      this.syncProxyVisibility()
    }
  }

  /** True when every live beam seat looks like grounded placement metres (not free-drive junk). */
  beamSeatsLookReasonable(): boolean {
    const handles = this.listBeamHandles()
    if (!handles.length) return true
    return handles.every(
      (h) => isReasonableCarLocal(h.position) && isReasonableCarLocal(h.target),
    )
  }

  getBoundTargets(): Array<{
    groupId: VehicleLightGroupId
    meshName: string
    materialName: string
    manual: boolean
  }> {
    return this.targets.map((t) => ({
      groupId: t.groupId,
      meshName: t.mesh.name || '(unnamed)',
      materialName: t.material.name || 'Material',
      manual: t.manual,
    }))
  }

  getBoundCounts(): Record<VehicleLightGroupId, number> {
    const counts = Object.fromEntries(VEHICLE_LIGHT_GROUP_IDS.map((id) => [id, 0])) as Record<
      VehicleLightGroupId,
      number
    >
    for (const t of this.targets) counts[t.groupId]++
    // Lixiang / Sketchfab often share one red rear material and one FrontLight —
    // expose inherited counts so the UI does not look "unbound".
    if (counts.brake === 0 && counts.tail > 0) counts.brake = counts.tail
    if (counts.drl === 0 && counts.lowBeam > 0) counts.drl = counts.lowBeam
    if (counts.lowBeam === 0 && counts.drl > 0) counts.lowBeam = counts.drl
    // Indicators/hazards: only mirror real bindings (promoted outer RedGlass or DarkGlass).
    // Do not fake (1) when nothing is bound — that made the toggles look live while inert.
    if (counts.hazards === 0) {
      counts.hazards = Math.max(counts.indicatorLeft, counts.indicatorRight)
    }
    return counts
  }

  /** Live beam handles for the Lights panel / gizmo (car-local metres). */
  listBeamHandles(): Array<{
    id: string
    groupId: VehicleBeamGroupId
    light: SpotLight
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  }> {
    const out: Array<{
      id: string
      groupId: VehicleBeamGroupId
      light: SpotLight
      position: { x: number; y: number; z: number }
      target: { x: number; y: number; z: number }
    }> = []
    for (const [id, light] of this.beamById) {
      const groupId = (light.userData.beamGroupId as VehicleBeamGroupId) || 'lowBeam'
      out.push({
        id,
        groupId,
        light,
        position: { x: light.position.x, y: light.position.y, z: light.position.z },
        target: {
          x: light.target.position.x,
          y: light.target.position.y,
          z: light.target.position.z,
        },
      })
    }
    out.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.id.localeCompare(b.id))
    return out
  }

  getBeamLight(id: string): SpotLight | null {
    return this.beamById.get(id) ?? null
  }

  /**
   * Snapshot current beam seats into persistable proxies (seeds manual edit from auto).
   * Prefer existing `state.beamProxies` ids when the live lights already carry them.
   */
  captureBeamProxies(): VehicleBeamProxy[] {
    const handles = this.listBeamHandles()
    if (handles.length === 0) return []
    return handles.map((h) => ({
      id: h.id,
      groupId: h.groupId,
      position: { ...h.position },
      target: { ...h.target },
    }))
  }

  /**
   * Write live SpotLight transforms back into an existing proxy list (by id).
   * Falls back to group order when ids diverged (auto-* vs UUID seed).
   */
  syncBeamProxiesFromLive(existing: VehicleBeamProxy[]): VehicleBeamProxy[] {
    const liveByGroup = new Map<VehicleBeamGroupId, SpotLight[]>()
    for (const [, light] of this.beamById) {
      const groupId = (light.userData.beamGroupId as VehicleBeamGroupId) || 'lowBeam'
      const list = liveByGroup.get(groupId) ?? []
      list.push(light)
      liveByGroup.set(groupId, list)
    }
    const used = new Set<SpotLight>()
    const groupIndex = new Map<VehicleBeamGroupId, number>()
    return existing.map((p) => {
      let light = this.beamById.get(p.id) ?? null
      if (!light || used.has(light)) {
        const idx = groupIndex.get(p.groupId) ?? 0
        const pool = liveByGroup.get(p.groupId) ?? []
        light = pool[idx] ?? null
        groupIndex.set(p.groupId, idx + 1)
      } else {
        groupIndex.set(p.groupId, (groupIndex.get(p.groupId) ?? 0) + 1)
      }
      if (!light) return structuredClone(p)
      used.add(light)
      return {
        id: p.id,
        groupId: p.groupId,
        position: {
          x: light.position.x,
          y: light.position.y,
          z: light.position.z,
        },
        target: {
          x: light.target.position.x,
          y: light.target.position.y,
          z: light.target.position.z,
        },
      }
    })
  }

  /**
   * Drop persisted seats that look like world-space corruption (e.g. free-drive
   * coords written as car-local). Caller should rebuild / leave empty for auto.
   *
   * `strict` also drops sideways aims and collapsed L/R pairs — use on load.
   * Gizmo commits use soft mode so a drag is never wiped back to auto seats.
   */
  sanitizeBeamProxies(
    proxies: VehicleBeamProxy[],
    opts: { strict?: boolean } = {},
  ): VehicleBeamProxy[] {
    const strict = opts.strict !== false
    const ok = proxies.filter((p) => {
      if (!isReasonableCarLocal(p.position) || !isReasonableCarLocal(p.target)) return false
      if (strict && !beamAimsAlongLength(p)) return false
      return true
    })
    if (!strict) return ok
    // Drop a whole front group when every seat sits in one spot (old shared-mat bug).
    const byGroup = new Map<VehicleBeamGroupId, VehicleBeamProxy[]>()
    for (const p of ok) {
      const list = byGroup.get(p.groupId) ?? []
      list.push(p)
      byGroup.set(p.groupId, list)
    }
    const out: VehicleBeamProxy[] = []
    for (const [groupId, list] of byGroup) {
      if ((groupId === 'lowBeam' || groupId === 'highBeam') && list.length >= 2) {
        let minX = Infinity
        let maxX = -Infinity
        let minZ = Infinity
        let maxZ = -Infinity
        for (const p of list) {
          minX = Math.min(minX, p.position.x)
          maxX = Math.max(maxX, p.position.x)
          minZ = Math.min(minZ, p.position.z)
          maxZ = Math.max(maxZ, p.position.z)
        }
        const span = Math.hypot(maxX - minX, maxZ - minZ)
        if (span < 0.4) continue
      }
      out.push(...list)
    }
    return out
  }

  /** Seed only currently lit beam groups (avoids stuffing high/reverse into every edit). */
  captureLitBeamProxies(): VehicleBeamProxy[] {
    if (!this.state) return this.captureBeamProxies()
    const groups = this.state.groups
    const handles = this.listBeamHandles().filter((h) => groups[h.groupId])
    const list = handles.length ? handles : this.listBeamHandles()
    // Keep live ids (including auto-*) so gizmo sync can find the same SpotLights.
    return list.map((h) => ({
      id: h.id,
      groupId: h.groupId,
      position: { ...h.position },
      target: { ...h.target },
    }))
  }

  /** Plain-text paste format for chat / defaults (car-local metres). */
  formatBeamPlacementsClipboard(proxies?: VehicleBeamProxy[]): string {
    const list = proxies ?? this.captureBeamProxies()
    const lines = [
      '# Automotive Studio beam proxies — placement-local metres (grounded car)',
      '# paste this block back to lock default positions',
      `# beams: ${list.length}`,
    ]
    for (const p of list) {
      const pos = `${fmt(p.position.x)},${fmt(p.position.y)},${fmt(p.position.z)}`
      const aim = `${fmt(p.target.x)},${fmt(p.target.y)},${fmt(p.target.z)}`
      lines.push(`${p.groupId} id=${p.id} pos=${pos} aim=${aim}`)
    }
    return lines.join('\n')
  }

  /** Build a persisted target from the currently selected mesh + material slot. */
  makeTargetFromObject(
    node: Object3D,
    materialSlot = 0,
  ): VehicleLightTarget | null {
    if (!this.root) return null
    const mesh = node as Mesh
    if (!mesh.isMesh) return null
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const mat = mats[materialSlot] ?? mats[0]
    return {
      node: refFromObject(this.root, node),
      materialSlot,
      materialName: mat?.name || undefined,
    }
  }

  apply(state: VehicleLightsState, opts: { strictSanitize?: boolean } = {}) {
    const prevTargets = JSON.stringify(this.state?.targets ?? {})
    const prevMode = this.state?.performanceMode ?? 'full'
    const strictSanitize = opts.strictSanitize !== false
    const cleanedProxies = this.sanitizeBeamProxies(state.beamProxies ?? [], {
      strict: strictSanitize,
    })
    const nextState: VehicleLightsState = {
      ...structuredClone(state),
      beamProxies: cleanedProxies,
      performanceMode: state.performanceMode === 'lite' ? 'lite' : 'full',
    }
    const prevBeams = JSON.stringify(this.state?.beamProxies ?? [])
    const prevIds = (this.state?.beamProxies ?? []).map((p) => p.id).join('|')
    const prevBlink =
      Boolean(this.state?.groups.hazards) ||
      Boolean(this.state?.groups.indicatorLeft) ||
      Boolean(this.state?.groups.indicatorRight)
    this.state = nextState
    if (!this.root) return
    const nextBlink =
      Boolean(nextState.groups.hazards) ||
      Boolean(nextState.groups.indicatorLeft) ||
      Boolean(nextState.groups.indicatorRight)
    // Start in the ON half so the first frame after toggling is visibly lit.
    if (nextBlink && !prevBlink) this.blinkPhase = 0
    const nextTargets = JSON.stringify(nextState.targets ?? {})
    const nextBeams = JSON.stringify(nextState.beamProxies ?? [])
    const nextIds = cleanedProxies.map((p) => p.id).join('|')
    const nextMode = nextState.performanceMode ?? 'full'
    if (nextTargets !== prevTargets) {
      this.restoreAll()
      this.rebuildTargets()
      this.buildProxies()
    } else if (nextMode !== prevMode) {
      // Lite drops PointLight proxies; full restores them.
      this.buildProxies()
    } else if (nextBeams !== prevBeams) {
      // Same seats, new transforms (gizmo drop) — update in place so the cone
      // does not snap back to auto while TransformControls re-binds.
      if (prevIds === nextIds && nextIds.length > 0 && this.applyBeamTransformsInPlace(cleanedProxies)) {
        /* kept live SpotLights */
      } else {
        this.buildProxies()
      }
    }
    this.applyEmissive()
    this.syncProxyVisibility()
  }

  /** Push authored positions onto existing SpotLights when ids still match. */
  private applyBeamTransformsInPlace(proxies: VehicleBeamProxy[]): boolean {
    if (!proxies.length) return false
    let applied = 0
    for (const p of proxies) {
      const light = this.beamById.get(p.id)
      if (!light) continue
      light.position.set(p.position.x, p.position.y, p.position.z)
      light.target.position.set(p.target.x, p.target.y, p.target.z)
      light.updateMatrixWorld(true)
      light.target.updateMatrixWorld(true)
      applied++
    }
    return applied === proxies.length
  }

  setRouteSignals(signals: {
    braking?: boolean
    reverse?: boolean
    /** Soft rear running lights while moving (OR'd with Tail checkbox). */
    running?: boolean
    indicatorLeft?: boolean
    indicatorRight?: boolean
  }) {
    let changed = false
    if (signals.braking != null && signals.braking !== this.routeBrake) {
      this.routeBrake = signals.braking
      changed = true
    }
    if (signals.reverse != null && signals.reverse !== this.routeReverse) {
      this.routeReverse = signals.reverse
      changed = true
    }
    if (signals.running != null && signals.running !== this.routeRunning) {
      this.routeRunning = signals.running
      changed = true
    }
    if (signals.indicatorLeft != null && signals.indicatorLeft !== this.routeIndicatorLeft) {
      if (signals.indicatorLeft) this.blinkPhase = 0
      this.routeIndicatorLeft = signals.indicatorLeft
      changed = true
    }
    if (signals.indicatorRight != null && signals.indicatorRight !== this.routeIndicatorRight) {
      if (signals.indicatorRight) this.blinkPhase = 0
      this.routeIndicatorRight = signals.indicatorRight
      changed = true
    }
    if (changed && this.state) {
      this.applyEmissive()
      this.syncProxyVisibility()
    }
  }

  /** Free-drive / route auto indicators (OR'd with Lights panel toggles). */
  getRouteIndicatorSignals() {
    return {
      indicatorLeft: this.routeIndicatorLeft,
      indicatorRight: this.routeIndicatorRight,
    }
  }

  playSequence(id: VehicleLightSequenceId) {
    if (!this.state) return false
    this.sequenceId = id
    this.sequenceElapsed = 0
    // Start from all-off for welcome, keep current for farewell then fade.
    if (id === 'welcome') {
      for (const g of VEHICLE_LIGHT_GROUP_IDS) this.state.groups[g] = false
    }
    this.applySequenceAt(0)
    return true
  }

  stopSequence(commit = true) {
    if (!this.sequenceId || !this.state) {
      this.sequenceId = null
      return
    }
    if (commit) this.onSequenceCommit?.({ ...this.state.groups })
    this.sequenceId = null
  }

  isSequencePlaying() {
    return Boolean(this.sequenceId)
  }

  update(dt: number) {
    if (!this.state) return

    if (this.sequenceId) {
      this.sequenceElapsed += dt
      this.applySequenceAt(this.sequenceElapsed)
      const steps = this.sequenceId === 'welcome' ? WELCOME_STEPS : FAREWELL_STEPS
      const end = steps[steps.length - 1].at + 0.35
      if (this.sequenceElapsed >= end) {
        this.stopSequence(true)
      }
    }

    const blink =
      this.state.groups.hazards ||
      this.state.groups.indicatorLeft ||
      this.state.groups.indicatorRight ||
      this.routeIndicatorLeft ||
      this.routeIndicatorRight
    if (blink || this.sequenceId) {
      this.blinkPhase += dt
      this.applyEmissive()
      this.syncProxyVisibility()
    }
  }

  dispose() {
    this.stopSequence(false)
    this.restoreAll()
    this.clearProxies()
    this.root = null
    this.targets = []
    // Keep `this.state` across dispose/bind (quality switch, Present→Studio restore).
    // Clearing it left UI checkboxes on while the car stayed dark after rebind.
  }

  private applySequenceAt(t: number) {
    if (!this.state || !this.sequenceId) return
    const steps = this.sequenceId === 'welcome' ? WELCOME_STEPS : FAREWELL_STEPS
    for (const step of steps) {
      if (step.at > t) break
      for (const [id, on] of Object.entries(step.groups)) {
        this.state.groups[id as VehicleLightGroupId] = Boolean(on)
      }
    }
  }

  private rebuildTargets() {
    if (!this.root) {
      this.targets = []
      return
    }
    const manualMap = this.state?.targets ?? {}
    const out: BoundTarget[] = []
    const usedMats = new WeakSet<MeshStandardMaterial>()

    for (const groupId of VEHICLE_LIGHT_GROUP_IDS) {
      if (!hasManualTargets(manualMap, groupId)) continue
      const manual = manualMap[groupId]!
      for (const entry of manual) {
        const node = resolveSemanticNode(this.root, entry.node)
        if (!node) continue
        const mesh = node as Mesh
        if (!mesh.isMesh) continue
        const mat = resolveMaterial(mesh, entry)
        if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
        const std = mat as MeshStandardMaterial
        if (usedMats.has(std)) continue
        usedMats.add(std)
        out.push({
          groupId,
          mesh,
          material: std,
          backup: captureMatBackup(std),
          localCenter: meshLocalCenter(mesh),
          manual: true,
        })
      }
    }

    // One tree walk for all auto groups (was 10× traverse on large GLBs).
    const needHeuristic = VEHICLE_LIGHT_GROUP_IDS.some((id) => !hasManualTargets(manualMap, id))
    if (needHeuristic) {
      for (const t of discoverAllHeuristicTargets(this.root, usedMats, manualMap)) {
        out.push(t)
      }
      // Named Orange/Amber first — Lixiang front blinker is often a single Orange pod
      // that spatial DarkGlass heuristics miss (outboard / band thresholds).
      for (const t of discoverNamedAmberIndicators(this.root, usedMats, manualMap, out)) {
        out.push(t)
      }
      // Lixiang-style: amber pods are often unnamed DarkGlass at the rear corners.
      for (const t of discoverSpatialIndicatorTargets(this.root, usedMats, manualMap, out)) {
        out.push(t)
      }
      // No DarkGlass corners — promote outermost TailLight/RedGlass pods to Indicator L/R
      // so the UI (1) matches real gizmo/emissive targets (not a silent fake count).
      promoteOuterTailToIndicators(out, this.root, this.bodyFrame)
    }
    this.targets = out
  }

  private effectiveOn(groupId: VehicleLightGroupId): boolean {
    if (!this.state) return false
    const g = this.state.groups
    if (groupId === 'brake') return g.brake || this.routeBrake
    if (groupId === 'reverse') return g.reverse || this.routeReverse
    if (groupId === 'tail') return g.tail || this.routeRunning
    if (groupId === 'indicatorLeft') {
      return g.hazards || g.indicatorLeft || this.routeIndicatorLeft
    }
    if (groupId === 'indicatorRight') {
      return g.hazards || g.indicatorRight || this.routeIndicatorRight
    }
    if (groupId === 'hazards') return g.hazards
    return Boolean(g[groupId])
  }

  private blinkLit(groupId: VehicleLightGroupId): boolean {
    if (groupId !== 'indicatorLeft' && groupId !== 'indicatorRight' && groupId !== 'hazards') {
      return true
    }
    const period = 1 / INDICATOR_HZ
    return this.blinkPhase % period < period * 0.5
  }

  private applyEmissive() {
    if (!this.state) return
    const gain = Math.max(0, Math.min(MAX_LAMP_GAIN, this.state.intensity))
    const hasDedicatedDrl = this.targets.some((t) => t.groupId === 'drl')
    const hasDedicatedInd = this.targets.some(
      (t) => t.groupId === 'indicatorLeft' || t.groupId === 'indicatorRight',
    )
    const brakeOn = this.effectiveOn('brake')
    const tailOn = this.effectiveOn('tail')
    const reverseOn = this.effectiveOn('reverse')
    const lowOn = this.effectiveOn('lowBeam')
    const drlOn = this.effectiveOn('drl')
    const indL = this.effectiveOn('indicatorLeft') && this.blinkLit('indicatorLeft')
    const indR = this.effectiveOn('indicatorRight') && this.blinkLit('indicatorRight')
    const hazardsOn = Boolean(this.state.groups.hazards)
    const rearTailTargets = this.targets.filter((t) => t.groupId === 'tail' || t.groupId === 'brake')

    for (const t of this.targets) {
      // Belt-and-suspenders: never paint cabin panes even if mis-bound.
      if (isCabinWindowMesh(t.mesh)) {
        const structural = restoreMatBackup(t.material, t.backup)
        if (structural) t.material.needsUpdate = true
        t.mesh.userData.selectiveBloom = false
        continue
      }

      let lit = false
      let colorHex = GROUP_COLOR[t.groupId]
      let baseIntensity = GROUP_BASE_INTENSITY[t.groupId]

      if (t.groupId === 'indicatorLeft' || t.groupId === 'indicatorRight') {
        const sideWant =
          t.groupId === 'indicatorLeft'
            ? this.effectiveOn('indicatorLeft')
            : this.effectiveOn('indicatorRight')
        const blinkOn =
          t.groupId === 'indicatorLeft'
            ? indL
            : indR
        const isAmberLens = /orange|amber/i.test(t.material.name || '')
        if (sideWant) {
          // Stay in amber-glass mode while the stalk is on; only pulse emissive with blink
          // (avoids transmission needsUpdate every half-cycle).
          // Hazards = all L+R indicators together, same amber as Indicator L/R.
          const intensity = blinkOn ? Math.min(3.6, GROUP_BASE_INTENSITY[t.groupId] * gain * 1.1) : 0
          const structural = applyLitLampLook(t.material, t.backup, {
            emissive: INDICATOR_AMBER,
            intensity,
            darkenColor: isLampLensMaterialName(t.material.name || ''),
          })
          if (structural) t.material.needsUpdate = true
          t.mesh.userData.selectiveBloom = blinkOn
          continue
        }
        if (reverseOn && !isAmberLens) {
          // No dedicated reverse lenses on Lixiang — rear pods go white in reverse.
          lit = true
          colorHex = GROUP_COLOR.reverse
          baseIntensity = GROUP_BASE_INTENSITY.reverse * 1.4
        } else if (brakeOn && !isAmberLens) {
          lit = true
          colorHex = GROUP_COLOR.brake
          baseIntensity = GROUP_BASE_INTENSITY.brake
        } else if (tailOn && !isAmberLens) {
          lit = true
          colorHex = GROUP_COLOR.tail
          baseIntensity = GROUP_BASE_INTENSITY.tail
        }
      } else if (t.groupId === 'tail' || t.groupId === 'brake') {
        const matName = normalizeLampMatName(t.material.name || '')
        const isRedGlass = /red\s*glass/i.test(matName)
        const isTailLight = /tail\s*light/i.test(matName)
        // Leftover rear RedGlass / TailLight (995, 713, …): join hazards in amber.
        // Never paint cabin Glass — that recreated the blinking-windows bug.
        if ((isRedGlass || isTailLight) && (indL || indR || hazardsOn) && !reverseOn) {
          if (hazardsOn && !isCabinWindowMesh(t.mesh)) {
            const blinkOn = this.blinkLit('hazards')
            const intensity = blinkOn
              ? Math.min(3.6, GROUP_BASE_INTENSITY.hazards * gain * 1.1)
              : 0
            const structural = applyLitLampLook(t.material, t.backup, {
              emissive: INDICATOR_AMBER,
              intensity,
              darkenColor: true,
            })
            if (structural) t.material.needsUpdate = true
            t.mesh.userData.selectiveBloom = blinkOn
          } else {
            const structural = restoreMatBackup(t.material, t.backup)
            if (structural) t.material.needsUpdate = true
            t.mesh.userData.selectiveBloom = false
          }
          continue
        }
        if (reverseOn) {
          // Going back: brake/tail cluster reads as white reverse lights.
          lit = true
          colorHex = GROUP_COLOR.reverse
          baseIntensity = GROUP_BASE_INTENSITY.reverse * 1.6
        } else if (brakeOn) {
          lit = true
          colorHex = GROUP_COLOR.brake
          baseIntensity = GROUP_BASE_INTENSITY.brake
        } else if (tailOn) {
          // Shared rear lenses: soft running lights stay on until brake fires.
          lit = true
          colorHex = GROUP_COLOR.tail
          baseIntensity = GROUP_BASE_INTENSITY.tail
        }
        // Fallback when promotion failed: only the single outermost L/R red pod.
        if (!hasDedicatedInd && (indL || indR) && !reverseOn) {
          const outer = this.outermostRearLamps(rearTailTargets)
          if (indL && outer.left && t === outer.left) {
            lit = true
            colorHex = INDICATOR_AMBER
            baseIntensity = GROUP_BASE_INTENSITY.indicatorLeft
          } else if (indR && outer.right && t === outer.right) {
            lit = true
            colorHex = INDICATOR_AMBER
            baseIntensity = GROUP_BASE_INTENSITY.indicatorRight
          }
        }
      } else if (t.groupId === 'drl') {
        // FrontLight strip (GeometryNode_724): join hazards in amber blink.
        if (hazardsOn) {
          const blinkOn = this.blinkLit('hazards')
          const intensity = blinkOn
            ? Math.min(5.5, GROUP_BASE_INTENSITY.hazards * gain * 1.2)
            : 0
          const structural = applyLitLampLook(t.material, t.backup, {
            emissive: INDICATOR_AMBER,
            intensity,
            darkenColor: isLampLensMaterialName(t.material.name || ''),
          })
          if (structural) t.material.needsUpdate = true
          t.mesh.userData.selectiveBloom = blinkOn
          continue
        }
        if (drlOn) {
          lit = true
          colorHex = GROUP_COLOR.drl
          baseIntensity = GROUP_BASE_INTENSITY.drl
        } else if (lowOn) {
          // Same FrontLight strip brightens when low beam is on.
          lit = true
          colorHex = GROUP_COLOR.lowBeam
          baseIntensity = GROUP_BASE_INTENSITY.lowBeam
        }
      } else if (t.groupId === 'lowBeam') {
        if (lowOn) {
          lit = true
          colorHex = GROUP_COLOR.lowBeam
          baseIntensity = GROUP_BASE_INTENSITY.lowBeam
        } else if (drlOn && !hasDedicatedDrl) {
          lit = true
          colorHex = GROUP_COLOR.drl
          baseIntensity = GROUP_BASE_INTENSITY.drl
        }
      } else if (t.groupId === 'hazards') {
        // Dedicated hazard meshes (rare) — same blink as indicators.
        lit = hazardsOn && this.blinkLit('hazards')
      } else {
        lit = this.effectiveOn(t.groupId) && this.blinkLit(t.groupId)
        colorHex = GROUP_COLOR[t.groupId]
        baseIntensity = GROUP_BASE_INTENSITY[t.groupId]
      }

      if (lit) {
        const cap = t.groupId === 'drl' ? 5.5 : 3.6
        const intensity = Math.min(cap, baseIntensity * gain * 1.1)
        const isIndicator =
          t.groupId === 'indicatorLeft' ||
          t.groupId === 'indicatorRight' ||
          t.groupId === 'hazards'
        const structural = applyLitLampLook(t.material, t.backup, {
          emissive: colorHex,
          intensity,
          // Only darken real lamp lenses — never cabin Glass (that painted the windows).
          darkenColor:
            isLampLensMaterialName(t.material.name || '') &&
            (isIndicator || t.groupId === 'brake' || t.groupId === 'tail' || t.groupId === 'drl'),
        })
        if (structural) t.material.needsUpdate = true
        t.mesh.userData.selectiveBloom = true
      } else {
        const structural = restoreMatBackup(t.material, t.backup)
        if (structural) t.material.needsUpdate = true
        t.mesh.userData.selectiveBloom = false
      }
    }
  }

  /** Single outermost rear lamp on each side (placement-local lateral). */
  private outermostRearLamps(rearTargets: BoundTarget[]): {
    left: BoundTarget | null
    right: BoundTarget | null
  } {
    if (rearTargets.length === 0) return { left: null, right: null }
    let left: BoundTarget | null = null
    let right: BoundTarget | null = null
    let minLat = Infinity
    let maxLat = -Infinity
    for (const t of rearTargets) {
      const lat = this.targetLateral(t)
      if (lat < minLat) {
        minLat = lat
        left = t
      }
      if (lat > maxLat) {
        maxLat = lat
        right = t
      }
    }
    // Need a real L/R spread — one centred mesh cannot serve both sides.
    if (left && right && left !== right && maxLat - minLat >= 0.25) {
      return { left, right }
    }
    return { left: null, right: null }
  }

  /** Placement-local lateral offset from body centre along the right axis. */
  private targetLateral(t: BoundTarget): number {
    if (!this.root) return 0
    t.mesh.updateWorldMatrix(true, false)
    const local = this.root.worldToLocal(t.mesh.localToWorld(t.localCenter.clone()))
    const body = this.bodyFrame
    if (!body) return local.x
    const forward = body.axis.clone()
    forward.y = 0
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
    else forward.normalize()
    const right = new Vector3(forward.z, 0, -forward.x)
    if (right.lengthSq() < 1e-8) return local.x - body.centre.x
    right.normalize()
    return local.clone().sub(body.centre).dot(right)
  }

  private buildProxies() {
    if (!this.root) return
    if (!this.proxyHost) {
      this.proxyHost = new Group()
      this.proxyHost.name = 'iom-vehicle-light-proxies'
      this.root.add(this.proxyHost)
    }
    while (this.proxyHost.children.length) {
      this.proxyHost.remove(this.proxyHost.children[0])
    }
    this.proxies.clear()
    this.beamById.clear()
    const byGroup = new Map<VehicleLightGroupId, BoundTarget[]>()
    for (const t of this.targets) {
      const list = byGroup.get(t.groupId) ?? []
      list.push(t)
      byGroup.set(t.groupId, list)
    }
    this.proxyHost.updateWorldMatrix(true, false)
    let body = this.bodyFrame ?? measureBodyFrame(this.root)
    if (!body || !bodyFrameLooksReasonable(body)) {
      body = measureBodyFrame(this.root)
      if (!body || !bodyFrameLooksReasonable(body)) body = fallbackBodyFrame()
    }
    this.bodyFrame = body
    const manual = this.state?.beamProxies ?? []
    const manualByGroup = new Map<VehicleBeamGroupId, VehicleBeamProxy[]>()
    for (const p of manual) {
      if (!BEAM_GROUP_IDS.includes(p.groupId)) continue
      const list = manualByGroup.get(p.groupId) ?? []
      list.push(p)
      manualByGroup.set(p.groupId, list)
    }

    // Aim from real lamp pods along the front/rear lamp axis (not hardcoded ±Z —
    // Sketchfab / flip180 cars often keep their nose on ±X in placement space).
    if (body) {
      const forwardXZ = inferForwardXZ(this.root, body, byGroup)
      for (const groupId of BEAM_GROUP_IDS) {
        const beam = BEAM_SPEC[groupId]!
        const ahead = groupId === 'reverse' ? -1 : 1
        const authored = manualByGroup.get(groupId)
        const lights: ProxyLight[] = []
        const distance = PROXY_DISTANCE[groupId] ?? PROXY_DISTANCE_DEFAULT

        if (authored && authored.length > 0) {
          for (let i = 0; i < authored.length; i++) {
            const p = authored[i]
            const spot = this.makeBeamSpot(groupId, distance, beam.angle, beam.penumbra, i, p.id)
            spot.position.set(p.position.x, p.position.y, p.position.z)
            spot.target.position.set(p.target.x, p.target.y, p.target.z)
            this.proxyHost.add(spot.target)
            this.proxyHost.add(spot)
            lights.push(spot)
            this.beamById.set(p.id, spot)
          }
        } else {
          let lampSeats = (
            groupId === 'reverse'
              ? collectLampSeatsLocal(this.root, byGroup, ['tail', 'brake', 'reverse'])
              : groupId === 'drl'
                ? collectLampSeatsLocal(this.root, byGroup, ['drl'])
                : collectLampSeatsLocal(this.root, byGroup, ['lowBeam', 'highBeam'])
          ).filter((s) => seatNearBody(s, body))
          // Lixiang: no HeadLight meshes — seat low/high/DRL on the front light assembly
          // (FrontLight strip + Black housing) so gizmos sit on GeometryNode_743 / nose cluster.
          if (groupId !== 'reverse' && lampSeats.length < 2) {
            const assembly = collectFrontAssemblyTrackSeats(this.root, body, byGroup)
            if (assembly.length >= 2) lampSeats = assembly
          }
          const seatOpts =
            groupId === 'highBeam'
              ? { pairSpread: 0.82, alongBias: body.lengthLocal * 0.04, heightBias: body.heightLocal * 0.04 }
              : groupId === 'lowBeam'
                ? { pairSpread: 1, alongBias: 0, heightBias: 0 }
                : groupId === 'drl'
                  ? { pairSpread: 1.05, alongBias: body.lengthLocal * 0.02, heightBias: body.heightLocal * 0.02 }
                  : {}
          const rig = planBeamRig(
            body,
            forwardXZ,
            ahead as 1 | -1,
            beam.reachBodies,
            beam.pair,
            lampSeats,
            seatOpts,
          )
          for (let i = 0; i < rig.seats.length; i++) {
            const id = `auto-${groupId}-${i}`
            const spot = this.makeBeamSpot(groupId, distance, beam.angle, beam.penumbra, i, id)
            spot.position.copy(rig.seats[i])
            spot.target.position.copy(rig.aims[i] ?? rig.aims[0])
            this.proxyHost.add(spot.target)
            this.proxyHost.add(spot)
            lights.push(spot)
            this.beamById.set(id, spot)
          }
        }
        this.proxies.set(groupId, lights)
      }
    }

    // Marker lamps: outward SpotLights (never PointLights) so cones miss the cabin.
    // Interior stays a short PointLight — it is meant to light the cabin.
    // Skip entirely in lite mode (beam SpotLights still provide head/tail cones).
    const maxMarkerProxies = this.state?.performanceMode === 'lite' ? 0 : 1
    const forwardXZ = body ? inferForwardXZ(this.root, body, byGroup) : new Vector3(0, 0, 1)
    for (const [groupId, list] of byGroup) {
      if (BEAM_SPEC[groupId]) continue
      const lights: ProxyLight[] = []
      const picked = list.slice(0, maxMarkerProxies)
      for (let i = 0; i < picked.length; i++) {
        const t = picked[i]
        t.mesh.updateWorldMatrix(true, false)
        const world = t.mesh.localToWorld(t.localCenter.clone())
        const seat = this.proxyHost!.worldToLocal(world)
        const distance = PROXY_DISTANCE[groupId] ?? PROXY_DISTANCE_DEFAULT

        if (groupId === 'interior') {
          const pl = new PointLight(GROUP_COLOR[groupId], PROXY_INTENSITY_FLOOR, distance, 2)
          pl.castShadow = false
          pl.visible = true
          pl.name = `iom-lamp-${groupId}-${i}`
          pl.position.copy(seat)
          this.proxyHost.add(pl)
          lights.push(pl)
          continue
        }

        const marker = MARKER_SPOT_SPEC[groupId] ?? {
          angle: 1.0,
          penumbra: 0.85,
          outNudge: 0.1,
        }
        const aim = markerOutwardDir(groupId, seat, body!.centre, forwardXZ)
        const nudged = seat.clone().addScaledVector(aim, marker.outNudge)
        // Soft ground pool slightly below the lamp so floor glow stays outside.
        const target = nudged
          .clone()
          .addScaledVector(aim, Math.max(1.2, distance * 0.55))
          .add(new Vector3(0, -0.35, 0))
        const spot = new SpotLight(
          GROUP_COLOR[groupId],
          PROXY_INTENSITY_FLOOR,
          distance,
          marker.angle,
          marker.penumbra,
          2,
        )
        spot.castShadow = false
        spot.visible = true
        spot.name = `iom-lamp-${groupId}-${i}`
        spot.position.copy(nudged)
        spot.target.position.copy(target)
        this.proxyHost.add(spot.target)
        this.proxyHost.add(spot)
        lights.push(spot)
      }
      this.proxies.set(groupId, lights)
    }
    // SpotLight programs compile on first non-zero draw — warm once so toggling
    // Low beam / markers does not freeze the UI for several seconds on big cars.
    if (!this.proxiesWarmed) {
      let anySpot = this.beamById.size > 0
      if (!anySpot) {
        for (const lights of this.proxies.values()) {
          if (lights.some((l) => (l as SpotLight).isSpotLight)) {
            anySpot = true
            break
          }
        }
      }
      if (anySpot) {
        this.proxiesWarmed = true
        this.onProxiesBuilt?.()
      }
    }
  }

  private makeBeamSpot(
    groupId: VehicleBeamGroupId,
    distance: number,
    angle: number,
    penumbra: number,
    index: number,
    proxyId: string,
  ): SpotLight {
    const spot = new SpotLight(
      GROUP_COLOR[groupId],
      PROXY_INTENSITY_FLOOR,
      distance,
      angle,
      penumbra,
      2,
    )
    spot.castShadow = false
    spot.visible = true
    spot.name = `iom-lamp-${groupId}-${index}`
    spot.userData.beamProxyId = proxyId
    spot.userData.beamGroupId = groupId
    return spot
  }

  private syncProxyVisibility() {
    if (!this.state) return
    const gain = Math.max(0, Math.min(MAX_LAMP_GAIN, this.state.intensity))
    const proxiesOn = this.state.proxiesEnabled
    const brakeOn = this.effectiveOn('brake')
    const tailOn = this.effectiveOn('tail')
    const reverseOn = this.effectiveOn('reverse')
    for (const groupId of VEHICLE_LIGHT_GROUP_IDS) {
      const lights = this.proxies.get(groupId) ?? []
      let on = proxiesOn && this.effectiveOn(groupId) && this.blinkLit(groupId)
      let powerId: VehicleLightGroupId = groupId
      // Going back: rear cones read as white reverse pools.
      if (
        reverseOn &&
        proxiesOn &&
        (groupId === 'tail' ||
          groupId === 'brake' ||
          groupId === 'indicatorLeft' ||
          groupId === 'indicatorRight' ||
          groupId === 'reverse')
      ) {
        on = true
        powerId = 'reverse'
      } else if (groupId === 'tail' && proxiesOn && brakeOn) {
        // Shared rear marker cones brighten with brake.
        on = true
        powerId = 'brake'
      } else if (groupId === 'brake' && proxiesOn && !brakeOn && tailOn) {
        // Brake seats still cast a soft running pool until the pedal fires.
        on = true
        powerId = 'tail'
      } else if (
        (groupId === 'indicatorLeft' || groupId === 'indicatorRight') &&
        proxiesOn &&
        !on &&
        (brakeOn || tailOn)
      ) {
        // Promoted indicator pods still cast a soft red pool when only tail/brake is on.
        on = true
        powerId = brakeOn ? 'brake' : 'tail'
      }
      for (const pl of lights) {
        // Always visible + floor intensity keeps NUM_*_LIGHTS stable (no recompile hitch).
        pl.visible = true
        pl.intensity = on ? PROXY_POWER[powerId] * gain : PROXY_INTENSITY_FLOOR
        if (on && powerId === 'reverse') pl.color.setHex(GROUP_COLOR.reverse)
        else if (on) pl.color.setHex(GROUP_COLOR[powerId])
      }
    }
  }

  private restoreAll() {
    for (const t of this.targets) {
      restoreMatBackup(t.material, t.backup)
      t.material.toneMapped = true
      t.material.needsUpdate = true
    }
  }

  private clearProxies() {
    if (this.proxyHost) {
      while (this.proxyHost.children.length) {
        this.proxyHost.remove(this.proxyHost.children[0])
      }
      this.proxyHost.removeFromParent()
    }
    this.proxies.clear()
    this.beamById.clear()
    this.proxyHost = null
    this.bodyFrame = null
    this.proxiesWarmed = false
  }
}

/**
 * Local-space bounds of the car under `root`, ignoring Sketchfab logos / plate letters
 * and tiny LED lettering strips. A world AABB would be useless once the car yaws.
 */
function measureBodyFrame(root: Object3D): BodyFrame | null {
  root.updateWorldMatrix(true, true)
  const toLocal = root.matrixWorld.clone().invert()
  const meshToLocal = new Matrix4()
  const vert = new Vector3()

  type MeshBox = { centre: Vector3; corners: Vector3[]; volume: number }
  const meshes: MeshBox[] = []

  const walk = (obj: Object3D) => {
    // Beam proxies / gizmos must not feed the body AABB (or we re-bake their junk).
    if (obj.name === 'iom-vehicle-light-proxies' || obj.name === 'iom-beam-orient-proxy') return
    const mesh = obj as Mesh
    if (mesh.isMesh && mesh.geometry) {
      if (!isDecorObject(mesh)) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
        const bb = mesh.geometry.boundingBox
        if (bb && !bb.isEmpty()) {
          meshToLocal.multiplyMatrices(toLocal, mesh.matrixWorld)
          const meshBox = new Box3()
          const corners: Vector3[] = []
          for (let corner = 0; corner < 8; corner++) {
            vert.set(
              corner & 1 ? bb.max.x : bb.min.x,
              corner & 2 ? bb.max.y : bb.min.y,
              corner & 4 ? bb.max.z : bb.min.z,
            )
            const local = vert.applyMatrix4(meshToLocal)
            meshBox.expandByPoint(local)
            corners.push(local.clone())
          }
          const size = meshBox.getSize(new Vector3())
          const volume = Math.abs(size.x * size.y * size.z)
          const maxDim = Math.max(size.x, size.y, size.z)
          const minDim = Math.min(size.x, size.y, size.z)
          // Skip paper-thin LED letters and absurd scene props (unscaled Sketchfab ground).
          if (maxDim > 1e-6 && minDim / maxDim >= 0.06 && maxDim < 28) {
            const centre = meshBox.getCenter(new Vector3())
            if (isReasonableCarLocal(centre)) {
              meshes.push({ centre, corners, volume })
            }
          }
        }
      }
    }
    for (const child of obj.children) walk(child)
  }
  walk(root)
  if (!meshes.length) return null

  const maxVol = Math.max(...meshes.map((m) => m.volume))
  const keepMeshes = meshes.filter((m) => m.volume >= maxVol * 0.02)
  const usable = keepMeshes.length ? keepMeshes : meshes

  const provisional = new Box3().setFromPoints(usable.map((m) => m.centre))
  const provCentre = provisional.getCenter(new Vector3())
  const provSize = provisional.getSize(new Vector3())
  const keep = new Box3()
  for (const m of usable) {
    const c = m.centre
    const nx = provSize.x > 1e-6 ? Math.abs(c.x - provCentre.x) / (provSize.x * 0.5) : 0
    const ny = provSize.y > 1e-6 ? Math.abs(c.y - provCentre.y) / (provSize.y * 0.5) : 0
    const nz = provSize.z > 1e-6 ? Math.abs(c.z - provCentre.z) / (provSize.z * 0.5) : 0
    if (nx > 1.15 || ny > 1.15 || nz > 1.15) continue
    for (const p of m.corners) keep.expandByPoint(p)
  }
  if (keep.isEmpty()) {
    for (const m of usable) for (const p of m.corners) keep.expandByPoint(p)
  }
  if (keep.isEmpty()) return null

  const size = keep.getSize(new Vector3())
  const boxCentre = keep.getCenter(new Vector3())
  // AABB centre drifts when one side has mirrors / open doors. Volume-weighted
  // mesh centres stay on the visual centreline of the body shell.
  let weight = 0
  const weighted = new Vector3()
  for (const m of usable) {
    const c = m.centre
    const nx = size.x > 1e-6 ? Math.abs(c.x - boxCentre.x) / (size.x * 0.5) : 0
    const nz = size.z > 1e-6 ? Math.abs(c.z - boxCentre.z) / (size.z * 0.5) : 0
    if (nx > 1.05 || nz > 1.05) continue
    weighted.addScaledVector(c, m.volume)
    weight += m.volume
  }
  const centre = weight > 0 ? weighted.multiplyScalar(1 / weight) : boxCentre.clone()
  centre.y = boxCentre.y

  // Placement space after VehicleNormalization: nose is always ±Z. Never let a wide
  // AABB or scattered FrontLight letters pick +X — that aimed cones out the side.
  const lengthLocal = size.z
  const widthLocal = size.x
  const frame: BodyFrame = {
    axis: new Vector3(0, 0, 1),
    centre,
    groundY: keep.min.y,
    lengthLocal: Math.max(lengthLocal, 0.5),
    widthLocal: Math.max(widthLocal, 0.5),
    heightLocal: size.y,
  }
  return bodyFrameLooksReasonable(frame) ? frame : null
}

function bodyFrameLooksReasonable(body: BodyFrame): boolean {
  if (!isReasonableCarLocal(body.centre)) return false
  if (body.lengthLocal < 0.8 || body.lengthLocal > 12) return false
  if (body.widthLocal < 0.6 || body.widthLocal > 5) return false
  if (body.heightLocal < 0.3 || body.heightLocal > 5) return false
  return true
}

function fallbackBodyFrame(): BodyFrame {
  return {
    axis: new Vector3(0, 0, 1),
    centre: new Vector3(0, 0.75, 0),
    groundY: 0,
    lengthLocal: 5,
    widthLocal: 1.9,
    heightLocal: 1.6,
  }
}

function seatNearBody(seat: Vector3, body: BodyFrame): boolean {
  if (!isReasonableCarLocal(seat)) return false
  const dx = seat.x - body.centre.x
  const dz = seat.z - body.centre.z
  const maxR = Math.max(body.lengthLocal, body.widthLocal) * 0.85 + 1.5
  return dx * dx + dz * dz <= maxR * maxR
}

function isDecorObject(mesh: Mesh): boolean {
  if (mesh.userData?.iomDecor) return true
  const matNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .map((m) => m?.name || '')
    .join(' ')
  return (
    DECOR_NAME.test(mesh.name || '') ||
    DECOR_NAME.test(mesh.parent?.name || '') ||
    DECOR_NAME.test(matNames)
  )
}

/**
 * Turn off Sketchfab attribution / logo lettering and tag it so the object list and
 * lamp heuristics ignore it. Floating text sits in the headlight beam path on many
 * exports, which looks like the lights are "bound" to the letters.
 */
export function suppressDecorMeshes(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    if (!isDecorObject(mesh)) return
    mesh.userData.iomDecor = true
    mesh.visible = false
  })
}

/** +1 / -1 along body.axis toward the nose (front lamps), falling back to +axis. */
function inferNoseSign(
  root: Object3D,
  body: BodyFrame,
  byGroup: Map<VehicleLightGroupId, BoundTarget[]>,
): 1 | -1 {
  const alongX = body.axis.x !== 0
  const longOf = (v: Vector3) => (alongX ? v.x : v.z)
  const seatLocal = (t: BoundTarget) => {
    t.mesh.updateWorldMatrix(true, false)
    return root.worldToLocal(t.mesh.localToWorld(t.localCenter.clone()))
  }
  const frontish: VehicleLightGroupId[] = ['lowBeam', 'highBeam', 'drl']
  const rearish: VehicleLightGroupId[] = ['tail', 'brake', 'reverse']
  let frontScore = 0
  let rearScore = 0
  for (const id of frontish) {
    for (const t of byGroup.get(id) ?? []) {
      if (isLetterLikeMesh(t.mesh)) continue
      frontScore += longOf(seatLocal(t)) - longOf(body.centre)
    }
  }
  for (const id of rearish) {
    for (const t of byGroup.get(id) ?? []) {
      if (isLetterLikeMesh(t.mesh)) continue
      rearScore += longOf(seatLocal(t)) - longOf(body.centre)
    }
  }
  if (Math.abs(frontScore) > Math.abs(rearScore) && Math.abs(frontScore) > 1e-4) {
    return frontScore > 0 ? 1 : -1
  }
  if (Math.abs(rearScore) > 1e-4) return rearScore > 0 ? -1 : 1
  return 1
}

/**
 * Unit XZ direction toward the visual nose in placement space.
 * Always follow body.axis (±Z after VehicleNormalization) — lamp centroids often
 * skew in X (one pod / lettering) and used to snap forward to ±X, aiming cones
 * out the side with only one pool visible on the floor.
 */
function inferForwardXZ(
  root: Object3D,
  body: BodyFrame,
  byGroup: Map<VehicleLightGroupId, BoundTarget[]>,
): Vector3 {
  const nose = inferNoseSign(root, body, byGroup)
  const dir = body.axis.clone().multiplyScalar(nose)
  dir.y = 0
  if (dir.lengthSq() < 1e-8) dir.set(0, 0, nose)
  else dir.normalize()
  return dir
}

/**
 * Unit XZ direction for a marker cone — always away from the cabin so SpotLights
 * do not wash seats/dash through the shell (PointLights did).
 */
export function markerOutwardDir(
  groupId: VehicleLightGroupId,
  seat: Vector3,
  bodyCentre: Vector3,
  forwardXZ: Vector3,
): Vector3 {
  if (groupId === 'tail' || groupId === 'brake') {
    return forwardXZ.clone().multiplyScalar(-1)
  }
  if (groupId === 'drl') {
    return forwardXZ.clone()
  }
  // Indicators / hazards / unknown: primarily lateral from centreline.
  const lateral = new Vector3(seat.x - bodyCentre.x, 0, seat.z - bodyCentre.z)
  const along = lateral.dot(forwardXZ)
  lateral.addScaledVector(forwardXZ, -along)
  if (lateral.lengthSq() > 1e-6) return lateral.normalize()
  const long = new Vector3(seat.x - bodyCentre.x, 0, seat.z - bodyCentre.z).dot(forwardXZ)
  return forwardXZ.clone().multiplyScalar(long >= 0 ? 1 : -1)
}

/**
 * Beam seats on lamp pods (when a real L/R track exists); aims straight along
 * `forwardXZ` onto the road — no toe-in (toe-in read as a 45° side spray from above).
 *
 * `pairSpread` 1 = full headlamp track; &lt;1 pulls seats inward (high beam).
 * `alongBias` / `heightBias` nudge high beams off the low-beam seats so they don't stack.
 */
function planBeamRig(
  body: BodyFrame,
  forwardXZ: Vector3,
  ahead: 1 | -1,
  reachBodies: number,
  pair: boolean,
  lampSeats: Vector3[] = [],
  opts: { pairSpread?: number; alongBias?: number; heightBias?: number } = {},
): BeamRig {
  const f = forwardXZ.clone().setY(0)
  if (f.lengthSq() < 1e-8) f.set(0, 0, 1)
  else f.normalize()
  if (ahead < 0) f.negate()

  // Lateral = perpendicular to forward on XZ (right-handed: forward × up).
  const lateral = new Vector3(-f.z, 0, f.x)
  if (lateral.lengthSq() < 1e-8) lateral.set(1, 0, 0)
  else lateral.normalize()

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const height =
    clamp(
      body.groundY + body.heightLocal * 0.2,
      body.groundY + body.heightLocal * 0.08,
      body.groundY + body.heightLocal * 0.38,
    ) + (opts.heightBias ?? 0)
  const reach = body.lengthLocal * reachBodies
  const pairSpread = opts.pairSpread ?? 1
  const alongBias = opts.alongBias ?? 0

  const latOf = (p: Vector3) => p.x * lateral.x + p.z * lateral.z
  const alongOf = (p: Vector3) =>
    (p.x - body.centre.x) * f.x + (p.z - body.centre.z) * f.z
  const at = (alongFromCentre: number, lat: number, y: number) =>
    new Vector3(
      body.centre.x + f.x * alongFromCentre + lateral.x * lat,
      y,
      body.centre.z + f.z * alongFromCentre + lateral.z * lat,
    )
  const aimFrom = (seat: Vector3) =>
    new Vector3(seat.x + f.x * reach, body.groundY, seat.z + f.z * reach)

  // Always keep a usable L/R track — shared FrontLight materials often yield one seat,
  // and a tiny width*0.14 spread reads as “all beams in one spot”.
  const minTrack = Math.max(0.85, Math.min(1.6, body.widthLocal * 0.36)) * pairSpread

  if (!pair) {
    if (lampSeats.length >= 1) {
      const avg = new Vector3()
      for (const s of lampSeats) avg.add(s)
      avg.multiplyScalar(1 / lampSeats.length)
      const along = Math.max(alongOf(avg), body.lengthLocal * 0.35) + alongBias
      const seat = at(ahead > 0 ? along : -Math.abs(along), 0, clamp(avg.y, height * 0.7, height * 1.3))
      return { seats: [seat], aims: [aimFrom(seat)] }
    }
    const seat = at((body.lengthLocal * 0.42 + alongBias) * (ahead > 0 ? 1 : -1), 0, height)
    return { seats: [seat], aims: [aimFrom(seat)] }
  }

  const usableLamps = lampSeats
    .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z))
    .sort((a, b) => latOf(a) - latOf(b))

  let latL = -minTrack * 0.5
  let latR = minTrack * 0.5
  let noseAlong = body.lengthLocal * 0.42 + alongBias
  let seatY = height

  if (usableLamps.length >= 2) {
    const left = usableLamps[0]
    const right = usableLamps[usableLamps.length - 1]
    // Cap track — shared-mat / junk seats can sit tens of metres apart after free drive.
    const track = Math.min(Math.abs(latOf(right) - latOf(left)), 2.2)
    const alongMid = (alongOf(left) + alongOf(right)) * 0.5
    if (track >= 0.35) {
      const mid = (latOf(left) + latOf(right)) * 0.5
      const half = Math.max(track * 0.5 * pairSpread, minTrack * 0.5)
      latL = mid - half
      latR = mid + half
      // Ignore free-drive world-as-local along readings (large negative); keep nose fraction.
      const along = Number.isFinite(alongMid) ? alongMid : body.lengthLocal * 0.42
      noseAlong =
        (along > body.lengthLocal * 0.15 && along < body.lengthLocal * 0.7
          ? along
          : Math.max(body.lengthLocal * 0.38, Math.min(Math.abs(along), body.lengthLocal * 0.5))) +
        alongBias
      seatY = clamp((left.y + right.y) * 0.5, height * 0.7, height * 1.35)
    }
  } else if (usableLamps.length === 1) {
    const s = usableLamps[0]
    const mid = latOf(s)
    latL = mid - minTrack * 0.5
    latR = mid + minTrack * 0.5
    const along = alongOf(s)
    noseAlong =
      (along > body.lengthLocal * 0.15 && along < body.lengthLocal * 0.7
        ? along
        : Math.max(body.lengthLocal * 0.38, Math.min(Math.abs(along), body.lengthLocal * 0.5))) +
      alongBias
    seatY = clamp(s.y, height * 0.7, height * 1.35)
  }

  const seatL = at(noseAlong, latL, seatY)
  const seatR = at(noseAlong, latR, seatY)
  return { seats: [seatL, seatR], aims: [aimFrom(seatL), aimFrom(seatR)] }
}

/**
 * Placement-local centres for beam seating. Unlike emissive binding, this does not
 * dedupe by shared material — L/R pods often share one FrontLight material.
 */
function collectLampSeatsLocal(
  root: Object3D,
  byGroup: Map<VehicleLightGroupId, BoundTarget[]>,
  groupIds: VehicleLightGroupId[],
): Vector3[] {
  const out: Vector3[] = []
  const seen = new Set<Mesh>()
  for (const id of groupIds) {
    for (const t of byGroup.get(id) ?? []) {
      if (seen.has(t.mesh) || isLetterLikeMesh(t.mesh)) continue
      seen.add(t.mesh)
      t.mesh.updateWorldMatrix(true, false)
      out.push(root.worldToLocal(t.mesh.localToWorld(t.localCenter.clone())))
    }
  }
  // Shared materials only bind one emissive target — rescan meshes for L/R seats.
  if (out.length < 2) {
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh || seen.has(mesh) || isDecorObject(mesh) || isLetterLikeMesh(mesh)) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        const name = mat?.name || ''
        const match = lampGroupForNames(mesh.name || '', mesh.parent?.name || '', name)
        if (!match || !groupIds.includes(match)) continue
        seen.add(mesh)
        mesh.updateWorldMatrix(true, false)
        out.push(root.worldToLocal(mesh.localToWorld(meshLocalCenter(mesh))))
        break
      }
    })
  }
  return out
}

function resolveMaterial(mesh: Mesh, entry: VehicleLightTarget): Material | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (entry.materialName) {
    const byName = mats.find((m) => m?.name === entry.materialName)
    if (byName) return byName
  }
  const slot = entry.materialSlot ?? 0
  return mats[slot] ?? mats[0] ?? null
}

/**
 * Lixiang rear signature: one RedGlass mesh (e.g. GeometryNode_759) holds both amber
 * tips as disconnected lateral islands. Split that lens into Indicator L/R materials
 * before falling back to whole-mesh promotion / front Orange.
 *
 * Skips only when each side already has a rear indicator; front Orange bindings alone
 * must not block rear promotion.
 */
function promoteOuterTailToIndicators(
  targets: BoundTarget[],
  root: Object3D,
  body: BodyFrame | null,
): void {
  let frame = body
  if (!frame || !bodyFrameLooksReasonable(frame)) {
    frame = measureBodyFrame(root)
    if (!frame || !bodyFrameLooksReasonable(frame)) frame = fallbackBodyFrame()
  }
  const forward = frame.axis.clone()
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
  else forward.normalize()
  const right = new Vector3(forward.z, 0, -forward.x)
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  else right.normalize()

  const alongOf = (t: BoundTarget): number => {
    t.mesh.updateWorldMatrix(true, false)
    const local = root.worldToLocal(t.mesh.localToWorld(t.localCenter.clone()))
    return local.clone().sub(frame!.centre).dot(forward)
  }
  const lateralOf = (t: BoundTarget): number => {
    t.mesh.updateWorldMatrix(true, false)
    const local = root.worldToLocal(t.mesh.localToWorld(t.localCenter.clone()))
    return local.clone().sub(frame!.centre).dot(right)
  }

  const isFrontAmber = (t: BoundTarget) => /orange|amber/i.test(t.material.name || '')
  const hasRearLeft = () =>
    targets.some(
      (t) =>
        t.groupId === 'indicatorLeft' &&
        alongOf(t) < -frame!.lengthLocal * 0.05 &&
        !isFrontAmber(t),
    )
  const hasRearRight = () =>
    targets.some(
      (t) =>
        t.groupId === 'indicatorRight' &&
        alongOf(t) < -frame!.lengthLocal * 0.05 &&
        !isFrontAmber(t),
    )
  if (hasRearLeft() && hasRearRight()) return

  // Prefer splitting a single rear RedGlass bar that already contains L+R tips.
  if (tryPromoteSplitRearRedGlass(targets, root, frame, right, hasRearLeft(), hasRearRight())) {
    return
  }

  const rear = targets.filter((t) => t.groupId === 'tail' || t.groupId === 'brake')
  if (rear.length < 1) return

  const lensBonus = (t: BoundTarget) =>
    /red\s*glass|dark\s*glass/i.test(normalizeLampMatName(t.material.name || '')) ? 1 : 0

  let left: BoundTarget | null = null
  let rightT: BoundTarget | null = null
  let bestLeft = Infinity
  let bestRight = -Infinity
  for (const t of rear) {
    if (isCabinWindowMesh(t.mesh, frame)) continue
    const lat = lateralOf(t)
    // Prefer RedGlass/DarkGlass lenses over TailLight housings when nearly as outer.
    const leftScore = lat - lensBonus(t) * frame.widthLocal * 0.05
    const rightScore = lat + lensBonus(t) * frame.widthLocal * 0.05
    if (leftScore < bestLeft) {
      bestLeft = leftScore
      left = t
    }
    if (rightScore > bestRight) {
      bestRight = rightScore
      rightT = t
    }
  }
  if (!left && !rightT) return

  const span = maxLatSpan(
    rear.filter((t) => !isCabinWindowMesh(t.mesh, frame)),
    lateralOf,
  )
  const splitOk = Boolean(left && rightT && left !== rightT && span >= 0.25)

  const promote = (t: BoundTarget, groupId: 'indicatorLeft' | 'indicatorRight') => {
    const cloned = cloneLampMaterialOnMesh(t.mesh, t.material, 0)
    if (cloned) {
      t.material = cloned
      t.backup = captureMatBackup(cloned)
    }
    t.groupId = groupId
  }

  if (splitOk) {
    if (!hasRearLeft() && left) promote(left, 'indicatorLeft')
    if (!hasRearRight() && rightT) promote(rightT, 'indicatorRight')
    return
  }

  // Asymmetric exports: all TailLight/RedGlass sit on one half — promote one side only.
  const only = left ?? rightT
  if (!only) return
  const onlyLat = lateralOf(only)
  if (onlyLat < 0 && !hasRearLeft()) promote(only, 'indicatorLeft')
  else if (onlyLat >= 0 && !hasRearRight()) promote(only, 'indicatorRight')
}

/**
 * Split a rear RedGlass mesh into Indicator L/R materials.
 * Lixiang: GeometryNode_759 holds both rear amber tips as lateral islands.
 * Do NOT split the thin upper signature strip (995) — that painted half the bar yellow.
 */
function tryPromoteSplitRearRedGlass(
  targets: BoundTarget[],
  root: Object3D,
  frame: BodyFrame,
  rightAxis: Vector3,
  hasRearLeft: boolean,
  hasRearRight: boolean,
): boolean {
  if (hasRearLeft && hasRearRight) return false

  type Cand = {
    target: BoundTarget
    splitAt: number
    score: number
  }
  let best: Cand | null = null
  const seen = new Set<Mesh>()
  for (const t of targets) {
    if (t.groupId !== 'tail' && t.groupId !== 'brake') continue
    if (seen.has(t.mesh)) continue
    seen.add(t.mesh)
    if (isCabinWindowMesh(t.mesh, frame)) continue
    if (!/red\s*glass/i.test(normalizeLampMatName(t.material.name || ''))) continue

    // Require a real lateral gap (two disconnected tips). Midpoint-splitting a
    // continuous strip (995) paints half the tail bar solid amber — wrong.
    const gap = largestLateralVertexGap(t.mesh, root, frame.centre, rightAxis)
    if (!gap || gap.gap < 0.35) continue

    const span = meshLateralSpan(t.mesh, root, frame.centre, rightAxis)
    if (!span || span.max - span.min < 0.55) continue

    const verts = t.mesh.geometry.getAttribute('position')?.count ?? 0
    // Prefer the dense dual-tip housing (759, ~700 verts) over a 34-vert bumper strip.
    const score = gap.gap + Math.min(2.5, verts / 300) + (span.thickness > 0.2 ? 1.0 : 0)
    if (!best || score > best.score) best = { target: t, splitAt: gap.splitAt, score }
  }
  if (!best) return false

  const split = splitMeshByLateralPlane(
    best.target.mesh,
    best.target.material,
    root,
    frame.centre,
    rightAxis,
    best.splitAt,
  )
  if (!split) return false

  // Drop every tail/brake binding on this mesh — replaced by L/R indicator slots.
  for (let i = targets.length - 1; i >= 0; i--) {
    if (targets[i].mesh === best.target.mesh) targets.splice(i, 1)
  }

  if (!hasRearLeft) {
    targets.push({
      groupId: 'indicatorLeft',
      mesh: best.target.mesh,
      material: split.rightMat,
      backup: captureMatBackup(split.rightMat),
      localCenter: split.rightCenter,
      manual: false,
    })
  }
  if (!hasRearRight) {
    targets.push({
      groupId: 'indicatorRight',
      mesh: best.target.mesh,
      material: split.leftMat,
      backup: captureMatBackup(split.leftMat),
      localCenter: split.leftCenter,
      manual: false,
    })
  }
  return !hasRearLeft || !hasRearRight
}

function meshLateralSpan(
  mesh: Mesh,
  root: Object3D,
  centre: Vector3,
  rightAxis: Vector3,
): { min: number; max: number; thickness: number; centreY: number } | null {
  const pos = mesh.geometry.getAttribute('position')
  if (!pos || pos.count < 6) return null
  mesh.updateWorldMatrix(true, false)
  const v = new Vector3()
  let min = Infinity
  let max = -Infinity
  let ySum = 0
  const wbox = new Box3().setFromObject(mesh)
  const ws = wbox.getSize(new Vector3())
  const sorted = [ws.x, ws.y, ws.z].sort((a, b) => a - b)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos as BufferAttribute, i)
    mesh.localToWorld(v)
    ySum += v.y
    const local = root.worldToLocal(v.clone())
    const lat = local.sub(centre).dot(rightAxis)
    min = Math.min(min, lat)
    max = Math.max(max, lat)
  }
  return {
    min,
    max,
    thickness: sorted[0],
    centreY: ySum / pos.count,
  }
}

/** Largest gap between sorted vertex laterals — marks separate L/R lamp islands. */
function largestLateralVertexGap(
  mesh: Mesh,
  root: Object3D,
  centre: Vector3,
  rightAxis: Vector3,
): { gap: number; splitAt: number } | null {
  const pos = mesh.geometry.getAttribute('position')
  if (!pos || pos.count < 8) return null
  mesh.updateWorldMatrix(true, false)
  const v = new Vector3()
  const lats: number[] = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos as BufferAttribute, i)
    mesh.localToWorld(v)
    const local = root.worldToLocal(v)
    lats.push(local.sub(centre).dot(rightAxis))
  }
  lats.sort((a, b) => a - b)
  let bestGap = 0
  let splitAt = 0
  let bestIdx = 0
  for (let i = 1; i < lats.length; i++) {
    const g = lats[i] - lats[i - 1]
    if (g > bestGap) {
      bestGap = g
      splitAt = (lats[i] + lats[i - 1]) * 0.5
      bestIdx = i
    }
  }
  if (bestGap < 0.35) return null
  // A solid light bar only has verts on its two end faces — that looks like a
  // huge "gap" but each "island" has ~zero lateral thickness. Real dual tips
  // (759 / Orange 664) have a measurable span on both sides.
  const leftLats = lats.slice(0, bestIdx)
  const rightLats = lats.slice(bestIdx)
  if (leftLats.length < 4 || rightLats.length < 4) return null
  const leftSpan = leftLats[leftLats.length - 1] - leftLats[0]
  const rightSpan = rightLats[rightLats.length - 1] - rightLats[0]
  if (leftSpan < 0.03 || rightSpan < 0.03) return null
  return { gap: bestGap, splitAt }
}

/**
 * Rebuild index groups so left-island tris use material 0 and right-island tris use material 1.
 */
function splitMeshByLateralPlane(
  mesh: Mesh,
  sourceMat: MeshStandardMaterial,
  root: Object3D,
  centre: Vector3,
  rightAxis: Vector3,
  splitAt: number,
): {
  leftMat: MeshStandardMaterial
  rightMat: MeshStandardMaterial
  leftCenter: Vector3
  rightCenter: Vector3
} | null {
  const geom = mesh.geometry
  const pos = geom.getAttribute('position') as BufferAttribute | undefined
  if (!pos) return null
  mesh.updateWorldMatrix(true, false)

  const index = geom.index
  const triCount = index ? index.count / 3 : pos.count / 3
  if (triCount < 2) return null

  const v = new Vector3()
  const latOf = (vi: number) => {
    v.fromBufferAttribute(pos, vi)
    mesh.localToWorld(v)
    return root.worldToLocal(v).sub(centre).dot(rightAxis)
  }

  const leftTris: number[] = []
  const rightTris: number[] = []
  let leftN = 0
  let rightN = 0
  const leftCentroid = new Vector3()
  const rightCentroid = new Vector3()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2
    const lat = (latOf(i0) + latOf(i1) + latOf(i2)) / 3
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    const cx = (a.x + b.x + c.x) / 3
    const cy = (a.y + b.y + c.y) / 3
    const cz = (a.z + b.z + c.z) / 3
    if (lat < splitAt) {
      leftTris.push(i0, i1, i2)
      leftCentroid.x += cx
      leftCentroid.y += cy
      leftCentroid.z += cz
      leftN++
    } else {
      rightTris.push(i0, i1, i2)
      rightCentroid.x += cx
      rightCentroid.y += cy
      rightCentroid.z += cz
      rightN++
    }
  }
  if (leftN < 1 || rightN < 1) return null

  leftCentroid.multiplyScalar(1 / leftN)
  rightCentroid.multiplyScalar(1 / rightN)

  const newIndex = new Uint32Array(leftTris.length + rightTris.length)
  newIndex.set(leftTris, 0)
  newIndex.set(rightTris, leftTris.length)
  geom.setIndex(new BufferAttribute(newIndex, 1))
  geom.clearGroups()
  geom.addGroup(0, leftTris.length, 0)
  geom.addGroup(leftTris.length, rightTris.length, 1)

  const leftMat = sourceMat.clone()
  leftMat.name = sourceMat.name ? `${sourceMat.name}` : 'RedGlass'
  const rightMat = sourceMat.clone()
  rightMat.name = sourceMat.name ? `${sourceMat.name}` : 'RedGlass'
  mesh.material = [leftMat, rightMat]

  return {
    leftMat,
    rightMat,
    leftCenter: leftCentroid,
    rightCenter: rightCentroid,
  }
}

function maxLatSpan(targets: BoundTarget[], lateralOf: (t: BoundTarget) => number): number {
  let minLat = Infinity
  let maxLat = -Infinity
  for (const t of targets) {
    const lat = lateralOf(t)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  return maxLat - minLat
}

/** True when the project has at least one manual bind for this lamp group. */
function hasManualTargets(
  manualMap: VehicleLightsState['targets'],
  groupId: VehicleLightGroupId,
): boolean {
  const list = manualMap[groupId]
  return Array.isArray(list) && list.length > 0
}

/** CamelCase material names (DarkGlass, FrontLight) → spaced tokens for regexes. */
function normalizeLampMatName(name: string): string {
  return (name || '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_.\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Bind materials literally named Orange / Amber (Lixiang front blinker).
 * If one mesh holds both front tips as lateral islands (GeometryNode_664), split
 * into Indicator L/R — otherwise a single shared material lights both tips at once.
 */
function discoverNamedAmberIndicators(
  root: Object3D,
  usedMats: WeakSet<MeshStandardMaterial>,
  manualMap: VehicleLightsState['targets'],
  already: BoundTarget[],
): BoundTarget[] {
  if (hasManualTargets(manualMap, 'indicatorLeft') || hasManualTargets(manualMap, 'indicatorRight')) {
    return []
  }

  let body = measureBodyFrame(root)
  if (!body || !bodyFrameLooksReasonable(body)) body = fallbackBodyFrame()

  const forward = body.axis.clone()
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
  else forward.normalize()
  const rightAxis = new Vector3(forward.z, 0, -forward.x)
  if (rightAxis.lengthSq() < 1e-8) rightAxis.set(1, 0, 0)
  else rightAxis.normalize()

  type Cand = {
    mesh: Mesh
    std: MeshStandardMaterial
    slot: number
    lat: number
    along: number
  }
  const cands: Cand[] = []
  const claimedMeshes = new Set(already.map((t) => t.mesh))

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || claimedMeshes.has(mesh) || isDecorObject(mesh)) return
    if (isCabinWindowMesh(mesh, body)) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (let slot = 0; slot < mats.length; slot++) {
      const mat = mats[slot]
      if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
      const std = mat as MeshStandardMaterial
      if (usedMats.has(std)) continue
      const matName = normalizeLampMatName(std.name || '')
      if (!/\b(orange|amber)\b/i.test(matName)) continue
      if (isCabinWindowMesh(mesh, body)) continue

      mesh.updateWorldMatrix(true, false)
      const local = root.worldToLocal(mesh.localToWorld(meshLocalCenter(mesh)))
      const along = local.clone().sub(body.centre).dot(forward)
      const lat = local.clone().sub(body.centre).dot(rightAxis)
      cands.push({ mesh, std, slot, lat, along })
      break
    }
  })

  if (cands.length === 0) return []

  const front = cands.filter((c) => c.along > body.lengthLocal * 0.02)
  const pool = (front.length > 0 ? front : cands).sort((a, b) => a.lat - b.lat)

  const out: BoundTarget[] = []
  const pushPick = (c: Cand, groupId: VehicleLightGroupId) => {
    const claimed = cloneLampMaterialOnMesh(c.mesh, c.std, c.slot)
    if (!claimed) return
    usedMats.add(claimed)
    usedMats.add(c.std)
    claimedMeshes.add(c.mesh)
    out.push({
      groupId,
      mesh: c.mesh,
      material: claimed,
      backup: captureMatBackup(claimed),
      localCenter: meshLocalCenter(c.mesh),
      manual: false,
    })
  }

  // Dual-tip Orange bar: split islands so Ind L/R each own one front tip.
  if (pool.length === 1) {
    const only = pool[0]
    const gap = largestLateralVertexGap(only.mesh, root, body.centre, rightAxis)
    if (gap && gap.gap >= 0.35) {
      const split = splitMeshByLateralPlane(
        only.mesh,
        only.std,
        root,
        body.centre,
        rightAxis,
        gap.splitAt,
      )
      if (split) {
        usedMats.add(split.leftMat)
        usedMats.add(split.rightMat)
        usedMats.add(only.std)
        claimedMeshes.add(only.mesh)
        // Placement-local +X is vehicle LEFT on this Sketchfab export — swap tips.
        out.push({
          groupId: 'indicatorLeft',
          mesh: only.mesh,
          material: split.rightMat,
          backup: captureMatBackup(split.rightMat),
          localCenter: split.rightCenter,
          manual: false,
        })
        out.push({
          groupId: 'indicatorRight',
          mesh: only.mesh,
          material: split.leftMat,
          backup: captureMatBackup(split.leftMat),
          localCenter: split.leftCenter,
          manual: false,
        })
        return out
      }
    }
    pushPick(only, only.lat < 0 ? 'indicatorLeft' : 'indicatorRight')
    return out
  }

  pushPick(pool[0], 'indicatorLeft')
  pushPick(pool[pool.length - 1], 'indicatorRight')
  return out
}

/**
 * Bind Orange / DarkGlass indicator pods at the front light assembly and rear corners
 * when the GLB has no turn-signal names. Front + rear bands are handled separately so a
 * single front Orange (Lixiang) does not steal the rear RedGlass promotion path.
 */
function discoverSpatialIndicatorTargets(
  root: Object3D,
  usedMats: WeakSet<MeshStandardMaterial>,
  manualMap: VehicleLightsState['targets'],
  already: BoundTarget[],
): BoundTarget[] {
  if (hasManualTargets(manualMap, 'indicatorLeft') || hasManualTargets(manualMap, 'indicatorRight')) {
    return []
  }
  let body = measureBodyFrame(root)
  if (!body || !bodyFrameLooksReasonable(body)) body = fallbackBodyFrame()

  const forward = body.axis.clone()
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
  else forward.normalize()
  const rightAxis = new Vector3(forward.z, 0, -forward.x)
  if (rightAxis.lengthSq() < 1e-8) rightAxis.set(1, 0, 0)
  else rightAxis.normalize()

  type Cand = {
    mesh: Mesh
    std: MeshStandardMaterial
    slot: number
    local: Vector3
    lat: number
    latSpan: number
    band: 'front' | 'rear'
  }
  const cands: Cand[] = []
  const claimedMeshes = new Set(already.map((t) => t.mesh))
  const _corner = new Vector3()

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || claimedMeshes.has(mesh) || isDecorObject(mesh)) {
      return
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (let slot = 0; slot < mats.length; slot++) {
      const mat = mats[slot]
      if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
      const std = mat as MeshStandardMaterial
      const matName = normalizeLampMatName(std.name || '')
      // Amber / Orange / named blinkers. DarkGlass only when not a cabin pane
      // (Lixiang windows are DarkGlass; tiny rear corner pods stay eligible).
      const darkGlass = /^dark\s+glass$/i.test(matName)
      const amberName = /\b(amber|orange|indicat|blink|signal|flasher)\b/i.test(matName)
      if (!darkGlass && !amberName) continue
      if (isCabinWindowMesh(mesh, body)) continue
      // Thin Orange LED bars are letter-like by aspect — keep them (same as FrontLight/DRL).
      if (isLetterLikeMesh(mesh) && !/\b(amber|orange)\b/i.test(matName)) continue
      mesh.updateWorldMatrix(true, false)
      const local = root.worldToLocal(mesh.localToWorld(meshLocalCenter(mesh)))
      const along = local.clone().sub(body.centre).dot(forward)
      const frontBand = along > body.lengthLocal * 0.08
      const rearBand = along < -body.lengthLocal * 0.05
      if (!frontBand && !rearBand) continue

      // World AABB — Sketchfab non-uniform scale makes local maxDim meaningless.
      const wbox = new Box3().setFromObject(mesh)
      const ws = wbox.getSize(new Vector3())
      // Cabin windows / body glass: large in two axes.
      if (ws.x > body.widthLocal * 0.7 && ws.z > body.lengthLocal * 0.28) continue
      if (ws.y > body.heightLocal * 0.55 && ws.x > body.widthLocal * 0.35) continue
      if (Math.max(ws.x, ws.y, ws.z) > body.lengthLocal * 0.55) continue

      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox
      if (!bb || bb.isEmpty()) continue

      let minLat = Infinity
      let maxLat = -Infinity
      for (let corner = 0; corner < 8; corner++) {
        _corner.set(
          corner & 1 ? bb.max.x : bb.min.x,
          corner & 2 ? bb.max.y : bb.min.y,
          corner & 4 ? bb.max.z : bb.min.z,
        )
        const world = mesh.localToWorld(_corner.clone())
        const pl = root.worldToLocal(world)
        const lat = pl.clone().sub(body.centre).dot(rightAxis)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }
      const latSpan = maxLat - minLat
      // Rear signature bars are wide; corner DarkGlass / amber stay narrower.
      if (rearBand && latSpan > body.widthLocal * 0.45) continue
      if (frontBand && latSpan > body.widthLocal * 0.55) continue

      const lat = local.clone().sub(body.centre).dot(rightAxis)
      const isDarkGlass = /^dark\s*glass$/i.test(matName)
      // DarkGlass rear corners can sit closer inboard than RedGlass tips.
      const minOutboard = frontBand
        ? body.widthLocal * 0.08
        : isDarkGlass
          ? body.widthLocal * 0.12
          : body.widthLocal * 0.18
      if (Math.abs(lat) < minOutboard) continue

      cands.push({
        mesh,
        std,
        slot,
        local,
        lat,
        latSpan,
        band: frontBand ? 'front' : 'rear',
      })
      break
    }
  })

  const out: BoundTarget[] = []
  const pushPick = (c: Cand, groupId: VehicleLightGroupId) => {
    const claimed = cloneLampMaterialOnMesh(c.mesh, c.std, c.slot)
    if (!claimed) return
    usedMats.add(claimed)
    usedMats.add(c.std)
    claimedMeshes.add(c.mesh)
    out.push({
      groupId,
      mesh: c.mesh,
      material: claimed,
      backup: captureMatBackup(claimed),
      localCenter: meshLocalCenter(c.mesh),
      manual: false,
    })
  }

  for (const band of ['front', 'rear'] as const) {
    const bandCands = cands.filter((c) => c.band === band).sort((a, b) => a.lat - b.lat)
    if (bandCands.length >= 2) {
      const left = bandCands[0]
      const right = bandCands[bandCands.length - 1]
      if (left.mesh === right.mesh) continue
      if (left.lat * right.lat > 0) continue
      pushPick(left, 'indicatorLeft')
      pushPick(right, 'indicatorRight')
      continue
    }
    // Single front amber pod → bind only its side (rear promotion fills the other).
    if (band === 'front' && bandCands.length === 1) {
      const only = bandCands[0]
      pushPick(only, only.lat < 0 ? 'indicatorLeft' : 'indicatorRight')
    }
  }

  return out
}

/**
 * L/R track on the nose light cluster (FrontLight strip + Black housing), even when the
 * strip is letter-thin and skipped by normal lamp-seat collection.
 */
function collectFrontAssemblyTrackSeats(
  root: Object3D,
  body: BodyFrame,
  byGroup: Map<VehicleLightGroupId, BoundTarget[]>,
): Vector3[] {
  const forward = body.axis.clone()
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
  else forward.normalize()
  const right = new Vector3(forward.z, 0, -forward.x)
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  else right.normalize()

  const meshes = new Set<Mesh>()
  for (const t of byGroup.get('drl') ?? []) meshes.add(t.mesh)

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || isDecorObject(mesh)) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const matName = (mats[0]?.name || '').replace(/[_.\-/]+/g, ' ')
    const isFrontLight = /front\s*light/i.test(matName)
    const isBlackHousing = /^(absolut\s*)?black$/i.test(matName)
    if (!isFrontLight && !isBlackHousing) return
    mesh.updateWorldMatrix(true, false)
    const local = root.worldToLocal(mesh.localToWorld(meshLocalCenter(mesh)))
    const along = local.clone().sub(body.centre).dot(forward)
    if (along < body.lengthLocal * 0.1) return
    // Housing can be large; keep pods near the DRL nose band.
    if (isBlackHousing && meshes.size > 0) {
      let nearDrl = false
      for (const d of meshes) {
        d.updateWorldMatrix(true, false)
        const dc = root.worldToLocal(d.localToWorld(meshLocalCenter(d)))
        if (local.distanceTo(dc) < body.lengthLocal * 0.55) nearDrl = true
      }
      if (!nearDrl) return
    }
    meshes.add(mesh)
  })

  if (meshes.size === 0) return []

  let minLat = Infinity
  let maxLat = -Infinity
  let sumAlong = 0
  let sumY = 0
  let n = 0
  const _corner = new Vector3()
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox
    if (!bb || bb.isEmpty()) continue
    mesh.updateWorldMatrix(true, false)
    for (let corner = 0; corner < 8; corner++) {
      _corner.set(
        corner & 1 ? bb.max.x : bb.min.x,
        corner & 2 ? bb.max.y : bb.min.y,
        corner & 4 ? bb.max.z : bb.min.z,
      )
      const local = root.worldToLocal(mesh.localToWorld(_corner.clone()))
      const lat = local.clone().sub(body.centre).dot(right)
      const along = local.clone().sub(body.centre).dot(forward)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      sumAlong += along
      sumY += local.y
      n++
    }
  }
  if (n === 0 || maxLat - minLat < 0.35) return []

  const along = sumAlong / n
  const y = sumY / n
  const at = (lat: number) =>
    new Vector3(
      body.centre.x + forward.x * along + right.x * lat,
      y,
      body.centre.z + forward.z * along + right.z * lat,
    )
  // Pull slightly inward from absolute bbox extremes (bumper corners).
  const pad = (maxLat - minLat) * 0.08
  return [at(minLat + pad), at(maxLat - pad)]
}

function discoverAllHeuristicTargets(
  root: Object3D,
  usedMats: WeakSet<MeshStandardMaterial>,
  manualMap: VehicleLightsState['targets'],
): BoundTarget[] {
  const out: BoundTarget[] = []
  let body = measureBodyFrame(root)
  if (!body || !bodyFrameLooksReasonable(body)) body = null

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    if (isDecorObject(mesh)) return
    if (isCabinWindowMesh(mesh, body)) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (let slot = 0; slot < mats.length; slot++) {
      const mat = mats[slot]
      if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
      const std = mat as MeshStandardMaterial
      // Plain cabin Glass must never become a lamp group via name heuristics.
      const matName = normalizeLampMatName(std.name || '')
      if (/^(glass|window|windscreen|windshield)$/i.test(matName)) continue

      const match = lampGroupForNames(
        mesh.name || '',
        (mesh.parent?.name as string) || '',
        std.name || '',
      )
      if (!match) continue
      if (hasManualTargets(manualMap, match)) continue
      // Thin FrontLight LED strips are letter-like by aspect — keep them for DRL;
      // only skip for real headlamp cones (low/high) where they yank seats off.
      if (match !== 'drl' && BEAM_SPEC[match] && isLetterLikeMesh(mesh)) continue

      // Always clone lamp materials so L/R / indicator edits never light sibling pods.
      let claimed = std
      if (
        usedMats.has(std) ||
        match === 'tail' ||
        match === 'brake' ||
        match === 'lowBeam' ||
        match === 'drl'
      ) {
        if (
          usedMats.has(std) &&
          match !== 'tail' &&
          match !== 'brake' &&
          match !== 'lowBeam' &&
          match !== 'drl'
        ) {
          continue
        }
        const cloned = cloneLampMaterialOnMesh(mesh, std, slot)
        if (!cloned) {
          if (usedMats.has(std)) continue
          claimed = std
        } else {
          claimed = cloned
        }
      }
      usedMats.add(claimed)
      usedMats.add(std)
      out.push({
        groupId: match,
        mesh,
        material: claimed,
        backup: captureMatBackup(claimed),
        localCenter: meshLocalCenter(mesh),
        manual: false,
      })
    }
  })
  return out
}

/** Put a private material copy on this mesh so emissive edits do not light sibling pods. */
function cloneLampMaterialOnMesh(
  mesh: Mesh,
  std: MeshStandardMaterial,
  slot: number,
): MeshStandardMaterial | null {
  const clone = std.clone()
  clone.name = std.name ? `${std.name}` : 'Lamp'
  const mats = Array.isArray(mesh.material) ? mesh.material.slice() : [mesh.material]
  if (mats[slot] !== std) {
    const idx = mats.indexOf(std)
    if (idx < 0) return null
    mats[idx] = clone
  } else {
    mats[slot] = clone
  }
  mesh.material = mats.length === 1 ? clone : mats
  return clone
}

/**
 * Lamp group for a mesh, from its own name, its parent's, and its material's.
 *
 * Sketchfab-style exports name meshes GeometryNode_713 under Plane.009 and keep the lamp
 * name on the material (FrontLight / TailLight), so the material name is probed too — but
 * only when it reads as a lamp, otherwise trim called "Interior" or a panel called
 * "Tailgate" would light up. Exported so `scripts/probe-lamp-names.ts` reports exactly
 * what the runtime binds.
 */
export function lampGroupForNames(
  meshName: string,
  parentName: string,
  materialName: string,
): VehicleLightGroupId | null {
  const nodeName = `${meshName} ${parentName}`
  const probe = LAMP_MATERIAL_WORD.test(materialName)
    ? `${nodeName} ${materialName}`
    : nodeName
  return classifyName(probe)
}

function classifyName(raw: string): VehicleLightGroupId | null {
  // Underscores and dots are word characters, so `\b(headlight)` never fires on
  // Car_HeadLight. Flatten separators to spaces before matching.
  const name = raw.replace(/[_.\-/]+/g, ' ')
  const order: VehicleLightGroupId[] = [
    'highBeam',
    'lowBeam',
    'brake',
    'reverse',
    'indicatorLeft',
    'indicatorRight',
    'hazards',
    'drl',
    'tail',
    'interior',
  ]
  for (const id of order) {
    if (GROUP_NAME_PATTERNS[id].test(name)) return id
  }
  // Sketchfab "FrontLight" → DRL signature strip (must run before generic front*light).
  if (/\bfront\s*light\b/i.test(name) && !/\b(head|low|high|main|dipped)\b/i.test(name)) {
    return 'drl'
  }
  if (/front.*(light|lamp)/i.test(name)) return 'lowBeam'
  if (/rear.*(light|lamp)/i.test(name)) return 'tail'
  if (/\bred\s*glass\b/i.test(name)) return 'tail'
  return null
}

function meshLocalCenter(mesh: Mesh): Vector3 {
  mesh.geometry.computeBoundingSphere()
  const c = mesh.geometry.boundingSphere?.center
  return c ? c.clone() : new Vector3()
}

export function vehicleLightGroupLabel(id: VehicleLightGroupId): string {
  switch (id) {
    case 'drl':
      return 'Daytime running'
    case 'lowBeam':
      return 'Low beam'
    case 'highBeam':
      return 'High beam'
    case 'tail':
      return 'Tail lights'
    case 'brake':
      return 'Brake'
    case 'indicatorLeft':
      return 'Indicator L'
    case 'indicatorRight':
      return 'Indicator R'
    case 'hazards':
      return 'Hazards'
    case 'reverse':
      return 'Reverse'
    case 'interior':
      return 'Interior'
    default:
      return id
  }
}

export function proposeNightRunning(
  state: VehicleLightsState,
  isNight: boolean,
): VehicleLightsState {
  if (!isNight || !state.autoRunningAtNight) return state
  const anyOn = VEHICLE_LIGHT_GROUP_IDS.some((id) => state.groups[id])
  if (anyOn) return state
  return {
    ...state,
    groups: {
      ...state.groups,
      drl: true,
      tail: true,
    },
  }
}

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toFixed(3)
}

/** Car-local seats are metres from the placement root — anything huge is almost certainly wrong. */
function isReasonableCarLocal(p: { x: number; y: number; z: number }): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.z) &&
    Math.abs(p.x) < 25 &&
    Math.abs(p.y) < 12 &&
    Math.abs(p.z) < 25
  )
}

/** Aim must be mostly longitudinal in XZ (nose may be ±X or ±Z after normalize). */
function beamAimsAlongLength(p: VehicleBeamProxy): boolean {
  const dx = p.target.x - p.position.x
  const dz = p.target.z - p.position.z
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return false
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return false
  const along = Math.max(Math.abs(dx), Math.abs(dz))
  const side = Math.min(Math.abs(dx), Math.abs(dz))
  // Short DRL signature cones only need a clear forward bias (not headlamp reach).
  const minRatio = p.groupId === 'drl' ? 1.15 : 1.5
  return along >= side * minRatio
}
