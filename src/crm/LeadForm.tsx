import { useMemo, useState, type FormEvent } from 'react'
import {
  hrefForLeadUrl,
  isLightlyValidEmail,
  isLightlyValidUrl,
  normalizeLeadEmails,
  normalizeLeadLinks,
} from './api'
import { AtlasEvalFields } from './AtlasEvalFields'
import { EMPTY_ATLAS_EVAL, normalizeAtlasEval } from './atlasEval'
import { CitySearchField } from './CitySearchField'
import { geocodeClientLocation, type CitySuggestion } from './clientWeather'
import { EMPTY_LEAD_INPUT } from './constants'
import { LEAD_STATUS_VALUES, LEAD_TEMP_VALUES, useCrmI18n } from './i18n'
import { LeadChatGptPanel } from './LeadChatGptPanel'
import { mergeLeadImport } from './leadChatGpt'
import {
  COMMON_TIMEZONES,
  filterTimezones,
  isValidIanaTimezone,
  suggestTimezoneFromCity,
} from './timezones'
import type { Lead, LeadEmail, LeadInput, LeadLink } from './types'
import {
  VALUE_EMOJI_OPTIONS,
  isHeartValueEmoji,
  isNoChargeValueEmoji,
  normalizeValueEmoji,
} from './valueEmoji'

interface LeadFormProps {
  initial?: Lead | null
  onSubmit: (input: LeadInput) => Promise<void>
  onCancel: () => void
}

type LinkDraft = LeadLink
type EmailDraft = LeadEmail

function emptyLinkRow(): LinkDraft {
  return { label: '', url: '' }
}

function emptyEmailRow(): EmailDraft {
  return { label: '', email: '' }
}

function leadToForm(initial: Lead): LeadInput {
  const links = normalizeLeadLinks(initial.links)
  const emails = normalizeLeadEmails(initial.emails)
  return {
    company_name: initial.company_name,
    website: initial.website,
    links: links.length > 0 ? links : [],
    contact_name: initial.contact_name,
    contact_role: initial.contact_role ?? '',
    email: initial.email,
    emails: emails.length > 0 ? emails : [],
    phone: initial.phone,
    offer: initial.offer,
    company_focus: initial.company_focus ?? '',
    notes: initial.notes,
    initial_email_subject: initial.initial_email_subject ?? '',
    initial_email_body: initial.initial_email_body ?? '',
    initial_email_drafted_at: initial.initial_email_drafted_at ?? null,
    initial_email_sent_at: initial.initial_email_sent_at ?? null,
    temperature: initial.temperature,
    status: initial.status,
    next_follow_up: initial.next_follow_up,
    estimated_value: initial.estimated_value,
    value_emoji: normalizeValueEmoji(initial.value_emoji),
    atlas_eval: normalizeAtlasEval(initial.atlas_eval),
    client_timezone: initial.client_timezone ?? '',
    client_city: initial.client_city ?? '',
    client_country: initial.client_country ?? '',
    client_address: initial.client_address ?? '',
    client_lat: initial.client_lat ?? null,
    client_lon: initial.client_lon ?? null,
  }
}

