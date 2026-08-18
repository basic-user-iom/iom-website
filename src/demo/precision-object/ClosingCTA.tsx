import { PRODUCT } from './productConfig'

export function ClosingCTA() {
  return (
    <section className="pov-cta" aria-labelledby="pov-cta-title">
      <p className="pov-eyebrow">Interactive Object Media</p>
      <h2 id="pov-cta-title">{PRODUCT.ctaTitle}</h2>
      <a className="pov-btn pov-btn--primary" href={PRODUCT.ctaHref}>
        {PRODUCT.ctaAction}
      </a>
    </section>
  )
}
