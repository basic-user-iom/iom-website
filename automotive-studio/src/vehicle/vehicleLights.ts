import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
  type Material,
} from 'three'
import type {
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
}

type BoundTarget = {
  groupId: VehicleLightGroupId
  mesh: Mesh
  material: MeshStandardMaterial
  backup: MatBackup
  localCenter: Vector3
  manual: boolean
}

const GROUP_NAME_PATTERNS: Record<VehicleLightGroupId, RegExp> = {
  drl: /\b(drl|day.?running|running.?light|position.?light|front.?pos)/i,
  lowBeam: /\b(low.?beam|dipped|headlight|head.?lamp|front.?light)(?!.*high)/i,
  highBeam: /\b(high.?beam|main.?beam|full.?beam)/i,
  tail: /\b(tail|rear.?light|rear.?lamp|stop.?tail|rueck|rück)/i,
  brake: /\b(brake|stop.?light|brems)/i,
  indicatorLeft: /\b(indicator|turn.?signal|blinker|flasher).*(l(eft)?|fl)\b|\b(l(eft)?|fl).*(indicator|turn|blinker)/i,
  indicatorRight: /\b(indicator|turn.?signal|blinker|flasher).*(r(ight)?|fr)\b|\b(r(ight)?|fr).*(indicator|turn|blinker)/i,
  hazards: /\b(hazard|warn.?blink)/i,
  reverse: /\b(reverse|backup|rueckfahr|rückfahr)/i,
  interior: /\b(interior|cabin|dome|courtesy|ambient.?light)/i,
}

const GROUP_COLOR: Record<VehicleLightGroupId, number> = {
  drl: 0xe8f0ff,
  lowBeam: 0xfff2d0,
  highBeam: 0xfff8e8,
  tail: 0xff3030,
  brake: 0xff1010,
  indicatorLeft: 0xffa020,
  indicatorRight: 0xffa020,
  hazards: 0xffa020,
  reverse: 0xf0f4ff,
  interior: 0xffe8c8,
}

const GROUP_BASE_INTENSITY: Record<VehicleLightGroupId, number> = {
  drl: 1.4,
  lowBeam: 2.2,
  highBeam: 3.2,
  tail: 1.6,
  brake: 3.5,
  indicatorLeft: 2.4,
  indicatorRight: 2.4,
  hazards: 2.4,
  reverse: 2.0,
  interior: 0.9,
}

const PROXY_POWER: Record<VehicleLightGroupId, number> = {
  drl: 0.35,
  lowBeam: 1.8,
  highBeam: 3.2,
  tail: 0.25,
  brake: 0.55,
  indicatorLeft: 0.4,
  indicatorRight: 0.4,
  hazards: 0.4,
  reverse: 0.8,
  interior: 0.45,
}

