import { OPTIONS } from '../../config/productConfig.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'

export function FinishSelector({ optionId }) {
  const option = OPTIONS[optionId]
  const value = useConfigurator((state) => state.values[optionId])
  const setOption = useConfigurator((state) => state.setOption)

  if (!option) return null

  return (
    <div className="swatch-grid" role="radiogroup" aria-label={option.label}>
      {option.choices.map((choice) => {
        const selected = choice.id === value
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`swatch ${selected ? 'is-selected' : ''}`}
            onClick={() => setOption(optionId, choice.id)}
          >
            <span
              className="swatch-chip"
              style={{
                background: `radial-gradient(circle at 32% 28%, ${choice.swatchInner ?? '#f0e6d6'}, ${choice.swatch})`,
              }}
            />
            <span className="swatch-copy">
              <strong>{choice.label}</strong>
              {choice.caption && <em>{choice.caption}</em>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
