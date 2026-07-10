import { memo, useState, type FormEvent } from 'react'

const ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim() ?? ''
const isDev = import.meta.env.DEV

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export const ContactForm = memo(function ContactForm() {
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!ACCESS_KEY) {
      setState('error')
      setErrorMessage(
        isDev
          ? 'Configure VITE_WEB3FORMS_ACCESS_KEY in .env to enable email delivery.'
          : 'Contact form is not configured. Please email us directly.',
      )
      return
    }

    setState('submitting')
    setErrorMessage('')

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append('access_key', ACCESS_KEY)
    formData.append('subject', 'New contact from iobjectm.com')

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json()) as { success?: boolean; message?: string }

      if (data.success) {
        setState('success')
        form.reset()
      } else {
        setState('error')
        setErrorMessage(
          data.message ?? 'Something went wrong. Please try again or email us directly.',
        )
      }
    } catch {
      setState('error')
      setErrorMessage('Network error. Please try again or email us directly.')
    }
  }

  return (
    <div className="contact-form-wrap">
      {!ACCESS_KEY && isDev && (
        <p className="contact-form-notice" role="status">
          Configure <code>VITE_WEB3FORMS_ACCESS_KEY</code> in <code>.env</code> to enable email
          delivery.
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
          <span className="contact-form-label">Name</span>
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
          <span className="contact-form-label">Email</span>
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
          <span className="contact-form-label">Message</span>
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
          {state === 'submitting' ? 'Sending…' : 'Send message'}
        </button>

        {state === 'success' && (
          <p className="contact-form-feedback contact-form-feedback--success" role="status">
            Message sent — we&apos;ll get back to you soon.
          </p>
        )}

        {state === 'error' && errorMessage && (
          <p className="contact-form-feedback contact-form-feedback--error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>

      <p className="contact-form-alt">
        or{' '}
        <a href="mailto:iom-production@proton.me" className="contact-form-mailto">
          email us directly
        </a>
      </p>
    </div>
  )
})
