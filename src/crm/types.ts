import type { AtlasEval } from './atlasEval'

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task'

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export type LeadSort = 'updated' | 'owner' | 'status'

/** Extra named link on a lead (beyond the primary `website` field). */
export interface LeadLink {
  label: string
  url: string
}

/** Extra labeled email on a lead (beyond the primary `email` field). */
export interface LeadEmail {
  label: string
  email: string
}

export interface Lead {
  id: string
  company_name: string
  website: string
  /** Named links beyond the primary website (jsonb in Supabase). */
  links: LeadLink[]
  contact_name: string
  /** Job title / role of primary contact (optional). */
  contact_role: string
  /** Primary contact email. */
  email: string
  /** Labeled department emails beyond primary (jsonb in Supabase). */
  emails: LeadEmail[]
  phone: string
  offer: string
  /** What the company does — context for outreach (distinct from offer). */
  company_focus: string
  notes: string
  /** Draft subject for first outreach email. */
  initial_email_subject: string
  /** Draft body for first outreach email. */
  initial_email_body: string
  /** When the draft was last marked ready (null = not marked). */
  initial_email_drafted_at: string | null
  /** When initial outreach was marked sent (null = not sent). */
  initial_email_sent_at: string | null
  temperature: LeadTemperature
  status: LeadStatus
  next_follow_up: string | null
  estimated_value: number | null
  /** Optional CRM-safe emoticon for estimated value (❤️ pro-bono, 🎁 gift, …). */
  value_emoji: string
  /** Atlas Evaluation Principle scores (jsonb; 0 = unset, 1–5 stars). */
  atlas_eval: AtlasEval
  /** IANA timezone (e.g. Europe/Belgrade) for client local clock */
  client_timezone: string
  /** City used for weather geocoding */
  client_city: string
  /** Country used with city for geocoding */
  client_country: string
  /** Street address for client location (optional). */
  client_address: string
  /** Cached geocode latitude (optional) */
  client_lat: number | null
  /** Cached geocode longitude (optional) */
  client_lon: number | null
  owner_id: string | null
  /** Denormalized at create — who added the lead (email) */
  owner_email: string | null
  /** Denormalized profile photo URL / data URL at create (or refreshed by owner) */
  owner_avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  subject: string
  body: string
  occurred_at: string
  created_at: string
  owner_id: string | null
}

export type LeadMessageDirection = 'outbound' | 'inbound'

/** Mirrored email in a lead conversation (Proton remains the mailbox). */
export interface LeadMessage {
  id: string
  lead_id: string
  direction: LeadMessageDirection
  from_email: string
  to_email: string
  subject: string
  body_text: string
  body_html: string | null
  message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  occurred_at: string
  created_at: string
  owner_id: string | null
  raw_headers: Record<string, unknown>
}

export type LeadMessageInput = Omit<
  LeadMessage,
  'id' | 'created_at' | 'owner_id' | 'raw_headers'
