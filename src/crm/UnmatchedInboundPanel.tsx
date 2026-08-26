import { useEffect, useMemo, useRef, useState } from 'react'
import {
  attachInboundUnmatched,
  dismissInboundUnmatched,
  isInboundUnmatchedSchemaMissing,
  listInboundUnmatched,
  listInboundUnmatchedIds,
} from './api'
import { isCrmDemoMode } from './demoMode'
import { useCrmI18n } from './i18n'
import { useLiveCrmBackend } from './supabaseClient'
import type { InboundUnmatched, Lead } from './types'

interface UnmatchedInboundPanelProps {
  leads: Lead[]
  onAttached?: (leadId: string) => void
  active?: boolean
}

export function UnmatchedInboundPanel({
  leads,
  onAttached,
  active = true,
}: UnmatchedInboundPanelProps) {
  const { t, locale } = useCrmI18n()
  const [items, setItems] = useState<InboundUnmatched[]>([])
  const [loading, setLoading] = useState(false)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [attachLeadById, setAttachLeadById] = useState<Record<string, string>>(
    {},
  )
  const [open, setOpen] = useState(true)
  const itemsSigRef = useRef('')

  const leadOptions = useMemo(
    () =>
      [...leads]
        .sort((a, b) => a.company_name.localeCompare(b.company_name))
        .map((lead) => ({
          id: lead.id,
          label: `${lead.company_name}${lead.email ? ` · ${lead.email}` : ''}`,
        })),
    [leads],
  )

  const refresh = async (opts?: { silent?: boolean }) => {
    if (isCrmDemoMode() || !useLiveCrmBackend()) {
      setItems([])
      return
    }
    if (!opts?.silent) {
      setLoading(true)
      setError('')
    }
    try {
      if (opts?.silent) {
        const ids = await listInboundUnmatchedIds(40)
        const sig = ids.join('|')
        if (sig === itemsSigRef.current) return
      }
      const rows = await listInboundUnmatched(40)
      const sig = rows.map((row) => row.id).join('|')
      itemsSigRef.current = sig
      setItems(rows)
      setSchemaMissing(false)
      const defaults: Record<string, string> = {}
      for (const row of rows) {
        if (row.candidate_lead_ids[0]) {
          defaults[row.id] = row.candidate_lead_ids[0]
        }
      }
      setAttachLeadById((prev) => ({ ...defaults, ...prev }))
    } catch (err) {
      if (isInboundUnmatchedSchemaMissing(err)) {
        setSchemaMissing(true)
        setItems([])
        itemsSigRef.current = ''
      } else if (!opts?.silent) {
        setError(err instanceof Error ? err.message : t('unmatched.loadFailed'))
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (isCrmDemoMode() || !useLiveCrmBackend()) return
    if (!active) return
    void refresh()
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refresh({ silent: true })
    }, 60_000)
    return () => window.clearInterval(id)
  }, [active])

  if (isCrmDemoMode() || !useLiveCrmBackend() || schemaMissing) return null
  if (items.length === 0 && !error) return null

  const formatWhen = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const handleAttach = async (row: InboundUnmatched) => {
    const leadId = (attachLeadById[row.id] || '').trim()
    if (!leadId) {
      setError(t('unmatched.pickLead'))
      return
    }
    setBusyId(row.id)
    setError('')
    try {
      await attachInboundUnmatched(row.id, leadId)
      setItems((prev) => prev.filter((x) => x.id !== row.id))
      onAttached?.(leadId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unmatched.attachFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDismiss = async (row: InboundUnmatched) => {
    if (!confirm(t('unmatched.dismissConfirm'))) return
    setBusyId(row.id)
    setError('')
    try {
      await dismissInboundUnmatched(row.id)
      setItems((prev) => prev.filter((x) => x.id !== row.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unmatched.dismissFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="crm-unmatched-panel" aria-label={t('unmatched.title')}>
      <div className="crm-unmatched-panel-head">
        <button
          type="button"
          className="crm-unmatched-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <strong>{t('unmatched.title')}</strong>
          <span className="crm-muted">
            {loading
              ? t('unmatched.loading')
              : t('unmatched.count', { count: String(items.length) })}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loading || busyId != null}
          onClick={() => void refresh()}
        >
          {t('unmatched.refresh')}
        </button>
      </div>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      {open && items.length > 0 && (
        <ul className="crm-unmatched-list">
          {items.map((row) => (
            <li key={row.id} className="crm-unmatched-item">
              <div className="crm-unmatched-meta">
                <strong>{row.subject || t('unmatched.noSubject')}</strong>
                <span className="crm-muted">
                  {row.from_email} → {row.to_email || '—'} ·{' '}
                  {formatWhen(row.occurred_at)} · {row.failure_code}
                </span>
                {row.body_text ? (
                  <p className="crm-unmatched-snippet">
                    {row.body_text.length > 180
                      ? `${row.body_text.slice(0, 180)}…`
                      : row.body_text}
                  </p>
                ) : null}
              </div>
              <div className="crm-unmatched-actions">
                <select
                  className="crm-input"
                  value={attachLeadById[row.id] || ''}
                  aria-label={t('unmatched.pickLead')}
                  disabled={busyId === row.id}
                  onChange={(e) =>
                    setAttachLeadById((prev) => ({
                      ...prev,
                      [row.id]: e.target.value,
                    }))
                  }
                >
                  <option value="">{t('unmatched.pickLead')}</option>
                  {leadOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === row.id || !(attachLeadById[row.id] || '')}
                  onClick={() => void handleAttach(row)}
                >
                  {t('unmatched.attach')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === row.id}
                  onClick={() => void handleDismiss(row)}
                >
                  {t('unmatched.dismiss')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
