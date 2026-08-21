export const BASE = '/demos/dukta'
export const LINAR_CONFIGURATOR = '/demos/dukta-linar-concept/'

export const NAV = [
  { id: 'material' as const, href: `${BASE}/#material` },
  { id: 'systems' as const, href: `${BASE}/#systems` },
  { id: 'applications' as const, href: `${BASE}/#applications` },
  { id: 'projects' as const, href: `${BASE}/projects` },
  { id: 'resources' as const, href: `${BASE}/#resources` },
  { id: 'about' as const, href: `${BASE}/#about` },
  { id: 'contact' as const, href: `${BASE}/#contact` },
]

export const CONTACT = {
  company: 'dukta gmbh',
  address: {
    en: ['Eschenhaustrasse 42', 'CH-8053 Zürich', 'Switzerland'],
    de: ['Eschenhaustrasse 42', 'CH-8053 Zürich', 'Schweiz'],
  },
  studio: ['Hermetschloostrasse 70', '8048 Zürich'],
  email: 'info@dukta.com',
  samplesHref: {
    en: 'https://dukta.com/en/products/samples/',
    de: 'https://dukta.com/produkte/muster/',
  },
  people: [
    { name: 'Serge Lunin', phone: '+41 76 527 87 56', email: 's.lunin@dukta.com' },
    { name: 'Pablo Lunin', phone: '+41 79 603 96 00', email: 'p.lunin@dukta.com' },
  ],
} as const

export const QUOTES = {
  en: {
    text: 'From a formal point of view, dukta is convincing because the interplay of width, shape and depth of the cuts as well as the choice of material (…) results in a wide range of possible end products. At the same time, the individual workpieces unfold an aesthetic all of their own.',
    source: 'NZZ Domizil',
  },
  de: {
    text: 'In formaler Hinsicht überzeugt dukta, weil sich durch das Zusammenspiel von Breite, Form und Tiefe der Schnitte sowie durch die Wahl des Materials (…) eine breite Palette von möglichen Endprodukten ergibt. Gleichzeitig entfalten die einzelnen Werkstücke eine ganz eigene Ästhetik.',
    source: 'NZZ Domizil',
  },
} as const
