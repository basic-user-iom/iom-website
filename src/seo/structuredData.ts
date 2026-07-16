import { PROJECTS, SECTIONS } from '../data/projects'
import {
  CONTACT_EMAIL,
  DEFAULT_DESCRIPTION,
  SAME_AS,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_SHORT_NAME,
} from './siteConfig'
import { absoluteUrl } from './pageMeta'

/** Organization + WebSite JSON-LD for the homepage. */
export function buildHomeStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: SITE_SHORT_NAME,
        legalName: SITE_NAME,
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/favicon.png`,
        email: CONTACT_EMAIL,
        sameAs: SAME_AS,
        description: DEFAULT_DESCRIPTION,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_ORIGIN}/#work-sections`,
        name: 'IOM portfolio sections',
        itemListElement: SECTIONS.map((section, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: section.label,
          description: section.blurb,
          url: `${SITE_ORIGIN}/#${section.id}`,
        })),
      },
    ],
  }
}

/** Featured public projects as CreativeWork entries. */
export function buildFeaturedProjectsStructuredData(): Record<string, unknown> {
  const featured = PROJECTS.filter(
    (p) => p.featured || (p.url && (p.url.startsWith('/') || p.url.includes('iobjectm.com'))),
  ).slice(0, 12)

  return {
    '@context': 'https://schema.org',
    '@graph': featured.map((project) => {
      const url = project.url
        ? project.url.startsWith('http')
          ? project.url
          : absoluteUrl(project.url)
        : `${SITE_ORIGIN}/#${project.section}`

      return {
        '@type': 'SoftwareApplication',
        name: project.title,
        description: project.description,
        url,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        keywords: project.tags.join(', '),
        datePublished: project.year,
      }
    }),
  }
}

export function structuredDataScripts(pathname: string): Record<string, unknown>[] {
  if (pathname !== '/' && pathname !== '') return []
  return [buildHomeStructuredData(), buildFeaturedProjectsStructuredData()]
}
