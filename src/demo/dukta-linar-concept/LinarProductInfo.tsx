import {
  CONSERVATIVE_RADIUS_NOTE_MM,
  PARTNER_CONFIRMATION_NOTE,
  type LinarTech,
} from './linarData'
import { LINAR_MATERIALS, type LinarConfig } from './types'

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

function statusClass(status: LinarTech['status']): string {
  if (status === 'Not tested') return 'linar-status linar-status--not-tested'
  if (status === 'Possible') return 'linar-status linar-status--possible'
  return 'linar-status linar-status--standard'
}

type Row = { label: string; value: string; hint?: string; status?: boolean }

type Props = {
  config: LinarConfig
  tech: LinarTech
}

export function LinarProductInfo({ config, tech }: Props) {
  const radiusValue =
    tech.referenceMinimumRadiusMm == null ? 'Not tested' : formatMm(tech.referenceMinimumRadiusMm)
  const bridgeHint = tech.bridgeSource === 'Physical sample' ? 'Physical sample' : 'Visual reference'

  const rows: Row[] = [
    { label: 'Panel size', value: '2800 × 1200 mm' },
    { label: 'Material', value: materialLabel(config.material) },
    { label: 'Thickness', value: formatMm(config.thicknessMm) },
    { label: 'Cut / slat', value: `${config.cutWidthMm}/${config.slatWidthMm} mm` },
    { label: 'Incision length', value: formatMm(config.incisionLengthMm) },
    { label: 'Bridge length', value: formatMm(tech.bridgeLengthMm), hint: bridgeHint },
    { label: 'Top cutting depth', value: formatMm(tech.topCutDepthMm, 3) },
    {
      label: 'Bottom cutting depth into spoil board',
      value: formatMm(tech.bottomCutDepthMm, 3),
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
    { label: 'Reference minimum radius', value: radiusValue },
    { label: 'Status', value: tech.status, status: true },
    { label: 'Preview status', value: tech.previewStatus },
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
        <li>Standard display panel: 2800 × 1200 mm. Thickness range in this simulator: 4–15 mm.</li>
      </ul>

      <details className="linar-acc linar-acc--tech" open>
        <summary className="linar-acc__sum">Technical data</summary>
        <dl className="linar-spec">
          {rows.map((row) => (
            <div className="linar-spec__row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.status ? <span className={statusClass(tech.status)}>{row.value}</span> : row.value}
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
        {tech.irregularNote ? <p className="linar-note">{tech.irregularNote}</p> : null}
        <p className="linar-note">{PARTNER_CONFIRMATION_NOTE}</p>
      </details>

      <a className="linar-info__link" href={LINAR_URL} target="_blank" rel="noopener noreferrer">
        View official LINAR information
      </a>
    </section>
  )
}
