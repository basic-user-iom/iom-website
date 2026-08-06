import type { Project } from '../data/projects'
import type { CursorMode } from './types'

/**
 * Cards already show OPEN / VIEW GALLERY / posters — use a quiet focus orb
 * instead of labelled ENTER 3D / VIEW / PLAY rings.
 * Labelled modes remain available for CTAs, transport, and the parked demo.
 */
export function cursorModeForProject(_project: Project): CursorMode {
  return 'focus'
}

export function cursorPropsForProject(project: Project): {
  'data-cursor': CursorMode
} {
  void project
  return { 'data-cursor': 'focus' }
}
