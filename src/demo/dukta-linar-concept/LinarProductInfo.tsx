import {
  CONSERVATIVE_RADIUS_NOTE_MM,
  PARTNER_CONFIRMATION_NOTE,
  type LinarTech,
} from './linarData'
import { findFeltColour, findMdfColour } from './materialData'
import {
  LINAR_APPLICATIONS,
  LINAR_MATERIALS,
  LINAR_VENEERS,
  LINAR_VISIBLE_BACKINGS,
  type LinarBendDirection,
  type LinarConfig,
} from './types'

const LINAR_URL = 'https://dukta.com/en/products/semi-finished/linar/'

function formatMm(value: number, digits = 0): string {
  return `${value.toFixed(digits)} mm`
}

function formatPct(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`
}

function materialLabel(id: LinarConfig['material']): string {
  return LINAR_MATERIALS.find((item) => item.id === id)?.label ?? id
}

function veneerLabel(id: LinarConfig['veneer']): string {
  return LINAR_VENEERS.find((item) => item.id === id)?.label ?? id
}

function applicationLabel(id: LinarConfig['application']): string {
  return LINAR_APPLICATIONS.find((item) => item.id === id)?.label ?? id
}

function backingLabel(id: LinarConfig['backing']): string {
  return (
    LINAR_VISIBLE_BACKINGS.find((item) => item.id === id)?.label ??
    'Not available in this revision'
  )
}

function bendDirectionLabel(direction: LinarBendDirection): string {
  if (direction === 'left') return 'Left · toward back'
  if (direction === 'right') return 'Right · toward front'
  return 'Flat'
}

function statusClass(status: LinarTech['status']): string {
  if (status === 'Not tested') return 'linar-status linar-status--not-tested'
  if (status === 'Possible') return 'linar-status linar-status--possible'
  return 'linar-status linar-status--standard'
}

type Row = {
  label: string
  value: string
  hint?: string
  status?: LinarTech['status']
  tourId?: string
}

type Props = {
  config: LinarConfig
  tech: LinarTech
  selectedRadiusMm: number | null
  bendDirection: LinarBendDirection
  secondaryCurveAmount: number
  secondaryCurveSafetyLimited: boolean
}

export function LinarProductInfo({
  config,
  tech,
  selectedRadiusMm,
  bendDirection,
  secondaryCurveAmount,
  secondaryCurveSafetyLimited,
}: Props) {
  const safeSecondaryCurveAmount = Math.max(
    0,
    Math.min(100, Math.round(secondaryCurveAmount)),
  )
  const hasSecondaryCurve = safeSecondaryCurveAmount > 0
  const radiusValue =
    tech.referenceMinimumRadiusMm == null ? 'Not tested' : formatMm(tech.referenceMinimumRadiusMm)
  const bridgeValue =
    tech.displayedBridgeLengthMm == null ? 'Not available' : formatMm(tech.displayedBridgeLengthMm)
  const bridgeHint =
    tech.displayedBridgeLengthMm == null ? 'Visual spacing only' : 'Physical sample'
  const selectedAtReferenceMinimum =
    selectedRadiusMm != null &&
    tech.referenceMinimumRadiusMm != null &&
    Math.abs(selectedRadiusMm - tech.referenceMinimumRadiusMm) < 0.05

  const rows: Row[] = [
    { label: 'Panel size', value: '2800 × 1200 mm visualization panel' },
    { label: 'Material', value: materialLabel(config.material) },
    ...(config.material === 'mdf'
      ? ([
          {
            label: 'MDF colour',
            value: findMdfColour(config.mdfColour).label,
            hint: 'Photo reference · official code pending',
          },
        ] satisfies Row[])
      : []),
    {
      label: 'Veneer',
      value: veneerLabel(config.veneer),
      hint: config.veneer === 'none' ? undefined : 'Appearance layer · no radius influence',
    },
    { label: 'Thickness', value: formatMm(config.thicknessMm) },
    {
      label: 'Rear patterned layer',
      value: 'Two-sided visual surface',
      hint: 'Thickness not yet available',
    },
    { label: 'Cut / lamella', value: `${config.cutWidthMm}/${config.slatWidthMm} mm` },
    { label: 'Incision length', value: formatMm(config.incisionLengthMm) },
    { label: 'Bridge length', value: bridgeValue, hint: bridgeHint },
    {
      label: 'Top cutting depth',
      value: formatMm(tech.topCutDepthMm, 3),
      hint: tech.topCutDepthSource,
    },
    {
      label: 'Open area in incised area',
      value: formatPct(tech.displayedIncisedOpenAreaPercent),
      hint: tech.openAreaLabel,
    },
    {
      label: 'Open area in complete panel',
      value: formatPct(tech.displayedFullPanelOpenAreaPercent),
      hint: tech.openAreaLabel,
    },
    {
      label: 'Primary selected radius',
      value: selectedRadiusMm == null ? 'Flat' : formatMm(selectedRadiusMm),
      tourId: 'radius',
      hint:
        selectedRadiusMm == null
          ? undefined
          : tech.referenceMinimumRadiusMm == null
            ? 'Visual reference only · Not tested'
            : selectedAtReferenceMinimum
              ? 'Physical-sample minimum'
              : 'Derived preview · only the minimum is table-validated',
    },
    { label: 'Primary bending direction', value: bendDirectionLabel(bendDirection) },
    ...(hasSecondaryCurve
      ? ([
          {
            label: 'S-curve progression',
            value: `${safeSecondaryCurveAmount}%`,
            hint: 'Proportional serpentine visual reference only',
          },
          {
            label: 'S-curve validation',
            value: 'Not tested',
            status: 'Not tested',
          },
        ] satisfies Row[])
      : []),
    ...(hasSecondaryCurve && secondaryCurveSafetyLimited
      ? ([
          {
            label: 'S-curve rendering',
            value: 'Visual safety limit',
            hint: 'Turn moderated to prevent rendered overlap; Not tested',
            status: 'Not tested',
          },
        ] satisfies Row[])
      : []),
    { label: 'Reference minimum radius', value: radiusValue },
    { label: 'Application', value: applicationLabel(config.application) },
    { label: 'Backing', value: backingLabel(config.backing) },
    ...(config.backing === 'felt'
      ? ([
          {
            label: 'Felt colour',
            value: findFeltColour(config.feltColour).label,
            hint: 'Provisional · official code pending',
          },
        ] satisfies Row[])
      : []),
    {
      label: 'Installation repetition',
      value: `${config.panelCount} ${config.panelCount === 1 ? 'panel' : 'panels'}`,
    },
    {
      label: hasSecondaryCurve ? 'Base sample status' : 'Status',
      value: tech.status,
      status: tech.status,
    },
    {
      label: 'Preview status',
      value: hasSecondaryCurve ? 'Visual reference only' : tech.previewStatus,
    },
  ]

  return (
    <section className="linar-info" aria-labelledby="linar-info-title">
      <h2 id="linar-info-title" className="linar-info__title">
        LINAR
      </h2>
      <ul className="linar-info__list">
        <li>
          Minimum bending radius depends on material, thickness and incision geometry. Reference
          values are shown where physical sample data is available.
        </li>
        <li>
          {CONSERVATIVE_RADIUS_NOTE_MM} mm is a general conservative reference value. Actual values
          depend strongly on material thickness and cutting geometry.
        </li>
        <li>
          Visualization / display panel: 2800 × 1200 mm, unless dukta confirms another current
          standard dimension. Thickness range in this simulator: 4–15 mm.
        </li>
      </ul>

      <details className="linar-acc linar-acc--tech" data-tour-id="technical-data" open>
        <summary className="linar-acc__sum">Technical data</summary>
        <dl className="linar-spec">
          {rows.map((row) => (
            <div className="linar-spec__row" data-tour-id={row.tourId} key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.status ? (
                  <span className={statusClass(row.status)}>{row.value}</span>
                ) : (
                  row.value
                )}
                {row.hint ? <span className="linar-spec__hint">{row.hint}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
        {tech.referenceOpenAreaPercent != null ? (
          <p className="linar-note">
            Geometric estimate in the incised area:{' '}
            {formatPct(tech.geometricIncisedOpenAreaPercent)}. Sample reference:{' '}
            {formatPct(tech.referenceOpenAreaPercent)}.
          </p>
        ) : (
          <p className="linar-note">
            Open-area figures are a geometric/reference calculation, not a measured production
            value.
          </p>
        )}
        {tech.radiusNote ? <p className="linar-note">{tech.radiusNote}</p> : null}
        {hasSecondaryCurve ? (
          <p className="linar-note">
            The supplied sample footage visually demonstrates an opposing S-shaped pose. It does
            not provide a measured counter-curve radius, transition position, load limit,
            spring-back value or manufacturing envelope. Visual reference only · Not tested.
          </p>
        ) : null}
        <p className="linar-note">{PARTNER_CONFIRMATION_NOTE}</p>
      </details>

      <a className="linar-info__link" href={LINAR_URL} target="_blank" rel="noopener noreferrer">
        View official LINAR information
      </a>
    </section>
  )
}
