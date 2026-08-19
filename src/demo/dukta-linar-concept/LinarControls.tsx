import type { RefObject } from 'react'
import { JANUS_THICKNESS_NOTE, type LinarTech } from './linarData'
import {
  LINAR_APPLICATIONS,
  LINAR_BACKINGS,
  LINAR_MATERIALS,
  type LinarApplication,
  type LinarBacking,
  type LinarConfig,
  type LinarMaterialId,
  type LinarPattern,
} from './types'

type Props = {
  bend: number
  config: LinarConfig
  tech: LinarTech
  previewRadiusMm: number | null
  sliderRef: RefObject<HTMLInputElement | null>
  percentRef: RefObject<HTMLSpanElement | null>
  onBendInput: (value: number) => void
  onConfig: (patch: Partial<LinarConfig>) => void
  onResetView: () => void
  onResetPanel: () => void
}

function RangeRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <div className="linar-range">
      <div className="linar-control__head">
        <label className="linar-label" htmlFor={id}>
          {label}
        </label>
        <span className="linar-percent">{display}</span>
      </div>
      <input
        id={id}
        className="linar-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  )
}

function ChipGroup<T extends string>({
  labelId,
  label,
  items,
  value,
  onChange,
}: {
  labelId: string
  label: string
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field">
      <p className="linar-label" id={labelId}>
        {label}
      </p>
      <div className="linar-materials" role="group" aria-labelledby={labelId}>
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'linar-chip is-active' : 'linar-chip'}
              aria-pressed={active}
              onClick={() => onChange(item.id)}
            >
              <span className="linar-chip__name">{item.label}</span>
              <span className="linar-chip__state">{active ? 'Selected' : 'Select'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function LinarControls({
  bend,
  config,
  tech,
  previewRadiusMm,
  sliderRef,
  percentRef,
  onBendInput,
  onConfig,
  onResetView,
  onResetPanel,
}: Props) {
  const radiusText =
    previewRadiusMm == null ? 'Nearly flat' : `${Math.round(previewRadiusMm)} mm preview radius`
  const referenceText =
    tech.referenceMinimumRadiusMm == null
      ? 'No validated radius for this combination'
      : `100% aims toward ${tech.referenceMinimumRadiusMm} mm sample radius`

  return (
    <div className="linar-controls">
      <details className="linar-acc" open>
        <summary className="linar-acc__sum">Panel</summary>
        <div className="linar-acc__body">
          <ChipGroup
            labelId="linar-material-label"
            label="Material"
            items={LINAR_MATERIALS}
            value={config.material}
            onChange={(id: LinarMaterialId) => onConfig({ material: id })}
          />
          <RangeRow
            id="linar-thickness"
            label="Thickness"
            value={config.thicknessMm}
            min={4}
            max={15}
            step={1}
            display={`${config.thicknessMm} mm`}
            onChange={(value) => onConfig({ thicknessMm: value })}
          />
          <p className="linar-note">{JANUS_THICKNESS_NOTE}</p>
        </div>
      </details>

      <details className="linar-acc" open>
        <summary className="linar-acc__sum">Incision</summary>
        <div className="linar-acc__body">
          <RangeRow
            id="linar-incision"
            label="Incision length"
            value={config.incisionLengthMm}
            min={40}
            max={400}
            step={1}
            display={`${config.incisionLengthMm} mm`}
            onChange={(value) => onConfig({ incisionLengthMm: value })}
          />
          <RangeRow
            id="linar-cut"
            label="Cut width"
            value={config.cutWidthMm}
            min={2}
            max={8}
            step={1}
            display={`${config.cutWidthMm} mm`}
            onChange={(value) => onConfig({ cutWidthMm: value })}
          />
          <RangeRow
            id="linar-slat"
            label="Slat / web width"
            value={config.slatWidthMm}
            min={2}
            max={8}
            step={1}
            display={`${config.slatWidthMm} mm`}
            onChange={(value) => onConfig({ slatWidthMm: value })}
          />
          <p className="linar-note">
            {config.cutWidthMm}/{config.slatWidthMm} mm means a {config.cutWidthMm} mm perforating
            cut and a {config.slatWidthMm} mm uncut slat. Incision and bridge lengths repeat across
            the incised area.
          </p>
          <RangeRow
            id="linar-coverage"
            label="Incised area coverage"
            value={config.incisedTwelfths}
            min={1}
            max={12}
            step={1}
            display={`${config.incisedTwelfths}/12`}
            onChange={(value) => onConfig({ incisedTwelfths: value })}
          />
          <ChipGroup
            labelId="linar-pattern-label"
            label="Pattern"
            items={[
              { id: 'regular' as const, label: 'Regular' },
              { id: 'irregular' as const, label: 'Irregular' },
            ]}
            value={config.pattern}
            onChange={(id: LinarPattern) => onConfig({ pattern: id })}
          />
          {config.pattern === 'irregular' ? <p className="linar-note">{tech.irregularNote}</p> : null}
        </div>
      </details>

      <details className="linar-acc" open>
        <summary className="linar-acc__sum">Application</summary>
        <div className="linar-acc__body">
          <ChipGroup
            labelId="linar-application-label"
            label="Application"
            items={LINAR_APPLICATIONS}
            value={config.application}
            onChange={(id: LinarApplication) => onConfig({ application: id })}
          />
          <ChipGroup
            labelId="linar-backing-label"
            label="Backing material"
            items={LINAR_BACKINGS}
            value={config.backing}
            onChange={(id: LinarBacking) => onConfig({ backing: id })}
          />
          <p className="linar-note">
            Application and backing are descriptive configuration metadata. They do not change the
            bending calculation.
          </p>
        </div>
      </details>

      <details className="linar-acc" open>
        <summary className="linar-acc__sum">Bending</summary>
        <div className="linar-acc__body">
          <div className="linar-range">
            <div className="linar-control__head">
              <label className="linar-label" htmlFor="linar-bend">
                Bend preview
              </label>
              <span className="linar-percent" ref={percentRef}>
                {Math.round(bend)}%
              </span>
            </div>
            <p className="linar-instruction">
              0% is nearly flat. 100% bends toward the selected reference radius when a physical
              sample exists.
            </p>
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
              aria-label="Bend preview"
              onInput={(event) => onBendInput(Number(event.currentTarget.value))}
            />
            <p className="linar-note">
              {radiusText}. {referenceText}.
            </p>
          </div>
        </div>
      </details>

      <div className="linar-control">
        <p className="linar-label" id="linar-view-label">
          View
        </p>
        <p className="linar-instruction">Drag to rotate. Scroll or pinch to zoom.</p>
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
