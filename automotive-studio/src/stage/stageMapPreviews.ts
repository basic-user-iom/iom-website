import { idbGetAssetBlob } from '../persistence/localDb'

const previewUrls = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

/** Object URL for a stage image asset — cached until revoked. */
export async function getStageMapPreviewUrl(assetId: string): Promise<string | null> {
  const hit = previewUrls.get(assetId)
  if (hit) return hit
  const pending = inflight.get(assetId)
  if (pending) return pending

  const promise = (async (): Promise<string | null> => {
    try {
      const blob = await idbGetAssetBlob(assetId)
      if (!blob) return null
      // Another caller may have won the race while we awaited.
      const existing = previewUrls.get(assetId)
      if (existing) return existing
      const url = URL.createObjectURL(blob)
      previewUrls.set(assetId, url)
      return url
    } finally {
      inflight.delete(assetId)
    }
  })()
  inflight.set(assetId, promise)
  return promise
}

export function revokeStageMapPreview(assetId: string) {
  const url = previewUrls.get(assetId)
  if (!url) return
  URL.revokeObjectURL(url)
  previewUrls.delete(assetId)
}

export function disposeStageMapPreviews() {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url)
  previewUrls.clear()
  inflight.clear()
}
