import { useState } from 'react'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import { buildChatGptNotePrompt, parseChatGptNoteImport } from './noteChatGpt'

interface NoteChatGptPanelProps {
  onImport: (data: { title: string; body: string }) => void
  seedHint?: string
}

export function NoteChatGptPanel({ onImport, seedHint = '' }: NoteChatGptPanelProps) {
  const { t } = useCrmI18n()
  const [paste, setPaste] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleCopyPrompt = async () => {
    setError('')
    setSuccess('')
    try {
      await copyTextToClipboard(buildChatGptNotePrompt(seedHint))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('notesChatgpt.copyFailed'))
    }
  }

  const handleLoad = () => {
    setError('')
    setSuccess('')
    try {
      const data = parseChatGptNoteImport(paste)
      onImport(data)
      setSuccess(t('notesChatgpt.loadSuccess'))
    } catch (err) {
      const key = err instanceof Error ? err.message : 'import_failed'
      if (key === 'empty') setError(t('notesChatgpt.pasteEmpty'))
      else if (key === 'missing_title') setError(t('notesChatgpt.missingTitle'))
      else if (key === 'missing_body') setError(t('notesChatgpt.missingBody'))
      else if (key === 'invalid_json' || key === 'invalid_shape')
        setError(t('notesChatgpt.parseFailed'))
      else setError(t('notesChatgpt.importFailed'))
    }
  }

  return (
    <section className="crm-chatgpt-panel">
      <div className="crm-chatgpt-header">
        <div>
          <h3 className="crm-panel-title">{t('notesChatgpt.title')}</h3>
          <p className="crm-muted crm-chatgpt-blurb">{t('notesChatgpt.blurb')}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void handleCopyPrompt()}>
          {copied ? t('detail.copied') : t('notesChatgpt.copyPrompt')}
        </button>
      </div>

      <ol className="crm-chatgpt-steps">
        <li>{t('notesChatgpt.step1')}</li>
        <li>{t('notesChatgpt.step2')}</li>
        <li>{t('notesChatgpt.step3')}</li>
      </ol>

      <label className="crm-field">
        <span className="crm-label">{t('notesChatgpt.pasteLabel')}</span>
        <textarea
          className="crm-input crm-textarea crm-chatgpt-paste"
          rows={6}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={t('notesChatgpt.pastePlaceholder')}
        />
      </label>

      <div className="crm-detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!paste.trim()}
          onClick={handleLoad}
        >
          {t('notesChatgpt.loadIntoNote')}
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
