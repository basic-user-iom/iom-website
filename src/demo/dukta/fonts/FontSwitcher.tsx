import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { FONT_PAIRINGS, isFontPairingId, type FontPairingId } from './pairings'
import { useFont } from './FontContext'
import { useLocale } from '../i18n/LocaleContext'

export function FontSwitcher() {
  const { font, setFont } = useFont()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const listId = useId()
  const current = FONT_PAIRINGS.find((p) => p.id === font) ?? FONT_PAIRINGS[0]

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (id: FontPairingId) => {
    setFont(id)
    setOpen(false)
  }

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const ids = FONT_PAIRINGS.map((p) => p.id)
    const index = ids.indexOf(font)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = ids[(index + 1) % ids.length]
      if (isFontPairingId(next)) setFont(next)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = ids[(index - 1 + ids.length) % ids.length]
      if (isFontPairingId(next)) setFont(next)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setFont(ids[0])
    }
    if (event.key === 'End') {
      event.preventDefault()
      setFont(ids[ids.length - 1])
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className={`dk-font${open ? ' is-open' : ''}`} ref={rootRef}>
      <span className="dk-font__label" id={labelId}>
        {t.a11y.type}
      </span>
      <button
        type="button"
        className="dk-font__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dk-font__value">{current.label}</span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="dk-font__menu"
          role="listbox"
          aria-labelledby={labelId}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {FONT_PAIRINGS.map((pairing) => (
            <li key={pairing.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={pairing.id === font}
                className={pairing.id === font ? 'is-active' : undefined}
                onClick={() => choose(pairing.id)}
              >
                <span className="dk-font__option-name">{pairing.label}</span>
                <span className="dk-font__option-note">{pairing.note}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
