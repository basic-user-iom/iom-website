import { memo, useEffect, useState, type FormEvent } from 'react'
import { useSiteI18n } from '../i18n'

const ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim() ?? ''
const isDev = import.meta.env.DEV
const WEB3FORMS_URL = 'https://api.web3forms.com/submit'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

function submitFormNatively(form: HTMLFormElement, accessKey: string) {
  form.action = WEB3FORMS_URL
  form.method = 'post'

  const ensureHidden = (name: string, value: string) => {
    let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      form.appendChild(input)
    }
    input.value = value
  }

  ensureHidden('access_key', accessKey)
  ensureHidden('subject', 'New contact from iobjectm.com')
  ensureHidden(
    'redirect',
    `${window.location.origin}${window.location.pathname}?sent=1${window.location.hash || '#contact'}`,
  )

  HTMLFormElement.prototype.submit.call(form)
}

export const ContactForm = memo(function ContactForm() {
  const { t } = useSiteI18n()
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sent') !== '1') return

    setState('success')
    params.delete('sent')
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || '#contact'}`
    window.history.replaceState(null, '', nextUrl)
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!ACCESS_KEY) {
      setState('error')
      setErrorMessage(isDev ? t('contact.errConfigDev') : t('contact.errConfig'))
      return
    }

    setState('submitting')
    setErrorMessage('')

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('access_key', ACCESS_KEY)
    formData.append('subject', 'New contact from iobjectm.com')

    try {
      const res = await fetch(WEB3FORMS_URL, {
        method: 'POST',
        body: formData,
      })

      const text = await res.text()
      let data: { success?: boolean; message?: string }
      try {
        data = JSON.parse(text) as { success?: boolean; message?: string }
      } catch {
        setState('error')
        setErrorMessage(t('contact.errUnexpected'))
        return
      }

      if (data.success) {
        setState('success')
        form.reset()
      } else {
        setState('error')
        setErrorMessage(data.message ?? t('contact.errGeneric'))
      }
    } catch {
      submitFormNatively(form, ACCESS_KEY)
    }
  }

  return (
    <div className="contact-form-wrap">
      {!ACCESS_KEY && isDev && (
        <p className="contact-form-notice" role="status">
          {t('contact.noticeDev')}
        </p>
      )}

      <form className="contact-form" onSubmit={handleSubmit} noValidate>
        <input
          type="checkbox"
          name="botcheck"
          className="contact-form-honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <label className="contact-form-field">
          <span className="contact-form-label">{t('contact.name')}</span>
          <input
            type="text"
            name="name"
            className="contact-form-input"
            required
            autoComplete="name"
            disabled={state === 'submitting'}
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">{t('contact.email')}</span>
          <input
            type="email"
            name="email"
            className="contact-form-input"
            required
            autoComplete="email"
            disabled={state === 'submitting'}
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">{t('contact.message')}</span>
          <textarea
            name="message"
            className="contact-form-input contact-form-textarea"
            required
            rows={5}
            disabled={state === 'submitting'}
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary contact-form-submit"
          disabled={state === 'submitting'}
        >
          {state === 'submitting' ? t('contact.sending') : t('contact.send')}
        </button>

        {state === 'success' && (
          <p className="contact-form-feedback contact-form-feedback--success" role="status">
            {t('contact.success')}
          </p>
        )}

        {state === 'error' && errorMessage && (
          <p className="contact-form-feedback contact-form-feedback--error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>

      <p className="contact-form-alt">
        {t('contact.or')}{' '}
        <a href="mailto:contact@iobjectm.com" className="contact-form-mailto">
          {t('contact.emailDirect')}
        </a>
      </p>
    </div>
  )
})
