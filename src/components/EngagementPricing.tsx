import type { EngagementOption } from '../project-costs/data'

function PricingSlot({
  className,
  id,
  children,
}: {
  className: string
  id?: string
  children?: string | null
}) {
  const empty = !children
  return (
    <p className={className} id={empty ? undefined : id} aria-hidden={empty || undefined}>
      {children || '\u00a0'}
    </p>
  )
}

export function EngagementPricing({
  option,
  compact = false,
  rateId,
  compareId,
}: {
  option: EngagementOption
  compact?: boolean
  rateId?: string
  compareId?: string
}) {
  const hasIntro = Boolean(option.rateCompareLine)

  return (
    <div className="pc-engage-pricing">
      <PricingSlot className="pc-engage-rate-label">
        {hasIntro ? option.rateBadge : null}
      </PricingSlot>
      <PricingSlot className="pc-engage-rate" id={rateId}>
        {hasIntro ? option.rateCompareLine : option.rateLine}
      </PricingSlot>
      <PricingSlot className="pc-engage-rate-until">{hasIntro ? option.rateUntilLine : null}</PricingSlot>
      <PricingSlot className="pc-engage-rate-compare" id={compareId}>
        {hasIntro ? (option.rateStandardLine ?? option.rateLine) : null}
      </PricingSlot>
      {compact ? null : (
        <PricingSlot className="pc-engage-rate-note">{option.rateNote}</PricingSlot>
      )}
    </div>
  )
}
