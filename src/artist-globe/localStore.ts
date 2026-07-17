import type { Artist, ArtistInvite, ArtistSubmission, SubmitArtistInput } from './types'
import { normalizeTags, slugify } from './types'

const STORAGE_KEY = 'artist-globe-local-v1'

interface LocalState {
  submissions: ArtistSubmission[]
  artists: Artist[]
  invites: ArtistInvite[]
  sessionEmail: string | null
  sessionArtistId: string | null
}

function emptyState(): LocalState {
  return {
    submissions: [],
    artists: [],
    invites: [],
    sessionEmail: null,
    sessionArtistId: null,
  }
}

function read(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as LocalState
    return {
      ...emptyState(),
      ...parsed,
      submissions: parsed.submissions ?? [],
      artists: parsed.artists ?? [],
      invites: parsed.invites ?? [],
    }
  } catch {
    return emptyState()
  }
}

function write(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function uid(): string {
  return crypto.randomUUID()
}

function token(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function localListArtists(): Artist[] {
  return read().artists.filter((a) => a.status === 'live').map(normalizeArtist)
}

export function localListAllArtists(): Artist[] {
  return read().artists.map(normalizeArtist)
}

function normalizeArtist(a: Artist): Artist {
  return {
    ...a,
    timezone: a.timezone || 'UTC',
    portfolio: Array.isArray(a.portfolio) ? a.portfolio : [],
  }
}

export function localListSubmissions(): ArtistSubmission[] {
  return [...read().submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function localSubmit(input: SubmitArtistInput): ArtistSubmission {
  const state = read()
  const row: ArtistSubmission = {
    id: uid(),
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    category: input.category,
    tags: normalizeTags(input.tags),
    bio: input.bio.trim(),
    links: input.links,
    city: input.city.trim(),
    country: input.country.trim(),
    lat: input.lat,
    lon: input.lon,
    timezone: input.timezone?.trim() || 'UTC',
    avatarUrl: input.avatarUrl?.trim() ?? '',
    status: 'pending',
    rejectReason: '',
    createdAt: new Date().toISOString(),
  }
  state.submissions.unshift(row)
  write(state)
  return row
}

export function localReject(submissionId: string, reason: string): ArtistSubmission | null {
  const state = read()
  const sub = state.submissions.find((s) => s.id === submissionId)
  if (!sub || sub.status !== 'pending') return null
  sub.status = 'rejected'
  sub.rejectReason = reason.trim()
  write(state)
  return sub
}

export function localApprove(submissionId: string): { artist: Artist; invite: ArtistInvite } | null {
  const state = read()
  const sub = state.submissions.find((s) => s.id === submissionId)
  if (!sub || sub.status !== 'pending') return null

  const baseSlug = slugify(sub.displayName)
  let slug = baseSlug
  let n = 2
  while (state.artists.some((a) => a.slug === slug)) {
    slug = `${baseSlug}-${n++}`
  }

  const now = new Date().toISOString()
  const artist: Artist = {
    id: uid(),
    slug,
    displayName: sub.displayName,
    category: sub.category,
    tags: sub.tags,
    bio: sub.bio,
    links: sub.links,
    city: sub.city,
    country: sub.country,
    lat: sub.lat,
    lon: sub.lon,
    timezone: sub.timezone || 'UTC',
    avatarUrl: sub.avatarUrl,
    status: 'live',
    portfolio: [],
    email: sub.email,
    authUserId: null,
    createdAt: now,
    updatedAt: now,
  }

  const invite: ArtistInvite = {
    id: uid(),
    token: token(),
    artistId: artist.id,
    submissionId: sub.id,
    email: sub.email,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    usedAt: null,
  }

  sub.status = 'approved'
  state.artists.push(artist)
  state.invites.push(invite)
  write(state)
  return { artist, invite }
}

export function localToggleArtistStatus(artistId: string): Artist | null {
  const state = read()
  const artist = state.artists.find((a) => a.id === artistId)
  if (!artist) return null
  artist.status = artist.status === 'live' ? 'hidden' : 'live'
  artist.updatedAt = new Date().toISOString()
  write(state)
  return artist
}

export function localGetInvite(inviteToken: string): ArtistInvite | null {
  return read().invites.find((i) => i.token === inviteToken) ?? null
}

export function localGetArtist(artistId: string): Artist | null {
  return read().artists.find((a) => a.id === artistId) ?? null
}

export function localClaimInvite(
  inviteToken: string,
  password: string,
): { artist: Artist; email: string } | null {
  void password
  const state = read()
  const invite = state.invites.find((i) => i.token === inviteToken)
  if (!invite || invite.usedAt) return null
  if (new Date(invite.expiresAt).getTime() < Date.now()) return null
  const artist = state.artists.find((a) => a.id === invite.artistId)
  if (!artist) return null

  invite.usedAt = new Date().toISOString()
  artist.authUserId = `local:${invite.email}`
  artist.updatedAt = new Date().toISOString()
  state.sessionEmail = invite.email
  state.sessionArtistId = artist.id
  write(state)
  return { artist, email: invite.email }
}

export function localGetSession(): { email: string; artistId: string } | null {
  const state = read()
  if (!state.sessionEmail || !state.sessionArtistId) return null
  return { email: state.sessionEmail, artistId: state.sessionArtistId }
}

export function localSignIn(email: string, _password: string): Artist | null {
  void _password
  const state = read()
  const normalized = email.trim().toLowerCase()
  const artist = state.artists.find(
    (a) => a.email?.toLowerCase() === normalized && a.authUserId,
  )
  if (!artist) return null
  state.sessionEmail = normalized
  state.sessionArtistId = artist.id
  write(state)
  return artist
}

export function localSignOut() {
  const state = read()
  state.sessionEmail = null
  state.sessionArtistId = null
  write(state)
}

export function localUpdateArtist(
  artistId: string,
  patch: Partial<
    Pick<
      Artist,
      | 'displayName'
      | 'category'
      | 'tags'
      | 'bio'
      | 'links'
      | 'city'
      | 'country'
      | 'lat'
      | 'lon'
      | 'avatarUrl'
    >
  >,
): Artist | null {
  const state = read()
  const artist = state.artists.find((a) => a.id === artistId)
  if (!artist) return null
  if (patch.displayName !== undefined) artist.displayName = patch.displayName.trim()
  if (patch.category !== undefined) artist.category = patch.category
  if (patch.tags !== undefined) artist.tags = normalizeTags(patch.tags)
  if (patch.bio !== undefined) artist.bio = patch.bio.trim()
  if (patch.links !== undefined) artist.links = patch.links
  if (patch.city !== undefined) artist.city = patch.city.trim()
  if (patch.country !== undefined) artist.country = patch.country.trim()
  if (patch.lat !== undefined) artist.lat = patch.lat
  if (patch.lon !== undefined) artist.lon = patch.lon
  if (patch.avatarUrl !== undefined) artist.avatarUrl = patch.avatarUrl.trim()
  artist.updatedAt = new Date().toISOString()
  write(state)
  return artist
}
