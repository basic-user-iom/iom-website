import {
  PROJECTS,
  type Project,
  type ProjectSection,
} from '../../data/projects'
import { SECTIONS } from '../../data/sections'
import type { SiteLang } from '../types'
import { deProjects } from './de'
import { esProjects } from './es'
import { frProjects } from './fr'
import { itProjects } from './it'
import { nlProjects } from './nl'
import type { ProjectsLocalePack } from './types'

const packs: Partial<Record<Exclude<SiteLang, 'en'>, ProjectsLocalePack>> = {
  de: deProjects,
  fr: frProjects,
  nl: nlProjects,
  it: itProjects,
  es: esProjects,
}

export function localizedSections(lang: SiteLang) {
  if (lang === 'en') return SECTIONS
  const overlay = packs[lang]?.sections
  if (!overlay) return SECTIONS
  return SECTIONS.map((section) => {
    const o = overlay[section.id]
    if (!o) return section
    return {
      ...section,
      label: o.label ?? section.label,
      blurb: o.blurb ?? section.blurb,
    }
  })
}

export function localizeProject(project: Project, lang: SiteLang): Project {
  if (lang === 'en') return project
  const o = packs[lang]?.projects[project.id]
  if (!o) return project

  const gallery =
    project.gallery && o.galleryCaptions
      ? project.gallery.map((img, i) => ({
          ...img,
          caption: o.galleryCaptions?.[i] ?? img.caption,
        }))
      : project.gallery

  const referenceUrls =
    project.referenceUrls && o.referenceLabels
      ? project.referenceUrls.map((ref, i) => ({
          ...ref,
          label: o.referenceLabels?.[i] ?? ref.label,
        }))
      : project.referenceUrls

  return {
    ...project,
    title: o.title ?? project.title,
    description: o.description ?? project.description,
    tags: o.tags ?? project.tags,
    comingSoonLabel: o.comingSoonLabel ?? project.comingSoonLabel,
    gallery,
    referenceUrls,
  }
}

export function localizedProjects(lang: SiteLang): Project[] {
  if (lang === 'en') return PROJECTS
  return PROJECTS.map((p) => localizeProject(p, lang))
}

export function localizedProjectsForSection(
  section: ProjectSection,
  lang: SiteLang,
): Project[] {
  return localizedProjects(lang).filter((p) => p.section === section)
}
