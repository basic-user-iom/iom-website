import type { RefObject } from 'react'
import type { LinarMaterialId } from './types'
import { LINAR_MATERIALS } from './types'

type Props = {
  bend: number
  material: LinarMaterialId
  sliderRef: RefObject<HTMLInputElement | null>
  percentRef: RefObject<HTMLSpanElement | null>
  onBendInput: (value: number) => void
  onMaterial: (id: LinarMaterialId) => void
  onResetView: () => void
  onResetPanel: () => void
}

export function LinarControls({
  bend,
  material,
  sliderRef,
  percentRef,
  onBendInput,
  onMaterial,
  onResetView,
  onResetPanel,
}: Props) {
  return (
    <div className="linar-controls">
      <div className="linar-control">
        <div className="linar-control__head">
          <label className="linar-label" htmlFor="linar-bend">
            Bend
          </label>
          <span className="linar-percent" ref={percentRef}>
            {Math.round(bend)}%
          </span>
        </div>
        <p className="linar-instruction">Move the control to bend the panel.</p>
        <input
          ref={sliderRef}
          id="linar-bend"
          className="linar-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={bend}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(bend)}
          aria-valuetext={`${Math.round(bend)} percent`}
          aria-label="Bend"
          onInput={(event) => onBendInput(Number(event.currentTarget.value))}
        />
      </div>

      <div className="linar-control">
        <p className="linar-label" id="linar-material-label">
          Material
        </p>
        <div className="linar-materials" role="group" aria-labelledby="linar-material-label">
          {LINAR_MATERIALS.map((item) => {
            const active = item.id === material
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'linar-chip is-active' : 'linar-chip'}
                aria-pressed={active}
                onClick={() => onMaterial(item.id)}
              >
                <span className="linar-chip__name">{item.label}</span>
                <span className="linar-chip__state">{active ? 'Selected' : 'Select'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="linar-control">
        <p className="linar-label" id="linar-view-label">
          View
        </p>
        <div className="linar-actions" role="group" aria-labelledby="linar-view-label">
          <button type="button" className="linar-text-btn" onClick={onResetView}>
            Reset view
          </button>
          <button type="button" className="linar-text-btn" onClick={onResetPanel}>
            Reset panel
          </button>
        </div>
      </div>
    </div>
  )
}
