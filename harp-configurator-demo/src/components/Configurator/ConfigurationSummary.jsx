import { useSummaryRows } from '../../utils/materials.js'

export function ConfigurationSummary({ values }) {
  const rows = useSummaryRows(values)

  return (
    <section className="summary" aria-label="Your harp">
      <p className="kicker">Your harp</p>
      <dl>
        {rows.map((row) => (
          <div key={row.optionId}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
