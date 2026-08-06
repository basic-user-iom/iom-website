import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { PROJECT_COSTS_META } from './data'

type InquiryKind = 'consultation' | 'estimate'
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'
type FieldErrors = Partial<Record<'name' | 'email' | 'message', string>>

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

type ProjectCostsInquiryFormProps = {
  id?: string
  defaultKind?: InquiryKind
}

export const ProjectCostsInquiryForm = memo(function ProjectCostsInquiryForm({
  id = 'inquiry',
  defaultKind = 'consultation',
}: ProjectCostsInquiryFormProps) {
  const [kind, setKind] = useState<InquiryKind>(defaultKind)
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const submittingRef = useRef(false)

  useEffect(() => {
    setKind(defaultKind)
  }, [defaultKind])

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validate = (form: HTMLFormElement): boolean => {
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim()
    const next: FieldErrors = {}

    if (!name) next.name = 'Please fill in this field.'
    if (!email) next.email = 'Please fill in this field.'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.'
    if (!message || message.length < 8) {
      next.message = 'Please include a short project description.'
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submittingRef.current || state === 'submitting') return

    const form = e.currentTarget
    if (!validate(form)) {
      setState('idle')
      return
    }

    submittingRef.current = true
    setState('submitting')
    setErrorMessage('')

    const body = {
      kind,
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem('email') as HTMLInputElement).value.trim(),
      company: (form.elements.namedItem('company') as HTMLInputElement).value.trim(),
      timeframe: (form.elements.namedItem('timeframe') as HTMLInputElement).value.trim(),
      budget: (form.elements.namedItem('budget') as HTMLInputElement).value.trim(),
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim(),
      botcheck: (form.elements.namedItem('botcheck') as HTMLInputElement | null)?.checked
        ? '1'
        : '',
    }

    try {
      const res = await fetch('/api/project-costs-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setState('error')
        setErrorMessage(
          data.error ||
            'Could not send the message. Please email projects@iobjectm.com directly.',
        )
        return
      }
      setState('success')
      form.reset()
      setFieldErrors({})
    } catch {
      setState('error')
      setErrorMessage(
        'Could not send the message. Please email projects@iobjectm.com directly.',
      )
    } finally {
      submittingRef.current = false
    }
  }

  const mailto =
    kind === 'consultation'
      ? PROJECT_COSTS_META.consultMail
      : PROJECT_COSTS_META.estimateMail

  return (
    <div className="pc-inquiry" id={id}>
      <form className="pc-inquiry-form contact-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <input
          type="checkbox"
          name="botcheck"
          className="contact-form-honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <fieldset className="pc-inquiry-kind">
          <legend className="contact-form-label">Request type</legend>
          <div className="pc-inquiry-kind-row" role="group">
            <label className={`pc-inquiry-chip${kind === 'consultation' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="consultation"
                checked={kind === 'consultation'}
                onChange={() => setKind('consultation')}
                disabled={state === 'submitting'}
              />
              Free consultation
            </label>
            <label className={`pc-inquiry-chip${kind === 'estimate' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="kind"
                value="estimate"
                checked={kind === 'estimate'}
                onChange={() => setKind('estimate')}
                disabled={state === 'submitting'}
              />
              Project estimate
            </label>
          </div>
        </fieldset>

        <label className="contact-form-field">
          <span className="contact-form-label">Name</span>
          <input
            type="text"
            name="name"
            className={`contact-form-input${fieldErrors.name ? ' is-invalid' : ''}`}
            required
            autoComplete="name"
            disabled={state === 'submitting'}
            aria-invalid={fieldErrors.name ? true : undefined}
            onInput={() => clearFieldError('name')}
          />
          {fieldErrors.name ? (
            <span className="contact-form-field-error" role="alert">
              {fieldErrors.name}
            </span>
          ) : null}
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">Email</span>
          <input
            type="email"
            name="email"
            className={`contact-form-input${fieldErrors.email ? ' is-invalid' : ''}`}
            required
            autoComplete="email"
            disabled={state === 'submitting'}
            aria-invalid={fieldErrors.email ? true : undefined}
            onInput={() => clearFieldError('email')}
          />
          {fieldErrors.email ? (
            <span className="contact-form-field-error" role="alert">
              {fieldErrors.email}
            </span>
          ) : null}
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">
            Company or organisation <span className="pc-optional">(optional)</span>
          </span>
          <input
            type="text"
            name="company"
            className="contact-form-input"
            autoComplete="organization"
            disabled={state === 'submitting'}
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">
            Preferred delivery timeframe <span className="pc-optional">(optional)</span>
          </span>
          <input
            type="text"
            name="timeframe"
            className="contact-form-input"
            disabled={state === 'submitting'}
            placeholder="e.g. within 6 weeks, Q4, flexible"
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">
            Approximate budget <span className="pc-optional">(optional)</span>
          </span>
          <input
            type="text"
            name="budget"
            className="contact-form-input"
            disabled={state === 'submitting'}
            placeholder="e.g. €5,000–€15,000"
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">Please include a short project description.</span>
          <textarea
            name="message"
            className={`contact-form-input contact-form-textarea${fieldErrors.message ? ' is-invalid' : ''}`}
            required
            rows={5}
            disabled={state === 'submitting'}
            placeholder="Describe the main idea, intended audience, available materials and what you would like the experience to achieve."
            aria-invalid={fieldErrors.message ? true : undefined}
            onInput={() => clearFieldError('message')}
          />
          {fieldErrors.message ? (
            <span className="contact-form-field-error" role="alert">
              {fieldErrors.message}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          className="btn btn-primary contact-form-submit"
          disabled={state === 'submitting'}
        >
          {state === 'submitting'
            ? 'Sending…'
            : kind === 'consultation'
              ? 'Book a free consultation'
              : 'Request a project estimate'}
        </button>

        {state === 'success' ? (
          <p className="contact-form-feedback contact-form-feedback--success" role="status">
            Message sent to projects@iobjectm.com — we’ll reply within two business days.
          </p>
        ) : null}
        {state === 'error' ? (
          <p className="contact-form-feedback contact-form-feedback--error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <p className="contact-form-alt">
          or{' '}
          <a className="contact-form-mailto" href={mailto} data-cursor="external">
            email projects@iobjectm.com directly
          </a>
        </p>
      </form>
    </div>
  )
})
