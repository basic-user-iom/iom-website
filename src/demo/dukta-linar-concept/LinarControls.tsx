import type { CSSProperties } from 'react'
import { VISUAL_FALLBACK_RADIUS_MM } from './bendMath'
import { JANUS_THICKNESS_NOTE, type LinarTech } from './linarData'
import {
  LINAR_FELT_COLOURS,
  LINAR_MDF_COLOURS,
  LINAR_PRESENTATION_LIMITS,
  type LinarColourOption,
} from './materialData'
import {
  LINAR_APPLICATIONS,
  LINAR_BACKLIGHT_MODES,
  LINAR_MATERIALS,
  LINAR_VENEERS,
  LINAR_VISIBLE_BACKINGS,
  type LinarApplication,
  type LinarBacklightMode,
  type LinarBacking,
  type LinarBendDirection,
  type LinarConfig,
  type LinarFeltColourId,
  type LinarMaterialId,
  type LinarMdfColourId,
  type LinarVeneerId,
} from './types'

type Props = {
  bend: number
  bendDirection: LinarBendDirection
  secondaryCurveAmount: number
  config: LinarConfig
  tech: LinarTech
  previewRadiusMm: number | null
  secondaryCurveSafetyLimited: boolean
  onBendInput: (value: number) => void
  onSecondaryCurveInput: (value: number) => void
  onConfig: (patch: Partial<LinarConfig>) => void
  onResetPanel: () => void
}

