/**
 * CRM lead tags — suggested taxonomy + helpers.
 *
 * Tags are freeform (custom allowed). Prefer lowercase kebab-case for presets
 * so ChatGPT / filters stay consistent.
 */

export const SUGGESTED_LEAD_TAGS = [
  // Vertical
  'museum',
  'heritage',
  'science-center',
  'exhibition',
  'brand',
  'agency',
  'education',
  'entertainment',
  'architecture',
  'civic',
  'furniture',
  'product-design',
  'outdoor',
  'lighting',
  'craft',
  'fashion',
  'hospitality',
  'retail',
  // Capability / offer fit
  'immersive',
  'ar-vr',
  'interactive',
  '360-tour',
  'photogrammetry',
  'webgl',
  'webgpu',
  'web-ar',
  '3d-viewer',
  'installation',
  'realtime',
  'multitouch',
  'creative-coding',
  'configurator',
  // Relationship
  'partnership',
  'production-partner',
  'direct-client',
  'overflow',
  // Geography
  'netherlands',
  'belgium',
  'germany',
  'uk',
  'canada',
  'eu',
  'usa',
  // Priority signal
  'high-priority',
] as const

export type SuggestedLeadTag = (typeof SUGGESTED_LEAD_TAGS)[number]

const SUGGESTED_SET = new Set<string>(SUGGESTED_LEAD_TAGS)

/** Max length per tag (storage / UI). */
export const LEAD_TAG_MAX_LEN = 40
/** Soft cap so cards stay readable. */
export const LEAD_TAGS_MAX = 12

/** Known companies from CRM imports → starter tags (analysed from company_focus). */
export const KNOWN_LEAD_TAGS: Record<string, string[]> = {
  'capitola digital b.v.': [
    'immersive',
    'ar-vr',
    'agency',
    'partnership',
    'netherlands',
    'eu',
    'high-priority',
  ],
  capitola: ['immersive', 'ar-vr', 'agency', 'partnership', 'netherlands', 'eu'],
  yipp: ['museum', 'heritage', 'education', 'interactive', 'netherlands', 'eu', 'high-priority'],
  'studio louter': ['immersive', 'museum', 'brand', 'exhibition', 'netherlands', 'eu'],
  'wonderment by design': [
    'museum',
    'science-center',
    'interactive',
    'netherlands',
    'eu',
  ],
  'kiss the frog': ['immersive', 'art', 'installation', 'museum', 'netherlands', 'eu'],
  'dropstuff media bv': ['immersive', 'museum', 'installation', 'netherlands', 'eu'],
  dropstuff: ['immersive', 'museum', 'installation', 'netherlands', 'eu'],
  'invr.space gmbh': ['immersive', 'ar-vr', 'germany', 'eu'],
  'invr.space': ['immersive', 'ar-vr', 'germany', 'eu'],
  'ocular bv': ['interactive', 'creative-coding', 'realtime', 'belgium', 'eu'],
  ocular: ['interactive', 'creative-coding', 'realtime', 'belgium', 'eu'],
  rndr: ['creative-coding', 'realtime', 'installation', 'netherlands', 'eu'],
  bluecadet: ['museum', 'exhibition', 'interactive', 'usa'],
  ideum: ['museum', 'interactive', 'multitouch', 'usa'],
  'cortina productions': ['museum', 'ar-vr', 'interactive', 'usa'],
  'local projects': ['museum', 'exhibition', 'brand', 'usa'],
  'unified field': ['museum', 'exhibition', 'interactive', 'usa'],
  rlmg: ['museum', 'exhibition', 'usa'],
  'trivium interactive': ['interactive', 'museum', 'usa'],
  luci: ['brand', 'immersive', 'usa'],
  hyperquake: ['brand', 'agency', 'usa'],
  'c&g partners': ['exhibition', 'brand', 'usa'],
  hush: ['immersive', 'brand', 'installation', 'usa'],
  'brc imagination arts': ['entertainment', 'immersive', 'usa'],
  'g&a': ['exhibition', 'museum', 'usa'],
  'de-yan': ['brand', 'immersive', 'usa'],
  artishock: ['immersive', 'interactive', 'netherlands', 'eu'],
}

