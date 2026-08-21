import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './hooks'
import { useLocale } from './i18n/LocaleContext'
import { IncisionPattern } from './IncisionPattern'

const KEY = 'dukta-entry-seen'

export function IncisionLoader({ onDone }: { onDone: () => void }) {
  const { t } = useLocale()
  const reduced = usePrefersReducedMotion()
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    try {
      return sessionStorage.getItem(KEY) !== '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!visible || reduced) {
      onDone()
      return
    }
    const done = window.setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, '1')
      } catch {
        /* ignore */
      }
      setVisible(false)
      onDone()
    }, 1600)
    return () => window.clearTimeout(done)
  }, [visible, reduced, onDone])

  if (!visible || reduced) return null

  return (
    <div className="dk-loader" role="status" aria-live="polite">
      <span className="dk-sr">{t.loader}</span>
      <div className="dk-loader__panel">
        <IncisionPattern kind="linar" openness={0.55} className="dk-loader__cuts" />
      </div>
    </div>
  )
}
