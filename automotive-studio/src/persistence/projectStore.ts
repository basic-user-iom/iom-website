import { migrateProject } from './migrations'
import {
  createDefaultFreeDrive,
  createDefaultVehicleLights,
  createEmptyProject,
  type AutomotiveProject,
  type FreeDriveState,
} from './schema'

export type CommandId =
  | 'project.rename'
  | 'project.replace'
  | 'project.reset'
  | 'environment.setPreset'
  | 'environment.patch'
  | 'vehicle.set'
  | 'vehicle.clear'
  | 'vehicle.setRig'
  | 'vehicle.patchNormalization'
  | 'vehicle.materialOverride.upsert'
  | 'vehicle.polishMode'
  | 'route.set'
  | 'freeDrive.patch'
  | 'hotspot.set'
  | 'hotspot.upsert'
  | 'hotspot.remove'
  | 'shot.set'
  | 'shot.upsert'
  | 'shot.remove'
  | 'asset.upsert'
  | 'stage.patch'
  | 'accentLights.patch'
  | 'vehicleLights.patch'
  | 'presentation.setDefaultMode'

export interface Command {
  id: CommandId
  label: string
  apply: (project: AutomotiveProject) => AutomotiveProject
  invert: (before: AutomotiveProject, after: AutomotiveProject) => Command
}

export type StoreListener = (snapshot: StoreSnapshot) => void

export interface StoreSnapshot {
  project: AutomotiveProject
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
}

const HISTORY_LIMIT = 100

export class ProjectStore {
  private project: AutomotiveProject
  private dirty = false
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private listeners = new Set<StoreListener>()

  constructor(initial?: AutomotiveProject) {
    this.project = initial ? migrateProject(initial) : createEmptyProject()
  }

  getSnapshot(): StoreSnapshot {
    return {
      project: this.project,
      dirty: this.dirty,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    }
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    const snap = this.getSnapshot()
    for (const listener of this.listeners) listener(snap)
  }

  dispatch(command: Command, options?: { recordHistory?: boolean }) {
    const before = structuredClone(this.project)
    const after = command.apply(structuredClone(before))
    this.project = migrateProject(after)
    this.dirty = true
    if (options?.recordHistory !== false) {
      this.undoStack.push(command.invert(before, this.project))
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
      this.redoStack = []
    }
    this.emit()
  }

  undo() {
    const inverse = this.undoStack.pop()
    if (!inverse) return
    const before = structuredClone(this.project)
    this.project = migrateProject(inverse.apply(structuredClone(before)))
    this.dirty = true
    this.redoStack.push(inverse.invert(before, this.project))
    this.emit()
  }

  redo() {
    const command = this.redoStack.pop()
    if (!command) return
    const before = structuredClone(this.project)
    this.project = migrateProject(command.apply(structuredClone(before)))
    this.dirty = true
    this.undoStack.push(command.invert(before, this.project))
    this.emit()
  }

  markClean() {
    this.dirty = false
    this.emit()
  }

  /** Atomic replace used by loaders — history cleared. */
  loadProject(raw: unknown) {
    this.project = migrateProject(raw)
    this.dirty = false
    this.undoStack = []
    this.redoStack = []
    this.emit()
  }

  exportProjectJson(): AutomotiveProject {
    const clone = structuredClone(this.project)
    delete clone.dirty
    return clone
  }
}

export function renameProject(name: string): Command {
  const trimmed = name.trim() || 'Untitled Automotive Project'
  return {
    id: 'project.rename',
    label: 'Rename project',
    apply: (p) => ({ ...p, name: trimmed }),
    invert: (before) => renameProject(before.name),
  }
}

export function setEnvironmentPreset(
  presetId: AutomotiveProject['environment']['presetId'],
): Command {
  const base =
    presetId === 'custom' ? ('studio' as const) : (presetId as Exclude<typeof presetId, 'custom'>)
  return {
    id: 'environment.setPreset',
    label: `Environment: ${presetId}`,
    apply: (p) => ({
      ...p,
      environment: {
        ...p.environment,
        ...presetDefaults(presetId),
        presetId,
        basePresetId: base,
        customized: false,
      },
    }),
    invert: (before) => ({
      id: 'environment.patch',
      label: 'Restore environment',
      apply: (p) => ({
        ...p,
        environment: structuredClone(before.environment),
      }),
      invert: () => setEnvironmentPreset(presetId),
    }),
  }
}

