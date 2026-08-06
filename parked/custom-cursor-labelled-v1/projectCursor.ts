import type { Project } from '../data/projects'
import type { CursorMode } from './types'

/**
 * Pick a labelled cursor mode for a project card based on its content type.
 * Ordinary links inside the card (source, case study) should set their own attributes.
 */
export function cursorModeForProject(project: Project): CursorMode {
  if (project.audioUrl) return 'play'
  if (project.gallery?.length) return 'view'

  const haystack = [
    project.id,
    project.section,
    project.embedUrl ?? '',
    project.url ?? '',
    project.tags.join(' '),
    project.title,
  ]
    .join(' ')
    .toLowerCase()

  if (
    haystack.includes('panorama') ||
    /\b360\b/.test(haystack) ||
    (project.section === '360' && Boolean(project.embedUrl))
  ) {
    return 'look'
  }

  if (
    project.embedUrl ||
    project.section === '3d' ||
    /\b(three\.?js|webgl|webgpu|globe|orbit|particle|ocean|terrain|spline)\b/.test(haystack)
  ) {
    return 'explore'
  }

  return 'view'
}

export function cursorPropsForProject(project: Project): {
  'data-cursor': CursorMode
  'data-cursor-label'?: string
} {
  const mode = cursorModeForProject(project)
  if (mode === 'explore' && /automotive|3d-viewer|artist-globe/.test(project.id)) {
    return { 'data-cursor': mode, 'data-cursor-label': 'ENTER 3D' }
  }
  return { 'data-cursor': mode }
}
