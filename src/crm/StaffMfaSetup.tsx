import { useState, type FormEvent } from 'react'
import {
  confirmMfaEnrollment,
  startMfaEnrollment,
  type MfaEnrollStart,
} from './crmMfa'
import { useCrmI18n } from './i18n'

interface StaffMfaSetupProps {
  onComplete: () => void
}

/** Required one-time TOTP enroll gate for staff accounts. */
export function StaffMfaSetup({ onComplete }: StaffMfaSetupProps) {
  const { t } = useCrmI18n()
  const [enroll, setEnroll] = useState<MfaEnrollStart | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const handleStart = async () => {
    setBusy(true)
    setError('')
    try {
      setEnroll(await startMfaEnrollment())
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.startFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    if (!enroll) return
    setBusy(true)
    setError('')
    try {
      await confirmMfaEnrollment(enroll.factorId, code)
      onComplete()
    } catch {
      setError(t('mfa.codeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-main crm-mfa-setup">
      <div className="crm-panel">
        <header className="crm-panel-head">
          <div>
            <p className="crm-kicker">{t('mfa.kicker')}</p>
            <h2 className="crm-panel-title">{t('mfa.title')}</h2>
            <p className="crm-muted">{t('mfa.intro')}</p>
          </div>
        </header>

        {error && (
          <p className="crm-error" role="alert">
            {error}
          </p>
        )}

        {!enroll ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handleStart()}
          >
            {busy ? t('mfa.starting') : t('mfa.start')}
          </button>
        ) : (
          <div className="crm-mfa-enroll">
            <p className="crm-muted">{t('mfa.scanHint')}</p>
            <img
              className="crm-mfa-qr"
              src={enroll.qrCode}
              alt={t('mfa.qrAlt')}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? t('mfa.hideSecret') : t('mfa.showSecret')}
            </button>
            {showSecret && (
              <p className="crm-mfa-secret">
                <code>{enroll.secret}</code>
              </p>
            )}
            <form className="crm-form" onSubmit={(e) => void handleConfirm(e)}>
              <label className="crm-field">
                <span className="crm-label">{t('login.mfaCode')}</span>
                <input
                  className="crm-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  disabled={busy}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('login.verifying') : t('mfa.confirm')}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
