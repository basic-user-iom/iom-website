import type { ProjectSection } from '../../data/projects'

export type ProjectOverlay = {
  title?: string
  description?: string
  tags?: string[]
  comingSoonLabel?: string
  /** Captions in gallery order */
  galleryCaptions?: string[]
  /** Labels in referenceUrls order */
  referenceLabels?: string[]
}

export type SectionOverlay = {
  label?: string
  blurb?: string
}

export type ProjectsLocalePack = {
  sections: Partial<Record<ProjectSection, SectionOverlay>>
  projects: Record<string, ProjectOverlay>
}
