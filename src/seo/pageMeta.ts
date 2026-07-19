import { BLOG_PUBLIC_ENABLED } from '../blog/publicFlags'
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

  if (path.startsWith('/r/')) {
    return {
      title: `${SITE_NAME} — Shared media`,
      description: 'Password-protected shared screen recording or screenshot.',
      canonical: `${SITE_ORIGIN}${path}`,
      robots: 'noindex, nofollow',
    }
  }

  if (path === '/demo/icm' || path.startsWith('/demo/icm/')) {
    return {
      title: 'ICM — Private preview',
      description: 'Password-protected client demo for ICM photography and film portfolio.',
      canonical: `${SITE_ORIGIN}/demo/icm`,
      robots: 'noindex, nofollow',
    }
  }

  if (path === '/tools/image-prep') {
    return {
      title: `${SITE_NAME} — Image prep`,
      description:
        'Resize, compress, and strip EXIF from photos in your browser — for portfolio and client demo delivery.',
      canonical: `${SITE_ORIGIN}/tools/image-prep`,
      robots: 'index, follow',
      keywords: ['image resize', 'EXIF strip', 'compress photos', 'web image prep'],
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

  if (path === '/blog' || path.startsWith('/blog/')) {
    const isVerify = path === '/blog/verify'
    const isPost = path.startsWith('/blog/') && !isVerify
    return {
      title: isVerify ? `${SITE_NAME} — Confirm comment` : `${SITE_NAME} — Blog`,
      description: isVerify
        ? 'Confirm your email to submit a blog comment.'
        : BLOG_PUBLIC_ENABLED
          ? 'Case studies and immersive media notes from Interactive Object Media — WebGPU, Three.js, 360° tours, and experiments.'
          : 'IOM Journal is coming soon — case studies and immersive media notes from Interactive Object Media.',
      canonical: isPost ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}/blog`,
      robots: isVerify
        ? 'noindex, nofollow'
        : BLOG_PUBLIC_ENABLED || path === '/blog'
          ? 'index, follow'
          : 'noindex, nofollow',
      keywords: BLOG_PUBLIC_ENABLED
        ? ['IOM blog', 'immersive media', 'WebGPU', 'Three.js', '360 tour']
        : ['IOM blog', 'immersive media', 'coming soon'],
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
