import { useEffect, useId, useRef, useState } from 'react'
import { searchCitySuggestions, type CitySuggestion } from './clientWeather'
import { useCrmI18n } from './i18n'

interface CitySearchFieldProps {
  value: string
  disabled?: boolean
  onCityChange: (city: string) => void
  onSelect: (place: CitySuggestion) => void
  onClearRelated?: () => void
}

const DEBOUNCE_MS = 300

export function CitySearchField({
  value,
  disabled,
  onCityChange,
  onSelect,
  onClearRelated,
}: CitySearchFieldProps) {
  const { t, lang } = useCrmI18n()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CitySuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchedFor, setSearchedFor] = useState('')

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      abortRef.current?.abort()
      setResults([])
      setLoading(false)
      setSearchedFor('')
      setActiveIndex(-1)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      void searchCitySuggestions(q, { language: lang, count: 8, signal: ac.signal })
        .then((hits: CitySuggestion[]) => {
          if (ac.signal.aborted) return
          setResults(hits)
          setSearchedFor(q)
          setActiveIndex(hits.length ? 0 : -1)
          setOpen(true)
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setResults([])
          setSearchedFor(q)
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [value, lang])

  useEffect(() => {
    const onDocPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    return () => document.removeEventListener('mousedown', onDocPointer)
  }, [])

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const pick = (place: CitySuggestion) => {
    onSelect(place)
    setOpen(false)
    setResults([])
    setActiveIndex(-1)
  }

  const clear = () => {
    if (onClearRelated) onClearRelated()
    else onCityChange('')
    setResults([])
    setOpen(false)
    setActiveIndex(-1)
    setSearchedFor('')
  }

  const showPanel = open && value.trim().length >= 2
  const showEmpty = showPanel && !loading && searchedFor === value.trim() && results.length === 0

  return (
    <div className="crm-city-search" ref={rootRef}>
      <div className="crm-city-search__input-wrap">
        <input
          className="crm-input"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          value={value}
          disabled={disabled}
          placeholder={t('form.citySearchPlaceholder')}
          autoComplete="off"
          onChange={(e) => {
            onCityChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (value.trim().length >= 2) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!showPanel) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!results.length) return
              setActiveIndex((i) => (i + 1) % results.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (!results.length) return
              setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
            } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
              e.preventDefault()
              pick(results[activeIndex])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="crm-city-search__clear"
            onClick={clear}
            disabled={disabled}
            aria-label={t('form.cityClear')}
            title={t('form.cityClear')}
          >
            ×
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          className="crm-city-search__panel"
          id={listId}
          role="listbox"
          aria-label={t('form.citySuggestions')}
        >
          {loading ? (
            <div className="crm-city-search__status" role="status">
              {t('form.citySearching')}
            </div>
          ) : null}
          {!loading &&
            results.map((place, index) => (
              <button
                key={place.id}
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? 'crm-city-search__option is-active'
                    : 'crm-city-search__option'
                }
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(place)}
              >
                <span className="crm-city-search__option-name">{place.name}</span>
                <span className="crm-city-search__option-meta">
                  {[place.admin1, place.country || place.countryCode]
                    .filter(Boolean)
                    .join(' · ')}
                  {place.timezone ? ` · ${place.timezone}` : ''}
                </span>
              </button>
            ))}
          {showEmpty ? (
            <div className="crm-city-search__status">{t('form.cityNoResults')}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
