import { useMemo, useState } from 'react'
import { OPTION_GROUPS } from '../../config/productConfig.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useIsMobile } from '../../hooks/useMedia.js'
import { AccordionSection, OptionControl, ViewPresetRow } from './OptionControl.jsx'
import { ConfigurationSummary } from './ConfigurationSummary.jsx'

export function ConfiguratorPanel() {
  const isMobile = useIsMobile()
  const values = useConfigurator((state) => state.values)
  const initial = useMemo(
    () => OPTION_GROUPS.filter((group) => group.defaultOpen).map((group) => group.id),
    [],
  )
  const [openIds, setOpenIds] = useState(initial)
  const [sheetOpen, setSheetOpen] = useState(false)

  const toggle = (id) => {
    setOpenIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const panel = (
    <>
      <div className="panel-head">
        {isMobile && (
          <button
            type="button"
            className="sheet-handle"
            aria-label={sheetOpen ? 'Collapse configuration' : 'Expand configuration'}
            onClick={() => setSheetOpen((value) => !value)}
          />
        )}
        <p className="kicker">Customize</p>
        {isMobile && (
          <button type="button" className="text-btn sheet-toggle" onClick={() => setSheetOpen((value) => !value)}>
            {sheetOpen ? 'Close' : 'Open'}
          </button>
        )}
      </div>
      <div className="panel-body">
        {OPTION_GROUPS.map((group) => (
          <AccordionSection
            key={group.id}
            group={group}
            open={openIds.includes(group.id)}
            onToggle={() => {
              if (isMobile && !sheetOpen) setSheetOpen(true)
              toggle(group.id)
            }}
          >
            {group.optionIds.map((optionId) => (
              <OptionControl key={optionId} optionId={optionId} />
            ))}
            {group.id === 'view' && <ViewPresetRow />}
          </AccordionSection>
        ))}
        <ConfigurationSummary values={values} />
      </div>
    </>
  )

  if (isMobile) {
    return (
      <aside className={`config-panel is-sheet ${sheetOpen ? 'is-open' : ''}`} aria-label="Customize">
        {panel}
      </aside>
    )
  }

  return (
    <aside className="config-panel" aria-label="Customize">
      {panel}
    </aside>
  )
}
