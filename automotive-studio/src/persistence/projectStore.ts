import { migrateProject } from './migrations'
import { createEmptyProject, type AutomotiveProject } from './schema'

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
  | 'route.set'
  | 'asset.upsert'
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
  return {
    id: 'environment.setPreset',
    label: `Environment: ${presetId}`,
    apply: (p) => ({
      ...p,
      environment: {
        ...p.environment,
        ...presetDefaults(presetId),
        presetId,
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
    apply: (p) => ({
      ...p,
      environment: {
        ...p.environment,
        ...patch,
        presetId: options?.keepPresetLabel
          ? (patch.presetId ?? p.environment.presetId)
          : (patch.presetId ?? 'custom'),
      },
    }),
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
        sunAzimuthDeg: 135,
        sunElevationDeg: 48,
        exposure: 1,
        environmentIntensity: 1,
        fogDensity: 0,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
      }
    case 'day':
      return {
        sunAzimuthDeg: 160,
        sunElevationDeg: 55,
        exposure: 1.05,
        environmentIntensity: 1.15,
        fogDensity: 0.01,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
      }
    case 'golden-hour':
      return {
        sunAzimuthDeg: 250,
        sunElevationDeg: 12,
        exposure: 1.1,
        environmentIntensity: 1.05,
        fogDensity: 0.02,
        hdrBackground: true,
        starsEnabled: false,
        moonEnabled: false,
      }
    case 'night':
      return {
        sunAzimuthDeg: 210,
        sunElevationDeg: -8,
        exposure: 0.85,
        environmentIntensity: 0.55,
        fogDensity: 0.03,
        hdrBackground: true,
        starsEnabled: true,
        moonEnabled: true,
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
    apply: (p) => ({ ...p, route }),
    invert: (before) => ({
      id: 'route.set',
      label: 'Restore route',
      apply: () => structuredClone(before),
      invert: () => setRoute(route),
    }),
  }
}
