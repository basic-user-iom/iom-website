import { useEffect, useMemo, useState } from 'react'
import { createActivity } from './api'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import { buildMutualNdaText, ndaDownloadFilename } from './ndaTemplate'
import {
  readLeadNda,
  writeLeadNda,
  type LeadNdaRecord,
  type NdaStatus,
} from './ndaStorage'
import type { Lead } from './types'

interface LeadNdaPanelProps {
  lead: Lead
  onLogged?: () => void
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function LeadNdaPanel({ lead, onLogged }: LeadNdaPanelProps) {
  const { t, locale } = useCrmI18n()
  const [record, setRecord] = useState<LeadNdaRecord>(() => readLeadNda(lead.id))
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRecord(readLeadNda(lead.id))
    setPreviewOpen(false)
    setCopied(false)
    setError('')
  }, [lead.id])

  const text = useMemo(
    () =>
      buildMutualNdaText(lead, {
        iomSignatory: record.iomSignatory,
        jurisdiction: record.jurisdiction,
      }),
    [lead, record.iomSignatory, record.jurisdiction],
  )

  const persist = (next: LeadNdaRecord) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    writeLeadNda(lead.id, stamped)
    setRecord(stamped)
  }

  const statusLabel = (status: NdaStatus): string => {
    if (status === 'sent') return t('nda.statusSent')
    if (status === 'signed') return t('nda.statusSigned')
    return t('nda.statusNotSent')
  }

  const logStatus = async (status: NdaStatus) => {
    const subject =
      status === 'sent'
        ? t('nda.activitySent')
        : status === 'signed'
          ? t('nda.activitySigned')
          : t('nda.activityReset')
    await createActivity({
      lead_id: lead.id,
      type: 'note',
      subject,
      body: t('nda.activityBody', { company: lead.company_name || '—' }),
      occurred_at: new Date().toISOString(),
    })
    onLogged?.()
  }

  const handleCopy = async () => {
    setError('')
    try {
      await copyTextToClipboard(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError(t('nda.copyFailed'))
    }
  }

  const handleDownload = () => {
    downloadText(ndaDownloadFilename(lead), text)
  }

  const handleStatus = async (status: NdaStatus) => {
    if (status === record.status) return
    setBusy(true)
    setError('')
    try {
      persist({ ...record, status })
      await logStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('nda.statusFailed'))
    } finally {
      setBusy(false)
    }
  }

  const updatedLabel = record.updatedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(record.updatedAt))
    : null

  return (
    <section className="crm-offer-block crm-nda">
      <div className="crm-outreach-header">
        <h3 className="crm-panel-title">{t('nda.title')}</h3>
        <span className={`crm-nda-status crm-nda-status--${record.status}`}>
          {statusLabel(record.status)}
        </span>
      </div>

      <p className="crm-muted crm-nda-blurb">{t('nda.blurb')}</p>
      <p className="crm-nda-disclaimer">{t('nda.disclaimer')}</p>

      <div className="crm-form crm-nda-fields">
        <label className="crm-field">
          <span className="crm-label">{t('nda.signatory')}</span>
          <input
            className="crm-input"
            value={record.iomSignatory}
            onChange={(e) =>
              persist({ ...record, iomSignatory: e.target.value, updatedAt: record.updatedAt })
            }
            placeholder={t('nda.signatoryPh')}
            autoComplete="name"
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('nda.jurisdiction')}</span>
          <input
            className="crm-input"
            value={record.jurisdiction}
            onChange={(e) =>
              persist({ ...record, jurisdiction: e.target.value, updatedAt: record.updatedAt })
            }
            placeholder={t('nda.jurisdictionPh')}
          />
        </label>
      </div>

      <div className="crm-nda-actions">
        <button type="button" className="btn btn-ghost" onClick={() => void handleCopy()}>
          {copied ? t('nda.copied') : t('nda.copy')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleDownload}>
          {t('nda.download')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setPreviewOpen((v) => !v)}
        >
          {previewOpen ? t('nda.hidePreview') : t('nda.showPreview')}
        </button>
      </div>

      <div className="crm-nda-status-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || record.status === 'not_sent'}
          onClick={() => void handleStatus('not_sent')}
        >
          {t('nda.markNotSent')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || record.status === 'sent'}
          onClick={() => void handleStatus('sent')}
        >
          {t('nda.markSent')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || record.status === 'signed'}
          onClick={() => void handleStatus('signed')}
        >
          {t('nda.markSigned')}
        </button>
      </div>

      {updatedLabel && (
        <p className="crm-muted crm-nda-updated">
          {t('nda.updated')}: {updatedLabel}
        </p>
      )}

      {error && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {error}
        </p>
      )}

      {previewOpen && (
        <pre className="crm-nda-preview" tabIndex={0}>
          {text}
        </pre>
      )}
    </section>
  )
}