const KEYWORD_TAG_RULES: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /\bmuseum|musea|heritage|cultural institution/i, tags: ['museum', 'heritage'] },
  { pattern: /\bscience\s*cent(er|re)|planetarium/i, tags: ['science-center', 'education'] },
  { pattern: /\bexhibition|exhibit\b|visitor experience/i, tags: ['exhibition'] },
  { pattern: /\bbrand experience|branded|marketing agency/i, tags: ['brand'] },
  {
    pattern: /\bagency\b|design studio|creative studio|media studio|atelier/i,
    tags: ['agency'],
  },
  { pattern: /\beducation|learning|school/i, tags: ['education'] },
  { pattern: /\btheme\s*park|entertainment|attraction/i, tags: ['entertainment'] },
  { pattern: /\barchitect(?:ure|ural)?\b|\baec\b|real\s*estate/i, tags: ['architecture'] },
  { pattern: /\bcivic|municipal/i, tags: ['civic'] },
  {
    pattern: /\bfurniture|softblock|paper\s*soft|spatial\s*product/i,
    tags: ['furniture', 'product-design'],
  },
  {
    pattern: /\boutdoor|camping|sleeping\s*bag|backpack|hiking|outdoor\s*gear/i,
    tags: ['outdoor', 'product-design'],
  },
  {
    pattern: /\blighting design|lighting studio|\blamps?\b|lantern|illuminat/i,
    tags: ['lighting', 'product-design'],
  },
  {
    pattern: /\bcraft|handmade|artisan|hat\s*block|scissors|cutlery|steelware/i,
    tags: ['craft', 'product-design'],
  },
  { pattern: /\bfashion|apparel|wearable|textile/i, tags: ['fashion', 'product-design'] },
  {
    pattern: /\bhospitality|hotel|restaurant|cafe|barista|coffee/i,
    tags: ['hospitality', 'retail'],
  },
  { pattern: /\bretail|e-?commerce/i, tags: ['retail'] },
  {
    pattern: /\bproduct\s*design|industrial\s*design|configurator|3d\s*product/i,
    tags: ['product-design', 'configurator'],
  },
  { pattern: /\bimmersive|\bxr\b/i, tags: ['immersive'] },
  {
    pattern: /\b(?:\bar\b|\bvr\b)|augmented reality|virtual reality/i,
    tags: ['ar-vr'],
  },
  { pattern: /\binteractive\b/i, tags: ['interactive'] },
  { pattern: /\b360|panorama|virtual tour/i, tags: ['360-tour'] },
  { pattern: /\bphotogrammetr/i, tags: ['photogrammetry'] },
  { pattern: /\bwebgpu\b/i, tags: ['webgpu', 'webgl'] },
  { pattern: /\bwebgl\b|three\.?js\b/i, tags: ['webgl'] },
  { pattern: /\bwebar\b|web-?ar\b/i, tags: ['web-ar'] },
  { pattern: /\b3d\s*viewer|iom\s*viewer/i, tags: ['3d-viewer'] },
  { pattern: /\binstallation|public art/i, tags: ['installation'] },
  { pattern: /\breal-?time|\brealtime\b/i, tags: ['realtime'] },
  { pattern: /\bmultitouch|touch\s*table|kiosk/i, tags: ['multitouch'] },
  { pattern: /\bcreative\s*cod|generative/i, tags: ['creative-coding'] },
  { pattern: /\bconfigurator/i, tags: ['configurator'] },
  {
    pattern: /\bpartner(ship)?|overflow|production\s+support/i,
    tags: ['partnership', 'production-partner'],
  },
  { pattern: /\bdirect\s*client|end\s*client|manufacturer/i, tags: ['direct-client'] },
  {
    pattern: /\bnetherlands|amsterdam|rotterdam|utrecht|\bdutch\b/i,
    tags: ['netherlands', 'eu'],
  },
  { pattern: /\bbelgium|brussels|antwerp|ghent/i, tags: ['belgium', 'eu'] },
  { pattern: /\bgermany|berlin|munich|hamburg|frankfurt/i, tags: ['germany', 'eu'] },
  {
    pattern: /\bunited\s*kingdom|\buk\b|england|london|scotland|wales|britain/i,
    tags: ['uk', 'eu'],
  },
  { pattern: /\bcanada|vancouver|toronto|montreal|ottawa/i, tags: ['canada'] },
  {
    pattern: /\bunited states|\busa\b|\bu\.s\.a?\b|new york|los angeles|san francisco|chicago/i,
    tags: ['usa'],
  },
]

