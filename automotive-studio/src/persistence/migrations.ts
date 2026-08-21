import {
  AUTOMOTIVE_SCHEMA_VERSION,
  createDefaultFreeDrive,
  createDefaultVehicleLights,
  createEmptyProject,
  type AutomotiveProject,
} from './schema'

export type Migration = (project: AutomotiveProject) => AutomotiveProject

const migrations: Record<number, Migration> = {
  1: (project) => ({
    ...project,
    schemaVersion: 2,
    vehicle: project.vehicle
      ? {
          ...project.vehicle,
          polishMode: project.vehicle.polishMode ?? 'auto',
          materialOverrides: project.vehicle.materialOverrides ?? [],
        }
      : null,
  }),
  2: (project) => ({
    ...project,
    schemaVersion: 3,
    vehicleLights: project.vehicleLights ?? createDefaultVehicleLights(),
  }),
  3: (project) => {
    const defaults = createDefaultVehicleLights()
    const vl = project.vehicleLights ?? defaults
    return {
      ...project,
      schemaVersion: 4,
      vehicleLights: {
        ...defaults,
        ...vl,
        groups: { ...defaults.groups, ...vl.groups },
        targets: vl.targets ?? {},
        bloomEnabled: vl.bloomEnabled ?? false,
        bloomStrength: vl.bloomStrength ?? defaults.bloomStrength,
        bloomThreshold: vl.bloomThreshold ?? defaults.bloomThreshold,
      },
    }
  },
  4: (project) => ({
    ...project,
    schemaVersion: 5,
    freeDrive: project.freeDrive ?? createDefaultFreeDrive(),
  }),
  5: (project) => {
    const defaults = createDefaultVehicleLights()
    const vl = project.vehicleLights ?? defaults
    return {
      ...project,
      schemaVersion: 6,
      vehicleLights: {
        ...defaults,
        ...vl,
        groups: { ...defaults.groups, ...vl.groups },
        performanceMode: vl.performanceMode ?? 'full',
      },
    }
  },
  6: (project) => {
    const empty = createEmptyProject(project.name)
    return {
      ...project,
      schemaVersion: 7,
      stage: {
        ...empty.stage,
        ...project.stage,
        cycloramaVolumeGlow: project.stage?.cycloramaVolumeGlow ?? empty.stage.cycloramaVolumeGlow,
        cycloramaVolumeIntensity:
          project.stage?.cycloramaVolumeIntensity ?? empty.stage.cycloramaVolumeIntensity,
        cycloramaInteractive: project.stage?.cycloramaInteractive ?? empty.stage.cycloramaInteractive,
        cycloramaVideoAssetId: project.stage?.cycloramaVideoAssetId ?? null,
        cycloramaVideoMuted: project.stage?.cycloramaVideoMuted ?? empty.stage.cycloramaVideoMuted,
        cycloramaVideoLoop: project.stage?.cycloramaVideoLoop ?? empty.stage.cycloramaVideoLoop,
        cycloramaVideoFit: project.stage?.cycloramaVideoFit ?? empty.stage.cycloramaVideoFit,
        cycloramaCropTop: project.stage?.cycloramaCropTop ?? empty.stage.cycloramaCropTop,
      },
    }
  },
}

