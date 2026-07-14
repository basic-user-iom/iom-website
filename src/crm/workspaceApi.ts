import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode } from './demoMode'
import { demoRead, demoWrite } from './demoStore'
import { getCurrentUser } from './api'
import type {
  BoardColumn,
  CrmProject,
  CrmTask,
  MindMap,
  MindMapInput,
  MindNode,
  ProjectInput,
  ProjectStatus,
  TaskInput,
  TaskPriority,
  TimeEntry,
  TimeEntryInput,
} from './types'

const PROJECTS_KEY = 'iom-crm-projects'
const COLUMNS_KEY = 'iom-crm-board-columns'
const TASKS_KEY = 'iom-crm-tasks'
const TIME_KEY = 'iom-crm-time-entries'
const MAPS_KEY = 'iom-crm-mind-maps'
const NODES_KEY = 'iom-crm-mind-nodes'

const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#64748b' },
  { name: 'Doing', color: '#0ea5e9' },
  { name: 'Review', color: '#a855f7' },
  { name: 'Done', color: '#22c55e' },
]

function uid(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function readLocal<T>(key: string, fallback: T): T {
  if (isCrmDemoMode()) return demoRead(key, fallback)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T): void {
  if (isCrmDemoMode()) {
    demoWrite(key, value)
    return
  }
  localStorage.setItem(key, JSON.stringify(value))
}

function durationBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.round(ms / 1000))
}

/* ── Projects ─────────────────────────────────────────── */

export async function listProjects(): Promise<CrmProject[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as CrmProject[]
  }
  return readLocal<CrmProject[]>(PROJECTS_KEY, []).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export async function listProjectsForLead(leadId: string): Promise<CrmProject[]> {
  const all = await listProjects()
  return all.filter((p) => p.lead_id === leadId)
}

export async function getProject(id: string): Promise<CrmProject | null> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as CrmProject) ?? null
  }
  return readLocal<CrmProject[]>(PROJECTS_KEY, []).find((p) => p.id === id) ?? null
}

async function seedDefaultColumns(projectId: string): Promise<BoardColumn[]> {
  const stamp = nowIso()
  const rows: Omit<BoardColumn, 'id' | 'created_at'>[] = DEFAULT_COLUMNS.map(
    (col, i) => ({
      project_id: projectId,
      name: col.name,
      color: col.color,
      position: i,
    }),
  )

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_board_columns')
      .insert(rows)
      .select('*')
      .order('position')
    if (error) throw new Error(error.message)
    return (data ?? []) as BoardColumn[]
  }

  const created: BoardColumn[] = rows.map((r) => ({
    ...r,
    id: uid(),
    created_at: stamp,
  }))
  writeLocal(COLUMNS_KEY, [...readLocal<BoardColumn[]>(COLUMNS_KEY, []), ...created])
  return created
}

export async function createProject(input: ProjectInput): Promise<CrmProject> {
  const user = await getCurrentUser()
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_projects')
      .insert({
        ...input,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    const project = data as CrmProject
    await seedDefaultColumns(project.id)
    return project
  }

  const project: CrmProject = {
    ...input,
    id: uid(),
    owner_id: user?.id ?? null,
    created_at: stamp,
    updated_at: stamp,
  }
  writeLocal(PROJECTS_KEY, [project, ...readLocal<CrmProject[]>(PROJECTS_KEY, [])])
  await seedDefaultColumns(project.id)
  return project
}

export async function createProjectFromLead(lead: {
  id: string
  company_name: string
  offer: string
  notes: string
}): Promise<CrmProject> {
  const name =
    lead.company_name.trim() ||
    `Lead project ${lead.id.slice(0, 8)}`
  const description = [lead.offer, lead.notes].filter(Boolean).join('\n\n')
  return createProject({
    name,
    description,
    status: 'active',
    lead_id: lead.id,
  })
}

export async function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<CrmProject> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_projects')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as CrmProject
  }
  const projects = readLocal<CrmProject[]>(PROJECTS_KEY, [])
  const idx = projects.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Project not found.')
  const updated: CrmProject = {
    ...projects[idx],
    ...input,
    updated_at: nowIso(),
  }
  projects[idx] = updated
  writeLocal(PROJECTS_KEY, projects)
  return updated
}

