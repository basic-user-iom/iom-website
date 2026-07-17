export type ArtistCategory =
  | 'photographer'
  | 'painter'
  | 'sculptor'
  | 'illustrator'
  | 'digital'
  | 'installation'
  | 'filmmaker'
  | 'sound'
  | 'conceptual'
  /** @deprecated Prefer painter / sculptor / digital — kept for older rows */
  | 'visual_artist'

export type ArtistStatus = 'live' | 'hidden'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface ArtistLinks {
  website?: string
  instagram?: string
  portfolio?: string
}

export interface PortfolioWork {
  id: string
  title: string
  year: string
  medium: string
  /** Demo image URL (picsum seed) */
  imageUrl: string
  caption?: string
}

export interface Artist {
  id: string
  slug: string
  displayName: string
  category: ArtistCategory
  tags: string[]
  bio: string
  links: ArtistLinks
  city: string
  country: string
  lat: number
  lon: number
  /** IANA timezone for local clock (e.g. Europe/Berlin) */
  timezone: string
  avatarUrl: string
  status: ArtistStatus
  portfolio: PortfolioWork[]
  email?: string
  authUserId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ArtistSubmission {
  id: string
  displayName: string
  email: string
  category: ArtistCategory
  tags: string[]
  bio: string
  links: ArtistLinks
  city: string
  country: string
  lat: number
  lon: number
  timezone: string
  avatarUrl: string
  status: SubmissionStatus
  rejectReason: string
  createdAt: string
}

export interface ArtistInvite {
  id: string
  token: string
  artistId: string
  submissionId: string | null
  email: string
  expiresAt: string
  usedAt: string | null
}

export interface SubmitArtistInput {
  displayName: string
  email: string
  category: ArtistCategory
  tags: string[]
  bio: string
  links: ArtistLinks
  city: string
  country: string
  lat: number
  lon: number
  timezone?: string
  avatarUrl?: string
}

/**
 * Primary filters — aligned with Saatchi Art mediums + Artsy disciplines:
 * Painting, Photography, Sculpture, Drawing, Digital/New Media, Installation,
 * Video, Sound art, Conceptual.
 */
export const CATEGORY_LABELS: Record<ArtistCategory, string> = {
  photographer: 'Photography',
  painter: 'Painting',
  sculptor: 'Sculpture',
  illustrator: 'Drawing & illustration',
  digital: 'Digital & new media',
  installation: 'Installation',
  filmmaker: 'Film & video',
  sound: 'Sound',
  conceptual: 'Conceptual',
  visual_artist: 'Visual arts',
}

/** Categories shown in filters / submit (excludes deprecated alias). */
export const PRIMARY_CATEGORIES: ArtistCategory[] = [
  'photographer',
  'painter',
  'sculptor',
  'illustrator',
  'digital',
  'installation',
  'filmmaker',
  'sound',
  'conceptual',
]

export const CATEGORY_COLORS: Record<ArtistCategory, number> = {
  photographer: 0x00e5ff,
  painter: 0xf5a623,
  sculptor: 0xc4b5a0,
  illustrator: 0x7dd3fc,
  digital: 0x34d399,
  installation: 0xa78bfa,
  filmmaker: 0xfb7185,
  sound: 0x2dd4bf,
  conceptual: 0xe879f9,
  visual_artist: 0xf5a623,
}

/**
 * Discovery tags inspired by Saatchi keyword guidance + Artsy subject/style genes:
 * style, subject, medium, process.
 */
export const SUGGESTED_TAGS = [
  // Style
  'abstract',
  'figurative',
  'minimal',
  'surreal',
  'documentary',
  'street',
  'pop',
  // Subject
  'portrait',
  'landscape',
  'architecture',
  'nature',
  'still-life',
  'body',
  'urban',
  'identity',
  'memory',
  'archive',
  // Medium / process
  'film',
  'analog',
  'digital',
  'oil',
  'acrylic',
  'watercolor',
  'bronze',
  'ceramic',
  'glass',
  'textile',
  'collage',
  'printmaking',
  'mixed-media',
  'performance',
  'sound',
  'field-recording',
  'electroacoustic',
  'ambient',
  'experimental',
  'composition',
  'noise',
  'light',
  'night',
  'color',
  'black-and-white',
  'large-scale',
  'site-specific',
] as const

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'artist'
  )
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = raw.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function portfolioImage(seed: string, index: number, w = 960, h = 720): string {
  return `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${index}`)}/${w}/${h}`
}
