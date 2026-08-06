export function isProjectCostsPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/project-costs'
}

/** Legacy client link — keep working after rename from /start. */
export function isLegacyStartPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/start'
}
