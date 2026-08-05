const DB_NAME = 'iom-automotive-studio'
const DB_VERSION = 2
const PROJECT_STORE = 'projects'
const BLOB_STORE = 'asset-blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function idbSaveProject(projectJson: unknown): Promise<void> {
  const stamped =
    projectJson && typeof projectJson === 'object'
      ? { ...(projectJson as Record<string, unknown>), updatedAt: Date.now() }
      : projectJson
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    tx.objectStore(PROJECT_STORE).put(stamped)
  })
  db.close()
}

export async function idbLoadProject(id: string): Promise<unknown | null> {
  const db = await openDb()
  const result = await new Promise<unknown | null>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly')
    const req = tx.objectStore(PROJECT_STORE).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
  })
  db.close()
  return result
}

export async function idbListProjectIds(): Promise<string[]> {
  const summaries = await idbListProjectSummaries()
  return summaries.map((s) => s.id)
}

export type ProjectSummary = {
  id: string
  name: string
  updatedAt: number
}

export async function idbListProjectSummaries(): Promise<ProjectSummary[]> {
  const db = await openDb()
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly')
    const req = tx.objectStore(PROJECT_STORE).getAll()
    req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('IndexedDB list failed'))
  })
  db.close()
  return rows
    .map((row) => {
      const r = row as { id?: string; name?: string; updatedAt?: number }
      if (!r?.id) return null
      return {
        id: String(r.id),
        name: String(r.name ?? 'Untitled'),
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
      }
    })
    .filter((s): s is ProjectSummary => Boolean(s))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function idbListAssetBlobIds(): Promise<string[]> {
  const db = await openDb()
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const req = tx.objectStore(BLOB_STORE).getAllKeys()
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String))
    req.onerror = () => reject(req.error ?? new Error('IndexedDB blob list failed'))
  })
  db.close()
  return ids
}

export async function idbPutAssetBlob(id: string, blob: Blob, meta?: { filename?: string }): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB blob write failed'))
    tx.objectStore(BLOB_STORE).put({ id, blob, filename: meta?.filename ?? '', updatedAt: Date.now() })
  })
  db.close()
}

export async function idbGetAssetBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  const result = await new Promise<{ blob?: Blob } | null>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const req = tx.objectStore(BLOB_STORE).get(id)
    req.onsuccess = () => resolve((req.result as { blob?: Blob } | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB blob read failed'))
  })
  db.close()
  return result?.blob ?? null
}

export async function idbDeleteAssetBlob(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB blob delete failed'))
    tx.objectStore(BLOB_STORE).delete(id)
  })
  db.close()
}
