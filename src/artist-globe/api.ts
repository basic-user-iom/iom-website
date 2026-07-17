import { SEED_ARTISTS } from './seedArtists'
import {
  localApprove,
  localClaimInvite,
  localGetArtist,
  localGetInvite,
  localGetSession,
  localListAllArtists,
  localListArtists,
  localListSubmissions,
  localReject,
  localSignIn,
  localSignOut,
  localSubmit,
  localToggleArtistStatus,
  localUpdateArtist,
} from './localStore'
import { getArtistGlobeSupabase, isArtistGlobeSupabaseReady } from './supabaseClient'
import type {
  Artist,
  ArtistCategory,
  ArtistInvite,
  ArtistLinks,
  ArtistSubmission,
  SubmitArtistInput,
} from './types'
import { normalizeTags, slugify } from './types'

const ADMIN_STORAGE_KEY = 'artist-globe-admin'

export function getAdminPassword(): string {
  return import.meta.env.VITE_ARTIST_GLOBE_ADMIN_PASSWORD?.trim() || 'iom-globe-admin'
}

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockAdmin(password: string): boolean {
  if (password !== getAdminPassword()) return false
  sessionStorage.setItem(ADMIN_STORAGE_KEY, '1')
  return true
}

export function lockAdmin() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY)
}

function rowToArtist(row: Record<string, unknown>): Artist {
  const links = (row.links as ArtistLinks) || {}
  const portfolio = Array.isArray(row.portfolio) ? (row.portfolio as Artist['portfolio']) : []
  return {
    id: String(row.id),
    slug: String(row.slug),
    displayName: String(row.display_name ?? ''),
    category: row.category as ArtistCategory,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    bio: String(row.bio ?? ''),
    links,
    city: String(row.city ?? ''),
    country: String(row.country ?? ''),
    lat: Number(row.lat),
    lon: Number(row.lon),
    timezone: String(row.timezone ?? 'UTC'),
    avatarUrl: String(row.avatar_url ?? ''),
    status: (row.status as Artist['status']) || 'live',
    portfolio,
    email: row.email ? String(row.email) : undefined,
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function rowToSubmission(row: Record<string, unknown>): ArtistSubmission {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ''),
    email: String(row.email ?? ''),
    category: row.category as ArtistCategory,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    bio: String(row.bio ?? ''),
    links: (row.links as ArtistLinks) || {},
    city: String(row.city ?? ''),
    country: String(row.country ?? ''),
    lat: Number(row.lat),
    lon: Number(row.lon),
    timezone: String(row.timezone ?? 'UTC'),
    avatarUrl: String(row.avatar_url ?? ''),
    status: (row.status as ArtistSubmission['status']) || 'pending',
    rejectReason: String(row.reject_reason ?? ''),
    createdAt: String(row.created_at ?? ''),
  }
}

function mergeArtists(remote: Artist[]): Artist[] {
  const bySlug = new Map<string, Artist>()
  for (const a of SEED_ARTISTS) bySlug.set(a.slug, a)
  for (const a of remote) {
    const prev = bySlug.get(a.slug)
    bySlug.set(a.slug, {
      ...a,
      timezone: a.timezone || prev?.timezone || 'UTC',
      portfolio: a.portfolio?.length ? a.portfolio : prev?.portfolio ?? [],
    })
  }
  return [...bySlug.values()].filter((a) => a.status === 'live')
}

export async function fetchLiveArtists(): Promise<Artist[]> {
  const supabase = getArtistGlobeSupabase()
  if (!supabase) {
    return mergeArtists(localListArtists())
  }

  try {
    const { data, error } = await supabase
      .from('artist_globe_artists')
      .select('*')
      .eq('status', 'live')
    if (error) throw error
    const remote = (data ?? []).map((r) => rowToArtist(r as Record<string, unknown>))
    const local = localListArtists()
    return mergeArtists([...remote, ...local])
  } catch (err) {
    console.warn('[artist-globe] fetch artists fallback', err)
    return mergeArtists(localListArtists())
  }
}

