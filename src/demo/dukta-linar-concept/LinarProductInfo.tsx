import {
  CONSERVATIVE_RADIUS_NOTE_MM,
  PARTNER_CONFIRMATION_NOTE,
  type LinarTech,
} from './linarData'
import {
  LINAR_FELT_METADATA,
  LINAR_FLEECE_METADATA,
  findFleeceColour,
  findFeltColour,
  findMdfColour,
} from './materialData'
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

function formatDimensions(heightMm: number, widthMm: number): string {
  return `${Math.round(heightMm)} x ${Math.round(widthMm)} mm`
}

function formatPct(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`
}

function formatSignedMm(value: number, digits = 3): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(digits)} mm`
}

function formatSignedPoints(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(3)} percentage points`
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
  if (direction === 'left') return 'Left - toward back'
  if (direction === 'right') return 'Right - toward front'
  return 'Flat'
}

function statusClass(status: LinarTech['status']): string {
  if (status === 'Not recommended') return 'linar-status linar-status--blocked'
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
  minimumLocalRadiusMm: number | null
  secondaryCurveSafetyLimited: boolean
}

export function LinarProductInfo({
  config,
  tech,
  selectedRadiusMm,
  bendDirection,
  secondaryCurveAmount,
  minimumLocalRadiusMm,
  secondaryCurveSafetyLimited,
}: Props) {
  const safeSecondaryCurveAmount = Math.max(
    0,
    Math.min(100, Math.round(secondaryCurveAmount)),
  )
  const hasSecondaryCurve = safeSecondaryCurveAmount > 0
  const radiusValue =
    tech.referenceMinimumRadiusMm == null
      ? 'Not tested'
      : formatMm(tech.referenceMinimumRadiusMm)
  const minimumLocalRadiusValue =
    minimumLocalRadiusMm == null ? 'Not available' : formatMm(minimumLocalRadiusMm)
  const selectedAtReferenceMinimum =
    selectedRadiusMm != null &&
    tech.referenceMinimumRadiusMm != null &&
    Math.abs(selectedRadiusMm - tech.referenceMinimumRadiusMm) < 0.05
  const secondaryCurveBelowReferenceMinimum =
    hasSecondaryCurve &&
    minimumLocalRadiusMm != null &&
    tech.referenceMinimumRadiusMm != null &&
    minimumLocalRadiusMm < tech.referenceMinimumRadiusMm - 0.05
  const documentedFormatRows: Row[] = tech.panelFormat.referenceFormats.map((format) => ({
    label: 'Documented format example',
    value: `full A x B ${formatDimensions(format.fullLengthAmm, format.fullWidthBmm)}; usable C x D ${formatDimensions(format.usableLengthCmm, format.usableWidthDmm)}`,
    hint: `${format.label} - ${format.manufacturer} price-list reference only; not assigned to this generic selection`,
  }))

  const rows: Row[] = [
    {
      label: 'Visualisation module',
      value: formatDimensions(
        tech.panelFormat.renderHeightMm,
        tech.module.widthMm,
      ),
      hint: `${tech.moduleAuthority.label}; actual formats vary`,
    },
    {
      label: 'Pattern modulation',
      value: `${tech.module.columnCount} pitches / ${tech.module.phaseRepeatCount} phase periods`,
      hint: `${formatMm(tech.module.phaseRepeatWidthMm)} two-column repeat; ${tech.module.deviationMm.toFixed(0)} mm from representative target`,
    },
    ...documentedFormatRows,
    { label: 'Material', value: materialLabel(config.material) },
    ...(config.material === 'mdf'
      ? ([
          {
            label: 'MDF type',
            value: config.mdfVariant === 'natural' ? 'MDF Natural' : 'Valchromat',
          },
          ...(config.mdfVariant === 'valchromat'
            ? ([{
                label: 'Valchromat colour',
                value: `${findMdfColour(config.mdfColour).label} · ${findMdfColour(config.mdfColour).manufacturerCode}`,
                hint: 'Official name/code; on-screen colour is an approximation',
              }] satisfies Row[])
            : []),
        ] satisfies Row[])
      : []),
    {
      label: 'Production classification',
      value:
        tech.productionClassification === 'standard'
          ? 'Standard'
          : tech.productionClassification === 'possible'
            ? 'Possible'
            : 'Not tested',
      hint: tech.sourceRecord
        ? `${tech.sourceRecord.sourceFilename}, page ${tech.sourceRecord.sourcePage}; ${tech.sourceRecord.boldFrame ? 'bold frame verified' : 'non-bold populated row'}`
        : 'No exact authoritative chart row',
    },
    {
      label: 'Physical evidence',
      value:
        tech.physicalEvidence === 'physical-sample'
          ? 'Physical sample'
          : tech.physicalEvidence === 'not-physically-tested'
            ? 'Not physically tested'
            : 'No exact physical-sample record',
    },
    {
      label: 'Feasibility',
      value: tech.feasibility === 'blocked' ? 'Not recommended' : tech.feasibility === 'allowed' ? 'Allowed by current record' : 'Requires confirmation',
      hint: tech.blockedReason ?? undefined,
      status: tech.feasibility === 'blocked' ? 'Not recommended' : undefined,
    },
    {
      label: 'Veneer',
      value: veneerLabel(config.veneer),
      hint:
        config.veneer === 'none'
          ? undefined
          : 'Same veneer is shown on both sides for this configurator. Actual front and reverse finishes may differ by manufacturer/application; no radius influence.',
    },
    { label: 'Panel thickness', value: formatMm(config.thicknessMm) },
    {
      label: 'Remaining bridge height',
      value: formatMm(tech.bridgeHeightMm, 3),
      hint: 'Panel thickness minus top cutting depth; no continuous rear sheet',
    },
    { label: 'Cut / lamella', value: `${config.cutWidthMm}/${config.slatWidthMm} mm` },
    { label: 'Incision length', value: formatMm(config.incisionLengthMm) },
    {
      label: 'CAD / rendered bridge span',
      value: formatMm(tech.displayedBridgeLengthMm, 3),
      hint: 'CAD-derived span used by the generated geometry and geometric open-area calculation',
    },
    ...(tech.physicalSampleBridgeLengthMm != null
      ? ([
          {
            label: 'Measured bridge reference',
            value: formatMm(tech.physicalSampleBridgeLengthMm, 3),
            hint: 'Exact physical-sample chart value; it does not override the CAD-derived geometry',
          },
          {
            label: 'Measured − CAD bridge',
            value: formatSignedMm(tech.physicalSampleBridgeDifferenceFromCadMm ?? 0),
            hint: 'Observed source discrepancy; cause not established',
          },
        ] satisfies Row[])
      : []),
    {
      label: 'Top cutting depth',
      value: formatMm(tech.topCutDepthMm, 3),
      hint: tech.topCutDepthSource,
    },
    {
      label: 'Blade profile',
      value: `${formatMm(tech.cadGeometry.bladeRadiusMm * 2)} diameter`,
      hint: tech.cadAuthority.label,
    },
    {
      label: 'Bottom overcut',
      value: formatMm(tech.bottomOvercutMm),
      hint: 'Into the spoil board; not subtracted from the finished panel',
    },
    {
      label:
        tech.referenceOpenAreaPercent == null
          ? 'Open area - incised area'
          : 'Approx. open area - incised area',
      value: formatPct(tech.displayedIncisedOpenAreaPercent),
      hint:
        tech.referenceOpenAreaPercent == null
          ? tech.openAreaLabel
          : 'Approximate physical-sample chart reference',
    },
    {
      label: 'Open area - displayed installation module',
      value: formatPct(tech.displayedFullPanelOpenAreaPercent),
      hint: `${tech.openAreaLabel}; ${tech.partialCellTreatment.toLowerCase()}`,
    },
    {
      label: 'Primary selected radius',
      value: selectedRadiusMm == null ? 'Flat' : formatMm(selectedRadiusMm),
      tourId: 'radius',
      hint:
        selectedRadiusMm == null
          ? undefined
          : tech.referenceMinimumRadiusMm == null
            ? 'Visual reference only - Not tested'
            : selectedAtReferenceMinimum
              ? tech.physicalEvidence === 'physical-sample'
                ? 'Physical-sample minimum'
                : tech.radiusAuthority.label
              : tech.physicalEvidence === 'physical-sample'
                ? 'Derived preview - only the minimum is sample-validated'
                : `Derived preview - ${tech.radiusAuthority.label}`,
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
            value: 'Visual demonstration',
            status: 'Not tested',
          },
          {
            label: 'S-curve minimum local radius',
            value: minimumLocalRadiusValue,
            hint: 'Calculated from the rendered centreline curvature; not an approved limit',
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
    ...(secondaryCurveBelowReferenceMinimum
      ? ([
          {
            label: 'S-curve reference comparison',
            value: 'Below primary chart minimum',
            hint: `${minimumLocalRadiusValue} local versus ${radiusValue} primary reference; visual overtravel only`,
            status: 'Not tested',
          },
        ] satisfies Row[])
      : []),
    {
      label: 'Reference minimum radius',
      value: radiusValue,
      hint:
        tech.referenceMinimumRadiusMm == null ? undefined : tech.radiusAuthority.label,
    },
    { label: 'Application', value: applicationLabel(config.application) },
    {
      label: 'Installation support',
      value:
        config.application === 'freestanding'
          ? 'Supporting structure required'
          : 'Project substructure required',
      hint: 'Abstract presentation only; no approved mounting hardware is specified',
    },
    { label: 'Backing', value: backingLabel(config.backing) },
    ...(config.backing === 'acoustic-fleece'
      ? ([
          {
            label: 'Acoustic fleece option',
            value: findFleeceColour(config.fleeceColour).label,
            hint: `${LINAR_FLEECE_METADATA.thicknessRangeMm[0]}–${LINAR_FLEECE_METADATA.thicknessRangeMm[1]} mm; ${LINAR_FLEECE_METADATA.representativeVisualThicknessMm} mm visual layer${config.fleeceColour === 'translucent' ? '; approximate 80% visual reference, not certified' : '; transmission is a visual assumption'}`,
          },
        ] satisfies Row[])
      : []),
    ...(config.application !== 'freestanding'
      ? ([
          {
            label: 'Rear illumination study',
            value:
              config.backlightMode === 'on'
                ? `Concept preview - ${config.backlightIntensity}%`
                : 'Off',
            hint:
              config.backlightMode === 'on'
                ? 'Outside technical product scope; non-photometric and no integrated-luminaire claim'
                : undefined,
            status: config.backlightMode === 'on' ? 'Not tested' : undefined,
          },
        ] satisfies Row[])
      : []),
    ...(config.backing === 'felt'
      ? ([
          {
            label: 'Felt colour',
            value: findFeltColour(config.feltColour).label,
            hint:
              config.application === 'freestanding'
                ? `Opaque wool felt; ${LINAR_FELT_METADATA.thicknessRangeMm[0]}–${LINAR_FELT_METADATA.thicknessRangeMm[1]} mm; ${LINAR_FELT_METADATA.representativeVisualThicknessMm} mm visual layer; screen approximation`
                : `Opaque wool felt; ${LINAR_FELT_METADATA.thicknessRangeMm[0]}–${LINAR_FELT_METADATA.thicknessRangeMm[1]} mm confirmed product range. Mounted cavity depth is a visual-only construction study; installed thickness is not specified.`,
            status: config.application === 'freestanding' ? undefined : 'Not tested',
          },
        ] satisfies Row[])
      : []),
    {
      label: 'Installation repetition',
      value: `${config.panelCount} ${config.panelCount === 1 ? 'module' : 'modules'}`,
      hint: 'Pattern phase continues across tangent-connected module seams',
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
          values are shown where a matching authoritative record is available; physical evidence
          is identified separately.
        </li>
        <li>
          {CONSERVATIVE_RADIUS_NOTE_MM} mm is a general conservative reference value. Actual values
          depend strongly on material thickness and cutting geometry.
        </li>
        <li>
          There is no universal LINAR panel size. Full production blanks include a cutting frame;
          installed repetition represents the trimmed usable area. Actual dimensions vary by base
          material and manufacturing partner.
        </li>
      </ul>

      <details className="linar-acc linar-acc--tech" data-tour-id="technical-data" open>
        <summary className="linar-acc__sum">Technical data</summary>
        <dl className="linar-spec">
          {rows.map((row, index) => (
            <div
              className="linar-spec__row"
              data-tour-id={row.tourId}
              key={`${row.label}-${index}`}
            >
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
            Approximate chart reference for the incised area:{' '}
            {formatPct(tech.referenceOpenAreaPercent)}. CAD-generated geometry:{' '}
            {formatPct(tech.geometricIncisedOpenAreaPercent)} ({formatSignedPoints(
              tech.openAreaDifferenceGeneratedMinusReferencePoints ?? 0,
            )}). The difference is recorded rather than forcing the geometry to the rounded chart
            value.
          </p>
        ) : (
          <p className="linar-note">
            Open-area figures are a geometric whole-cycle estimate, not a measured production
            value. Official edge-cell treatment remains pending.
          </p>
        )}
        {tech.radiusNote ? <p className="linar-note">{tech.radiusNote}</p> : null}
        {hasSecondaryCurve ? (
          <p className="linar-note">
            The supplied sample footage visually demonstrates an opposing S-shaped pose. It does
            not provide a measured counter-curve radius, transition position, load limit,
            spring-back value or manufacturing envelope. Visual reference only - Not tested.
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