export function normalizeLeadTag(raw: unknown): string {
  if (raw == null) return ''
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._+/-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, LEAD_TAG_MAX_LEN)
}

export function normalizeLeadTags(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? raw.split(/[,;]+/)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const tag = normalizeLeadTag(item)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= LEAD_TAGS_MAX) break
  }
  return out
}

export function isSuggestedLeadTag(tag: string): boolean {
  return SUGGESTED_SET.has(normalizeLeadTag(tag))
}

function companyKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Exact / alias lookup from researched import list. */
export function tagsForKnownCompany(companyName: string): string[] {
  const key = companyKey(companyName)
  if (!key) return []
  if (KNOWN_LEAD_TAGS[key]) return [...KNOWN_LEAD_TAGS[key]]
  for (const [alias, tags] of Object.entries(KNOWN_LEAD_TAGS)) {
    if (key.includes(alias) || alias.includes(key)) return [...tags]
  }
  return []
}

export interface LeadTagSource {
  company_name?: string
  company_focus?: string
  offer?: string
  notes?: string
  client_country?: string
  client_city?: string
}

/**
 * Suggest tags from known company map + keyword scan of focus/offer/notes/geo.
 * Does not invent contact data — only labels for filtering.
 */
export function suggestLeadTags(source: LeadTagSource, existing: string[] = []): string[] {
  const merged = new Set(normalizeLeadTags(existing))
  for (const tag of tagsForKnownCompany(source.company_name ?? '')) {
    merged.add(tag)
  }
  const hay = [
    source.company_name,
    source.company_focus,
    source.offer,
    source.notes,
    source.client_city,
    source.client_country,
  ]
    .filter(Boolean)
    .join('\n')
  for (const rule of KEYWORD_TAG_RULES) {
    if (rule.pattern.test(hay)) {
      for (const tag of rule.tags) merged.add(normalizeLeadTag(tag))
    }
  }
  const country = (source.client_country ?? '').toLowerCase()
  if (country.includes('nether')) {
    merged.add('netherlands')
    merged.add('eu')
  } else if (country.includes('belg')) {
    merged.add('belgium')
    merged.add('eu')
  } else if (country.includes('german')) {
    merged.add('germany')
    merged.add('eu')
  } else if (
    country.includes('united kingdom') ||
    country === 'uk' ||
    country.includes('england') ||
    country.includes('scotland') ||
    country.includes('wales')
  ) {
    merged.add('uk')
    merged.add('eu')
  } else if (country.includes('canada')) {
    merged.add('canada')
  } else if (
    country.includes('united states') ||
    country === 'usa' ||
    country === 'us'
  ) {
    merged.add('usa')
  } else if (
    country.includes('serbia') ||
    country.includes('france') ||
    country.includes('italy') ||
    country.includes('spain') ||
    country.includes('austria') ||
    country.includes('switzerland') ||
    country.includes('sweden') ||
    country.includes('norway') ||
    country.includes('denmark') ||
    country.includes('finland') ||
    country.includes('portugal') ||
    country.includes('poland') ||
    country.includes('ireland')
  ) {
    merged.add('eu')
  }
  return normalizeLeadTags([...merged])
}

/** Text for ChatGPT prompt — how to pick / invent tags. */
export function leadTagsPromptGuide(): string {
  const presets = SUGGESTED_LEAD_TAGS.join(', ')
  return `tags: string[] of short lowercase kebab-case labels (max ${LEAD_TAGS_MAX}).
Prefer from this IOM CRM vocabulary when they fit: ${presets}.
If none of the presets fit the firm, invent 2–5 specific custom tags (still kebab-case) that describe industry, offer-fit, geography, and relationship (e.g. "marine-museum", "trade-show-booth", "nordics", "reseller").
Always include at least one industry/vertical tag and one geography tag when known.
Do not leave tags as [] when company_focus or location is known — assign the best available labels.
Custom tags are allowed and encouraged when the firm does not match the vocabulary.`
}