export async function submitArtist(input: SubmitArtistInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload = {
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
  }

  if (!payload.displayName || !payload.email || !payload.city) {
    return { ok: false, error: 'Name, email, and city are required.' }
  }
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
    return { ok: false, error: 'Valid latitude and longitude are required.' }
  }

  // Always keep a local copy so admin moderation works in the pitch demo
  // without SUPABASE_SERVICE_ROLE_KEY. Also mirror to Supabase when configured.
  localSubmit(payload)

  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      const { error } = await supabase.from('artist_globe_submissions').insert({
        display_name: payload.displayName,
        email: payload.email,
        category: payload.category,
        tags: payload.tags,
        bio: payload.bio,
        links: payload.links,
        city: payload.city,
        country: payload.country,
        lat: payload.lat,
        lon: payload.lon,
        timezone: payload.timezone,
        avatar_url: payload.avatarUrl,
        status: 'pending',
      })
      if (error) throw error
    } catch (err) {
      console.warn('[artist-globe] submit remote failed; local copy kept', err)
    }
  }

  return { ok: true }
}

async function adminFetch(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Artist-Globe-Admin': getAdminPassword(),
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; inviteUrl?: string; invite?: ArtistInvite }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export async function listSubmissions(): Promise<ArtistSubmission[]> {
  if (!isAdminUnlocked()) return []

  const local = localListSubmissions()
  try {
    const data = await adminFetch('/api/artist-globe-admin', { action: 'list_submissions' })
    if (Array.isArray((data as { submissions?: unknown }).submissions)) {
      const remote = ((data as { submissions: Record<string, unknown>[] }).submissions).map(
        rowToSubmission,
      )
      const byId = new Map<string, ArtistSubmission>()
      for (const s of remote) byId.set(s.id, s)
      for (const s of local) if (!byId.has(s.id)) byId.set(s.id, s)
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
  } catch (err) {
    console.warn('[artist-globe] admin list remote fallback', err)
  }

  return local
}

export async function listManagedArtists(): Promise<Artist[]> {
  if (!isAdminUnlocked()) return []

  try {
    const data = await adminFetch('/api/artist-globe-admin', { action: 'list_artists' })
    if (Array.isArray((data as { artists?: unknown }).artists)) {
      const remote = ((data as { artists: Record<string, unknown>[] }).artists).map(rowToArtist)
      return [...remote, ...localListAllArtists()]
    }
  } catch (err) {
    console.warn('[artist-globe] admin artists fallback', err)
  }

  return localListAllArtists()
}

export async function approveSubmission(
  submissionId: string,
): Promise<{ inviteUrl: string } | { error: string }> {
  if (!isAdminUnlocked()) return { error: 'Admin locked' }

  // Local submission ids are UUIDs from crypto — try remote first for DB ids
  try {
    const data = await adminFetch('/api/artist-globe-admin', {
      action: 'approve',
      submissionId,
    })
    if (data.inviteUrl) return { inviteUrl: data.inviteUrl }
  } catch {
    /* local path */
  }

  const result = localApprove(submissionId)
  if (!result) return { error: 'Submission not found or already handled.' }
  const inviteUrl = `${window.location.origin}/artist-globe/invite/${result.invite.token}`
  return { inviteUrl }
}

export async function rejectSubmission(
  submissionId: string,
  reason: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isAdminUnlocked()) return { error: 'Admin locked' }

  try {
    await adminFetch('/api/artist-globe-admin', {
      action: 'reject',
      submissionId,
      reason,
    })
    return { ok: true }
  } catch {
    /* local */
  }

  if (!localReject(submissionId, reason)) return { error: 'Submission not found or already handled.' }
  return { ok: true }
}

export async function toggleArtistHidden(artistId: string): Promise<{ ok: true } | { error: string }> {
  if (!isAdminUnlocked()) return { error: 'Admin locked' }

  if (artistId.startsWith('seed-')) {
    return { error: 'Seed artists cannot be toggled in the demo.' }
  }

  try {
    await adminFetch('/api/artist-globe-admin', {
      action: 'toggle_status',
      artistId,
    })
    return { ok: true }
  } catch {
    /* local */
  }

  if (!localToggleArtistStatus(artistId)) return { error: 'Artist not found.' }
  return { ok: true }
}

export async function getInvite(token: string): Promise<{
  invite: ArtistInvite
  artist: Artist
} | null> {
  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      const { data: inviteRow, error } = await supabase
        .from('artist_globe_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle()
      if (error) throw error
      if (inviteRow) {
        const { data: artistRow } = await supabase
          .from('artist_globe_artists')
          .select('*')
          .eq('id', inviteRow.artist_id)
          .maybeSingle()
        if (artistRow) {
          return {
            invite: {
              id: String(inviteRow.id),
              token: String(inviteRow.token),
              artistId: String(inviteRow.artist_id),
              submissionId: inviteRow.submission_id ? String(inviteRow.submission_id) : null,
              email: String(inviteRow.email),
              expiresAt: String(inviteRow.expires_at),
              usedAt: inviteRow.used_at ? String(inviteRow.used_at) : null,
            },
            artist: rowToArtist(artistRow as Record<string, unknown>),
          }
        }
      }
    } catch (err) {
      console.warn('[artist-globe] getInvite remote', err)
    }
  }

  const invite = localGetInvite(token)
  if (!invite) return null
  const artist = localGetArtist(invite.artistId)
  if (!artist) return null
  return { invite, artist }
}