export function patchEnvironment(
  patch: Partial<AutomotiveProject['environment']>,
  options?: { keepPresetLabel?: boolean },
): Command {
  return {
    id: 'environment.patch',
    label: 'Edit environment',
    apply: (p) => {
      const keep = options?.keepPresetLabel !== false
      const nextPreset = keep
        ? (patch.presetId ?? p.environment.presetId)
        : (patch.presetId ?? 'custom')
      const basePresetId =
        patch.basePresetId ??
        (nextPreset !== 'custom'
          ? (nextPreset as Exclude<typeof nextPreset, 'custom'>)
          : p.environment.basePresetId)
      return {
        ...p,
        environment: {
          ...p.environment,
          ...patch,
          presetId: nextPreset,
          basePresetId,
          customized: keep ? true : (patch.customized ?? p.environment.customized),
        },
      }
    },
    invert: (before) => ({
      id: 'environment.patch',
      label: 'Restore environment',
      apply: (p) => ({
        ...p,
        environment: structuredClone(before.environment),
      }),
      invert: () => patchEnvironment(patch, options),
    }),
  }
}

function presetDefaults(
  presetId: AutomotiveProject['environment']['presetId'],
): Partial<AutomotiveProject['environment']> {
  switch (presetId) {
    case 'studio':
      return {
        sunEnabled: true,
        sunAzimuthDeg: 128,
        sunElevationDeg: 42,
        sunIntensity: 1,
        sunDiscVisible: true,
        sunAngularDiameterDeg: 0.53,
        sunDiscScale: 1,
        exposure: 1.05,
        environmentIntensity: 1,
        fogDensity: 0,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
        moonAsKeyLight: false,
        moonAzimuthDeg: 300,
        moonElevationDeg: 35,
        moonPhase: 0.5,
      }
    case 'day':
      return {
        sunEnabled: true,
        sunAzimuthDeg: 155,
        sunElevationDeg: 52,
        sunIntensity: 1,
        sunDiscVisible: true,
        sunAngularDiameterDeg: 0.53,
        exposure: 1.08,
        environmentIntensity: 1.12,
        fogDensity: 0.008,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
        moonAsKeyLight: false,
        moonAzimuthDeg: 310,
        moonElevationDeg: 20,
        moonPhase: 0.35,
      }
    case 'golden-hour':
      return {
        sunEnabled: true,
        sunAzimuthDeg: 248,
        sunElevationDeg: 11,
        sunIntensity: 1,
        sunDiscVisible: true,
        sunAngularDiameterDeg: 0.65,
        sunDiscScale: 1.15,
        exposure: 1.12,
        environmentIntensity: 1.05,
        fogDensity: 0.018,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
        moonAsKeyLight: false,
        moonAzimuthDeg: 80,
        moonElevationDeg: 15,
        moonPhase: 0.6,
      }
    case 'night':
      return {
        sunEnabled: false,
        sunAzimuthDeg: 210,
        sunElevationDeg: -12,
        sunIntensity: 0,
        sunDiscVisible: false,
        exposure: 0.92,
        environmentIntensity: 0.7,
        fogDensity: 0.025,
        hdrBackground: true,
        starsEnabled: true,
        moonEnabled: true,
        moonAsKeyLight: true,
        moonAzimuthDeg: 40,
        moonElevationDeg: 32,
        moonAngularDiameterDeg: 0.53,
        moonScale: 1,
        moonIntensity: 1.15,
        moonPhase: 0.55,
      }
    default:
      return {}
  }
}

export function resetProject(): Command {
  return {
    id: 'project.reset',
    label: 'New empty project',
    apply: () => createEmptyProject(),
    invert: (before) => ({
      id: 'project.replace',
      label: 'Restore previous project',
      apply: () => structuredClone(before),
      invert: () => resetProject(),
    }),
  }
}

const VEHICLE_ASSET_ROLES = new Set([
  'vehicle-master',
  'vehicle-high',
  'vehicle-balanced',
  'vehicle-mobile',
])