export async function deleteProject(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_projects').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(
    PROJECTS_KEY,
    readLocal<CrmProject[]>(PROJECTS_KEY, []).filter((p) => p.id !== id),
  )
  writeLocal(
    COLUMNS_KEY,
    readLocal<BoardColumn[]>(COLUMNS_KEY, []).filter((c) => c.project_id !== id),
  )
  writeLocal(
    TASKS_KEY,
    readLocal<CrmTask[]>(TASKS_KEY, []).filter((t) => t.project_id !== id),
  )
  writeLocal(
    TIME_KEY,
    readLocal<TimeEntry[]>(TIME_KEY, []).map((e) =>
      e.project_id === id ? { ...e, project_id: null, task_id: null } : e,
    ),
  )
  writeLocal(
    MAPS_KEY,
    readLocal<MindMap[]>(MAPS_KEY, []).map((m) =>
      m.project_id === id ? { ...m, project_id: null } : m,
    ),
  )
}

/* ── Columns ──────────────────────────────────────────── */

export async function listColumns(projectId: string): Promise<BoardColumn[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_board_columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position')
    if (error) throw new Error(error.message)
    const cols = (data ?? []) as BoardColumn[]
    if (cols.length === 0) return seedDefaultColumns(projectId)
    return cols
  }
  let cols = readLocal<BoardColumn[]>(COLUMNS_KEY, [])
    .filter((c) => c.project_id === projectId)
    .sort((a, b) => a.position - b.position)
  if (cols.length === 0) cols = await seedDefaultColumns(projectId)
  return cols
}

export async function createColumn(
  projectId: string,
  name: string,
): Promise<BoardColumn> {
  const existing = await listColumns(projectId)
  const position = existing.length
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_board_columns')
      .insert({
        project_id: projectId,
        name,
        position,
        color: '',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as BoardColumn
  }
  const col: BoardColumn = {
    id: uid(),
    project_id: projectId,
    name,
    position,
    color: '',
    created_at: nowIso(),
  }
  writeLocal(COLUMNS_KEY, [...readLocal<BoardColumn[]>(COLUMNS_KEY, []), col])
  return col
}

/* ── Tasks ────────────────────────────────────────────── */

export async function listTasks(projectId: string): Promise<CrmTask[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('position')
    if (error) throw new Error(error.message)
    return (data ?? []) as CrmTask[]
  }
  return readLocal<CrmTask[]>(TASKS_KEY, [])
    .filter((t) => t.project_id === projectId)
    .sort((a, b) => a.position - b.position)
}

export async function createTask(
  projectId: string,
  input: TaskInput,
): Promise<CrmTask> {
  const user = await getCurrentUser()
  const existing = await listTasks(projectId)
  const position = existing.filter((t) => t.column_id === input.column_id).length
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_tasks')
      .insert({
        project_id: projectId,
        ...input,
        position,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await supabase
      .from('crm_projects')
      .update({ updated_at: stamp })
      .eq('id', projectId)
    return data as CrmTask
  }

  const task: CrmTask = {
    id: uid(),
    project_id: projectId,
    ...input,
    position,
    owner_id: user?.id ?? null,
    created_at: stamp,
    updated_at: stamp,
  }
  writeLocal(TASKS_KEY, [...readLocal<CrmTask[]>(TASKS_KEY, []), task])
  const projects = readLocal<CrmProject[]>(PROJECTS_KEY, [])
  const idx = projects.findIndex((p) => p.id === projectId)
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], updated_at: stamp }
    writeLocal(PROJECTS_KEY, projects)
  }
  return task
}

