const LINAR_URL = 'https://dukta.com/en/products/semi-finished/linar/'

const FACTS = [
  'Regular, continuous incision arrangement',
  'Standard incision: 4 mm cut / 4 mm bar',
  'Minimum bending radius: approximately 80 mm',
  'Standard panel: 2800 × 1200 × 6–12 mm',
  'Open area: 20–40%',
]

export function LinarProductInfo() {
  return (
    <section className="linar-info" aria-labelledby="linar-info-title">
      <h2 id="linar-info-title" className="linar-info__title">
        LINAR
      </h2>
      <ul className="linar-info__list">
        {FACTS.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <a
        className="linar-info__link"
        href={LINAR_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        View official LINAR information
      </a>
    </section>
  )
}
