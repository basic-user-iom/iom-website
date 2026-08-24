import { VISUAL_FALLBACK_RADIUS_MM } from './bendMath'
import { JANUS_THICKNESS_NOTE, type LinarTech } from './linarData'
import {
  LINAR_APPLICATIONS,
  LINAR_MATERIALS,
  LINAR_VENEERS,
  LINAR_VISIBLE_BACKINGS,
  type LinarApplication,
  type LinarBacking,
  type LinarBendDirection,
  type LinarConfig,
  type LinarMaterialId,
  type LinarVeneerId,
} from './types'

type Props = {
  bend: number
  bendDirection: LinarBendDirection
  secondaryCurveAmount: number
  config: LinarConfig
  tech: LinarTech
  previewRadiusMm: number | null
  onBendInput: (value: number) => void
  onSecondaryCurveInput: (value: number) => void
  onConfig: (patch: Partial<LinarConfig>) => void
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
  items: readonly { id: T; label: string }[]
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
      : `${safeSecondaryCurveAmount} percent toward a three-leg serpentine S curve`
  const secondaryCurveIsDormant =
    safeSecondaryCurveAmount > 0 && bendDirection === 'flat'
  const referenceText =
    tech.referenceMinimumRadiusMm == null
      ? `The endpoint uses the existing ${VISUAL_FALLBACK_RADIUS_MM} mm visual reference and remains Not tested.`
      : `The endpoint reaches the ${tech.referenceMinimumRadiusMm} mm physical-sample minimum.`

  return (
    <div className="linar-controls">
      <details className="linar-acc linar-acc--bending" open>
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

          <details className="linar-secondary-curve">
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
                    secondaryCurveIsDormant
                      ? 'linar-secondary-curve-description linar-secondary-curve-flat-status'
                      : 'linar-secondary-curve-description'
                  }
                  onInput={(event) =>
                    onSecondaryCurveInput(Number(event.currentTarget.value))
                  }
                />
              </div>
              <p className="linar-note">
                0 keeps the existing C curve. Progression morphs it continuously toward two
                opposing hairpin turns. At 100, with the primary radius at either endpoint, the
                panel forms three near-parallel legs. This does not change open-area or radius
                calculations.
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
              <p id="linar-secondary-curve-description" className="linar-note">
                The supplied sample footage visually demonstrates an opposing S-shaped pose. It
                does not provide a measured second radius, transition position, load limit,
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
            onChange={(id: LinarMaterialId) => onConfig({ material: id })}
          />
          <ChipGroup
            labelId="linar-veneer-label"
            label="Optional veneer"
            items={LINAR_VENEERS}
            value={config.veneer}
            onChange={(id: LinarVeneerId) => onConfig({ veneer: id })}
          />
          <p className="linar-note">
            Veneer is an additional appearance layer of approximately 1 mm. It does not alter the
            configured base thickness or bending-radius calculation in this revision.
          </p>
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
          <button type="button" className="linar-text-btn" onClick={onResetPanel}>
            Reset panel
          </button>
        </div>
      </details>

      <details className="linar-acc">
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
            items={LINAR_VISIBLE_BACKINGS}
            value={config.backing}
            onChange={(id: LinarBacking) => onConfig({ backing: id })}
          />
          <p className="linar-note">
            Application and visible backing choices are descriptive configuration metadata. They
            do not change the bending calculation.
          </p>
        </div>
      </details>
    </div>
  )
}