export async function updateTask(
  id: string,
  input: Partial<TaskInput> & { position?: number },
): Promise<CrmTask> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_tasks')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as CrmTask
  }
  const tasks = readLocal<CrmTask[]>(TASKS_KEY, [])
  const idx = tasks.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('Task not found.')
  const updated: CrmTask = {
    ...tasks[idx],
    ...input,
    updated_at: nowIso(),
  }
  tasks[idx] = updated
  writeLocal(TASKS_KEY, tasks)
  return updated
}

export async function moveTask(
  taskId: string,
  columnId: string,
): Promise<CrmTask> {
  const tasks = useLiveCrmBackend()
    ? null
    : readLocal<CrmTask[]>(TASKS_KEY, [])
  let projectId = ''
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data: existing, error: getErr } = await supabase
      .from('crm_tasks')
      .select('project_id')
      .eq('id', taskId)
      .single()
    if (getErr) throw new Error(getErr.message)
    projectId = (existing as { project_id: string }).project_id
    const siblings = await listTasks(projectId)
    const position = siblings.filter((t) => t.column_id === columnId && t.id !== taskId)
      .length
    return updateTask(taskId, { column_id: columnId, position })
  }
  const idx = tasks!.findIndex((t) => t.id === taskId)
  if (idx < 0) throw new Error('Task not found.')
  projectId = tasks![idx].project_id
  const position = tasks!.filter(
    (t) => t.column_id === columnId && t.id !== taskId && t.project_id === projectId,
  ).length
  return updateTask(taskId, { column_id: columnId, position })
}

export async function deleteTask(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(
    TASKS_KEY,
    readLocal<CrmTask[]>(TASKS_KEY, []).filter((t) => t.id !== id),
  )
}

/* ── Time tracking ────────────────────────────────────── */

export async function listTimeEntries(filters?: {
  projectId?: string
  userId?: string
}): Promise<TimeEntry[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let query = supabase
      .from('crm_time_entries')
      .select('*')
      .order('started_at', { ascending: false })
    if (filters?.projectId) query = query.eq('project_id', filters.projectId)
    if (filters?.userId) query = query.eq('user_id', filters.userId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as TimeEntry[]
  }
  return readLocal<TimeEntry[]>(TIME_KEY, [])
    .filter((e) => {
      if (filters?.projectId && e.project_id !== filters.projectId) return false
      if (filters?.userId && e.user_id !== filters.userId) return false
      return true
    })
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )
}

export async function getRunningTimer(): Promise<TimeEntry | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const entries = await listTimeEntries({ userId: user.id })
  return entries.find((e) => !e.ended_at) ?? null
}

export async function startTimer(input: {
  project_id: string | null
  task_id: string | null
  notes?: string
}): Promise<TimeEntry> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')

  const running = await getRunningTimer()
  if (running) await stopTimer(running.id)

  const stamp = nowIso()
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_time_entries')
      .insert({
        project_id: input.project_id,
        task_id: input.task_id,
        user_id: user.id,
        user_email: user.email,
        started_at: stamp,
        ended_at: null,
        duration_seconds: 0,
        notes: input.notes ?? '',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as TimeEntry
  }

  const entry: TimeEntry = {
    id: uid(),
    project_id: input.project_id,
    task_id: input.task_id,
    user_id: user.id,
    user_email: user.email,
    started_at: stamp,
    ended_at: null,
    duration_seconds: 0,
    notes: input.notes ?? '',
    created_at: stamp,
  }
  writeLocal(TIME_KEY, [entry, ...readLocal<TimeEntry[]>(TIME_KEY, [])])
  return entry
}

