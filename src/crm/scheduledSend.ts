import type { OutreachFromIdentityId } from './outreachFromIdentities'
import type { Lead } from './types'

export type ScheduledSend = {
  /** ISO timestamp when the initial outreach should send. */
  at: string
  to: string
  from: OutreachFromIdentityId
  /** Last failure message (empty when healthy). */
  error: string
  attempts: number
}

const FROM_IDS = new Set<OutreachFromIdentityId>(['contact', 'visual', 'projects'])

export function normalizeScheduledSend(raw: unknown): ScheduledSend | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const at = typeof o.at === 'string' ? o.at.trim() : ''
  const to = typeof o.to === 'string' ? o.to.trim().toLowerCase() : ''
  const fromRaw = typeof o.from === 'string' ? o.from.trim().toLowerCase() : 'contact'
  const from = FROM_IDS.has(fromRaw as OutreachFromIdentityId)
    ? (fromRaw as OutreachFromIdentityId)
    : 'contact'
  if (!at || !to) return null
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return null
  const attempts =
    typeof o.attempts === 'number' && Number.isFinite(o.attempts)
      ? Math.max(0, Math.floor(o.attempts))
      : 0
  const error = typeof o.error === 'string' ? o.error.trim() : ''
  return {
    at: when.toISOString(),
    to,
    from,
    error,
    attempts,
  }
}

export function isScheduledSendArmed(lead: Lead): boolean {
  return !!normalizeScheduledSend(lead.scheduled_send) && !lead.initial_email_sent_at
}

export function scheduledSendDue(
  schedule: ScheduledSend | null | undefined,
  now = Date.now(),
): boolean {
  if (!schedule) return false
  return new Date(schedule.at).getTime() <= now
}

export function clearScheduledSend(): null {
  return null
}

export function buildScheduledSend(input: {
  at: string
  to: string
  from: OutreachFromIdentityId
}): ScheduledSend {
  const normalized = normalizeScheduledSend({
    at: input.at,
    to: input.to,
    from: input.from,
    error: '',
    attempts: 0,
  })
  if (!normalized) {
    throw new Error('Invalid schedule')
  }
  return normalized
}

/** datetime-local value from ISO (in `timeZone`, or browser local if omitted). */
export function isoToDatetimeLocalValue(iso: string, timeZone?: string): string {
  try {
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return ''
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      fmt.formatToParts(dt).map((p) => [p.type, p.value]),
    )
    const y = parts.year
    const m = parts.month
    const d = parts.day
    const h = parts.hour
    const min = parts.minute
    if (!y || !m || !d || h == null || min == null) return ''
    return `${y}-${m}-${d}T${h}:${min}`
  } catch {
    return ''
  }
}

/** Parse datetime-local as browser-local wall time → ISO. */
export function datetimeLocalValueToIso(value: string): string | null {
  const v = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

/**
 * Parse datetime-local as wall clock in an IANA zone → absolute ISO.
 * Use contact `client_timezone` so "9:00" means 9:00 where they are.
 */
export function datetimeLocalValueInZoneToIso(
  value: string,
  timeZone: string,
): string | null {
  const v = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  const tz = timeZone.trim()
  if (!tz) return datetimeLocalValueToIso(v)

  const [datePart, timePart] = v.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return null

  const desiredAsUtc = Date.UTC(y, mo - 1, d, hh, mm, 0)

  const offsetMsAt = (instant: number): number | null => {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(new Date(instant))
          .map((p) => [p.type, p.value]),
      )
      const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second || 0),
      )
      if (!Number.isFinite(asUtc)) return null
      return asUtc - instant
    } catch {
      return null
    }
  }

  let instant = desiredAsUtc
  for (let i = 0; i < 4; i++) {
    const offset = offsetMsAt(instant)
    if (offset == null) return null
    instant = desiredAsUtc - offset
  }

  const dt = new Date(instant)
  if (Number.isNaN(dt.getTime())) return null
  // Verify wall clock round-trips (DST edges can be ambiguous / skipped).
  const back = isoToDatetimeLocalValue(dt.toISOString(), tz)
  if (back !== v) {
    // Prefer the later offset interpretation if first landing is off by an hour.
    const offset = offsetMsAt(instant + 3600_000)
    if (offset != null) {
      const alt = new Date(desiredAsUtc - offset)
      if (isoToDatetimeLocalValue(alt.toISOString(), tz) === v) {
        return alt.toISOString()
      }
    }
    return null
  }
  return dt.toISOString()
}

/** Schedule picker value ↔ ISO using contact timezone when available. */
export function schedulePickerValueToIso(
  value: string,
  contactTimeZone?: string | null,
): string | null {
  const tz = contactTimeZone?.trim()
  if (tz) return datetimeLocalValueInZoneToIso(value, tz)
  return datetimeLocalValueToIso(value)
}

export function scheduleIsoToPickerValue(
  iso: string,
  contactTimeZone?: string | null,
): string {
  return isoToDatetimeLocalValue(iso, contactTimeZone?.trim() || undefined)
}

export function leadContactTimeZone(lead: Lead): string {
  return lead.client_timezone?.trim() || ''
}

export function leadContactPlaceLabel(lead: Lead): string {
  return [lead.client_city?.trim(), lead.client_country?.trim()]
    .filter(Boolean)
    .join(', ')
}

/** Format an absolute instant in the contact timezone (or browser if unset). */
export function formatInContactZone(
  iso: string,
  contactTimeZone: string | null | undefined,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  try {
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return iso
    const tz = contactTimeZone?.trim()
    return new Intl.DateTimeFormat(locale, {
      ...opts,
      ...(tz ? { timeZone: tz } : {}),
    }).format(dt)
  } catch {
    return iso
  }
}
