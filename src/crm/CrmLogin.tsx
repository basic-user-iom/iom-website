import { useEffect, useState, type FormEvent } from 'react'
import { signIn, signOut, storageMode } from './api'
import { getPostLoginMfaState, resetOwnMfaFactors, verifyMfaChallenge } from './crmMfa'
import { useCrmI18n } from './i18n'

interface CrmLoginProps {
  onSuccess: () => void
  /** Keep login mounted while TOTP is pending (Auth session already exists). */
  onMfaHoldChange?: (hold: boolean, factorId?: string | null) => void
  /** Resume challenge after refresh when session is still aal1. */
  resumeFactorId?: string | null
}

export function CrmLogin({
  onSuccess,
  onMfaHoldChange,
  resumeFactorId = null,
}: CrmLoginProps) {
  const { t } = useCrmI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(resumeFactorId)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const mode = storageMode()

  useEffect(() => {
    if (!resumeFactorId) return
    setMfaFactorId(resumeFactorId)
    onMfaHoldChange?.(true)
    // Parent callback identity is unstable; only re-run when factor id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeFactorId])

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const result = await signIn(email, password)
      if (result.kind === 'mfa_challenge') {
        setMfaFactorId(result.factorId)
        setMfaCode('')
        // Pass factorId to parent immediately — onAuthChange can remount this
        // form before local state alone would survive.
        onMfaHoldChange?.(true, result.factorId)
        return
      }
      onMfaHoldChange?.(false, null)
      onSuccess()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'LOGIN_UNAVAILABLE') {
        setError(t('login.unavailable'))
      } else {
        setError(t('login.failed'))
      }
    } finally {
      setBusy(false)
    }
  }

  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await verifyMfaChallenge(mfaFactorId, mfaCode)
      onMfaHoldChange?.(false, null)
      onSuccess()
    } catch {
      setError(t('login.mfaFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleBackToPassword = async () => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await signOut()
    } catch {
      /* ignore */
    } finally {
      setMfaFactorId(null)
      setMfaCode('')
      onMfaHoldChange?.(false, null)
      setBusy(false)
    }
  }

  /** Lost phone authenticator / never scanned — clear server factors and re-enroll. */
  const handleSetupAgain = async () => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await resetOwnMfaFactors()
      try {
        await signOut()
      } catch {
        /* ignore */
      }
      setMfaFactorId(null)
      setMfaCode('')
      onMfaHoldChange?.(false, null)

      // Password still in form → sign in again and land on QR enroll gate.
      if (email.trim() && password) {
        const result = await signIn(email, password)
        if (result.kind === 'mfa_challenge') {
          // Unexpected leftover factor
          setMfaFactorId(result.factorId)
          onMfaHoldChange?.(true, result.factorId)
          setError(t('login.mfaResetIncomplete'))
          return
        }
        onSuccess()
        return
      }

      // Resume path without password cached — ask them to sign in once more.
      setInfo(t('login.mfaResetOk'))
      // Confirm no challenge remains
      try {
        const state = await getPostLoginMfaState()
        if (state.kind === 'mfa_challenge') {
          setMfaFactorId(state.factorId)
          onMfaHoldChange?.(true, state.factorId)
        }
      } catch {
        /* signed out */
      }
    } catch {
      setError(t('login.mfaResetFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-login">
      <div className="crm-login-card">
        <p className="crm-kicker">{t('login.kicker')}</p>
        <h1 className="crm-login-title">{t('login.title')}</h1>
        <p className="crm-login-blurb">
          {mfaFactorId ? t('login.mfaBlurb') : t('login.blurb')}
        </p>

        {mfaFactorId ? (
          <form className="crm-form" onSubmit={(e) => void handleMfaSubmit(e)}>
            <label className="crm-field">
              <span className="crm-label">{t('login.mfaCode')}</span>
              <input
                className="crm-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={busy}
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary crm-submit" disabled={busy}>
              {busy ? t('login.verifying') : t('login.mfaSubmit')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void handleSetupAgain()}
            >
              {t('login.mfaSetupAgain')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void handleBackToPassword()}
            >
              {t('login.mfaBack')}
            </button>
            {error && (
              <p className="crm-feedback crm-feedback--error" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="crm-feedback" role="status">
                {info}
              </p>
            )}
          </form>
        ) : (
          <form className="crm-form" onSubmit={(e) => void handlePasswordSubmit(e)}>
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
            {info && (
              <p className="crm-feedback" role="status">
                {info}
              </p>
            )}
          </form>
        )}

        <p className="crm-mode-note" role="status">
          {mode === 'supabase' ? t('login.modeOnline') : t('login.modeLocal')}
        </p>

        {!mfaFactorId && (
          <p className="crm-login-demo-cta">
            <a href="/crm-demo" className="btn btn-ghost">
              {t('login.tryDemo')}
            </a>
            <span className="crm-muted">{t('login.tryDemoHint')}</span>
          </p>
        )}
      </div>
    </div>
  )
}