function SwatchGroup<T extends string>({
  labelId,
  label,
  items,
  value,
  onChange,
}: {
  labelId: string
  label: string
  items: readonly LinarColourOption<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field linar-field--swatches">
      <p className="linar-label" id={labelId}>
        {label}
      </p>
      <div className="linar-swatches" role="group" aria-labelledby={labelId}>
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'linar-swatch is-active' : 'linar-swatch'}
              aria-label={`${item.label}. ${item.source}. Official code pending.`}
              aria-pressed={active}
              title={`${item.label} · ${item.source} · official code pending`}
              style={{ '--linar-swatch': item.swatch } as CSSProperties}
              onClick={() => onChange(item.id)}
            >
              <span className="linar-swatch__colour" aria-hidden="true" />
              <span className="linar-swatch__label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RangeRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  dataTourId,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  dataTourId?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="linar-range" data-tour-id={dataTourId}>
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
  dataTourId,
  onChange,
}: {
  labelId: string
  label: string
  items: readonly { id: T; label: string; disabled?: boolean }[]
  value: T
  dataTourId?: string
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field" data-tour-id={dataTourId}>
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
              disabled={item.disabled}
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

function SegmentedGroup<T extends string>({
  labelId,
  label,
  items,
  value,
  dataTourId,
  descriptionId,
  onChange,
}: {
  labelId: string
  label: string
  items: readonly { id: T; label: string; disabled?: boolean }[]
  value: T
  dataTourId?: string
  descriptionId?: string
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field linar-segmented" data-tour-id={dataTourId}>
      <p className="linar-label" id={labelId}>
        {label}
      </p>
      <div
        className="linar-materials linar-materials--segmented"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-orientation="horizontal"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              className={active ? 'linar-chip is-active' : 'linar-chip'}
              aria-checked={active}
              disabled={item.disabled}
              tabIndex={active && !item.disabled ? 0 : -1}
              style={{ justifyContent: 'center', textAlign: 'center' }}
              onClick={() => {
                if (!item.disabled) onChange(item.id)
              }}
              onKeyDown={(event) => {
                let nextIndex = index
                let direction = 0
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  direction = -1
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  direction = 1
                } else if (event.key === 'Home') {
                  nextIndex = items.findIndex((item) => !item.disabled)
                } else if (event.key === 'End') {
                  nextIndex = items.length - 1
                  while (nextIndex >= 0 && items[nextIndex].disabled) nextIndex -= 1
                } else {
                  return
                }

                event.preventDefault()
                if (nextIndex < 0) return
                if (direction !== 0) {
                  do {
                    nextIndex = (nextIndex + direction + items.length) % items.length
                  } while (items[nextIndex].disabled && nextIndex !== index)
                }
                if (items[nextIndex].disabled) return
                onChange(items[nextIndex].id)
                const buttons = event.currentTarget.parentElement?.querySelectorAll('button')
                buttons?.item(nextIndex).focus()
              }}
            >
              <span className="linar-chip__name">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatRadius(radiusMm: number | null): string {
  if (radiusMm == null) return 'Flat'
  return `${Math.round(radiusMm).toLocaleString('en-US')} mm`
}

function directionLabel(direction: LinarBendDirection): string {
  if (direction === 'left') return 'Left · toward back'
  if (direction === 'right') return 'Right · toward front'
  return 'Neutral · flat'
}

export function LinarControls({
  bend,
  bendDirection,
  secondaryCurveAmount,
  config,
  tech,
  previewRadiusMm,
  secondaryCurveSafetyLimited,
  onBendInput,
  onSecondaryCurveInput,
  onConfig,
  onResetPanel,
}: Props) {
  const radiusText = formatRadius(previewRadiusMm)
  const bendValueText = `${radiusText} · ${directionLabel(bendDirection)}`
  const safeSecondaryCurveAmount = Math.max(
    0,
    Math.min(100, Math.round(secondaryCurveAmount)),
  )
  const secondaryCurveText =
    safeSecondaryCurveAmount === 0 ? 'Off' : `${safeSecondaryCurveAmount}%`
  const secondaryCurveValueText =
    safeSecondaryCurveAmount === 0
      ? 'Off'
      : `${safeSecondaryCurveAmount} percent toward a continuous serpentine S curve`
  const secondaryCurveIsDormant =
    safeSecondaryCurveAmount > 0 && bendDirection === 'flat'
  const referenceText =
    tech.referenceMinimumRadiusMm == null
      ? `The endpoint uses the existing ${VISUAL_FALLBACK_RADIUS_MM} mm visual reference and remains Not tested.`
      : `The endpoint reaches the ${tech.referenceMinimumRadiusMm} mm physical-sample minimum.`

  return (
    <div className="linar-controls">
      <details className="linar-acc linar-acc--bending" data-tour-id="bending" open>
        <summary className="linar-acc__sum">Bending radius</summary>
        <div className="linar-acc__body">
          <div className="linar-range linar-bend-control">
            <div className="linar-control__head linar-control__head--bend">
              <label className="linar-label" htmlFor="linar-bend">
                Primary selected radius
              </label>
              <span className="linar-bend-value">{radiusText}</span>
            </div>
            <span className="linar-bend-direction" aria-live="polite">
              {directionLabel(bendDirection)}
            </span>
            <p className="linar-instruction">
              Centre is flat. Move left or right to bend in opposite directions. Large radii use
              the complete incised width; the active curved area reduces progressively toward
              π × R as the radius becomes smaller.
            </p>
            <div className="linar-bend-slider-wrap">
              <input
                id="linar-bend"
                className="linar-slider linar-slider--bidirectional"
                type="range"
                min={-100}
                max={100}
                step={1}
                value={bend}
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={Math.round(bend)}
                aria-valuetext={bendValueText}
                aria-label="Bending radius and direction"
                onInput={(event) => onBendInput(Number(event.currentTarget.value))}
              />
            </div>
            <div className="linar-bend-scale" aria-hidden="true">
              <span>Left</span>
              <span>Flat</span>
              <span>Right</span>
            </div>
            <p className="linar-note">{referenceText}</p>
          </div>

          <details className="linar-secondary-curve" data-tour-id="s-curve">
            <summary className="linar-secondary-curve__summary">Advanced shape preview</summary>
            <div className="linar-secondary-curve__body">
              <div className="linar-range">
                <div className="linar-control__head linar-secondary-curve__head">
                  <label className="linar-label" htmlFor="linar-secondary-curve">
                    S-curve progression
                  </label>
                  <output
                    className="linar-percent"
                    htmlFor="linar-secondary-curve"
                    aria-live="polite"
                  >
                    {secondaryCurveText}
                  </output>
                </div>
                <input
                  id="linar-secondary-curve"
                  className="linar-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={safeSecondaryCurveAmount}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={safeSecondaryCurveAmount}
                  aria-valuetext={secondaryCurveValueText}
                  aria-describedby={
                    [
                      'linar-secondary-curve-description',
                      secondaryCurveIsDormant ? 'linar-secondary-curve-flat-status' : '',
                      secondaryCurveSafetyLimited ? 'linar-secondary-curve-safety-status' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                  onInput={(event) =>
                    onSecondaryCurveInput(Number(event.currentTarget.value))
                  }
                />
              </div>
              <p className="linar-note">
                0 keeps the existing C curve. Progression morphs it continuously toward two
                broad opposing lobes. At 100 the incised area forms one continuously changing
                wave without straight shelves; any unincised side zones remain rigid. The shape
                proportions are a visual reference; the primary radius and open-area calculations
                remain independent.
              </p>
              {secondaryCurveIsDormant ? (
                <p
                  id="linar-secondary-curve-flat-status"
                  className="linar-secondary-curve__status"
                  role="status"
                  aria-live="polite"
                >
                  Move the primary radius control away from centre to see the opposing curve.
                </p>
              ) : null}
              {secondaryCurveSafetyLimited ? (
                <p
                  id="linar-secondary-curve-safety-status"
                  className="linar-secondary-curve__status"
                  role="status"
                  aria-live="polite"
                >
                  Visual safety limit: the rendered S turn is moderated to prevent surface or
                  backing overlap at this partial coverage. Visual reference only; Not tested.
                </p>
              ) : null}
              <p id="linar-secondary-curve-description" className="linar-note">
                The supplied sample footage visually demonstrates an opposing S-shaped pose. It
                does not provide a measured counter-curve radius, transition position, load limit,
                spring-back value or manufacturing envelope. Visual reference only · Not tested.
              </p>
            </div>
          </details>
        </div>
      </details>

      <details className="linar-acc" open>
        <summary className="linar-acc__sum">Panel</summary>
        <div className="linar-acc__body">
          <ChipGroup
            labelId="linar-material-label"
            label="Base material"
            items={LINAR_MATERIALS}
            value={config.material}
            dataTourId="materials"
            onChange={(id: LinarMaterialId) => onConfig({ material: id })}
          />
          <div data-tour-id="colours">
            {config.material === 'mdf' ? (
              <>
                <SwatchGroup
                  labelId="linar-mdf-colour-label"
                  label="MDF colour reference"
                  items={LINAR_MDF_COLOURS}
                  value={config.mdfColour}
                  onChange={(id: LinarMdfColourId) => onConfig({ mdfColour: id })}
                />
                <p className="linar-note">
                  Photo-reference swatches only. Official manufacturer names, codes and digital
                  colour values are still pending.
                </p>
              </>
            ) : null}
            <ChipGroup
              labelId="linar-veneer-label"
              label="Optional veneer"
              items={LINAR_VENEERS}
              value={config.veneer}
              onChange={(id: LinarVeneerId) => onConfig({ veneer: id })}
            />
            <p className="linar-note">
              Veneer is an additional appearance layer of approximately 1 mm. It does not alter
              the configured base thickness or bending-radius calculation in this revision.
            </p>
          </div>
          <RangeRow
            id="linar-thickness"
            label="Base panel thickness"
            value={config.thicknessMm}
            min={4}
            max={15}
            step={1}
            display={`${config.thicknessMm} mm`}
            onChange={(value) => onConfig({ thicknessMm: value })}
          />
          <p className="linar-note">{JANUS_THICKNESS_NOTE}</p>
          <button
            type="button"
            className="linar-text-btn"
            data-tour-id="reset"
            onClick={onResetPanel}
          >
            Reset panel
          </button>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="incision">
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
            label="Cut width / spacing"
            value={config.cutWidthMm}
            min={2}
            max={8}
            step={1}
            display={`${config.cutWidthMm} mm`}
            onChange={(value) => onConfig({ cutWidthMm: value })}
          />
          <RangeRow
            id="linar-lamella"
            label="Lamella width"
            value={config.slatWidthMm}
            min={2}
            max={8}
            step={1}
            display={`${config.slatWidthMm} mm`}
            onChange={(value) => onConfig({ slatWidthMm: value })}
          />
          <p className="linar-note">
            {config.cutWidthMm}/{config.slatWidthMm} mm means a {config.cutWidthMm} mm perforating
            cut and a {config.slatWidthMm} mm uncut lamella. Incision and bridge lengths repeat
            across the incised area.
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
          <p className="linar-note">
            Coverage expands symmetrically from the panel centre. The remaining left and right
            areas stay solid and unincised.
          </p>
        </div>
      </details>

      <details className="linar-acc">
        <summary className="linar-acc__sum">Application</summary>
        <div className="linar-acc__body">
          <SegmentedGroup
            labelId="linar-application-label"
            label="Application"
            items={LINAR_APPLICATIONS}
            value={config.application}
            dataTourId="application"
            onChange={(id: LinarApplication) => onConfig({ application: id })}
          />
          <ChipGroup
            labelId="linar-backing-label"
            label="Backing material"
            items={LINAR_VISIBLE_BACKINGS}
            value={config.backing}
            onChange={(id: LinarBacking) => onConfig({ backing: id })}
          />
          {config.application !== 'freestanding' ? (
            <>
              <SegmentedGroup
                labelId="linar-backlight-label"
                label="Rear illumination"
                items={LINAR_BACKLIGHT_MODES.map((item) => ({
                  ...item,
                  disabled: item.id === 'on' && config.backing !== 'none',
                }))}
                value={config.backlightMode}
                dataTourId="backlight"
                descriptionId={
                  config.backing === 'none'
                    ? 'linar-backlight-description'
                    : 'linar-backlight-description linar-backlight-backing-status'
                }
                onChange={(id: LinarBacklightMode) => onConfig({ backlightMode: id })}
              />
              {config.backlightMode === 'on' ? (
                <RangeRow
                  id="linar-backlight-intensity"
                  label="Visual preview brightness"
                  value={config.backlightIntensity}
                  min={10}
                  max={100}
                  step={5}
                  display={`${config.backlightIntensity}% visual`}
                  onChange={(value) => onConfig({ backlightIntensity: value })}
                />
              ) : null}
              <p className="linar-note" id="linar-backlight-description">
                Warm diffuse visual preview only. Diffuser construction, cavity depth, output,
                thermal/fire performance and mounting are not specified · Not tested. Shown in
                room-facing front and side views; hidden in Top shape and Back inspection views.
              </p>
              {config.backing !== 'none' ? (
                <p
                  className="linar-note"
                  id="linar-backlight-backing-status"
                  role="status"
                  aria-live="polite"
                >
                  Rear illumination is off because the selected backing is treated as opaque.
                  Choose None to inspect preview illumination through the real LINAR openings.
                </p>
              ) : null}
            </>
          ) : (
            <p className="linar-note">
              Rear illumination preview is available in Wall and Ceiling applications.
            </p>
          )}
          {config.backing === 'felt' ? (
            <>
              <SwatchGroup
                labelId="linar-felt-colour-label"
                label="Felt colour"
                items={LINAR_FELT_COLOURS}
                value={config.feltColour}
                onChange={(id: LinarFeltColourId) => onConfig({ feltColour: id })}
              />
              <p className="linar-note">
                Red is based on the supplied LINAR photograph. The remaining swatches are
                development previews; official felt names and codes are pending.
              </p>
            </>
          ) : null}
          <RangeRow
            id="linar-panel-count"
            label="Addition / repetition"
            value={config.panelCount}
            min={LINAR_PRESENTATION_LIMITS.minimumPanelCount}
            max={LINAR_PRESENTATION_LIMITS.maximumPanelCount}
            step={1}
            display={`${config.panelCount} ${config.panelCount === 1 ? 'panel' : 'panels'}`}
            dataTourId="repetition"
            onChange={(value) => onConfig({ panelCount: value })}
          />
          <p className="linar-note">
            Application, backing and repetition change the presentation only. They do not change
            the LINAR open-area or single-panel radius/status calculations. Repeated modules remain
            in one tangent-connected horizontal row; the selected visual turn is distributed over
            the complete installation so modules do not loop or overlap. The current 1–4 range is
            a development/performance presentation limit, not a commercial maximum.
          </p>
        </div>
      </details>
    </div>
  )
}
