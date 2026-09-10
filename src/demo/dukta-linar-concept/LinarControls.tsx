import type { CSSProperties, ReactNode } from 'react'
import { VISUAL_FALLBACK_RADIUS_MM } from './bendMath'
import { JANUS_THICKNESS_NOTE, type LinarTech } from './linarData'
import {
  LINAR_FELT_COLOURS,
  LINAR_FELT_METADATA,
  LINAR_FLEECE_COLOURS,
  LINAR_FLEECE_METADATA,
  LINAR_MDF_COLOURS,
  LINAR_MDF_VARIANTS,
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
  type LinarFleeceColourId,
  type LinarFeltColourId,
  type LinarMaterialId,
  type LinarMdfColourId,
  type LinarMdfVariant,
  type LinarVeneerId,
} from './types'

type Props = {
  bend: number
  bendDirection: LinarBendDirection
  secondaryCurveAmount: number
  config: LinarConfig
  tech: LinarTech
  previewRadiusMm: number | null
  minimumLocalRadiusMm: number | null
  secondaryCurveSafetyLimited: boolean
  onBendInput: (value: number) => void
  onSecondaryCurveInput: (value: number) => void
  onConfig: (patch: Partial<LinarConfig>) => void
  onResetPanel: () => void
}

function SectionSummary({ label, value }: { label: string; value: string }) {
  return (
    <summary className="linar-acc__sum">
      <span>{label}</span>
      <span className="linar-acc__value">{value}</span>
    </summary>
  )
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
      <p className="linar-label" id={labelId}>{label}</p>
      <div className="linar-swatches" role="group" aria-labelledby={labelId}>
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'linar-swatch is-active' : 'linar-swatch'}
              aria-label={`${item.label}${item.manufacturerCode ? `, code ${item.manufacturerCode}` : ''}. ${item.source}. ${item.isScreenApproximation ? 'Screen colour approximation.' : ''}`}
              aria-pressed={active}
              title={`${item.label}${item.manufacturerCode ? ` · ${item.manufacturerCode}` : ''} · ${item.source}${item.isScreenApproximation ? ' · screen approximation' : ''}`}
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
        <label className="linar-label" htmlFor={id}>{label}</label>
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
  items: readonly { id: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field">
      <p className="linar-label" id={labelId}>{label}</p>
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
  descriptionId,
  onChange,
}: {
  labelId: string
  label: string
  items: readonly { id: T; label: string; disabled?: boolean }[]
  value: T
  descriptionId?: string
  onChange: (id: T) => void
}) {
  return (
    <div className="linar-field linar-segmented">
      <p className="linar-label" id={labelId}>{label}</p>
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
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') direction = -1
                else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') direction = 1
                else if (event.key === 'Home') nextIndex = items.findIndex((candidate) => !candidate.disabled)
                else if (event.key === 'End') {
                  nextIndex = items.length - 1
                  while (nextIndex >= 0 && items[nextIndex].disabled) nextIndex -= 1
                } else return

                event.preventDefault()
                if (nextIndex < 0) return
                if (direction !== 0) {
                  do nextIndex = (nextIndex + direction + items.length) % items.length
                  while (items[nextIndex].disabled && nextIndex !== index)
                }
                if (items[nextIndex].disabled) return
                onChange(items[nextIndex].id)
                event.currentTarget.parentElement?.querySelectorAll('button').item(nextIndex).focus()
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

function selectedLabel<T extends string>(
  items: readonly { id: T; label: string }[],
  value: T,
): string {
  return items.find((item) => item.id === value)?.label ?? value
}

function InlineTechnicalNote({ children }: { children: ReactNode }) {
  return (
    <details className="linar-inline-details">
      <summary>Technical note</summary>
      <div className="linar-inline-details__body">{children}</div>
    </details>
  )
}

function formatRadius(radiusMm: number | null): string {
  return radiusMm == null ? 'Flat' : `${Math.round(radiusMm).toLocaleString('en-US')} mm`
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
  minimumLocalRadiusMm,
  secondaryCurveSafetyLimited,
  onBendInput,
  onSecondaryCurveInput,
  onConfig,
  onResetPanel,
}: Props) {
  const radiusText = formatRadius(previewRadiusMm)
  const safeSecondaryCurveAmount = Math.max(0, Math.min(100, Math.round(secondaryCurveAmount)))
  const secondaryCurveText = safeSecondaryCurveAmount === 0 ? 'Off' : `${safeSecondaryCurveAmount}%`
  const secondaryCurveIsDormant = safeSecondaryCurveAmount > 0 && bendDirection === 'flat'
  const secondaryCurveBelowReferenceMinimum =
    safeSecondaryCurveAmount > 0 &&
    bendDirection !== 'flat' &&
    minimumLocalRadiusMm != null &&
    tech.referenceMinimumRadiusMm != null &&
    minimumLocalRadiusMm < tech.referenceMinimumRadiusMm - 0.05
  const referenceText =
    tech.referenceMinimumRadiusMm == null
      ? `The endpoint uses the existing ${VISUAL_FALLBACK_RADIUS_MM} mm visual reference and remains Not tested.`
      : tech.physicalEvidence === 'physical-sample'
        ? `The endpoint reaches the ${tech.referenceMinimumRadiusMm} mm physical-sample minimum.`
        : `The endpoint reaches the ${tech.referenceMinimumRadiusMm} mm ${tech.radiusAuthority.label.toLowerCase()}.`
  const rearLightAvailable = config.application !== 'freestanding' && config.backing !== 'felt'
  const rearLightSummary = rearLightAvailable
    ? config.backlightMode === 'on' ? `${config.backlightIntensity}% visual` : 'Off'
    : 'Unavailable'

  return (
    <div className="linar-controls">
      <p className="linar-controls__group-title">Shape &amp; construction</p>

      <details className="linar-acc linar-acc--bending" data-tour-id="bending" open>
        <SectionSummary label="Bending radius" value={radiusText} />
        <div className="linar-acc__body">
          <div className="linar-range linar-bend-control" data-tour-id="radius">
            <div className="linar-control__head linar-control__head--bend">
              <label className="linar-label" htmlFor="linar-bend">Primary selected radius</label>
              <span className="linar-bend-value">{radiusText}</span>
            </div>
            <span className="linar-bend-direction" aria-live="polite">{directionLabel(bendDirection)}</span>
            <p className="linar-instruction">
              Centre is flat. Move left or right to bend in opposite directions. As radius becomes
              smaller, the active curved area reduces progressively toward π × R.
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
                aria-valuetext={`${radiusText} · ${directionLabel(bendDirection)}`}
                aria-label="Bending radius and direction"
                onInput={(event) => onBendInput(Number(event.currentTarget.value))}
              />
            </div>
            <div className="linar-bend-scale" aria-hidden="true"><span>Left</span><span>Flat</span><span>Right</span></div>
            <p className="linar-note">{referenceText}</p>
          </div>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="s-curve" open>
        <SectionSummary label="S-curve" value={secondaryCurveText} />
        <div className="linar-acc__body">
          <RangeRow
            id="linar-secondary-curve"
            label="S-curve progression"
            value={safeSecondaryCurveAmount}
            min={0}
            max={100}
            step={1}
            display={secondaryCurveText}
            onChange={onSecondaryCurveInput}
          />
          <p className="linar-note">
            0 keeps the C curve. Higher values form one continuous opposing wave; unincised side
            zones remain rigid. This is a visual shape study independent of the open-area data.
          </p>
          {safeSecondaryCurveAmount > 0 && bendDirection !== 'flat' ? (
            <p className="linar-secondary-curve__status" role="status" aria-live="polite">
              Minimum local radius: {minimumLocalRadiusMm == null ? 'Not available' : `${minimumLocalRadiusMm.toFixed(0)} mm`}.
              Manufacturing feasibility must be confirmed.
            </p>
          ) : null}
          {secondaryCurveIsDormant ? (
            <p className="linar-secondary-curve__status" role="status">Move the primary radius away from centre to see the opposing curve.</p>
          ) : null}
          {secondaryCurveSafetyLimited ? (
            <p className="linar-secondary-curve__status" role="status">Visual safety limit is moderating this pose to avoid rendered overlap · Not tested.</p>
          ) : null}
          {secondaryCurveBelowReferenceMinimum ? (
            <p className="linar-secondary-curve__status" role="status">
              Local radius {minimumLocalRadiusMm?.toFixed(0) ?? 'not available'} mm is below the
              primary C-bend reference. Visual study only · Not tested.
            </p>
          ) : null}
          <InlineTechnicalNote>
            <p className="linar-note">
              Supplied footage confirms the visual idea, but not a counter-radius, transition,
              load limit, spring-back value or manufacturing envelope · Not tested.
            </p>
          </InlineTechnicalNote>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="incision">
        <SectionSummary
          label="Incisions"
          value={`${config.incisionLengthMm} mm · ${config.cutWidthMm}/${config.slatWidthMm} · ${config.incisedTwelfths}/12`}
        />
        <div className="linar-acc__body">
          <RangeRow id="linar-incision" label="Incision length" value={config.incisionLengthMm} min={40} max={400} step={1} display={`${config.incisionLengthMm} mm`} onChange={(value) => onConfig({ incisionLengthMm: value })} />
          <RangeRow id="linar-cut" label="Cut width / spacing" value={config.cutWidthMm} min={2} max={8} step={1} display={`${config.cutWidthMm} mm`} onChange={(value) => onConfig({ cutWidthMm: value })} />
          <RangeRow id="linar-lamella" label="Lamella width" value={config.slatWidthMm} min={2} max={8} step={1} display={`${config.slatWidthMm} mm`} onChange={(value) => onConfig({ slatWidthMm: value })} />
          <RangeRow id="linar-coverage" label="Incised area coverage" value={config.incisedTwelfths} min={1} max={12} step={1} display={`${config.incisedTwelfths}/12`} onChange={(value) => onConfig({ incisedTwelfths: value })} />
          <p className="linar-note">
            {config.cutWidthMm}/{config.slatWidthMm} mm means a {config.cutWidthMm} mm perforating
            cut and a {config.slatWidthMm} mm uncut lamella. Coverage expands symmetrically from centre.
          </p>
          {tech.feasibility === 'blocked' ? (
            <p className="linar-secondary-curve__status" role="alert">Not recommended. {tech.blockedReason}</p>
          ) : null}
        </div>
      </details>

      <details className="linar-acc" data-tour-id="thickness">
        <SectionSummary label="Base panel thickness" value={`${config.thicknessMm} mm`} />
        <div className="linar-acc__body">
          <RangeRow id="linar-thickness" label="Base panel thickness" value={config.thicknessMm} min={4} max={15} step={1} display={`${config.thicknessMm} mm`} onChange={(value) => onConfig({ thicknessMm: value })} />
          <p className="linar-note">{JANUS_THICKNESS_NOTE}</p>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="repetition">
        <SectionSummary label="Addition / repetition" value={`${config.panelCount} ${config.panelCount === 1 ? 'module' : 'modules'}`} />
        <div className="linar-acc__body">
          <RangeRow id="linar-panel-count" label="Addition / repetition" value={config.panelCount} min={LINAR_PRESENTATION_LIMITS.minimumPanelCount} max={LINAR_PRESENTATION_LIMITS.maximumPanelCount} step={1} display={`${config.panelCount} ${config.panelCount === 1 ? 'module' : 'modules'}`} onChange={(value) => onConfig({ panelCount: value })} />
          <p className="linar-note">Modules form one tangent-connected row without duplicated seam frames. The 1–4 range is a visual-configurator limit, not a manufacturing maximum.</p>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="application">
        <SectionSummary label="Application" value={selectedLabel(LINAR_APPLICATIONS, config.application)} />
        <div className="linar-acc__body">
          <SegmentedGroup labelId="linar-application-label" label="Application" items={LINAR_APPLICATIONS} value={config.application} onChange={(id: LinarApplication) => onConfig({ application: id })} />
          <p className="linar-note">
            Wall and Ceiling show the back-construction. The client-directed display uses one
            centred longitudinal member per module, four profile ribs and a closed outer frame.
            This is illustrative, not a structural specification.
          </p>
        </div>
      </details>

      <p className="linar-controls__group-title">Materials &amp; appearance</p>

      <details className="linar-acc" data-tour-id="materials">
        <SectionSummary label="Base material" value={selectedLabel(LINAR_MATERIALS, config.material)} />
        <div className="linar-acc__body">
          <ChipGroup labelId="linar-material-label" label="Base material" items={LINAR_MATERIALS} value={config.material} onChange={(id: LinarMaterialId) => onConfig({ material: id })} />
          {config.material === 'mdf' ? (
            <>
              <ChipGroup labelId="linar-mdf-variant-label" label="MDF type" items={LINAR_MDF_VARIANTS} value={config.mdfVariant} onChange={(id: LinarMdfVariant) => onConfig({ mdfVariant: id })} />
              {config.mdfVariant === 'valchromat' ? (
                <div data-tour-id="colours">
                  <SwatchGroup labelId="linar-mdf-colour-label" label="Valchromat colour" items={LINAR_MDF_COLOURS} value={config.mdfColour} onChange={(id: LinarMdfColourId) => onConfig({ mdfColour: id })} />
                  <p className="linar-note">Catalogue names and codes are authoritative; screen colours are approximations.</p>
                </div>
              ) : <p className="linar-note">MDF Natural uses a neutral through-coloured board appearance.</p>}
            </>
          ) : null}
        </div>
      </details>

      <details className="linar-acc" data-tour-id="veneer">
        <SectionSummary label="Veneer" value={selectedLabel(LINAR_VENEERS, config.veneer)} />
        <div className="linar-acc__body">
          <ChipGroup labelId="linar-veneer-label" label="Optional veneer" items={LINAR_VENEERS} value={config.veneer} onChange={(id: LinarVeneerId) => onConfig({ veneer: id })} />
          <p className="linar-note">Veneer is an appearance layer of approximately 1 mm and does not alter configured base thickness or bending-radius calculation in this revision.</p>
        </div>
      </details>

      <details className="linar-acc" data-tour-id="backing">
        <SectionSummary label="Backing material" value={selectedLabel(LINAR_VISIBLE_BACKINGS, config.backing)} />
        <div className="linar-acc__body">
          <ChipGroup labelId="linar-backing-label" label="Backing material" items={LINAR_VISIBLE_BACKINGS} value={config.backing} onChange={(id: LinarBacking) => onConfig({ backing: id })} />
          {config.backing === 'felt' ? (
            <>
              <SwatchGroup labelId="linar-felt-colour-label" label="Felt colour" items={LINAR_FELT_COLOURS} value={config.feltColour} onChange={(id: LinarFeltColourId) => onConfig({ feltColour: id })} />
              <p className="linar-note">Opaque wool felt; {LINAR_FELT_METADATA.thicknessRangeMm[0]}–{LINAR_FELT_METADATA.thicknessRangeMm[1]} mm confirmed product range. Mounted cavity depth remains a visual study. Swatches are approximations.</p>
            </>
          ) : null}
          {config.backing === 'acoustic-fleece' ? (
            <>
              <SwatchGroup labelId="linar-fleece-colour-label" label="Acoustic fleece" items={LINAR_FLEECE_COLOURS} value={config.fleeceColour} onChange={(id: LinarFleeceColourId) => onConfig({ fleeceColour: id })} />
              <p className="linar-note">{LINAR_FLEECE_METADATA.thicknessRangeMm[0]}–{LINAR_FLEECE_METADATA.thicknessRangeMm[1]} mm confirmed range; renderer uses {LINAR_FLEECE_METADATA.representativeVisualThicknessMm} mm. Transmission is a non-certified visual estimate.</p>
            </>
          ) : null}
        </div>
      </details>

      <details className="linar-acc" data-tour-id="backlight">
        <SectionSummary label="Rear light study" value={rearLightSummary} />
        <div className="linar-acc__body">
          {config.application !== 'freestanding' ? (
            <>
              <SegmentedGroup
                labelId="linar-backlight-label"
                label="Rear light study"
                items={LINAR_BACKLIGHT_MODES.map((item) => ({ ...item, disabled: item.id === 'on' && config.backing === 'felt' }))}
                value={config.backlightMode}
                descriptionId="linar-backlight-description"
                onChange={(id: LinarBacklightMode) => onConfig({ backlightMode: id })}
              />
              {config.backlightMode === 'on' ? (
                <RangeRow id="linar-backlight-intensity" label="Visual preview brightness" value={config.backlightIntensity} min={10} max={100} step={5} display={`${config.backlightIntensity}% visual`} onChange={(value) => onConfig({ backlightIntensity: value })} />
              ) : null}
              {config.backing === 'felt' ? (
                <p className="linar-note" role="status" aria-live="polite">Rear illumination is off because wool felt is opaque. Choose None or acoustic fleece to inspect transmission.</p>
              ) : null}
            </>
          ) : <p className="linar-note">Rear light is available in Wall and Ceiling applications.</p>}
          <p className="linar-note" id="linar-backlight-description">Conceptual, non-photometric study. Diffuser, cavity, electrical output, heat/fire performance and mounting are unspecified · Not tested.</p>
        </div>
      </details>

      <button type="button" className="linar-text-btn" data-tour-id="reset" onClick={onResetPanel}>Reset panel</button>
    </div>
  )
}
