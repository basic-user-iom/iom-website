import { isImagePath } from './archiveIo'

export type PathedFile = {
  file: File
  relativePath: string
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function joinPath(dir: string, name: string): string {
  const d = normalizePath(dir)
  return d ? `${d}/${name}` : name
}

/** Recursively read a FileSystemDirectoryEntry into image files. */
async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  prefix: string,
): Promise<PathedFile[]> {
  const reader = entry.createReader()
  const out: PathedFile[] = []

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

  // Chrome returns batches; keep reading until empty
  for (;;) {
    const batch = await readBatch()
    if (!batch.length) break
    for (const child of batch) {
      const path = joinPath(prefix, child.name)
      if (child.isFile) {
        if (!isImagePath(path)) continue
        const file = await new Promise<File>((resolve, reject) => {
          ;(child as FileSystemFileEntry).file(resolve, reject)
        })
        out.push({ file, relativePath: path })
      } else if (child.isDirectory) {
        out.push(...(await readDirectoryEntry(child as FileSystemDirectoryEntry, path)))
      }
    }
  }

  return out
}

async function readFileEntry(entry: FileSystemFileEntry, prefix: string): Promise<PathedFile | null> {
  const path = joinPath(prefix, entry.name)
  if (!isImagePath(path)) return null
  const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject))
  return { file, relativePath: path }
}

/**
 * Collect images from a drag-drop DataTransfer (supports nested folders).
 * Falls back to FileList when entry API is unavailable.
 */
export async function collectImagesFromDataTransfer(dt: DataTransfer): Promise<{
  images: PathedFile[]
  archives: File[]
}> {
  const images: PathedFile[] = []
  const archives: File[] = []
  const items = Array.from(dt.items || [])

  if (items.length && items.some((i) => typeof i.webkitGetAsEntry === 'function')) {
    for (const item of items) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()
      if (!entry) {
        const f = item.getAsFile()
        if (!f) continue
        if (/\.(zip|rar)$/i.test(f.name)) archives.push(f)
        else if (isImagePath(f.name)) images.push({ file: f, relativePath: f.name })
        continue
      }
      if (entry.isDirectory) {
        images.push(...(await readDirectoryEntry(entry as FileSystemDirectoryEntry, entry.name)))
      } else if (entry.isFile) {
        const name = entry.name
        if (/\.(zip|rar)$/i.test(name)) {
          const f = item.getAsFile()
          if (f) archives.push(f)
        } else {
          const hit = await readFileEntry(entry as FileSystemFileEntry, '')
          if (hit) images.push(hit)
        }
      }
    }
    return { images, archives }
  }

  for (const file of Array.from(dt.files || [])) {
    if (/\.(zip|rar)$/i.test(file.name)) archives.push(file)
    else if (isImagePath(file.name) || file.type.startsWith('image/')) {
      const rel =
        'webkitRelativePath' in file && (file as File & { webkitRelativePath?: string }).webkitRelativePath
          ? (file as File & { webkitRelativePath: string }).webkitRelativePath
          : file.name
      images.push({ file, relativePath: normalizePath(rel) })
    }
  }

  return { images, archives }
}

/** Files picked via `<input webkitdirectory>`. */
export function collectImagesFromFileList(fileList: FileList | File[]): PathedFile[] {
  const out: PathedFile[] = []
  for (const file of Array.from(fileList)) {
    const rel =
      'webkitRelativePath' in file && (file as File & { webkitRelativePath?: string }).webkitRelativePath
        ? (file as File & { webkitRelativePath: string }).webkitRelativePath
        : file.name
    const relativePath = normalizePath(rel || file.name)
    if (!isImagePath(relativePath) && !file.type.startsWith('image/')) continue
    out.push({ file, relativePath: relativePath || file.name })
  }
  return out
}
