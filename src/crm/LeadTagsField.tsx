import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useCrmI18n } from './i18n'
import {
  LEAD_TAGS_MAX,
  SUGGESTED_LEAD_TAGS,
  normalizeLeadTag,
  normalizeLeadTags,
  suggestLeadTags,
  type LeadTagSource,
} from './leadTags'

interface LeadTagsFieldProps {
  value: string[]
  onChange: (tags: string[]) => void
  source?: LeadTagSource
  disabled?: boolean
}

export function LeadTagsField({
  value,
  onChange,
  source,
  disabled = false,
}: LeadTagsFieldProps) {
  const { t } = useCrmI18n()
  const [draft, setDraft] = useState('')
  const tags = normalizeLeadTags(value)

  const suggestions = useMemo(() => {
    const have = new Set(tags)
    return SUGGESTED_LEAD_TAGS.filter((tag) => !have.has(tag)).slice(0, 24)
  }, [tags])

  const addTag = (raw: string) => {
    const tag = normalizeLeadTag(raw)
    if (!tag) return
    if (tags.includes(tag)) {
      setDraft('')
      return
    }
    if (tags.length >= LEAD_TAGS_MAX) return
    onChange([...tags, tag])
    setDraft('')
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]!)
    }
  }

  const handleSubmitDraft = (e: FormEvent) => {
    e.preventDefault()
    addTag(draft)
  }

  const handleSuggest = () => {
    if (!source) return
    onChange(suggestLeadTags(source, tags))
  }

  return (
    <div className="crm-tags-field">
      <div className="crm-tags-field-head">
        <span className="crm-label">{t('form.tags')}</span>
        {source && (
          <button
            type="button"
            className="btn btn-ghost crm-tags-suggest"
            disabled={disabled}
            onClick={handleSuggest}
          >
            {t('form.tagsSuggest')}
          </button>
        )}
      </div>
      <p className="crm-muted crm-tags-hint">{t('form.tagsHint')}</p>
      <div className="crm-tags-chips" aria-live="polite">
        {tags.length === 0 ? (
          <span className="crm-muted">{t('form.tagsEmpty')}</span>
        ) : (
          tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="crm-tag-chip crm-tag-chip--editable"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              title={t('form.tagsRemove', { tag })}
            >
              {tag}
              <span aria-hidden="true"> ×</span>
            </button>
          ))
        )}
      </div>
      <form className="crm-tags-add" onSubmit={handleSubmitDraft}>
        <input
          className="crm-input"
          value={draft}
          disabled={disabled || tags.length >= LEAD_TAGS_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('form.tagsPlaceholder')}
          aria-label={t('form.tags')}
        />
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={disabled || !normalizeLeadTag(draft) || tags.length >= LEAD_TAGS_MAX}
        >
          {t('form.tagsAdd')}
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="crm-tags-suggestions" role="group" aria-label={t('form.tagsSuggested')}>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              className="crm-tag-chip crm-tag-chip--suggest"
              disabled={disabled || tags.length >= LEAD_TAGS_MAX}
              onClick={() => addTag(tag)}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function LeadTagsDisplay({ tags }: { tags: string[] }) {
  const normalized = normalizeLeadTags(tags)
  if (normalized.length === 0) return null
  return (
    <ul className="crm-tags-display">
      {normalized.map((tag) => (
        <li key={tag} className="crm-tag-chip">
          {tag}
        </li>
      ))}
    </ul>
  )
}
