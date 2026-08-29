import { OPTIONS } from '../../config/productConfig.js'
import { CAMERA_VIEWS } from '../../config/productConfig.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { FinishSelector } from './FinishSelector.jsx'
import { ChoiceRow, OptionToggle } from './OptionToggle.jsx'

export function OptionControl({ optionId }) {
  const option = OPTIONS[optionId]
  if (!option) {
    if (import.meta.env.DEV) console.warn(`[harp-configurator] missing option ${optionId}`)
    return null
  }

  if (option.type === 'material') return <FinishSelector optionId={optionId} />
  if (option.type === 'boolean') return <OptionToggle optionId={optionId} />
  if (option.type === 'choice' || option.type === 'lighting') return <ChoiceRow optionId={optionId} />
  return null
}

export function ViewPresetRow() {
  const view = useViewer((state) => state.view)
  const requestView = useViewer((state) => state.requestView)

  return (
    <div className="choice-block">
      <p className="option-label">Camera</p>
      <div className="choice-row" role="radiogroup" aria-label="Camera">
        {CAMERA_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={view === item.id}
            className={view === item.id ? 'is-active' : ''}
            onClick={() => requestView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AccordionSection({ group, open, onToggle, children }) {
  const panelId = `section-${group.id}`
  const buttonId = `${panelId}-button`

  return (
    <section className={`accordion ${open ? 'is-open' : ''}`}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="accordion-index">{group.index}</span>
          <span>{group.title}</span>
          <span className="accordion-mark" aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
        {group.blurb && <p className="section-blurb">{group.blurb}</p>}
        {children}
      </div>
    </section>
  )
}

export function useOptionValue(optionId) {
  return useConfigurator((state) => state.values[optionId])
}
