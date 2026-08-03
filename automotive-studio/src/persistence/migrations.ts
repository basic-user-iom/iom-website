import {
  AUTOMOTIVE_SCHEMA_VERSION,
  createEmptyProject,
  type AutomotiveProject,
} from './schema'

export type Migration = (project: AutomotiveProject) => AutomotiveProject

const migrations: Record<number, Migration> = {
  // Future: 1 → 2 maps here. Phase 1 ships schema v1 only.
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
    stage: { ...empty.stage, ...project.stage },
    environment: { ...empty.environment, ...project.environment },
    accentLights: { ...empty.accentLights, ...project.accentLights },
    shots: project.shots ?? [],
    timeline: { ...empty.timeline, ...project.timeline },
    hotspots: project.hotspots ?? [],
    presentation: { ...empty.presentation, ...project.presentation },
    credits: project.credits ?? empty.credits,
    schemaVersion: AUTOMOTIVE_SCHEMA_VERSION,
  }
}
