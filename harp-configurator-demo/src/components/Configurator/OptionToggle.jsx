import { OPTIONS } from '../../config/productConfig.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'

export function OptionToggle({ optionId }) {
  const option = OPTIONS[optionId]
  const value = useConfigurator((state) => state.values[optionId])
  const setOption = useConfigurator((state) => state.setOption)

  if (!option) return null

  return (
    <div className="option-row">
      <div>
        <p className="option-label">{option.label}</p>
        {option.description && <p className="option-help">{option.description}</p>}
      </div>
      <button
        type="button"
        className={`toggle ${value ? 'is-on' : ''}`}
        aria-pressed={Boolean(value)}
        aria-label={`${option.label}: ${value ? 'on' : 'off'}`}
        onClick={() => setOption(optionId, !value)}
      >
        <span />
      </button>
    </div>
  )
}

export function ChoiceRow({ optionId }) {
  const option = OPTIONS[optionId]
  const value = useConfigurator((state) => state.values[optionId])
  const setOption = useConfigurator((state) => state.setOption)
  const requestView = useViewer((state) => state.requestView)
  const selectedChoice = option?.choices.find((choice) => choice.id === value)

  if (!option) return null

  return (
    <div className="choice-block">
      <p className="option-label">{option.label}</p>
      <div className="choice-row" role="radiogroup" aria-label={option.label}>
        {option.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={choice.id === value}
            className={choice.id === value ? 'is-active' : ''}
            onClick={() => {
              setOption(optionId, choice.id)
              if (optionId === 'detail' && choice.id === 'emblem') {
                requestView('rear')
              }
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {selectedChoice?.caption && <p className="option-help">{selectedChoice.caption}</p>}
    </div>
  )
}