> & {
  raw_headers?: Record<string, unknown>
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CrmProject {
  id: string
  lead_id: string | null
  name: string
  description: string
  status: ProjectStatus
  created_at: string
  updated_at: string
  owner_id: string | null
}

export interface BoardColumn {
  id: string
  project_id: string
  name: string
  position: number
  color: string
  created_at: string
}

export interface CrmTask {
  id: string
  project_id: string
  column_id: string | null
  title: string
  description: string
  priority: TaskPriority
  due_date: string | null
  assignee_id: string | null
  position: number
  owner_id: string | null
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  project_id: string | null
  task_id: string | null
  user_id: string | null
  user_email: string
  started_at: string
  ended_at: string | null
  duration_seconds: number
  notes: string
  created_at: string
}

export interface MindMap {
  id: string
  title: string
  lead_id: string | null
  project_id: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type MindNodeEmphasis = 'normal' | 'bold' | 'italic' | 'bold-italic'

export interface MindNode {
  id: string
  mind_map_id: string
  parent_id: string | null
  title: string
  notes: string
  /** CSS color string; empty = theme default */
  color: string
  /** Optional URL on the topic */
  link_url: string
  emphasis: MindNodeEmphasis
  position: number
  created_at: string
  updated_at: string
}

export type ProjectInput = Pick<CrmProject, 'name' | 'description' | 'status' | 'lead_id'>
export type TaskInput = Pick<
  CrmTask,
  'title' | 'description' | 'priority' | 'due_date' | 'assignee_id' | 'column_id'
>
export type TimeEntryInput = {
  project_id: string | null
  task_id: string | null
  notes: string
  started_at: string
  ended_at: string
  duration_seconds: number
}
export type MindMapInput = Pick<MindMap, 'title' | 'lead_id' | 'project_id'>

export interface ResearchNote {
  id: string
  title: string
  body: string
  lead_id: string | null
  project_id: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type ResearchNoteInput = Pick<
  ResearchNote,
  'title' | 'body' | 'lead_id' | 'project_id'
>

export type CrmSection =
  | 'leads'
  | 'projects'
  | 'time'
  | 'ideas'
  | 'notes'
  | 'recordings'
  | 'blog'
  | 'links'
  | 'demos'
  | 'seo'

/** Online screen recording metadata (crm_recordings). */
export interface CrmRecording {
  id: string
  owner_id: string
  title: string
  storage_path: string
  mime_type: string
  duration_ms: number | null
  file_size: number | null
  share_slug: string
  /** True when a share password is set (hash never exposed to clients). */
  has_password: boolean
  created_at: string
  updated_at: string
}

export type LeadInput = Omit<
  Lead,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'owner_id'
  | 'owner_email'
  | 'owner_avatar_url'
>
export type ActivityInput = Omit<Activity, 'id' | 'created_at' | 'owner_id'>
export type ActivityUpdate = Pick<ActivityInput, 'type' | 'subject' | 'body' | 'occurred_at'>
export type LeadMessageCreate = LeadMessageInput

export interface CrmUser {
  id: string
  email: string
  /** Public Storage URL (online) or data URL (local mode) */
  avatar_url: string | null
}

/** Shared staff directory row (readable by all authenticated CRM users). */
export interface StaffProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
}

export interface LeadFilters {
  search: string
  status: LeadStatus | 'all'
  temperature: LeadTemperature | 'all'
  /** 'all' | owner_id | owner_email | 'none' */
  owner: string
  sort: LeadSort
}

export interface LeadOwnerOption {
  key: string
  label: string
  avatar_url: string | null
}

export interface ResolvedLeadOwner {
  email: string | null
  avatar_url: string | null
  name: string
  /** True when attribution is missing — staff can claim "I added this". */
  claimable: boolean
}

/** Display name from email local-part (mirjan@… → Mirjan). */
export function ownerDisplayName(
  email: string | null | undefined,
  fallback = 'Unknown',
): string {
  if (!email?.trim()) return fallback
  const local = email.trim().split('@')[0] || email.trim()
  if (!local) return fallback
  // mirjan.foto / iva.musovic → Mirjan / Iva
  const first = local.split(/[._-]/)[0] || local
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function staffFromMap(
  ownerId: string | null,
  staffById?: Map<string, StaffProfile> | null,
): StaffProfile | undefined {
  if (!ownerId || !staffById) return undefined
  return staffById.get(ownerId)
}

/**
 * Resolve who-added for UI:
 * snapshot → shared staff profile → current user (if they own it) → email local-part.
 *
 * Important: the isSelf email/avatar fallback is display-only. Teammates only see
 * attribution when owner_email / staff profile is present in shared storage.
 * Claim is allowed only for null owner_id (or self completing an incomplete row) —
 * never for another user's owner_id (prevents stealing Iva's lead as Mirjan).
 */
export function resolveLeadOwner(
  lead: Lead,
  currentUser: CrmUser | null,
  staffById?: Map<string, StaffProfile> | null,
): ResolvedLeadOwner {
  const staff = staffFromMap(lead.owner_id, staffById)
  const isSelf = !!(currentUser && lead.owner_id && lead.owner_id === currentUser.id)
  const snapshotEmail = lead.owner_email?.trim() || null
  const snapshotIncomplete = !!(lead.owner_id && !snapshotEmail)

  const email =
    snapshotEmail ||
    staff?.email?.trim() ||
    (isSelf ? currentUser!.email : null) ||
    null

  const avatar =
    lead.owner_avatar_url?.trim() ||
    staff?.avatar_url?.trim() ||
    (isSelf ? currentUser!.avatar_url : null) ||
    null

  const nameFromStaff = staff?.display_name?.trim() || null
  const name =
    (nameFromStaff ? ownerDisplayName(nameFromStaff, '') : '') ||
    ownerDisplayName(email, '')
  const hasIdentity = !!(name || email || avatar)

  // Legacy rows with no owner — anyone may claim.
  if (!lead.owner_id) {
    return {
      email: email || null,
      avatar_url: avatar || null,
      name,
      claimable: true,
    }
  }

  // owner_id set but nothing resolvable yet (migration / missing staff row).
  if (!hasIdentity) {
    return {
      email: null,
      avatar_url: null,
      name: 'Unknown',
      // Only the attributed user may complete their own snapshot — not teammates.
      claimable: isSelf,
    }
  }

  return {
    email,
    avatar_url: avatar,
    name,
    // Self can still persist missing owner_email after viewing (auto-heal / claim).
    claimable: isSelf && snapshotIncomplete,
  }
}

/** Whether staff can assign themselves as the person who added this lead. */
export function leadOwnerIsClaimable(
  lead: Lead,
  currentUser: CrmUser | null = null,
  staffById?: Map<string, StaffProfile> | null,
): boolean {
  return resolveLeadOwner(lead, currentUser, staffById).claimable
}

export function collectOwnerOptions(
  leads: Lead[],
  currentUser?: CrmUser | null,
  staffById?: Map<string, StaffProfile> | null,
): LeadOwnerOption[] {
  const map = new Map<string, LeadOwnerOption>()
  for (const lead of leads) {
    const key = lead.owner_id || lead.owner_email || ''
    if (!key) continue
    const resolved = resolveLeadOwner(lead, currentUser ?? null, staffById)
    let label = resolved?.name || ownerDisplayName(lead.owner_email)
    let avatar_url = resolved?.avatar_url ?? lead.owner_avatar_url
    if (!label) label = 'Unknown'
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        label,
        avatar_url,
      })
    } else {
      if (!existing.avatar_url && avatar_url) existing.avatar_url = avatar_url
      if (existing.label === 'Unknown' && label !== 'Unknown') existing.label = label
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}
