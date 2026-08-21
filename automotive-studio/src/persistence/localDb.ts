const DB_NAME = 'iom-automotive-studio'
const DB_VERSION = 2
const PROJECT_STORE = 'projects'
const BLOB_STORE = 'asset-blobs'

/** Soft timeout so a wedged IndexedDB (common after deleteDatabase while a tab is open) fails visibly. */
const IDB_OP_MS = 45_000

function withTimeout<T>(promise: Promise<T>, label: string, ms = IDB_OP_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s. Close other Automotive Studio tabs, then run: indexedDB.deleteDatabase('${DB_NAME}'); location.reload()`,
        ),
      )
    }, ms)
    promise.then(
      (v) => {
        window.clearTimeout(timer)
        resolve(v)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function openDb(): Promise<IDBDatabase> {
  return withTimeout(
    new Promise((resolve, reject) => {
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
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          db.close()
        }
        resolve(db)
      }
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
      req.onblocked = () => {
        console.warn(
          `[automotive-studio] IndexedDB open blocked — close other tabs on this origin, then reload.`,
        )
      }
    }),
    'IndexedDB open',
    20_000,
  )
}

export async function idbSaveProject(projectJson: unknown): Promise<void> {
  const stamped =
    projectJson && typeof projectJson === 'object'
      ? { ...(projectJson as Record<string, unknown>), updatedAt: Date.now() }
      : projectJson
  const db = await openDb()
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PROJECT_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
        tx.objectStore(PROJECT_STORE).put(stamped)
      }),
      'IndexedDB project save',
    )
  } finally {
    db.close()
  }
}

export async function idbLoadProject(id: string): Promise<unknown | null> {
  const db = await openDb()
  try {
    return await withTimeout(
      new Promise<unknown | null>((resolve, reject) => {
        const tx = db.transaction(PROJECT_STORE, 'readonly')
        const req = tx.objectStore(PROJECT_STORE).get(id)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
      }),
      'IndexedDB project load',
    )
  } finally {
    db.close()
  }
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
  let rows: unknown[]
  try {
    rows = await withTimeout(
      new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(PROJECT_STORE, 'readonly')
        const req = tx.objectStore(PROJECT_STORE).getAll()
        req.onsuccess = () => resolve((req.result as unknown[]) ?? [])
        req.onerror = () => reject(req.error ?? new Error('IndexedDB list failed'))
      }),
      'IndexedDB project list',
    )
  } finally {
    db.close()
  }
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
  try {
    return await withTimeout(
      new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE, 'readonly')
        const req = tx.objectStore(BLOB_STORE).getAllKeys()
        req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String))
        req.onerror = () => reject(req.error ?? new Error('IndexedDB blob list failed'))
      }),
      'IndexedDB blob list',
    )
  } finally {
    db.close()
  }
}

export async function idbPutAssetBlob(id: string, blob: Blob, meta?: { filename?: string }): Promise<void> {
  const db = await openDb()
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB blob write failed'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB blob write aborted (quota?)'))
        tx.objectStore(BLOB_STORE).put({
          id,
          blob,
          filename: meta?.filename ?? '',
          updatedAt: Date.now(),
        })
      }),
      `IndexedDB blob save (${meta?.filename || id})`,
      Math.max(IDB_OP_MS, Math.min(180_000, blob.size / 50_000 + 30_000)),
    )
  } finally {
    db.close()
  }
}

export async function idbGetAssetBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  try {
    const result = await withTimeout(
      new Promise<{ blob?: Blob } | null>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE, 'readonly')
        const req = tx.objectStore(BLOB_STORE).get(id)
        req.onsuccess = () => resolve((req.result as { blob?: Blob } | undefined) ?? null)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB blob read failed'))
      }),
      'IndexedDB blob load',
    )
    return result?.blob ?? null
  } finally {
    db.close()
  }
}

export async function idbDeleteAssetBlob(id: string): Promise<void> {
  const db = await openDb()
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(BLOB_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB blob delete failed'))
        tx.objectStore(BLOB_STORE).delete(id)
      }),
      'IndexedDB blob delete',
    )
  } finally {
    db.close()
  }
}

/**
 * Wipe Studio local data. Safe to paste in the console:
 *   await indexedDB.databases?.() // optional
 *   // or call window.__iomResetAutomotiveStudio()
 */
export function idbDeleteStudioDatabase(): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'))
      req.onblocked = () => {
        console.warn(
          `[automotive-studio] deleteDatabase blocked — close every other tab on this site, then retry.`,
        )
      }
    }),
    'IndexedDB deleteDatabase',
    20_000,
  )
}

export { DB_NAME as AUTOMOTIVE_STUDIO_IDB_NAME }