export function LeadForm({ initial, onSubmit, onCancel }: LeadFormProps) {
  const { t, statusLabel, tempLabel } = useCrmI18n()
  const [form, setForm] = useState<LeadInput>(() =>
    initial
      ? leadToForm(initial)
      : { ...EMPTY_LEAD_INPUT, links: [], emails: [], atlas_eval: { ...EMPTY_ATLAS_EVAL } },
  )
  const [tzQuery, setTzQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set =
    <K extends keyof LeadInput>(key: K) =>
    (value: LeadInput[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }))

  const linkRows = form.links ?? []
  const emailRows = form.emails ?? []

  const updateLink = (index: number, field: keyof LinkDraft, value: string) => {
    setForm((prev) => {
      const next = [...(prev.links ?? [])]
      const row = { ...(next[index] ?? emptyLinkRow()), [field]: value }
      next[index] = row
      return { ...prev, links: next }
    })
  }

  const addLinkRow = () => {
    setForm((prev) => ({
      ...prev,
      links: [...(prev.links ?? []), emptyLinkRow()],
    }))
  }

  const removeLinkRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      links: (prev.links ?? []).filter((_, i) => i !== index),
    }))
  }

  const updateEmail = (index: number, field: keyof EmailDraft, value: string) => {
    setForm((prev) => {
      const next = [...(prev.emails ?? [])]
      const row = { ...(next[index] ?? emptyEmailRow()), [field]: value }
      next[index] = row
      return { ...prev, emails: next }
    })
  }

  const addEmailRow = () => {
    setForm((prev) => ({
      ...prev,
      emails: [...(prev.emails ?? []), emptyEmailRow()],
    }))
  }

  const removeEmailRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      emails: (prev.emails ?? []).filter((_, i) => i !== index),
    }))
  }

  const tzOptions = useMemo(() => filterTimezones(tzQuery), [tzQuery])

  const handleCitySelect = (place: CitySuggestion) => {
    const tzFromApi =
      place.timezone && isValidIanaTimezone(place.timezone) ? place.timezone : ''
    const tz = tzFromApi || suggestTimezoneFromCity(place.name) || ''
    setForm((prev) => ({
      ...prev,
      client_city: place.name,
      client_country: place.country || place.countryCode || prev.client_country,
      client_timezone: tz || prev.client_timezone,
      client_lat: place.lat,
      client_lon: place.lon,
    }))
    if (tz) setTzQuery(tz)
  }

  const handleCityTextChange = (city: string) => {
    setForm((prev) => ({
      ...prev,
      client_city: city,
      client_lat: null,
      client_lon: null,
    }))
  }

  const handleCityClearRelated = () => {
    setForm((prev) => ({
      ...prev,
      client_city: '',
      client_country: '',
      client_timezone: '',
      client_lat: null,
      client_lon: null,
    }))
    setTzQuery('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const city = form.client_city.trim()
      const country = form.client_country.trim()
      let timezone = form.client_timezone.trim()
      let lat = form.client_lat
      let lon = form.client_lon

      if (timezone && !isValidIanaTimezone(timezone)) {
        throw new Error(t('form.timezoneInvalid'))
      }

      for (const row of form.links ?? []) {
        const url = row.url.trim()
        if (!url) continue
        if (!isLightlyValidUrl(url)) throw new Error(t('form.linkUrlInvalid'))
      }
      const links = normalizeLeadLinks(
        (form.links ?? []).map((row) => ({
          label: row.label.trim(),
          url: hrefForLeadUrl(row.url.trim()) || row.url.trim(),
        })),
      )

      for (const row of form.emails ?? []) {
        const email = row.email.trim()
        if (!email) continue
        if (!isLightlyValidEmail(email)) throw new Error(t('form.emailInvalid'))
      }
      const emails = normalizeLeadEmails(
        (form.emails ?? []).map((row) => ({
          label: row.label.trim(),
          email: row.email.trim(),
        })),
      )

      const placeChanged =
        !initial ||
        city !== (initial.client_city ?? '').trim() ||
        country !== (initial.client_country ?? '').trim()

      if (city && (placeChanged || lat == null || lon == null)) {
        const geo = await geocodeClientLocation(city, country)
        if (geo) {
          lat = geo.lat
          lon = geo.lon
          if (!timezone && geo.timezone && isValidIanaTimezone(geo.timezone)) {
            timezone = geo.timezone
          }
        } else {
          lat = null
          lon = null
        }
      }
      if (!city) {
        lat = null
        lon = null
      }

      await onSubmit({
        ...form,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_role: form.contact_role.trim(),
        company_focus: form.company_focus.trim(),
        website: form.website.trim(),
        links,
        emails,
        email: form.email.trim(),
        phone: form.phone.trim(),
        offer: form.offer.trim(),
        notes: form.notes.trim(),
        initial_email_subject: form.initial_email_subject.trim(),
        initial_email_body: form.initial_email_body.trim(),
        initial_email_drafted_at:
          form.initial_email_subject.trim() && form.initial_email_body.trim()
            ? form.initial_email_drafted_at ?? new Date().toISOString()
            : form.initial_email_drafted_at,
        next_follow_up: form.next_follow_up || null,
        estimated_value:
          form.estimated_value === null || Number.isNaN(form.estimated_value)
            ? null
            : form.estimated_value,
        value_emoji: normalizeValueEmoji(form.value_emoji),
        atlas_eval: normalizeAtlasEval(form.atlas_eval),
        client_timezone: timezone,
        client_city: city,
        client_country: country,
        client_lat: lat,
        client_lon: lon,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.saveFailed'))
      setBusy(false)
      return
    }
    setBusy(false)
  }

  return (
    <form className="crm-form crm-lead-form" onSubmit={(e) => void handleSubmit(e)}>
      {!initial && (
        <LeadChatGptPanel
          seedHint={form.company_name || form.website}
          onImport={(data) => {
            setForm((prev) => mergeLeadImport(prev, data))
            if (data.client_timezone?.trim()) setTzQuery(data.client_timezone.trim())
            setError('')
          }}
        />
      )}

      <div className="crm-form-grid">
        <label className="crm-field">
          <span className="crm-label">{t('form.company')}</span>
          <input
            className="crm-input"
            value={form.company_name}
            onChange={(e) => set('company_name')(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.website')}</span>
          <input
            className="crm-input"
            type="url"
            placeholder="https://"
            value={form.website}
            onChange={(e) => set('website')(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.contact')}</span>
          <input
            className="crm-input"
            value={form.contact_name}
            onChange={(e) => set('contact_name')(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.contactRole')}</span>
          <input
            className="crm-input"
            value={form.contact_role}
            onChange={(e) => set('contact_role')(e.target.value)}
            placeholder={t('form.contactRolePlaceholder')}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.email')}</span>
          <input
            className="crm-input"
            type="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.phone')}</span>
          <input
            className="crm-input"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.value')}</span>
          <input
            className="crm-input"
            type="number"
            min={0}
            step={100}
            value={form.estimated_value ?? ''}
            onChange={(e) =>
              set('estimated_value')(e.target.value === '' ? null : Number(e.target.value))
            }
            placeholder={
              isNoChargeValueEmoji(form.value_emoji)
                ? t('form.valueOptionalHint')
                : undefined
            }
            disabled={busy}
          />
        </label>
        <div className="crm-field crm-field--span2">
          <span className="crm-label" id="crm-value-emoji-label">
            {t('form.valueEmoji')}
          </span>
          <div
            className="crm-value-emoji-picker"
            role="group"
            aria-labelledby="crm-value-emoji-label"
          >
            {VALUE_EMOJI_OPTIONS.map((opt) => {
              const selected = (form.value_emoji || '') === opt.emoji
              const label = t(opt.i18nKey)
              return (
                <button
                  key={opt.i18nKey}
                  type="button"
                  className={`crm-value-emoji-btn${selected ? ' is-selected' : ''}`}
                  onClick={() => set('value_emoji')(opt.emoji)}
                  disabled={busy}
                  aria-pressed={selected}
                  title={label}
                >
                  <span className="crm-value-emoji-btn__glyph" aria-hidden="true">
                    {opt.emoji || '—'}
                  </span>
                  <span className="crm-value-emoji-btn__label">{label}</span>
                </button>
              )
            })}
          </div>
          {isHeartValueEmoji(form.value_emoji) && (
            <p className="crm-muted crm-value-emoji-hint">{t('form.valueEmojiHeartHint')}</p>
          )}
        </div>
        <label className="crm-field">
          <span className="crm-label">{t('form.temperature')}</span>
          <select
            className="crm-input"
            value={form.temperature}
            onChange={(e) => set('temperature')(e.target.value as LeadInput['temperature'])}
            disabled={busy}
          >
            {LEAD_TEMP_VALUES.map((value) => (
              <option key={value} value={value}>
                {tempLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.stage')}</span>
          <select
            className="crm-input"
            value={form.status}
            onChange={(e) => set('status')(e.target.value as LeadInput['status'])}
            disabled={busy}
          >
            {LEAD_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('form.followUp')}</span>
          <input
            className="crm-input"
            type="date"
            value={form.next_follow_up ?? ''}
            onChange={(e) => set('next_follow_up')(e.target.value || null)}
            disabled={busy}
          />
        </label>
      </div>

      <fieldset className="crm-links-fieldset" disabled={busy}>
        <legend className="crm-label">{t('form.emailsSection')}</legend>
        <p className="crm-muted crm-links-hint">{t('form.emailsHint')}</p>
        {emailRows.length === 0 ? (
          <p className="crm-muted crm-links-empty">{t('form.emailsEmpty')}</p>
        ) : (
          <ul className="crm-links-editor">
            {emailRows.map((row, index) => (
              <li key={index} className="crm-links-editor__row">
                <label className="crm-field crm-links-editor__label">
                  <span className="crm-label">{t('form.emailLabel')}</span>
                  <input
                    className="crm-input"
                    value={row.label}
                    onChange={(e) => updateEmail(index, 'label', e.target.value)}
                    placeholder={t('form.emailLabelPlaceholder')}
                    disabled={busy}
                  />
                </label>
                <label className="crm-field crm-links-editor__url">
                  <span className="crm-label">{t('form.emailAddress')}</span>
                  <input
                    className="crm-input"
                    type="email"
                    autoComplete="email"
                    value={row.email}
                    onChange={(e) => updateEmail(index, 'email', e.target.value)}
                    placeholder={t('form.emailAddressPlaceholder')}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost crm-links-editor__remove"
                  onClick={() => removeEmailRow(index)}
                  disabled={busy}
                  aria-label={t('form.emailRemove')}
                >
                  {t('form.emailRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost crm-links-add"
          onClick={addEmailRow}
          disabled={busy}
        >
          {t('form.emailAdd')}
        </button>
      </fieldset>

      <fieldset className="crm-links-fieldset" disabled={busy}>
        <legend className="crm-label">{t('form.linksSection')}</legend>
        <p className="crm-muted crm-links-hint">{t('form.linksHint')}</p>
        {linkRows.length === 0 ? (
          <p className="crm-muted crm-links-empty">{t('form.linksEmpty')}</p>
        ) : (
          <ul className="crm-links-editor">
            {linkRows.map((row, index) => (
              <li key={index} className="crm-links-editor__row">
                <label className="crm-field crm-links-editor__label">
                  <span className="crm-label">{t('form.linkLabel')}</span>
                  <input
                    className="crm-input"
                    value={row.label}
                    onChange={(e) => updateLink(index, 'label', e.target.value)}
                    placeholder={t('form.linkLabelPlaceholder')}
                    disabled={busy}
                  />
                </label>
                <label className="crm-field crm-links-editor__url">
                  <span className="crm-label">{t('form.linkUrl')}</span>
                  <input
                    className="crm-input"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={row.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    placeholder={t('form.linkUrlPlaceholder')}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost crm-links-editor__remove"
                  onClick={() => removeLinkRow(index)}
                  disabled={busy}
                  aria-label={t('form.linkRemove')}
                >
                  {t('form.linkRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost crm-links-add"
          onClick={addLinkRow}
          disabled={busy}
        >
          {t('form.linkAdd')}
        </button>
      </fieldset>

      <fieldset className="crm-outreach-fieldset" disabled={busy}>
        <legend className="crm-label">{t('form.outreachSection')}</legend>
        <p className="crm-muted crm-outreach-hint">{t('form.outreachHint')}</p>
        <label className="crm-field">
          <span className="crm-label">{t('outreach.companyFocus')}</span>
          <textarea
            className="crm-input crm-textarea"
            rows={2}
            value={form.company_focus}
            onChange={(e) => set('company_focus')(e.target.value)}
            placeholder={t('form.companyFocusPlaceholder')}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('outreach.subject')}</span>
          <input
            className="crm-input"
            value={form.initial_email_subject}
            onChange={(e) => set('initial_email_subject')(e.target.value)}
            placeholder={t('form.initialEmailSubjectPlaceholder')}
            disabled={busy}
          />
        </label>
        <label className="crm-field">
          <span className="crm-label">{t('outreach.body')}</span>
          <textarea
            className="crm-input crm-textarea"
            rows={8}
            value={form.initial_email_body}
            onChange={(e) => set('initial_email_body')(e.target.value)}
            placeholder={t('form.initialEmailBodyPlaceholder')}
            disabled={busy}
          />
        </label>
      </fieldset>

      <fieldset className="crm-atlas-fieldset" disabled={busy}>
        <legend className="crm-label">{t('atlas.title')}</legend>
        <AtlasEvalFields
          value={form.atlas_eval ?? EMPTY_ATLAS_EVAL}
          onChange={(atlas_eval) => set('atlas_eval')(atlas_eval)}
          disabled={busy}
        />
      </fieldset>

      <fieldset className="crm-locale-fieldset" disabled={busy}>
        <legend className="crm-label">{t('form.localeSection')}</legend>
        <p className="crm-muted crm-locale-hint">{t('form.localeHint')}</p>
        <div className="crm-form-grid">
          <div className="crm-field">
            <span className="crm-label">{t('form.city')}</span>
            <CitySearchField
              value={form.client_city}
              disabled={busy}
              onCityChange={handleCityTextChange}
              onSelect={handleCitySelect}
              onClearRelated={handleCityClearRelated}
            />
          </div>
          <label className="crm-field">
            <span className="crm-label">{t('form.country')}</span>
            <input
              className="crm-input"
              value={form.client_country}
              onChange={(e) => set('client_country')(e.target.value)}
              placeholder={t('form.countryPlaceholder')}
              autoComplete="country-name"
            />
          </label>
          <label className="crm-field crm-field--span2">
            <span className="crm-label">{t('form.timezone')}</span>
            <input
              className="crm-input"
              list="crm-tz-list"
              value={form.client_timezone}
              onChange={(e) => {
                set('client_timezone')(e.target.value)
                setTzQuery(e.target.value)
              }}
              onFocus={() => setTzQuery(form.client_timezone)}
              placeholder={t('form.timezonePlaceholder')}
              autoComplete="off"
            />
            <datalist id="crm-tz-list">
              {(tzQuery ? tzOptions : COMMON_TIMEZONES).slice(0, 40).map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label} ({z.region})
                </option>
              ))}
            </datalist>
          </label>
        </div>
      </fieldset>

      <label className="crm-field">
        <span className="crm-label">{t('form.offer')}</span>
        <textarea
          className="crm-input crm-textarea"
          rows={3}
          value={form.offer}
          onChange={(e) => set('offer')(e.target.value)}
          placeholder={t('form.offerPlaceholder')}
          disabled={busy}
        />
      </label>

      <label className="crm-field">
        <span className="crm-label">{t('form.notes')}</span>
        <textarea
          className="crm-input crm-textarea crm-textarea--notes"
          rows={7}
          value={form.notes}
          onChange={(e) => set('notes')(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="crm-form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('form.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('form.saving') : initial ? t('form.save') : t('form.add')}
        </button>
      </div>
      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
