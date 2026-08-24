export type FontPairingId = 'editorial' | 'official' | 'atelier' | 'technical' | 'iom'

export type FontPairing = {
  id: FontPairingId
  /** Stable proper name shown in the switcher (not translated). */
  label: string
  /** Short EN hint for recommendation notes / title attributes. */
  note: string
  display: string
  sans: string
  serif: string
  /** Google Fonts family query segment, or null when self-hosted / system. */
  google: string | null
}

/**
 * Curated dukta demo pairings (license-safe: Google Fonts or already in /fonts).
 * dukta.com itself uses Open Sans (Google) for body + UI; Lato only on form controls.
 */
export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'editorial',
    label: 'Fraunces · Source Sans 3',
    note: 'Editorial Swiss — recommended default for client pitch',
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    sans: "'Source Sans 3', Helvetica, Arial, sans-serif",
    serif: "'Fraunces', Georgia, 'Times New Roman', serif",
    google: 'Fraunces:wght@500;600;700&family=Source+Sans+3:wght@400;500;600',
  },
  {
    id: 'official',
    label: 'Open Sans',
    note: 'Closest to dukta.com (Open Sans)',
    display: "'Open Sans', Helvetica, Arial, sans-serif",
    sans: "'Open Sans', Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    google: 'Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400;1,700',
  },
  {
    id: 'atelier',
    label: 'Cormorant · Outfit',
    note: 'Atelier / architectural serif + clean sans',
    display: "'Cormorant Garamond', Georgia, serif",
    sans: "'Outfit', Helvetica, Arial, sans-serif",
    serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    google: 'Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@400;500;600',
  },
  {
    id: 'technical',
    label: 'Space Grotesk · IBM Plex',
    note: 'Technical / industrial',
    display: "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    sans: "'IBM Plex Sans', Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    google: 'Space+Grotesk:wght@400;500;600;700',
  },
  {
    id: 'iom',
    label: 'Syne · IBM Plex (IOM)',
    note: 'Current IOM website pairing — for comparison',
    display: "'Syne', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    sans: "'IBM Plex Sans', Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    google: null,
  },
]

export const DEFAULT_FONT_PAIRING: FontPairingId = 'editorial'

export const FONT_STORAGE_KEY = 'dukta-font'

const PAIRING_IDS = new Set<string>(FONT_PAIRINGS.map((p) => p.id))

export function isFontPairingId(value: string | null | undefined): value is FontPairingId {
  return Boolean(value && PAIRING_IDS.has(value))
}

export function getFontPairing(id: FontPairingId): FontPairing {
  return FONT_PAIRINGS.find((p) => p.id === id) ?? FONT_PAIRINGS[0]
}

export function detectFontPairing(): FontPairingId {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('font')
    if (isFontPairingId(fromQuery)) return fromQuery
    const stored = localStorage.getItem(FONT_STORAGE_KEY)
    if (isFontPairingId(stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT_PAIRING
}

export function persistFontPairing(id: FontPairingId) {
  try {
    localStorage.setItem(FONT_STORAGE_KEY, id)
    const url = new URL(window.location.href)
    url.searchParams.set('font', id)
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* ignore */
  }
  applyFontPairing(id)
}

const GOOGLE_LINK_ID = 'dk-font-google'

export function ensureGoogleFonts(pairing: FontPairing) {
  if (!pairing.google || typeof document === 'undefined') return

  let link = document.getElementById(GOOGLE_LINK_ID) as HTMLLinkElement | null
  if (!link) {
    if (!document.querySelector('link[data-dk-font-preconnect="googleapis"]')) {
      const preconnect1 = document.createElement('link')
      preconnect1.rel = 'preconnect'
      preconnect1.href = 'https://fonts.googleapis.com'
      preconnect1.setAttribute('data-dk-font-preconnect', 'googleapis')
      document.head.appendChild(preconnect1)

      const preconnect2 = document.createElement('link')
      preconnect2.rel = 'preconnect'
      preconnect2.href = 'https://fonts.gstatic.com'
      preconnect2.crossOrigin = 'anonymous'
      preconnect2.setAttribute('data-dk-font-preconnect', 'gstatic')
      document.head.appendChild(preconnect2)
    }

    link = document.createElement('link')
    link.id = GOOGLE_LINK_ID
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }

  const href = `https://fonts.googleapis.com/css2?family=${pairing.google}&display=swap`
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

export function applyFontPairing(id: FontPairingId) {
  if (typeof document === 'undefined') return
  const pairing = getFontPairing(id)
  document.documentElement.setAttribute('data-font', id)
  ensureGoogleFonts(pairing)
}