export async function claimInvite(
  token: string,
  password: string,
): Promise<{ ok: true; artist: Artist } | { ok: false; error: string }> {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const packed = await getInvite(token)
  if (!packed) return { ok: false, error: 'Invite not found.' }
  if (packed.invite.usedAt) return { ok: false, error: 'Invite already used.' }
  if (new Date(packed.invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'Invite expired.' }
  }

  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      const { data: signData, error: signError } = await supabase.auth.signUp({
        email: packed.invite.email,
        password,
      })
      if (signError) throw signError
      const userId = signData.user?.id
      if (!userId) throw new Error('No user returned from signup')

      const { error: claimError } = await supabase.rpc('artist_globe_claim_invite', {
        invite_token: token,
        claim_user_id: userId,
      })
      if (claimError) throw claimError

      const artist = { ...packed.artist, authUserId: userId }
      return { ok: true, artist }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed'
      // Fall through to local if tables/RPC missing
      if (!/ invitet|relation|function|schema/i.test(msg)) {
        console.warn('[artist-globe] claim remote', err)
      }
    }
  }

  const local = localClaimInvite(token, password)
  if (!local) return { ok: false, error: 'Could not claim invite.' }
  return { ok: true, artist: local.artist }
}

export async function getCurrentArtist(): Promise<Artist | null> {
  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (user) {
        const { data, error } = await supabase
          .from('artist_globe_artists')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (data) return rowToArtist(data as Record<string, unknown>)
      }
    } catch (err) {
      console.warn('[artist-globe] getCurrentArtist', err)
    }
  }

  const session = localGetSession()
  if (!session) return null
  return localGetArtist(session.artistId)
}

export async function signInArtist(
  email: string,
  password: string,
): Promise<{ ok: true; artist: Artist } | { ok: false; error: string }> {
  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const artist = await getCurrentArtist()
      if (!artist) return { ok: false, error: 'Signed in, but no artist profile linked yet.' }
      return { ok: true, artist }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed'
      // try local
      console.warn('[artist-globe] signIn remote', msg)
    }
  }

  const artist = localSignIn(email, password)
  if (!artist) return { ok: false, error: 'Invalid credentials or profile not claimed yet.' }
  return { ok: true, artist }
}

export async function signOutArtist() {
  const supabase = getArtistGlobeSupabase()
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
  }
  localSignOut()
}

export async function updateMyArtist(
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
): Promise<{ ok: true; artist: Artist } | { ok: false; error: string }> {
  const current = await getCurrentArtist()
  if (!current) return { ok: false, error: 'Not signed in.' }

  const supabase = getArtistGlobeSupabase()
  if (supabase && current.authUserId && !current.authUserId.startsWith('local:')) {
    try {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.displayName !== undefined) update.display_name = patch.displayName.trim()
      if (patch.category !== undefined) update.category = patch.category
      if (patch.tags !== undefined) update.tags = normalizeTags(patch.tags)
      if (patch.bio !== undefined) update.bio = patch.bio.trim()
      if (patch.links !== undefined) update.links = patch.links
      if (patch.city !== undefined) update.city = patch.city.trim()
      if (patch.country !== undefined) update.country = patch.country.trim()
      if (patch.lat !== undefined) update.lat = patch.lat
      if (patch.lon !== undefined) update.lon = patch.lon
      if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl.trim()
      if (patch.displayName !== undefined) update.slug = slugify(patch.displayName)

      const { data, error } = await supabase
        .from('artist_globe_artists')
        .update(update)
        .eq('id', current.id)
        .select('*')
        .single()
      if (error) throw error
      return { ok: true, artist: rowToArtist(data as Record<string, unknown>) }
    } catch (err) {
      console.warn('[artist-globe] update remote', err)
    }
  }

  const artist = localUpdateArtist(current.id, patch)
  if (!artist) return { ok: false, error: 'Could not update profile.' }
  return { ok: true, artist }
}

export function backendMode(): 'supabase' | 'local' {
  return isArtistGlobeSupabaseReady ? 'supabase' : 'local'
}
