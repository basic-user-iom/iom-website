export function isRecordingSharePath(path: string): boolean {
  return /^\/r\/[^/]+$/.test(path.replace(/\/+$/, '') || '/')
}

export function recordingSlugFromPath(path: string): string | null {
  const m = /^\/r\/([^/]+)$/.exec(path.replace(/\/+$/, '') || '/')
  return m ? decodeURIComponent(m[1]) : null
}
