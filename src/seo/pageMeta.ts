import {
  CONTACT_EMAIL,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_ORIGIN,
} from './siteConfig'
import type { PageMeta } from './types'

function normalizePath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  return p.startsWith('/') ? p : `/${p}`
}

export function pageMetaForPath(pathname: string): PageMeta {
  const path = normalizePath(pathname)

  if (path === '/client-login' || path === '/crm-demo') {
    return {
      title: `${SITE_NAME} — Client Login`,
      description: 'Private client workspace for IOM lead management.',
      canonical: `${SITE_ORIGIN}${path}`,
      robots: 'noindex, nofollow',
    }
  }

  if (path === '/artist-globe') {
    return {
      title: `${SITE_NAME} — Artist Globe`,
      description:
        'Interactive WebGL artist globe — explore photographers, painters, sculptors, and sound artists on a living map. Filter by practice, open portfolios, and submit a profile for review.',
      canonical: `${SITE_ORIGIN}/artist-globe`,
      ogImage: `${SITE_ORIGIN}/assets/posters/artist-globe.jpg`,
      keywords: [
        'artist globe',
        'WebGL globe',
        'interactive artist map',
        'Three.js globe',
        'artist portfolio map',
        'photographer map',
      ],
    }
  }

  if (path.startsWith('/artist-globe/')) {
    const privateRoute =
      path.startsWith('/artist-globe/admin') ||
      path.startsWith('/artist-globe/me') ||
      path.startsWith('/artist-globe/invite')
    return {
      title: `${SITE_NAME} — Artist Globe`,
      description:
        'Interactive WebGL artist globe — explore photographers, painters, sculptors, and sound artists on a living map.',
      canonical: `${SITE_ORIGIN}/artist-globe`,
      ogImage: `${SITE_ORIGIN}/assets/posters/artist-globe.jpg`,
      robots: privateRoute ? 'noindex, nofollow' : 'index, follow',
    }
  }

  if (path === '/') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonical: `${SITE_ORIGIN}/`,
      ogImage: DEFAULT_OG_IMAGE,
      keywords: [
        'interactive object media',
        '3D viewer',
        '360 tour',
        'WebGPU',
        'Three.js studio',
      ],
    }
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical: `${SITE_ORIGIN}${path}`,
    ogImage: DEFAULT_OG_IMAGE,
  }
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_ORIGIN}${path}`
}

export { CONTACT_EMAIL, DEFAULT_OG_IMAGE, SITE_ORIGIN, SITE_NAME }
