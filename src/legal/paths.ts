const LEGAL_PATHS = new Set(['/privacy', '/terms', '/cookies'])

export function isLegalPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return LEGAL_PATHS.has(p)
}
