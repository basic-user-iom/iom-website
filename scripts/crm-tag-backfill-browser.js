/**
 * Browser-injected CRM tag backfill body.
 * Executed via CDP Runtime.evaluate on a signed-in /client-login session.
 */
export async function runCrmTagBackfill(dryRun = false) {
  const auth = JSON.parse(
    localStorage.getItem('sb-werfdsobddsijqckymip-auth-token') || '{}',
  )
  const token = auth.access_token
  if (!token) throw new Error('no staff session')

  const src = await fetch('/src/crm/supabaseClient.ts').then((r) => r.text())
  const anon = (src.match(/VITE_SUPABASE_ANON_KEY":\s*"([^"]+)"/) || [])[1]
  const url = (src.match(/VITE_SUPABASE_URL":\s*"([^"]+)"/) || [])[1]
  if (!anon || !url) throw new Error('could not read supabase env from vite')

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
    yipp: [
      'museum',
      'heritage',
      'education',
      'interactive',
      'netherlands',
      'eu',
      'high-priority',
    ],
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
    {
      pattern: /\bmuseum|musea|heritage|cultural institution/i,
      tags: ['museum', 'heritage'],
    },
    {
      pattern: /\bscience\s*cent(er|re)|planetarium/i,
      tags: ['science-center', 'education'],
    },
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
    {
      pattern: /\blighting|lamp\b|lantern|illuminat/i,
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
    const key = String(companyName || '')
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
    for (const tag of tagsForKnownCompany(source.company_name || '')) merged.add(tag)
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
    const country = String(source.client_country || '').toLowerCase()
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

  const listRes = await fetch(
    `${url}/rest/v1/crm_leads?select=id,company_name,company_focus,offer,notes,client_city,client_country,tags&order=updated_at.desc`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
    },
  )
  if (!listRes.ok) throw new Error(`list failed: ${listRes.status} ${await listRes.text()}`)
  const leads = await listRes.json()

  let updated = 0
  let skipped = 0
  let stillEmpty = 0
  const samples = []
  const failures = []

  for (const lead of leads) {
    const before = normalizeLeadTags(lead.tags)
    const next = suggestLeadTags(lead, before)
    if (next.length === 0) {
      stillEmpty += 1
      skipped += 1
      continue
    }
    if (sameTags(before, next)) {
      skipped += 1
      continue
    }
    if (samples.length < 40) {
      samples.push({ company: lead.company_name, before, next })
    }
    if (!dryRun) {
      const up = await fetch(`${url}/rest/v1/crm_leads?id=eq.${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ tags: next }),
      })
      if (!up.ok) {
        failures.push({
          company: lead.company_name,
          status: up.status,
          body: (await up.text()).slice(0, 200),
        })
        continue
      }
    }
    updated += 1
  }

  return {
    dryRun,
    total: leads.length,
    updated,
    skipped,
    stillEmpty,
    failures,
    samples,
  }
}
