import { useState } from 'react'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import { buildChatGptLeadPrompt, parseChatGptLeadImport } from './leadChatGpt'
import type { LeadInput } from './types'

interface LeadChatGptPanelProps {
  onImport: (data: Partial<LeadInput>) => void
  seedHint?: string
}

export function LeadChatGptPanel({ onImport, seedHint = '' }: LeadChatGptPanelProps) {
  const { t } = useCrmI18n()
  const [paste, setPaste] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleCopyPrompt = async () => {
    setError('')
    setSuccess('')
    try {
      await copyTextToClipboard(buildChatGptLeadPrompt(seedHint))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('chatgpt.copyFailed'))
    }
  }

  const handleLoad = () => {
    setError('')
    setSuccess('')
    try {
      const data = parseChatGptLeadImport(paste)
      onImport(data)
      setSuccess(t('chatgpt.loadSuccess'))
    } catch (err) {
      const key = err instanceof Error ? err.message : 'import_failed'
      if (key === 'empty') setError(t('chatgpt.pasteEmpty'))
      else if (key === 'missing_identity') setError(t('chatgpt.missingIdentity'))
      else if (key === 'invalid_json' || key === 'invalid_shape')
        setError(t('chatgpt.parseFailed'))
      else setError(t('chatgpt.importFailed'))
    }
  }

  return (
    <section className="crm-chatgpt-panel">
      <div className="crm-chatgpt-header">
        <div>
          <h3 className="crm-panel-title">{t('chatgpt.title')}</h3>
          <p className="crm-muted crm-chatgpt-blurb">{t('chatgpt.blurb')}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void handleCopyPrompt()}>
          {copied ? t('detail.copied') : t('chatgpt.copyPrompt')}
        </button>
      </div>

      <ol className="crm-chatgpt-steps">
        <li>{t('chatgpt.step1')}</li>
        <li>{t('chatgpt.step2')}</li>
        <li>{t('chatgpt.step3')}</li>
      </ol>

      <label className="crm-field">
        <span className="crm-label">{t('chatgpt.pasteLabel')}</span>
        <textarea
          className="crm-input crm-textarea crm-chatgpt-paste"
          rows={8}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={t('chatgpt.pastePlaceholder')}
        />
      </label>

      <div className="crm-detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!paste.trim()}
          onClick={handleLoad}
        >
          {t('chatgpt.loadIntoForm')}
        </button>
      </div>

      {success && (
        <p className="crm-feedback crm-feedback--ok" role="status">
          {success}
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