export function setActiveVehicle(
  vehicle: AutomotiveProject['vehicle'],
  asset?: AutomotiveProject['assets'][number],
): Command {
  return {
    id: 'vehicle.set',
    label: vehicle ? `Set vehicle: ${vehicle.name}` : 'Clear vehicle',
    apply: (p) => {
      let assets = p.assets
      if (asset) {
        assets = [
          ...p.assets.filter((a) => a.id !== asset.id && a.role !== asset.role),
          asset,
        ]
      } else if (!vehicle) {
        assets = p.assets.filter((a) => !VEHICLE_ASSET_ROLES.has(a.role))
      }
      return {
        ...p,
        vehicle,
        activeVehicleId: vehicle?.assetId ?? null,
        assets,
      }
    },
    invert: (before) => ({
      id: 'vehicle.set',
      label: 'Restore vehicle',
      apply: () => structuredClone(before),
      invert: () => setActiveVehicle(vehicle, asset),
    }),
  }
}

export function setVehicleRig(rig: NonNullable<AutomotiveProject['vehicle']>['rig']): Command {
  return {
    id: 'vehicle.setRig',
    label: rig ? 'Attach vehicle rig manifesto' : 'Clear vehicle rig',
    apply: (p) => {
      if (!p.vehicle) return p
      return {
        ...p,
        vehicle: { ...p.vehicle, rig },
      }
    },
    invert: (before) => ({
      id: 'vehicle.setRig',
      label: 'Restore vehicle rig',
      apply: (p) => ({
        ...p,
        vehicle: before.vehicle ? structuredClone(before.vehicle) : null,
      }),
      invert: () => setVehicleRig(rig),
    }),
  }
}

export function patchVehicleNormalization(
  patch: Partial<NonNullable<AutomotiveProject['vehicle']>>,
): Command {
  return {
    id: 'vehicle.patchNormalization',
    label: 'Update vehicle normalization',
    apply: (p) => {
      if (!p.vehicle) return p
      return {
        ...p,
        vehicle: { ...p.vehicle, ...patch },
      }
    },
    invert: (before) => ({
      id: 'vehicle.patchNormalization',
      label: 'Restore vehicle normalization',
      apply: (p) => ({
        ...p,
        vehicle: before.vehicle ? structuredClone(before.vehicle) : null,
      }),
      invert: () => patchVehicleNormalization(patch),
    }),
  }
}

export function upsertMaterialOverride(
  entry: NonNullable<AutomotiveProject['vehicle']>['materialOverrides'][number],
): Command {
  return {
    id: 'vehicle.materialOverride.upsert',
    label: 'Edit material',
    apply: (p) => {
      if (!p.vehicle) return p
      const list = p.vehicle.materialOverrides ?? []
      const next = [...list.filter((o) => o.id !== entry.id), structuredClone(entry)]
      return {
        ...p,
        vehicle: { ...p.vehicle, materialOverrides: next },
      }
    },
    invert: (before) => ({
      id: 'vehicle.materialOverride.upsert',
      label: 'Restore material',
      apply: (p) => ({
        ...p,
        vehicle: before.vehicle ? structuredClone(before.vehicle) : null,
      }),
      invert: () => upsertMaterialOverride(entry),
    }),
  }
}

export function setVehiclePolishMode(
  polishMode: NonNullable<AutomotiveProject['vehicle']>['polishMode'],
): Command {
  return {
    id: 'vehicle.polishMode',
    label: polishMode === 'off' ? 'Disable material polish' : 'Enable material polish',
    apply: (p) => {
      if (!p.vehicle) return p
      return { ...p, vehicle: { ...p.vehicle, polishMode } }
    },
    invert: (before) => ({
      id: 'vehicle.polishMode',
      label: 'Restore polish mode',
      apply: (p) => ({
        ...p,
        vehicle: before.vehicle ? structuredClone(before.vehicle) : null,
      }),
      invert: () => setVehiclePolishMode(polishMode),
    }),
  }
}

