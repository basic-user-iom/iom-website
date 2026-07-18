import { isCrmDemoMode } from './demoMode'
import { demoRead, demoWrite } from './demoStore'
import {
  DEMO_USEFUL_LINKS,
  USEFUL_LINKS,
  type LinkCategory,
  type UsefulLink,
} from './linksCatalog'
import { getSupabase, useLiveCrmBackend } from './supabaseClient'

export const USEFUL_LINKS_KEY = 'iom-crm-useful-links'

export type UsefulLinkInput = {
  title: string
  url: string
  category: LinkCategory
  note: string
  tags?: string[]
}

function uid(): string {
  return crypto.randomUUID()
}

function cloneLinks(links: UsefulLink[]): UsefulLink[] {
  return structuredClone(links)
}

function seedForMode(): UsefulLink[] {
  return cloneLinks(isCrmDemoMode() ? DEMO_USEFUL_LINKS : USEFUL_LINKS)
}

function readLocalLinks(): UsefulLink[] {
  if (isCrmDemoMode()) {
    return demoRead<UsefulLink[]>(USEFUL_LINKS_KEY, seedForMode())
  }
  try {
    const raw = localStorage.getItem(USEFUL_LINKS_KEY)
    if (raw === null) {
      const seed = seedForMode()
      localStorage.setItem(USEFUL_LINKS_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as UsefulLink[]
    return Array.isArray(parsed) ? parsed : seedForMode()
  } catch {
    return seedForMode()
  }
}

function writeLocalLinks(links: UsefulLink[]): void {
  if (isCrmDemoMode()) {
    demoWrite(USEFUL_LINKS_KEY, links)
    return
  }
  localStorage.setItem(USEFUL_LINKS_KEY, JSON.stringify(links))
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isSchemaMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('crm_useful_links') ||
    msg.includes('schema cache') ||
    msg.includes('Could not find the table')
  )
}

function rowToLink(row: Record<string, unknown>): UsefulLink {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    url: String(row.url ?? ''),
    category: row.category as LinkCategory,
    note: String(row.note ?? ''),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
  }
}

export async function listUsefulLinks(): Promise<UsefulLink[]> {
  if (useLiveCrmBackend()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('crm_useful_links')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      const rows = (data ?? []).map((row) => rowToLink(row as Record<string, unknown>))
      if (rows.length === 0) {
        // Fresh table — seed once from the staff catalogue, then return.
        const seed = cloneLinks(USEFUL_LINKS)
        const { error: insertError } = await supabase.from('crm_useful_links').insert(
          seed.map((link) => ({
            title: link.title,
            url: link.url,
            category: link.category,
            note: link.note,
            tags: link.tags ?? [],
          })),
        )
        if (insertError) {
          // Race with another client, or id type mismatch — re-list.
          const { data: again } = await supabase
            .from('crm_useful_links')
            .select('*')
            .order('created_at', { ascending: true })
          if (again && again.length > 0) {
            return again.map((row) => rowToLink(row as Record<string, unknown>))
          }
          throw new Error(insertError.message)
        }
        const { data: seeded } = await supabase
          .from('crm_useful_links')
          .select('*')
          .order('created_at', { ascending: true })
        return (seeded ?? []).map((row) => rowToLink(row as Record<string, unknown>))
      }
      return rows
    } catch (err) {
      if (isSchemaMissing(err)) return readLocalLinks()
      throw err
    }
  }
  return readLocalLinks()
}

export async function createUsefulLink(input: UsefulLinkInput): Promise<UsefulLink> {
  const title = input.title.trim()
  const url = normalizeUrl(input.url)
  const note = input.note.trim()
  const category = input.category
  if (!title) throw new Error('Title is required.')
  if (!url) throw new Error('URL is required.')
  try {
    // Validate URL shape
    void new URL(url)
  } catch {
    throw new Error('Enter a valid URL.')
  }

  if (useLiveCrmBackend()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('crm_useful_links')
        .insert({
          title,
          url,
          category,
          note,
          tags: input.tags ?? [],
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return rowToLink(data as Record<string, unknown>)
    } catch (err) {
      if (!isSchemaMissing(err)) throw err
      // fall through to local
    }
  }

  const link: UsefulLink = {
    id: uid(),
    title,
    url,
    category,
    note,
    tags: input.tags,
  }
  writeLocalLinks([link, ...readLocalLinks()])
  return link
}

export async function deleteUsefulLink(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    try {
      const supabase = getSupabase()!
      const { error } = await supabase.from('crm_useful_links').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return
    } catch (err) {
      if (!isSchemaMissing(err)) throw err
      // fall through to local
    }
  }
  writeLocalLinks(readLocalLinks().filter((link) => link.id !== id))
}