export function migrateProject(raw: unknown): AutomotiveProject {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid project: expected object')
  }

  const project = structuredClone(raw) as AutomotiveProject
  if (typeof project.schemaVersion !== 'number') {
    throw new Error('Invalid project: missing schemaVersion')
  }
  if (typeof project.id !== 'string' || typeof project.name !== 'string') {
    throw new Error('Invalid project: missing id or name')
  }

  let version = project.schemaVersion
  while (version < AUTOMOTIVE_SCHEMA_VERSION) {
    const migrate = migrations[version]
    if (!migrate) {
      throw new Error(`No migration from schema version ${version}`)
    }
    Object.assign(project, migrate(project))
    version = project.schemaVersion
  }

  if (project.schemaVersion !== AUTOMOTIVE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${project.schemaVersion}; expected ${AUTOMOTIVE_SCHEMA_VERSION}`,
    )
  }

  // Fill missing Phase-1-required collections without wiping valid data.
  const empty = createEmptyProject(project.name)
  return {
    ...empty,
    ...project,
    assets: project.assets ?? [],
    stage: {
      ...empty.stage,
      ...project.stage,
      floorVisible: project.stage?.floorVisible ?? empty.stage.floorVisible,
      cycloramaVisible: project.stage?.cycloramaVisible ?? empty.stage.cycloramaVisible,
      pedestalVisible: project.stage?.pedestalVisible ?? empty.stage.pedestalVisible,
      floorSize: project.stage?.floorSize ?? empty.stage.floorSize,
      pedestalSize: project.stage?.pedestalSize ?? empty.stage.pedestalSize,
      pedestalHeight: project.stage?.pedestalHeight ?? empty.stage.pedestalHeight,
      cycloramaSize: project.stage?.cycloramaSize ?? empty.stage.cycloramaSize,
      cycloramaHeight: project.stage?.cycloramaHeight ?? empty.stage.cycloramaHeight,
      cycloramaCropTop: project.stage?.cycloramaCropTop ?? empty.stage.cycloramaCropTop,
      cycloramaVolumeGlow: project.stage?.cycloramaVolumeGlow ?? empty.stage.cycloramaVolumeGlow,
      cycloramaVolumeIntensity:
        project.stage?.cycloramaVolumeIntensity ?? empty.stage.cycloramaVolumeIntensity,
      cycloramaInteractive: project.stage?.cycloramaInteractive ?? empty.stage.cycloramaInteractive,
      cycloramaVideoAssetId: project.stage?.cycloramaVideoAssetId ?? empty.stage.cycloramaVideoAssetId,
      cycloramaVideoMuted: project.stage?.cycloramaVideoMuted ?? empty.stage.cycloramaVideoMuted,
      cycloramaVideoLoop: project.stage?.cycloramaVideoLoop ?? empty.stage.cycloramaVideoLoop,
      cycloramaVideoFit: project.stage?.cycloramaVideoFit ?? empty.stage.cycloramaVideoFit,
      floor: { ...empty.stage.floor, ...project.stage?.floor, maps: { ...empty.stage.floor.maps, ...project.stage?.floor?.maps } },
      pedestal: {
        ...empty.stage.pedestal,
        ...project.stage?.pedestal,
        maps: { ...empty.stage.pedestal.maps, ...project.stage?.pedestal?.maps },
      },
      cyclorama: {
        ...empty.stage.cyclorama,
        ...project.stage?.cyclorama,
        maps: { ...empty.stage.cyclorama.maps, ...project.stage?.cyclorama?.maps },
      },
    },
    environment: {
      ...empty.environment,
      ...project.environment,
      basePresetId:
        project.environment?.basePresetId ??
        (project.environment?.presetId && project.environment.presetId !== 'custom'
          ? project.environment.presetId
          : empty.environment.basePresetId),
      customized: project.environment?.customized ?? false,
      sunEnabled: project.environment?.sunEnabled ?? empty.environment.sunEnabled,
      sunIntensity: project.environment?.sunIntensity ?? empty.environment.sunIntensity,
      sunAngularDiameterDeg:
        project.environment?.sunAngularDiameterDeg ?? empty.environment.sunAngularDiameterDeg,
      sunDiscVisible: project.environment?.sunDiscVisible ?? empty.environment.sunDiscVisible,
      sunDiscScale: project.environment?.sunDiscScale ?? empty.environment.sunDiscScale,
      moonAzimuthDeg: project.environment?.moonAzimuthDeg ?? empty.environment.moonAzimuthDeg,
      moonElevationDeg: project.environment?.moonElevationDeg ?? empty.environment.moonElevationDeg,
      moonAngularDiameterDeg:
        project.environment?.moonAngularDiameterDeg ?? empty.environment.moonAngularDiameterDeg,
      moonScale: project.environment?.moonScale ?? empty.environment.moonScale,
      moonIntensity: project.environment?.moonIntensity ?? empty.environment.moonIntensity,
      moonPhase: project.environment?.moonPhase ?? empty.environment.moonPhase,
      moonAsKeyLight: project.environment?.moonAsKeyLight ?? empty.environment.moonAsKeyLight,
    },
    accentLights: {
      ...empty.accentLights,
      ...project.accentLights,
      intensity: project.accentLights?.intensity ?? empty.accentLights.intensity,
    },
    vehicleLights: {
      ...empty.vehicleLights,
      ...project.vehicleLights,
      groups: {
        ...empty.vehicleLights.groups,
        ...project.vehicleLights?.groups,
      },
      intensity: project.vehicleLights?.intensity ?? empty.vehicleLights.intensity,
      proxiesEnabled:
        project.vehicleLights?.proxiesEnabled ?? empty.vehicleLights.proxiesEnabled,
      autoRunningAtNight:
        project.vehicleLights?.autoRunningAtNight ?? empty.vehicleLights.autoRunningAtNight,
      targets: project.vehicleLights?.targets ?? empty.vehicleLights.targets,
      bloomEnabled: project.vehicleLights?.bloomEnabled ?? empty.vehicleLights.bloomEnabled,
      bloomStrength: project.vehicleLights?.bloomStrength ?? empty.vehicleLights.bloomStrength,
      bloomThreshold: project.vehicleLights?.bloomThreshold ?? empty.vehicleLights.bloomThreshold,
      beamProxies: Array.isArray(project.vehicleLights?.beamProxies)
        ? project.vehicleLights.beamProxies
        : empty.vehicleLights.beamProxies,
      performanceMode: project.vehicleLights?.performanceMode ?? empty.vehicleLights.performanceMode,
    },
    vehicle: project.vehicle
      ? {
          ...project.vehicle,
          polishMode: project.vehicle.polishMode ?? 'auto',
          materialOverrides: project.vehicle.materialOverrides ?? [],
        }
      : null,
    route: project.route ?? null,
    freeDrive: {
      ...empty.freeDrive,
      ...project.freeDrive,
    },
    shots: project.shots ?? [],
    timeline: { ...empty.timeline, ...project.timeline },
    hotspots: project.hotspots ?? [],
    presentation: { ...empty.presentation, ...project.presentation },
    credits: project.credits ?? empty.credits,
    schemaVersion: AUTOMOTIVE_SCHEMA_VERSION,
  }
}