export function upsertAsset(asset: AutomotiveProject['assets'][number]): Command {
  return {
    id: 'asset.upsert',
    label: `Asset: ${asset.filename}`,
    apply: (p) => ({
      ...p,
      assets: [...p.assets.filter((a) => a.id !== asset.id), asset],
    }),
    invert: (before) => ({
      id: 'asset.upsert',
      label: 'Restore assets',
      apply: () => ({
        ...before,
        assets: structuredClone(before.assets),
      }),
      invert: () => upsertAsset(asset),
    }),
  }
}

export function setRoute(route: AutomotiveProject['route']): Command {
  return {
    id: 'route.set',
    label: route ? 'Set vehicle route' : 'Clear vehicle route',
    apply: (p) => ({
      ...p,
      route,
      // Route and free-drive both own the vehicle root — keep them exclusive.
      freeDrive: route
        ? { ...(p.freeDrive ?? createDefaultFreeDrive()), enabled: false }
        : p.freeDrive ?? createDefaultFreeDrive(),
    }),
    invert: (before) => ({
      id: 'route.set',
      label: 'Restore route',
      apply: () => structuredClone(before),
      invert: () => setRoute(route),
    }),
  }
}

export function patchFreeDrive(patch: Partial<FreeDriveState>): Command {
  return {
    id: 'freeDrive.patch',
    label: patch.enabled === true ? 'Enable free drive' : patch.enabled === false ? 'Disable free drive' : 'Update free drive',
    apply: (p) => {
      const prev = p.freeDrive ?? createDefaultFreeDrive()
      const next = { ...prev, ...patch }
      return {
        ...p,
        freeDrive: next,
        // Enabling free-drive clears the spline route so ownership stays exclusive.
        route: next.enabled ? null : p.route,
      }
    },
    invert: (before) => ({
      id: 'freeDrive.patch',
      label: 'Restore free drive',
      apply: () => structuredClone(before),
      invert: () => patchFreeDrive(patch),
    }),
  }
}

export function setHotspots(hotspots: AutomotiveProject['hotspots']): Command {
  return replaceCollection('hotspot.set', 'Set hotspots', 'hotspots', hotspots, setHotspots)
}

export function upsertHotspot(hotspot: AutomotiveProject['hotspots'][number]): Command {
  return {
    id: 'hotspot.upsert',
    label: `Hotspot: ${hotspot.name}`,
    apply: (p) => ({
      ...p,
      hotspots: [...p.hotspots.filter((item) => item.id !== hotspot.id), hotspot],
    }),
    invert: (before) => setHotspots(before.hotspots),
  }
}

export function removeHotspot(id: string): Command {
  return {
    id: 'hotspot.remove',
    label: 'Remove hotspot',
    apply: (p) => ({ ...p, hotspots: p.hotspots.filter((item) => item.id !== id) }),
    invert: (before) => setHotspots(before.hotspots),
  }
}

export function setShots(shots: AutomotiveProject['shots']): Command {
  return replaceCollection('shot.set', 'Set shots', 'shots', shots, setShots)
}

export function upsertShot(shot: AutomotiveProject['shots'][number]): Command {
  return {
    id: 'shot.upsert',
    label: `Shot: ${shot.name}`,
    apply: (p) => ({
      ...p,
      shots: [...p.shots.filter((item) => item.id !== shot.id), shot],
    }),
    invert: (before) => setShots(before.shots),
  }
}

export function removeShot(id: string): Command {
  return {
    id: 'shot.remove',
    label: 'Remove shot',
    apply: (p) => ({ ...p, shots: p.shots.filter((item) => item.id !== id) }),
    invert: (before) => setShots(before.shots),
  }
}

