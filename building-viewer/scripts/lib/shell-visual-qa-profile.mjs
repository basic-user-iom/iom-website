import { resolve } from 'node:path'

export const SHELL_VISUAL_QA_PROFILES = Object.freeze({
  'first-floor': Object.freeze({
    slug: 'first-floor',
    title: 'First floor',
    ownerName: '1st Floor._anim1',
    auditSchema: 'IOM_FIRST_FLOOR_SHELL_PROJECTION_AUDIT',
  }),
  'second-floor': Object.freeze({
    slug: 'second-floor',
    title: 'Second floor',
    ownerName: '2st Floor._anim1',
    auditSchema: 'IOM_SECOND_FLOOR_SHELL_PROJECTION_AUDIT',
  }),
  mezzanine: Object.freeze({
    slug: 'mezzanine',
    title: 'Mezzanine',
    ownerName: 'Mezzanine._anim1',
    auditSchema: 'IOM_MEZZANINE_SHELL_PROJECTION_AUDIT',
  }),
  ceiling: Object.freeze({
    slug: 'ceiling',
    title: 'Ceiling',
    ownerName: 'Ceiling._anim1',
    auditSchema: 'IOM_CEILING_SHELL_PROJECTION_AUDIT',
  }),
  'ground-floor': Object.freeze({
    slug: 'ground-floor',
    title: 'Ground floor',
    ownerName: 'Ground Floor._anim1',
    auditSchema: 'IOM_GROUND_FLOOR_SHELL_PROJECTION_AUDIT',
  }),
})

export function requestedShellVisualQaProfile(argv = process.argv) {
  let id = 'first-floor'
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--profile') {
      id = argv[++index]
    } else if (value.startsWith('--profile=')) {
      id = value.slice('--profile='.length)
    } else {
      throw new Error(`Unknown argument: ${value}`)
    }
  }
  const profile = SHELL_VISUAL_QA_PROFILES[id]
  if (!profile) {
    throw new Error(`--profile must be one of: ${Object.keys(SHELL_VISUAL_QA_PROFILES).join(', ')}`)
  }
  return profile
}

export function shellVisualQaPaths(viewerRoot, profile) {
  const candidateRoot = resolve(viewerRoot, 'tmp', `hlod-pilot-${profile.slug}-shell-candidate`)
  return Object.freeze({
    candidateRoot,
    indexPath: resolve(candidateRoot, 'detail-package-index.json'),
    outputRoot: resolve(candidateRoot, 'visual-qa'),
  })
}