const INDICATOR_HZ = 1.5

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
  private proxies = new Map<VehicleLightGroupId, PointLight[]>()
  private state: VehicleLightsState | null = null
  private blinkPhase = 0
  private routeBrake = false
  private routeReverse = false
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
    this.stopSequence(false)
    if (!root) {
      this.proxyHost = null
      return
    }
    this.proxyHost = new Group()
    this.proxyHost.name = 'iom-vehicle-light-proxies'
    root.add(this.proxyHost)
    this.rebuildTargets()
    this.buildProxies()
    if (this.state) this.applyEmissive()
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
    return counts
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

  apply(state: VehicleLightsState) {
    const prevTargets = JSON.stringify(this.state?.targets ?? {})
    this.state = structuredClone(state)
    if (!this.root) return
    if (JSON.stringify(state.targets ?? {}) !== prevTargets) {
      this.restoreAll()
      this.rebuildTargets()
      this.buildProxies()
    }
    this.applyEmissive()
    this.syncProxyVisibility()
  }

  setRouteSignals(signals: { braking?: boolean; reverse?: boolean }) {
    if (signals.braking != null) this.routeBrake = signals.braking
    if (signals.reverse != null) this.routeReverse = signals.reverse
    if (this.state) {
      this.applyEmissive()
      this.syncProxyVisibility()
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
      this.state.groups.indicatorRight
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
    this.state = null
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
      const manual = manualMap[groupId]
      if (manual) {
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
            backup: {
              emissive: std.emissive.getHex(),
              emissiveIntensity: std.emissiveIntensity,
            },
            localCenter: meshLocalCenter(mesh),
            manual: true,
          })
        }
        continue
      }
      // Heuristic discovery for groups without a manual override key.
      for (const t of discoverHeuristicTargets(this.root, groupId, usedMats)) {
        out.push(t)
      }
    }
    this.targets = out
  }

  private effectiveOn(groupId: VehicleLightGroupId): boolean {
    if (!this.state) return false
    const g = this.state.groups
    if (groupId === 'brake') return g.brake || this.routeBrake
    if (groupId === 'reverse') return g.reverse || this.routeReverse
    if (groupId === 'indicatorLeft') return g.hazards || g.indicatorLeft
    if (groupId === 'indicatorRight') return g.hazards || g.indicatorRight
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
    const gain = Math.max(0, Math.min(2, this.state.intensity))
    for (const t of this.targets) {
      const on = this.effectiveOn(t.groupId) && this.blinkLit(t.groupId)
      if (on) {
        t.material.emissive.setHex(GROUP_COLOR[t.groupId])
        // High enough to clear bloom threshold (~1.0) without washing the cabin.
        t.material.emissiveIntensity = GROUP_BASE_INTENSITY[t.groupId] * gain * 1.15
        t.mesh.userData.selectiveBloom = true
      } else {
        t.material.emissive.setHex(t.backup.emissive)
        t.material.emissiveIntensity = t.backup.emissiveIntensity
        t.mesh.userData.selectiveBloom = false
      }
      t.material.needsUpdate = true
    }
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
    const byGroup = new Map<VehicleLightGroupId, BoundTarget[]>()
    for (const t of this.targets) {
      const list = byGroup.get(t.groupId) ?? []
      list.push(t)
      byGroup.set(t.groupId, list)
    }
    for (const [groupId, list] of byGroup) {
      const lights: PointLight[] = []
      for (const t of list.slice(0, 2)) {
        const pl = new PointLight(GROUP_COLOR[groupId], 0, 6, 2)
        pl.castShadow = false
        pl.position.copy(t.localCenter)
        pl.position.y += 0.02
        this.proxyHost.add(pl)
        lights.push(pl)
      }
      this.proxies.set(groupId, lights)
    }
  }

  private syncProxyVisibility() {
    if (!this.state) return
    const gain = Math.max(0, Math.min(2, this.state.intensity))
    const proxiesOn = this.state.proxiesEnabled
    for (const groupId of VEHICLE_LIGHT_GROUP_IDS) {
      const lights = this.proxies.get(groupId) ?? []
      const on = proxiesOn && this.effectiveOn(groupId) && this.blinkLit(groupId)
      for (const pl of lights) {
        pl.intensity = on ? PROXY_POWER[groupId] * gain : 0
        pl.visible = on
      }
    }
  }

  private restoreAll() {
    for (const t of this.targets) {
      t.material.emissive.setHex(t.backup.emissive)
      t.material.emissiveIntensity = t.backup.emissiveIntensity
      t.material.needsUpdate = true
    }
  }

  private clearProxies() {
    if (this.proxyHost) {
      this.proxyHost.removeFromParent()
      while (this.proxyHost.children.length) {
        this.proxyHost.remove(this.proxyHost.children[0])
      }
    }
    this.proxies.clear()
    this.proxyHost = null
  }
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

function discoverHeuristicTargets(
  root: Object3D,
  groupId: VehicleLightGroupId,
  usedMats: WeakSet<MeshStandardMaterial>,
): BoundTarget[] {
  const out: BoundTarget[] = []
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const name = `${mesh.name || ''} ${(mesh.parent?.name as string) || ''}`
    if (classifyName(name) !== groupId) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
      const std = mat as MeshStandardMaterial
      if (usedMats.has(std)) continue
      usedMats.add(std)
      out.push({
        groupId,
        mesh,
        material: std,
        backup: {
          emissive: std.emissive.getHex(),
          emissiveIntensity: std.emissiveIntensity,
        },
        localCenter: meshLocalCenter(mesh),
        manual: false,
      })
    }
  })
  return out
}

function classifyName(name: string): VehicleLightGroupId | null {
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
  if (/front.*(light|lamp)/i.test(name)) return 'lowBeam'
  if (/rear.*(light|lamp)/i.test(name)) return 'tail'
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
