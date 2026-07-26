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
  /** RFO stage this identity carries (Raven→Research, Fox→Form, Octopus→Output). */
  rfoStage: 'Research' | 'Form' | 'Output'
  /** Short stage line shown on the identity card. */
  rfoLine: string
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
    rfoStage: 'Research',
    rfoLine: 'Understands the client, audience, story, and technical challenge before anything is built.',
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
    rfoStage: 'Form',
    rfoLine: 'Turns strategy into experience — visual language, interaction, structure, and technology.',
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
    rfoStage: 'Output',
    rfoLine: 'Delivers the finished result people can open, understand, and use.',
  },
]

export const TEAM_PORTRAIT_EXTS = ['.webp', '.png', '.jpg', '.jpeg'] as const

/** Compact studio process copy — maps to Raven / Fox / Octopus. */
export const RFO = {
  title: 'Research · Form · Output',
  tagline: 'Research the challenge. Form the experience. Deliver the output.',
  short:
    'Research gives the project direction. Form gives it identity. Output makes it real.',
  bridge:
    'From the first question to the final interactive experience, RFO connects strategy, design, and technology into one clear process — carried by Raven, Fox, and Octopus.',
  close:
    'RFO is not a rigid production formula. It is how we make sure every creative decision has a reason, every technical system supports the experience, and every project reaches a clear and useful final form.',
} as const
