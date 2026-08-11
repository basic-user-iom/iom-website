/**
 * Backfill crm_leads.tags from existing CRM text (focus / offer / notes / geo).
 *
 * Usage (staff session):
 *   node scripts/backfill-crm-lead-tags.mjs --token "<access_token>"
 *   node scripts/backfill-crm-lead-tags.mjs --token "<access_token>" --dry-run
 *
 * Or env:
 *   CRM_ACCESS_TOKEN=... node scripts/backfill-crm-lead-tags.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dryRun = process.argv.includes('--dry-run')

const LEAD_TAGS_MAX = 12
const LEAD_TAG_MAX_LEN = 40

const KNOWN_LEAD_TAGS = {
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
  'wonderment by design': ['museum', 'science-center', 'interactive', 'netherlands', 'eu'],
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
  artishock: ['immersive', 'interactive', 'netherlands', 'eu'],
  molo: ['furniture', 'product-design', 'architecture', 'canada'],
  'paper softblock': ['furniture', 'product-design', 'architecture'],
  zenbivy: ['outdoor', 'product-design', 'usa'],
  'durston gear': ['outdoor', 'product-design', 'uk', 'eu'],
  'guy morse-brown': ['craft', 'product-design', 'uk', 'eu'],
  'bright white': ['lighting', 'product-design', 'uk', 'eu'],
  'tom raffield': ['lighting', 'craft', 'product-design', 'uk', 'eu'],
  '9barista': ['hospitality', 'product-design', 'retail', 'uk', 'eu'],
  'ernest wright': ['craft', 'product-design', 'uk', 'eu'],
}

const KEYWORD_TAG_RULES = [
  { pattern: /\bmuseum|musea|heritage|cultural institution/i, tags: ['museum', 'heritage'] },
  { pattern: /\bscience\s*cent(er|re)|planetarium/i, tags: ['science-center', 'education'] },
  { pattern: /\bexhibition|exhibit\b|visitor experience/i, tags: ['exhibition'] },
  { pattern: /\bbrand experience|branded|marketing agency/i, tags: ['brand'] },
  { pattern: /\bagency\b|studio\b|atelier/i, tags: ['agency'] },
  { pattern: /\beducation|learning|school/i, tags: ['education'] },
  { pattern: /\btheme\s*park|entertainment|attraction/i, tags: ['entertainment'] },
  { pattern: /\barchitect|aec\b|real\s*estate/i, tags: ['architecture'] },
  { pattern: /\bcivic|municipal/i, tags: ['civic'] },
  {
    pattern: /\bfurniture|softblock|paper\s*soft|sofa|chair|spatial\s*product/i,
    tags: ['furniture', 'product-design'],
  },
  {
    pattern: /\boutdoor|camping|sleeping\s*bag|backpack|hiking|gear\b|tent\b/i,
    tags: ['outdoor', 'product-design'],
  },
  { pattern: /\blighting|lamp\b|lantern|illuminat/i, tags: ['lighting', 'product-design'] },
  {
    pattern: /\bcraft|handmade|artisan|hat\s*block|scissors|cutlery|steelware/i,
    tags: ['craft', 'product-design'],
  },
  { pattern: /\bfashion|apparel|wearable|textile/i, tags: ['fashion', 'product-design'] },
  {
    pattern: /\bhospitality|hotel|restaurant|cafe|barista|coffee/i,
    tags: ['hospitality', 'retail'],
  },
  { pattern: /\bretail|e-?commerce|shop\b|store\b/i, tags: ['retail'] },
  {
    pattern: /\bproduct\s*design|industrial\s*design|configurator|3d\s*product/i,
    tags: ['product-design', 'configurator'],
  },
  { pattern: /\bimmersive|xr\b/i, tags: ['immersive'] },
  { pattern: /\b(?:ar|vr)\b|augmented reality|virtual reality/i, tags: ['ar-vr'] },
  { pattern: /\binteractive\b/i, tags: ['interactive'] },
  { pattern: /\b360|panorama|virtual tour/i, tags: ['360-tour'] },
  { pattern: /\bphotogrammetr/i, tags: ['photogrammetry'] },
  { pattern: /\bwebgpu\b/i, tags: ['webgpu', 'webgl'] },
  { pattern: /\bwebgl|three\.?js\b/i, tags: ['webgl'] },
  { pattern: /\bwebar|web-?ar\b/i, tags: ['web-ar'] },
  { pattern: /\b3d\s*viewer|iom\s*viewer/i, tags: ['3d-viewer'] },
  { pattern: /\binstallation|public art/i, tags: ['installation'] },
  { pattern: /\breal-?time|realtime/i, tags: ['realtime'] },
  { pattern: /\bmultitouch|touch\s*table|kiosk/i, tags: ['multitouch'] },
  { pattern: /\bcreative\s*cod|generative/i, tags: ['creative-coding'] },
  { pattern: /\bconfigurator/i, tags: ['configurator'] },
  {
    pattern: /\bpartner(ship)?|overflow|production\s+support/i,
    tags: ['partnership', 'production-partner'],
  },
  { pattern: /\bdirect\s*client|end\s*client|manufacturer/i, tags: ['direct-client'] },
  { pattern: /\bnetherlands|amsterdam|dutch|\bnl\b/i, tags: ['netherlands', 'eu'] },
  { pattern: /\bbelgium|brussels|antwerp|\bbe\b/i, tags: ['belgium', 'eu'] },
  { pattern: /\bgermany|berlin|munich|\bde\b/i, tags: ['germany', 'eu'] },
  {
    pattern: /\bunited\s*kingdom|\buk\b|england|london|scotland|wales/i,
    tags: ['uk', 'eu'],
  },
  { pattern: /\bcanada|vancouver|toronto|montreal/i, tags: ['canada'] },
  { pattern: /\beurope|eu\b/i, tags: ['eu'] },
  {
    pattern: /\bunited states|\busa\b|\bu\.s\.|new york|los angeles|san francisco/i,
    tags: ['usa'],
  },
]

function loadEnv() {
  const out = {}
  for (const name of ['.env', '.env.local']) {
    const envPath = path.join(root, name)
    if (!fs.existsSync(envPath)) continue
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      const val = line.slice(i + 1).trim()
      if (!(key in out)) out[key] = val
    }
  }
  return out
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx < 0) return ''
  return String(process.argv[idx + 1] ?? '').trim()
}

function normalizeLeadTag(raw) {
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

function normalizeLeadTags(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? raw.split(/[,;]+/)
      : []
  const out = []
  const seen = new Set()
  for (const item of list) {
    const tag = normalizeLeadTag(item)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= LEAD_TAGS_MAX) break
  }
  return out
}

function tagsForKnownCompany(companyName) {
  const key = String(companyName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  if (!key) return []
  if (KNOWN_LEAD_TAGS[key]) return [...KNOWN_LEAD_TAGS[key]]
  for (const [alias, tags] of Object.entries(KNOWN_LEAD_TAGS)) {
    if (key.includes(alias) || alias.includes(key)) return [...tags]
  }
  return []
}

function suggestLeadTags(source, existing = []) {
  const merged = new Set(normalizeLeadTags(existing))
  for (const tag of tagsForKnownCompany(source.company_name ?? '')) merged.add(tag)
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
  const country = String(source.client_country ?? '').toLowerCase()
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
    /serbia|france|italy|spain|austria|switzerland|sweden|norway|denmark|finland|portugal|poland|ireland/.test(
      country,
    )
  ) {
    merged.add('eu')
  }
  return normalizeLeadTags([...merged])
}

function sameTags(a, b) {
  const aa = normalizeLeadTags(a)
  const bb = normalizeLeadTags(b)
  if (aa.length !== bb.length) return false
  return aa.every((t, i) => t === bb[i])
}

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL?.trim()
  const anon = env.VITE_SUPABASE_ANON_KEY?.trim()
  const token =
    argValue('--token') ||
    process.env.CRM_ACCESS_TOKEN?.trim() ||
    env.CRM_ACCESS_TOKEN?.trim() ||
    ''
  if (!url || !anon) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
    process.exit(1)
  }
  if (!token) {
    console.error('Missing staff access token. Pass --token or CRM_ACCESS_TOKEN.')
    process.exit(1)
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('crm_leads')
    .select(
      'id, company_name, company_focus, offer, notes, client_city, client_country, tags',
    )
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)

  const leads = data ?? []
  let updated = 0
  let skipped = 0
  let empty = 0
  const samples = []

  for (const lead of leads) {
    const before = normalizeLeadTags(lead.tags)
    const next = suggestLeadTags(lead, before)
    if (next.length === 0) {
      empty += 1
      skipped += 1
      continue
    }
    if (sameTags(before, next)) {
      skipped += 1
      continue
    }
    if (samples.length < 25) {
      samples.push({
        company: lead.company_name,
        before,
        next,
      })
    }
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('crm_leads')
        .update({ tags: next })
        .eq('id', lead.id)
      if (upErr) throw new Error(`${lead.company_name}: ${upErr.message}`)
    }
    updated += 1
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        total: leads.length,
        updated,
        skipped,
        stillEmpty: empty,
        samples,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
