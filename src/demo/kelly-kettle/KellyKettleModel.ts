import { createProceduralKettle } from './createProceduralKettle'
import type { KellyKettleModelHandle, QualityLevel } from './types'

export async function createKellyKettleModel(options: {
  quality: QualityLevel
}): Promise<KellyKettleModelHandle> {
  return createProceduralKettle(options.quality)
}