export async function stopTimer(id: string): Promise<TimeEntry> {
  const stamp = nowIso()
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data: existing, error: getErr } = await supabase
      .from('crm_time_entries')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr) throw new Error(getErr.message)
    const row = existing as TimeEntry
    const duration = durationBetween(row.started_at, stamp)
    const { data, error } = await supabase
      .from('crm_time_entries')
      .update({
        ended_at: stamp,
        duration_seconds: duration,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as TimeEntry
  }

  const entries = readLocal<TimeEntry[]>(TIME_KEY, [])
  const idx = entries.findIndex((e) => e.id === id)
  if (idx < 0) throw new Error('Time entry not found.')
  const updated: TimeEntry = {
    ...entries[idx],
    ended_at: stamp,
    duration_seconds: durationBetween(entries[idx].started_at, stamp),
  }
  entries[idx] = updated
  writeLocal(TIME_KEY, entries)
  return updated
}

export async function createManualTimeEntry(
  input: TimeEntryInput,
): Promise<TimeEntry> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_time_entries')
      .insert({
        ...input,
        user_id: user.id,
        user_email: user.email,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as TimeEntry
  }

  const entry: TimeEntry = {
    id: uid(),
    ...input,
    user_id: user.id,
    user_email: user.email,
    created_at: stamp,
  }
  writeLocal(TIME_KEY, [entry, ...readLocal<TimeEntry[]>(TIME_KEY, [])])
  return entry
}

export async function deleteTimeEntry(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_time_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(
    TIME_KEY,
    readLocal<TimeEntry[]>(TIME_KEY, []).filter((e) => e.id !== id),
  )
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export type TimeReportRow = { key: string; label: string; seconds: number }

export function reportTimeByProject(
  entries: TimeEntry[],
  projects: CrmProject[],
): TimeReportRow[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!e.ended_at && e.duration_seconds === 0) continue
    const secs =
      e.ended_at && e.duration_seconds === 0
        ? durationBetween(e.started_at, e.ended_at)
        : e.duration_seconds
    const key = e.project_id || 'none'
    map.set(key, (map.get(key) ?? 0) + secs)
  }
  return [...map.entries()]
    .map(([key, seconds]) => ({
      key,
      label:
        key === 'none'
          ? 'No project'
          : projects.find((p) => p.id === key)?.name || 'Project',
      seconds,
    }))
    .sort((a, b) => b.seconds - a.seconds)
}

export function reportTimeByUser(entries: TimeEntry[]): TimeReportRow[] {
  const map = new Map<string, { label: string; seconds: number }>()
  for (const e of entries) {
    if (!e.ended_at && e.duration_seconds === 0) continue
    const secs =
      e.ended_at && e.duration_seconds === 0
        ? durationBetween(e.started_at, e.ended_at)
        : e.duration_seconds
    const key = e.user_id || e.user_email || 'unknown'
    const prev = map.get(key)
    map.set(key, {
      label: e.user_email || key,
      seconds: (prev?.seconds ?? 0) + secs,
    })
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, seconds: v.seconds }))
    .sort((a, b) => b.seconds - a.seconds)
}

