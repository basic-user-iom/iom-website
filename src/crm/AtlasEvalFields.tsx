import {
  ATLAS_CRITERIA_KEYS,
  ATLAS_HEADLINE_KEYS,
  atlasPriorityComposite,
  atlasPriorityHintKey,
  hasAtlasEval,
  type AtlasEval,
  type AtlasScoreKey,
} from './atlasEval'
import { useCrmI18n } from './i18n'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  label: string
  disabled?: boolean
  readOnly?: boolean
  size?: 'md' | 'sm'
}

export function StarRating({
  value,
  onChange,
  label,
  disabled,
  readOnly,
  size = 'md',
}: StarRatingProps) {
  const interactive = !readOnly && !!onChange && !disabled
  return (
    <div
      className={`crm-stars crm-stars--${size}${readOnly ? ' is-readonly' : ''}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`${label}: ${value > 0 ? value : 'unset'} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n
        if (!interactive) {
          return (
            <span
              key={n}
              className={`crm-star${filled ? ' is-filled' : ''}`}
              aria-hidden="true"
            >
              ★
            </span>
          )
        }
        return (
          <button
            key={n}
            type="button"
            className={`crm-star-btn${filled ? ' is-filled' : ''}`}
            aria-checked={value === n}
            role="radio"
            disabled={disabled}
            onClick={() => onChange?.(value === n ? 0 : n)}
            title={String(n)}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

interface AtlasEvalFieldsProps {
  value: AtlasEval
  onChange?: (next: AtlasEval) => void
  disabled?: boolean
  readOnly?: boolean
}

function scoreLabelKey(key: AtlasScoreKey): string {
  return `atlas.${key}`
}

export function AtlasEvalFields({
  value,
  onChange,
  disabled,
  readOnly,
}: AtlasEvalFieldsProps) {
  const { t } = useCrmI18n()
  const setScore = (key: AtlasScoreKey, score: number) => {
    if (!onChange) return
    onChange({ ...value, [key]: score })
  }
  const composite = atlasPriorityComposite(value)
  const hintKey = atlasPriorityHintKey(composite)

  return (
    <div className={`crm-atlas${readOnly ? ' crm-atlas--readonly' : ''}`}>
      <p className="crm-muted crm-atlas__principle">{t('atlas.principle')}</p>
      <p className="crm-muted crm-atlas__note">{t('atlas.principleNote')}</p>

      <div className="crm-atlas__headlines">
        {ATLAS_HEADLINE_KEYS.map((key) => (
          <div key={key} className="crm-atlas__row crm-atlas__row--headline">
            <div className="crm-atlas__labels">
              <span className="crm-label">{t(scoreLabelKey(key))}</span>
              <span className="crm-muted crm-atlas__hint">
                {t(`${scoreLabelKey(key)}.hint`)}
              </span>
            </div>
            <StarRating
              value={value[key]}
              label={t(scoreLabelKey(key))}
              onChange={readOnly ? undefined : (n) => setScore(key, n)}
              disabled={disabled}
              readOnly={readOnly}
            />
          </div>
        ))}
      </div>

      <div className="crm-atlas__criteria">
        <span className="crm-label">{t('atlas.criteria')}</span>
        {ATLAS_CRITERIA_KEYS.map((key) => (
          <div key={key} className="crm-atlas__row">
            <span className="crm-atlas__criteria-label">{t(scoreLabelKey(key))}</span>
            <StarRating
              value={value[key]}
              label={t(scoreLabelKey(key))}
              onChange={readOnly ? undefined : (n) => setScore(key, n)}
              disabled={disabled}
              readOnly={readOnly}
              size="sm"
            />
          </div>
        ))}
      </div>

      {hintKey && (
        <p className="crm-muted crm-atlas__priority">
          <span className="crm-atlas__priority-label">{t('atlas.priority')}</span>{' '}
          {t(hintKey)}
        </p>
      )}
    </div>
  )
}

/** Compact hire / think stars for the lead list meta row. */
export function AtlasEvalCompact({ eval: eval_ }: { eval: AtlasEval }) {
  const { t } = useCrmI18n()
  if (!hasAtlasEval(eval_)) return null
  return (
    <span className="crm-atlas-compact" title={t('atlas.title')}>
      <span className="crm-atlas-compact__pair" title={t('atlas.can_hire_us')}>
        <span className="crm-atlas-compact__key" aria-hidden="true">
          H
        </span>
        <StarRating
          value={eval_.can_hire_us}
          label={t('atlas.can_hire_us')}
          readOnly
          size="sm"
        />
      </span>
      <span className="crm-atlas-compact__pair" title={t('atlas.thinks_like_us')}>
        <span className="crm-atlas-compact__key" aria-hidden="true">
          T
        </span>
        <StarRating
          value={eval_.thinks_like_us}
          label={t('atlas.thinks_like_us')}
          readOnly
          size="sm"
        />
      </span>
    </span>
  )
}
