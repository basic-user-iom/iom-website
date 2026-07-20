import { useMemo, useState } from 'react'
import { useCrmI18n } from './i18n'
import type { Lead } from './types'

export function followUpDateKey(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  const isoDate = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoDate) return isoDate[1]
  try {
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return null
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return null
  }
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function todayKey(): string {
  const now = new Date()
  return dateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Local calendar date for tomorrow (YYYY-MM-DD). */
export function tomorrowKey(): string {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return dateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate())
}

export function isFollowUpTomorrow(raw: string | null | undefined): boolean {
  return followUpDateKey(raw) === tomorrowKey()
}

interface CrmFollowUpCalendarProps {
  leads: Lead[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

export function CrmFollowUpCalendar({
  leads,
  selectedDate,
  onSelectDate,
}: CrmFollowUpCalendarProps) {
  const { t, locale } = useCrmI18n()
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of leads) {
      const key = followUpDateKey(lead.next_follow_up)
      if (!key) continue
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [leads])

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1) // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d)
    })
  }, [locale])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(view.year, view.month, 1),
      ),
    [locale, view.month, view.year],
  )

  const monthShortLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(
        new Date(view.year, view.month, 1),
      ),
    [locale, view.month, view.year],
  )

  const followUpsInMonth = useMemo(() => {
    const prefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}-`
    let total = 0
    for (const [key, count] of countsByDate) {
      if (key.startsWith(prefix)) total += count
    }
    return total
  }, [countsByDate, view.month, view.year])

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const startOffset = (first.getDay() + 6) % 7 // Monday-first
    const out: Array<{ day: number; key: string } | null> = []
    for (let i = 0; i < startOffset; i++) out.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({ day, key: dateKeyFromParts(view.year, view.month, day) })
    }
    return out
  }, [view.month, view.year])

  const today = todayKey()

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={`crm-calendar crm-calendar-toggle${selectedDate ? ' has-filter' : ''}`}
        aria-label={t('calendar.expand')}
        aria-expanded={false}
        onClick={() => setExpanded(true)}
      >
        <span className="crm-stat-value">{monthShortLabel}</span>
        <span className="crm-stat-label">{t('calendar.title')}</span>
        {followUpsInMonth > 0 && (
          <span className="crm-calendar-toggle-count" aria-hidden="true">
            {followUpsInMonth}
          </span>
        )}
        <span className="crm-calendar-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
    )
  }

  return (
    <section
      className="crm-calendar is-expanded"
      aria-label={t('calendar.title')}
    >
      <div className="crm-calendar-header">
        <button
          type="button"
          className="btn btn-ghost crm-calendar-nav"
          onClick={() => shiftMonth(-1)}
          aria-label={t('calendar.prev')}
        >
          ‹
        </button>
        <h3 className="crm-calendar-title">{monthLabel}</h3>
        <button
          type="button"
          className="btn btn-ghost crm-calendar-nav"
          onClick={() => shiftMonth(1)}
          aria-label={t('calendar.next')}
        >
          ›
        </button>
        <button
          type="button"
          className="btn btn-ghost crm-calendar-collapse"
          onClick={() => setExpanded(false)}
          aria-label={t('calendar.collapse')}
        >
          ▴
        </button>
      </div>

      <div className="crm-calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label} className="crm-calendar-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="crm-calendar-grid" role="grid" aria-label={t('calendar.title')}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="crm-calendar-cell is-empty" />
          }
          const count = countsByDate.get(cell.key) ?? 0
          const isToday = cell.key === today
          const isSelected = cell.key === selectedDate
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className={`crm-calendar-cell${isToday ? ' is-today' : ''}${
                isSelected ? ' is-selected' : ''
              }${count > 0 ? ' has-follow-up' : ''}`}
              aria-pressed={isSelected}
              aria-label={
                count > 0
                  ? t('calendar.dayWithFollowUps', { day: cell.day, count })
                  : t('calendar.day', { day: cell.day })
              }
              onClick={() => onSelectDate(isSelected ? null : cell.key)}
            >
              <span className="crm-calendar-day">{cell.day}</span>
              {count > 0 && <span className="crm-calendar-dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <button
          type="button"
          className="btn btn-ghost crm-calendar-clear"
          onClick={() => onSelectDate(null)}
        >
          {t('calendar.clearFilter')}
        </button>
      )}
    </section>
  )
}