export function patchStage(patch: Partial<AutomotiveProject['stage']>): Command {
  return {
    id: 'stage.patch',
    label: 'Edit stage',
    apply: (p) => ({
      ...p,
      stage: {
        ...p.stage,
        ...patch,
        // Callers pass a full `maps` object when editing textures — replace, don't
        // merge onto the previous set, or "Clear maps" / per-slot Remove can never stick.
        floor: patch.floor
          ? {
              ...p.stage.floor,
              ...patch.floor,
              maps:
                patch.floor.maps !== undefined
                  ? { ...patch.floor.maps }
                  : p.stage.floor.maps,
            }
          : p.stage.floor,
        pedestal: patch.pedestal
          ? {
              ...p.stage.pedestal,
              ...patch.pedestal,
              maps:
                patch.pedestal.maps !== undefined
                  ? { ...patch.pedestal.maps }
                  : p.stage.pedestal.maps,
            }
          : p.stage.pedestal,
        cyclorama: patch.cyclorama
          ? {
              ...p.stage.cyclorama,
              ...patch.cyclorama,
              maps:
                patch.cyclorama.maps !== undefined
                  ? { ...patch.cyclorama.maps }
                  : p.stage.cyclorama.maps,
            }
          : p.stage.cyclorama,
      },
    }),
    invert: (before) => ({
      id: 'stage.patch',
      label: 'Restore stage',
      apply: (p) => ({
        ...p,
        stage: structuredClone(before.stage),
      }),
      invert: () => patchStage(patch),
    }),
  }
}

export function patchAccentLights(patch: Partial<AutomotiveProject['accentLights']>): Command {
  return {
    id: 'accentLights.patch',
    label: 'Edit accent lights',
    apply: (p) => ({
      ...p,
      accentLights: { ...p.accentLights, ...patch },
    }),
    invert: (before) => ({
      id: 'accentLights.patch',
      label: 'Restore accent lights',
      apply: (p) => ({
        ...p,
        accentLights: structuredClone(before.accentLights),
      }),
      invert: () => patchAccentLights(patch),
    }),
  }
}

export function patchVehicleLights(patch: {
  groups?: Partial<AutomotiveProject['vehicleLights']['groups']>
  intensity?: number
  proxiesEnabled?: boolean
  autoRunningAtNight?: boolean
  targets?: AutomotiveProject['vehicleLights']['targets']
  bloomEnabled?: boolean
  bloomStrength?: number
  bloomThreshold?: number
  beamProxies?: AutomotiveProject['vehicleLights']['beamProxies']
  performanceMode?: AutomotiveProject['vehicleLights']['performanceMode']
}): Command {
  return {
    id: 'vehicleLights.patch',
    label: 'Edit vehicle lights',
    apply: (p) => ({
      ...p,
      vehicleLights: {
        ...p.vehicleLights,
        ...patch,
        groups: {
          ...p.vehicleLights.groups,
          ...(patch.groups ?? {}),
        },
        targets: patch.targets !== undefined ? structuredClone(patch.targets) : p.vehicleLights.targets,
        beamProxies:
          patch.beamProxies !== undefined
            ? structuredClone(patch.beamProxies)
            : p.vehicleLights.beamProxies,
      },
    }),
    invert: (before) => ({
      id: 'vehicleLights.patch',
      label: 'Restore vehicle lights',
      apply: (p) => ({
        ...p,
        vehicleLights: structuredClone(before.vehicleLights),
      }),
      invert: () => patchVehicleLights(patch),
    }),
  }
}

/**
 * Clear active vehicle + vehicle assets + lamp authoring + vehicle-bound hotspots.
 * IndexedDB blobs are kept until Save GC so Undo can restore.
 */
export function clearVehicleProject(): Command {
  return {
    id: 'vehicle.clear',
    label: 'Clear vehicle',
    apply: (p) => ({
      ...p,
      vehicle: null,
      activeVehicleId: null,
      assets: p.assets.filter((a) => !VEHICLE_ASSET_ROLES.has(a.role)),
      vehicleLights: createDefaultVehicleLights(),
      hotspots: [],
      route: null,
      freeDrive: { ...(p.freeDrive ?? createDefaultFreeDrive()), enabled: false },
    }),
    invert: (before) => ({
      id: 'vehicle.clear',
      label: 'Restore cleared vehicle',
      apply: () => structuredClone(before),
      invert: () => clearVehicleProject(),
    }),
  }
}

function replaceCollection<K extends 'hotspots' | 'shots'>(
  id: CommandId,
  label: string,
  key: K,
  value: AutomotiveProject[K],
  restore: (value: AutomotiveProject[K]) => Command,
): Command {
  return {
    id,
    label,
    apply: (p) => ({ ...p, [key]: structuredClone(value) }),
    invert: (before) => restore(structuredClone(before[key])),
  }
}