export function reportTimeByDay(entries: TimeEntry[]): TimeReportRow[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!e.ended_at && e.duration_seconds === 0) continue
    const secs =
      e.ended_at && e.duration_seconds === 0
        ? durationBetween(e.started_at, e.ended_at)
        : e.duration_seconds
    const day = e.started_at.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + secs)
  }
  return [...map.entries()]
    .map(([key, seconds]) => ({ key, label: key, seconds }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

/* ── Mind maps ────────────────────────────────────────── */

export async function listMindMaps(filters?: {
  leadId?: string
  projectId?: string
}): Promise<MindMap[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let query = supabase
      .from('crm_mind_maps')
      .select('*')
      .order('updated_at', { ascending: false })
    if (filters?.leadId) query = query.eq('lead_id', filters.leadId)
    if (filters?.projectId) query = query.eq('project_id', filters.projectId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as MindMap[]
  }
  return readLocal<MindMap[]>(MAPS_KEY, [])
    .filter((m) => {
      if (filters?.leadId && m.lead_id !== filters.leadId) return false
      if (filters?.projectId && m.project_id !== filters.projectId) return false
      return true
    })
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
}

export async function createMindMap(input: MindMapInput): Promise<MindMap> {
  const user = await getCurrentUser()
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_mind_maps')
      .insert({
        ...input,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    const map = data as MindMap
    await createMindNode(map.id, {
      parent_id: null,
      title: input.title || 'Central idea',
      notes: '',
    })
    return map
  }

  const map: MindMap = {
    ...input,
    id: uid(),
    owner_id: user?.id ?? null,
    created_at: stamp,
    updated_at: stamp,
  }
  writeLocal(MAPS_KEY, [map, ...readLocal<MindMap[]>(MAPS_KEY, [])])
  await createMindNode(map.id, {
    parent_id: null,
    title: input.title || 'Central idea',
    notes: '',
  })
  return map
}

export async function updateMindMap(
  id: string,
  input: Partial<MindMapInput>,
): Promise<MindMap> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_mind_maps')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as MindMap
  }
  const maps = readLocal<MindMap[]>(MAPS_KEY, [])
  const idx = maps.findIndex((m) => m.id === id)
  if (idx < 0) throw new Error('Mind map not found.')
  const updated: MindMap = { ...maps[idx], ...input, updated_at: nowIso() }
  maps[idx] = updated
  writeLocal(MAPS_KEY, maps)
  return updated
}

export async function deleteMindMap(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_mind_maps').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(
    MAPS_KEY,
    readLocal<MindMap[]>(MAPS_KEY, []).filter((m) => m.id !== id),
  )
  writeLocal(
    NODES_KEY,
    readLocal<MindNode[]>(NODES_KEY, []).filter((n) => n.mind_map_id !== id),
  )
}

function normalizeMindNode(row: Partial<MindNode> & { id: string }): MindNode {
  const emphasis = row.emphasis
  const safeEmphasis =
    emphasis === 'bold' ||
    emphasis === 'italic' ||
    emphasis === 'bold-italic' ||
    emphasis === 'normal'
      ? emphasis
      : 'normal'
  return {
    id: row.id,
    mind_map_id: row.mind_map_id ?? '',
    parent_id: row.parent_id ?? null,
    title: row.title ?? '',
    notes: row.notes ?? '',
    color: row.color ?? '',
    link_url: row.link_url ?? '',
    emphasis: safeEmphasis,
    position: row.position ?? 0,
    created_at: row.created_at ?? nowIso(),
    updated_at: row.updated_at ?? nowIso(),
  }
}

export function isMindNodeStyleSchemaMissing(err: unknown): boolean {
  const m = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    (m.includes('color') || m.includes('link_url') || m.includes('emphasis')) &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache') ||
      m.includes('pgrst'))
  )
}

export async function listMindNodes(mindMapId: string): Promise<MindNode[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_mind_nodes')
      .select('*')
      .eq('mind_map_id', mindMapId)
      .order('position')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => normalizeMindNode(row as MindNode))
  }
  return readLocal<MindNode[]>(NODES_KEY, [])
    .filter((n) => n.mind_map_id === mindMapId)
    .map((n) => normalizeMindNode(n))
    .sort((a, b) => a.position - b.position)
}

