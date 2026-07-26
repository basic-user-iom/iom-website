export interface TeamMember {
  id: string
  name: string
  role: string
  philosophy: string
  email: string
  /**
   * Base path without extension, e.g. `/assets/team/raven`.
   * The UI tries `.webp`, `.jpg`, then `.png`.
   */
  portraitBase?: string
  initials: string
}

/** Public-facing aliases only — never use legal names on the marketing site. */
export const TEAM: TeamMember[] = [
  {
    id: 'raven',
    name: 'Raven',
    role: 'Founder · Interactive media & engineering',
    philosophy:
      'Clients hire clarity as much as craft — ship tools and experiences people can open, understand, and decide from.',
    email: 'raven@iobjectm.com',
    portraitBase: '/assets/team/raven',
    initials: 'R',
  },
  {
    id: 'fox',
    name: 'Fox',
    role: 'Partnerships · Client experience',
    philosophy:
      'High-value work starts with listening — match technical ambition to the story a client actually needs to tell.',
    email: 'fox@iobjectm.com',
    portraitBase: '/assets/team/fox',
    initials: 'F',
  },
  {
    id: 'octopus',
    name: 'Octopus',
    role: 'Software engineering · WebGL',
    philosophy:
      'Builds reliable interactive systems — connecting interfaces, 3D environments, data, and performance.',
    email: 'octopus@iobjectm.com',
    portraitBase: '/assets/team/octopus',
    initials: 'O',
  },
]

export const TEAM_PORTRAIT_EXTS = ['.webp', '.png', '.jpg', '.jpeg'] as const
