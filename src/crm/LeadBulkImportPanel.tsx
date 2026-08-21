import { useState } from 'react'
import { EMPTY_LEAD_INPUT } from './constants'
import {
  buildChatGptBulkLeadPrompt,
  CHATGPT_BULK_LEAD_MAX,
  mergeLeadImport,
  parseChatGptBulkLeadImport,
} from './leadChatGpt'
import { withNeedsReview } from './leadTags'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import type { LeadInput } from './types'

interface LeadBulkImportPanelProps {
  onImport: (leads: LeadInput[]) => Promise<void>
  onCancel: () => void
  seedHint?: string
}

export function LeadBulkImportPanel({
  onImport,
  onCancel,
  seedHint = '',
}: LeadBulkImportPanelProps) {
  const { t } = useCrmI18n()
  const [brief, setBrief] = useState(seedHint)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<LeadInput[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const promptScript = buildChatGptBulkLeadPrompt(brief)
  const handleCopyPrompt = async () => {
    setError('')
    try {
      await copyTextToClipboard(promptScript)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('bulkChatgpt.copyFailed'))
    }
  }

  const handlePreview = () => {
    setError('')
    setProgress('')
    try {
      const parsed = parseChatGptBulkLeadImport(paste)
      const rows = parsed.map((row) =>
        mergeLeadImport(EMPTY_LEAD_INPUT, {
          ...row,
          tags: withNeedsReview(row.tags),
          status: row.status ?? 'new',
        }),
      )
      setPreview(rows)
    } catch (err) {
      setPreview(null)
      const key = err instanceof Error ? err.message : 'import_failed'
      if (key === 'empty') setError(t('bulkChatgpt.pasteEmpty'))
      else if (key === 'too_many')
        setError(t('bulkChatgpt.tooMany', { max: CHATGPT_BULK_LEAD_MAX }))
      else if (key.startsWith('missing_identity:')) {
        const n = key.split(':')[1] || '?'
        setError(t('bulkChatgpt.missingIdentityAt', { n }))
      } else if (key === 'missing_identity') setError(t('chatgpt.missingIdentity'))
      else if (key === 'invalid_json' || key === 'invalid_shape')
        setError(t('bulkChatgpt.parseFailed'))
      else setError(t('bulkChatgpt.importFailed'))
    }
  }

  const handleImport = async () => {
    if (!preview?.length) {
      handlePreview()
      return
    }
    setError('')
    setBusy(true)
    setProgress(t('bulkChatgpt.importing', { n: preview.length }))
    try {
      await onImport(preview)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('bulkChatgpt.importFailed'),
      )
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <section className="crm-chatgpt-panel crm-bulk-import-panel">
      <div className="crm-chatgpt-header">
        <div>
          <h3 className="crm-panel-title">{t('bulkChatgpt.title')}</h3>
          <p className="crm-muted crm-chatgpt-blurb">{t('bulkChatgpt.blurb')}</p>
        </div>
      </div>

      <ol className="crm-chatgpt-steps">
        <li>{t('bulkChatgpt.step1')}</li>
        <li>{t('bulkChatgpt.step2')}</li>
        <li>{t('bulkChatgpt.step3')}</li>
      </ol>

      <div className="crm-bulk-import-script">
        <label className="crm-field">
          <span className="crm-label">{t('bulkChatgpt.briefLabel')}</span>
          <input
            type="text"
            className="crm-input"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t('bulkChatgpt.briefPlaceholder')}
            disabled={busy}
          />
        </label>

        <div className="crm-bulk-import-script-head">
          <span className="crm-label">{t('bulkChatgpt.scriptLabel')}</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCopyPrompt()}
          >
            {copied ? t('detail.copied') : t('bulkChatgpt.copyPrompt')}
          </button>
        </div>
        <p className="crm-muted crm-bulk-import-script-hint">
          {t('bulkChatgpt.scriptHint')}
        </p>
        <textarea
          className="crm-input crm-textarea crm-chatgpt-paste crm-bulk-import-script-text"
          rows={16}
          value={promptScript}
          readOnly
          spellCheck={false}
          aria-label={t('bulkChatgpt.scriptLabel')}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <label className="crm-field">
        <span className="crm-label">{t('bulkChatgpt.pasteLabel')}</span>
        <textarea
          className="crm-input crm-textarea crm-chatgpt-paste"
          rows={12}
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value)
            setPreview(null)
          }}
          placeholder={t('bulkChatgpt.pastePlaceholder')}
          disabled={busy}
        />
      </label>

      {preview && preview.length > 0 && (
        <div className="crm-bulk-import-preview" role="status">
          <p className="crm-outreach-focus-label">
            {t('bulkChatgpt.previewTitle', { n: preview.length })}
          </p>
          <ul className="crm-bulk-import-list">
            {preview.slice(0, 40).map((lead, i) => (
              <li key={`${lead.company_name}-${i}`}>
                <strong>
                  {lead.company_name.trim() ||
                    lead.contact_name.trim() ||
                    t('detail.untitled')}
                </strong>
                {lead.contact_name.trim() && lead.company_name.trim() ? (
                  <span className="crm-muted"> — {lead.contact_name.trim()}</span>
                ) : null}
                {lead.client_city.trim() || lead.client_country.trim() ? (
                  <span className="crm-muted">
                    {' '}
                    ·{' '}
                    {[lead.client_city.trim(), lead.client_country.trim()]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                ) : null}
              </li>
            ))}
            {preview.length > 40 ? (
              <li className="crm-muted">
                {t('bulkChatgpt.previewMore', { n: preview.length - 40 })}
              </li>
            ) : null}
          </ul>
          <p className="crm-muted">{t('bulkChatgpt.needsReviewNote')}</p>
        </div>
      )}

      <div className="crm-detail-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !paste.trim()}
          onClick={handlePreview}
        >
          {t('bulkChatgpt.preview')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !paste.trim()}
          onClick={() => void handleImport()}
        >
          {busy
            ? t('bulkChatgpt.importingShort')
            : preview?.length
              ? t('bulkChatgpt.importN', { n: preview.length })
              : t('bulkChatgpt.previewThenImport')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onCancel}
        >
          {t('form.cancel')}
        </button>
      </div>

      {progress && (
        <p className="crm-feedback crm-feedback--ok" role="status">
          {progress}
        </p>
      )}
      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
