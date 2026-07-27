export interface Client {
  id: string
  name: string
  /** Short mark shown in the wordmark strip. */
  mark: string
  href: string
  /**
   * Dominant brand color for wordmark hover.
   * Sourced from logo assets and published brand refs (see comments).
   */
  brandColor: string
  /** Optional logo asset under /assets/clients/ */
  logo?: string
}

/** Organizations IOM has worked with on projects. */
export const CLIENTS: Client[] = [
  {
    id: 'rimrock',
    name: 'Rimrock Resort',
    mark: 'Rimrock',
    href: 'https://www.rimrockresort.com/',
    // Emblems Collection / Accor gold (solid gold #B88D5B; logo itself is white)
    brandColor: '#B88D5B',
    logo: '/assets/clients/rimrock.png',
  },
  {
    id: 'weekapaug',
    name: 'Weekapaug Inn',
    mark: 'Weekapaug',
    href: 'https://weekapauginn.com/',
    // Crest wreath green from official logo art (sampled)
    brandColor: '#6B8F24',
    logo: '/assets/clients/weekapaug.png',
  },
  {
    id: 'ucw',
    name: 'University Canada West',
    mark: 'UCW',
    href: 'https://www.ucanwest.ca/',
    // Shield red from UCW logo + site CSS (#B11320 / #C01020)
    brandColor: '#B11320',
    logo: '/assets/clients/ucw.webp',
  },
  {
    id: 'wesgroup',
    name: 'Wesgroup — Brewery District',
    mark: 'Wesgroup',
    href: 'https://wesgroup.ca/brewery-district/',
    // Wesgroup blue from logo + wesgroup.ca CSS (#072AA0)
    brandColor: '#072AA0',
    logo: '/assets/clients/wesgroup.png',
  },
  {
    id: 'veolia',
    name: 'Veolia',
    mark: 'Veolia',
    href: 'https://www.veolia.com/en',
    // Veolia primary red — graphic charter Pantone 485 / #FF0000
    brandColor: '#FF0000',
    logo: '/assets/clients/veolia.svg',
  },
  {
    id: 'aggreko',
    name: 'Aggreko',
    mark: 'Aggreko',
    href: 'https://www.aggreko.com/en-gb?country=GB',
    // Signature “Always Orange” equipment / brand orange
    brandColor: '#FF6600',
    logo: '/assets/clients/aggreko.svg',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    mark: 'Facebook',
    href: 'https://www.facebook.com/',
    // Official Facebook Blue (logo SVG + brand guidelines)
    brandColor: '#1877F2',
    logo: '/assets/clients/facebook.svg',
  },
  {
    id: 'messe-muenchen',
    name: 'Locations of Messe München',
    mark: 'Messe München',
    href: 'https://locations.messe-muenchen.de/en/',
    // Official Dunkelblau from MMW_Logo_quer_Dunkelblau_RGB.svg (#112072)
    brandColor: '#112072',
    logo: '/assets/clients/messe-muenchen.svg',
  },
]
