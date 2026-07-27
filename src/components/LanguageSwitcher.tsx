import { useEffect, useId, useRef, useState } from 'react'
import {
  SITE_LANG_LABELS,
  SITE_LANGS,
  switchLocaleUrl,
  useSiteI18n,
  useSiteI18nOptional,
  type SiteLang,
} from '../i18n'

export function LanguageSwitcher() {
  const i18n = useSiteI18nOptional()
  const { lang, t } = useSiteI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!i18n) return null

  const go = (next: SiteLang) => {
    if (next === lang) {
      setOpen(false)
      return
    }
    const url = switchLocaleUrl(
      next,
      window.location.pathname,
      window.location.search,
      window.location.hash,
    )
    window.history.pushState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
    setOpen(false)
  }

  return (
    <div className={`lang-switcher${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="lang-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t('nav.langAria')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-switcher-code">{lang.toUpperCase()}</span>
      </button>
      {open ? (
        <ul id={listId} className="lang-switcher-menu" role="listbox" aria-label={t('nav.langAria')}>
          {SITE_LANGS.map((code) => (
            <li key={code} role="option" aria-selected={code === lang}>
              <button
                type="button"
                className={code === lang ? 'is-active' : undefined}
                onClick={() => go(code)}
              >
                <span className="lang-switcher-code">{code.toUpperCase()}</span>
                <span className="lang-switcher-label">{SITE_LANG_LABELS[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
