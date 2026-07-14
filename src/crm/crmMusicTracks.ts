import { projectsForSection } from '../data/projects'

export interface CrmMusicTrack {
  id: string
  title: string
  audioUrl: string
}

/** Same playlist URLs as the public Music section player. */
export const CRM_MUSIC_TRACKS: CrmMusicTrack[] = projectsForSection('music')
  .filter((project): project is typeof project & { audioUrl: string } =>
    Boolean(project.audioUrl),
  )
  .map((project) => ({
    id: project.id,
    title: project.title,
    audioUrl: project.audioUrl,
  }))
