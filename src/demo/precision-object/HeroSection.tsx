import { forwardRef } from 'react'
import { PRODUCT } from './productConfig'

type Props = {
  onExplore: () => void
  onDetails: () => void
}

export const HeroSection = forwardRef<HTMLElement, Props>(function HeroSection(
  { onExplore, onDetails },
  ref,
) {
  return (
    <section className="pov-hero" ref={ref} aria-labelledby="pov-hero-title">
      <div className="pov-hero__copy">
        <p className="pov-eyebrow">{PRODUCT.eyebrow}</p>
        <h1 id="pov-hero-title" className="pov-hero__title">
          {PRODUCT.heroTitle}
        </h1>
        <p className="pov-hero__lead">{PRODUCT.heroLead}</p>
        <div className="pov-hero__actions">
          <button type="button" className="pov-btn pov-btn--primary" onClick={onExplore}>
            {PRODUCT.primaryAction}
          </button>
          <button type="button" className="pov-btn pov-btn--ghost" onClick={onDetails}>
            {PRODUCT.secondaryAction}
          </button>
        </div>
      </div>
      <p className="pov-scroll-cue" aria-hidden="true">
        <span className="pov-scroll-cue__label">Scroll</span>
        <span className="pov-scroll-cue__mark" />
      </p>
    </section>
  )
})
