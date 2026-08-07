/** Path helper only — keep free of blog markdown / post catalog. */

export function isBlogPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/blog' || p.startsWith('/blog/')
}
