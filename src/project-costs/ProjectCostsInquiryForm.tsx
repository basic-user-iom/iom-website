import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSiteI18n } from '../i18n'
import { getProjectCostsCopy } from '../i18n/projectCosts'
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
  const { lang } = useSiteI18n()
  const pack = getProjectCostsCopy(lang)
  const copy = pack.inquiry
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

    if (!name) next.name = copy.required
    if (!email) next.email = copy.required
    else if (!isValidEmail(email)) next.email = copy.invalidEmail
    if (!message || message.length < 8) {
      next.message = copy.messageShort
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
        setErrorMessage(data.error || copy.error)
        return
      }
      setState('success')
      form.reset()
      setFieldErrors({})
    } catch {
      setState('error')
      setErrorMessage(copy.error)
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
          <legend className="contact-form-label">{copy.requestType}</legend>
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
              {copy.consultation}
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
              {copy.estimate}
            </label>
          </div>
        </fieldset>

        <label className="contact-form-field">
          <span className="contact-form-label">{copy.name}</span>
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
          <span className="contact-form-label">{copy.email}</span>
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
            {copy.company} <span className="pc-optional">{copy.optional}</span>
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
            {copy.timeframe} <span className="pc-optional">{copy.optional}</span>
          </span>
          <input
            type="text"
            name="timeframe"
            className="contact-form-input"
            disabled={state === 'submitting'}
            placeholder={copy.timeframePh}
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">
            {copy.budget} <span className="pc-optional">{copy.optional}</span>
          </span>
          <input
            type="text"
            name="budget"
            className="contact-form-input"
            disabled={state === 'submitting'}
            placeholder={copy.budgetPh}
          />
        </label>

        <label className="contact-form-field">
          <span className="contact-form-label">{copy.message}</span>
          <textarea
            name="message"
            className={`contact-form-input contact-form-textarea${fieldErrors.message ? ' is-invalid' : ''}`}
            required
            rows={5}
            disabled={state === 'submitting'}
            placeholder={copy.messagePh}
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
            ? copy.sending
            : kind === 'consultation'
              ? pack.page.bookConsult
              : pack.page.requestEstimate}
        </button>

        {state === 'success' ? (
          <p className="contact-form-feedback contact-form-feedback--success" role="status">
            {copy.success}
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
            {copy.emailDirect}
          </a>
        </p>
      </form>
    </div>
  )
})
