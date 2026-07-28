export function isCaseStudyPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/case-studies' || p.startsWith('/case-studies/')
}
