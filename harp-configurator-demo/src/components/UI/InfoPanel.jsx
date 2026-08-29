import { useEffect, useRef } from 'react'
import { Icons } from './Icons.jsx'

export function InfoPanel({ open, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <aside
        className="info-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="icon-btn overlay-close" onClick={onClose} aria-label="Close information">
          <Icons.Close />
        </button>
        <p className="kicker">About</p>
        <h2 id="info-title">Interactive configuration study</h2>
        <p>
          This demonstration uses a generic harp model to illustrate how a browser-based product configurator can
          handle materials, components, add-ons and product variants.
        </p>
        <p>
          A production version can be built around the actual Marini Made Harps models, options and product
          information.
        </p>
      </aside>
    </div>
  )
}
