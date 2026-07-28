const BASE = '/tools/image-prep'

export function isImagePrepPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === BASE
}

export const IMAGE_PREP_BASE = BASE