export async function createMindNode(
  mindMapId: string,
  input: {
    parent_id: string | null
    title: string
    notes?: string
    color?: string
    link_url?: string
    emphasis?: MindNode['emphasis']
    /** Insert at this position among siblings; default = append */
    position?: number
  },
): Promise<MindNode> {
  const siblings = (await listMindNodes(mindMapId)).filter(
    (n) => n.parent_id === input.parent_id,
  )
  const insertAt =
    typeof input.position === 'number'
      ? Math.max(0, Math.min(input.position, siblings.length))
      : siblings.length
  const stamp = nowIso()
  const styleFields = {
    color: input.color ?? '',
    link_url: input.link_url ?? '',
    emphasis: input.emphasis ?? ('normal' as const),
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    // Shift siblings at/after insert slot so order stays stable.
    for (const sib of siblings.filter((s) => s.position >= insertAt)) {
      const { error: shiftErr } = await supabase
        .from('crm_mind_nodes')
        .update({ position: sib.position + 1 })
        .eq('id', sib.id)
      if (shiftErr) throw new Error(shiftErr.message)
    }

    const baseRow = {
      mind_map_id: mindMapId,
      parent_id: input.parent_id,
      title: input.title,
      notes: input.notes ?? '',
      position: insertAt,
    }

    let data: MindNode | null = null
    let error: { message: string } | null = null
    ;({ data, error } = await supabase
      .from('crm_mind_nodes')
      .insert({ ...baseRow, ...styleFields })
      .select('*')
      .single())

    if (error && isMindNodeStyleSchemaMissing(error)) {
      ;({ data, error } = await supabase
        .from('crm_mind_nodes')
        .insert(baseRow)
        .select('*')
        .single())
    }
    if (error) throw new Error(error.message)
    await supabase
      .from('crm_mind_maps')
      .update({ updated_at: stamp })
      .eq('id', mindMapId)
    return normalizeMindNode(data as MindNode)
  }

  const all = readLocal<MindNode[]>(NODES_KEY, []).map((n) => {
    if (n.mind_map_id === mindMapId && n.parent_id === input.parent_id && n.position >= insertAt) {
      return { ...n, position: n.position + 1 }
    }
    return n
  })
  const node: MindNode = {
    id: uid(),
    mind_map_id: mindMapId,
    parent_id: input.parent_id,
    title: input.title,
    notes: input.notes ?? '',
    ...styleFields,
    position: insertAt,
    created_at: stamp,
    updated_at: stamp,
  }
  writeLocal(NODES_KEY, [...all, node])
  const maps = readLocal<MindMap[]>(MAPS_KEY, [])
  const idx = maps.findIndex((m) => m.id === mindMapId)
  if (idx >= 0) {
    maps[idx] = { ...maps[idx], updated_at: stamp }
    writeLocal(MAPS_KEY, maps)
  }
  return node
}

export async function updateMindNode(
  id: string,
  input: Partial<
    Pick<
      MindNode,
      'title' | 'notes' | 'parent_id' | 'position' | 'color' | 'link_url' | 'emphasis'
    >
  >,
): Promise<MindNode> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let { data, error } = await supabase
      .from('crm_mind_nodes')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error && isMindNodeStyleSchemaMissing(error)) {
      const { color: _c, link_url: _l, emphasis: _e, ...core } = input
      if (Object.keys(core).length === 0) {
        throw new Error(
          'Mind map style columns missing — run crm_mind_node_style_migration.sql',
        )
      }
      ;({ data, error } = await supabase
        .from('crm_mind_nodes')
        .update(core)
        .eq('id', id)
        .select('*')
        .single())
    }
    if (error) throw new Error(error.message)
    return normalizeMindNode(data as MindNode)
  }
  const nodes = readLocal<MindNode[]>(NODES_KEY, [])
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx < 0) throw new Error('Node not found.')
  const updated: MindNode = normalizeMindNode({
    ...nodes[idx],
    ...input,
    updated_at: nowIso(),
  })
  nodes[idx] = updated
  writeLocal(NODES_KEY, nodes)
  return updated
}

export async function deleteMindNode(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_mind_nodes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  const nodes = readLocal<MindNode[]>(NODES_KEY, [])
  const toRemove = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parent_id && toRemove.has(n.parent_id) && !toRemove.has(n.id)) {
        toRemove.add(n.id)
        grew = true
      }
    }
  }
  writeLocal(
    NODES_KEY,
    nodes.filter((n) => !toRemove.has(n.id)),
  )
}

export const PROJECT_STATUS_VALUES: ProjectStatus[] = [
  'planned',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]

export const TASK_PRIORITY_VALUES: TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
]
