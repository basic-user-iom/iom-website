import type { ThemeMode } from './sceneConfig'

type Props = {
  theme: ThemeMode
  onChange: (theme: ThemeMode) => void
  disabled?: boolean
}

export function ThemeToggle({ theme, onChange, disabled = false }: Props) {
  return (
    <div className="fs-toggle" role="radiogroup" aria-label="Scene theme" aria-busy={disabled}>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'night'}
        className={theme === 'night' ? 'is-active' : undefined}
        disabled={disabled}
        onClick={() => onChange('night')}
      >
        Night
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'day'}
        className={theme === 'day' ? 'is-active' : undefined}
        disabled={disabled}
        onClick={() => onChange('day')}
      >
        Day
      </button>
    </div>
  )
}
