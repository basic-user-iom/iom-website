import { useState, type FormEvent } from 'react'
import { signIn, storageMode } from './api'
import { useCrmI18n } from './i18n'

interface CrmLoginProps {
  onSuccess: () => void
}

export function CrmLogin({ onSuccess }: CrmLoginProps) {
  const { t } = useCrmI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mode = storageMode()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-login">
      <div className="crm-login-card">
        <p className="crm-kicker">{t('login.kicker')}</p>
        <h1 className="crm-login-title">{t('login.title')}</h1>
        <p className="crm-login-blurb">{t('login.blurb')}</p>

        <form className="crm-form" onSubmit={handleSubmit}>
          <label className="crm-field">
            <span className="crm-label">{t('login.email')}</span>
            <input
              className="crm-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">{t('login.password')}</span>
            <input
              className="crm-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn btn-primary crm-submit" disabled={busy}>
            {busy ? t('login.signingIn') : t('login.submit')}
          </button>
          {error && (
            <p className="crm-feedback crm-feedback--error" role="alert">
              {error}
            </p>
          )}
        </form>

        <p className="crm-mode-note" role="status">
          {mode === 'supabase' ? t('login.modeOnline') : t('login.modeLocal')}
        </p>

        <p className="crm-login-demo-cta">
          <a href="/crm-demo" className="btn btn-ghost">
            {t('login.tryDemo')}
          </a>
          <span className="crm-muted">{t('login.tryDemoHint')}</span>
        </p>
      </div>
    </div>
  )
}
