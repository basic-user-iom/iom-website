export function isArtistGlobePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/artist-globe' || p.startsWith('/artist-globe/')
}
