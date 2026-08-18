type Props = {
  exploded: boolean
  onChange: (value: boolean) => void
}

/** Shown only when the loaded GLB has separable named parts. */
export function MechanismMode({ exploded, onChange }: Props) {
  return (
    <div className="pov-mechanism" role="group" aria-label="Mechanism inspect">
      <button
        type="button"
        className={!exploded ? 'pov-chip is-active' : 'pov-chip'}
        aria-pressed={!exploded}
        onClick={() => onChange(false)}
      >
        Assembled
      </button>
      <button
        type="button"
        className={exploded ? 'pov-chip is-active' : 'pov-chip'}
        aria-pressed={exploded}
        onClick={() => onChange(true)}
      >
        Exploded
      </button>
    </div>
  )
}
