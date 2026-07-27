export type NdaStatus = 'not_sent' | 'sent' | 'signed'

export type LeadNdaRecord = {
  status: NdaStatus
  iomSignatory: string
  jurisdiction: string
  updatedAt: string
}

const LEAD_KEY_PREFIX = 'iom-crm-nda:v1:'
const DEFAULTS_KEY = 'iom-crm-nda-defaults:v1'

export type NdaDefaults = {
  iomSignatory: string
  jurisdiction: string
}

const EMPTY_DEFAULTS: NdaDefaults = {
  iomSignatory: '',
  jurisdiction: '',
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function readNdaDefaults(): NdaDefaults {
  if (typeof localStorage === 'undefined') return { ...EMPTY_DEFAULTS }
  const parsed = safeParse<Partial<NdaDefaults>>(localStorage.getItem(DEFAULTS_KEY))
  return {
    iomSignatory: parsed?.iomSignatory?.trim() ?? '',
    jurisdiction: parsed?.jurisdiction?.trim() ?? '',
  }
}

export function writeNdaDefaults(next: NdaDefaults): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    DEFAULTS_KEY,
    JSON.stringify({
      iomSignatory: next.iomSignatory.trim(),
      jurisdiction: next.jurisdiction.trim(),
    }),
  )
}

export function readLeadNda(leadId: string): LeadNdaRecord {
  const defaults = readNdaDefaults()
  const fallback: LeadNdaRecord = {
    status: 'not_sent',
    iomSignatory: defaults.iomSignatory,
    jurisdiction: defaults.jurisdiction,
    updatedAt: '',
  }
  if (typeof localStorage === 'undefined') return fallback
  const parsed = safeParse<Partial<LeadNdaRecord>>(
    localStorage.getItem(`${LEAD_KEY_PREFIX}${leadId}`),
  )
  if (!parsed) return fallback
  const status =
    parsed.status === 'sent' || parsed.status === 'signed' ? parsed.status : 'not_sent'
  return {
    status,
    iomSignatory: (parsed.iomSignatory ?? defaults.iomSignatory).trim(),
    jurisdiction: (parsed.jurisdiction ?? defaults.jurisdiction).trim(),
    updatedAt: parsed.updatedAt ?? '',
  }
}

export function writeLeadNda(leadId: string, record: LeadNdaRecord): void {
  if (typeof localStorage === 'undefined') return
  const next: LeadNdaRecord = {
    status: record.status,
    iomSignatory: record.iomSignatory.trim(),
    jurisdiction: record.jurisdiction.trim(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  }
  localStorage.setItem(`${LEAD_KEY_PREFIX}${leadId}`, JSON.stringify(next))
  writeNdaDefaults({
    iomSignatory: next.iomSignatory,
    jurisdiction: next.jurisdiction,
  })
}
