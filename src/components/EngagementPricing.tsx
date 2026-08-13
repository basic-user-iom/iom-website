import type { EngagementOption } from '../project-costs/data'

export function EngagementPricing({ option }: { option: EngagementOption }) {
  return (
    <div className="pc-engage-card-pricing">
      {option.rateBadge ? <p className="pc-engage-rate-badge">{option.rateBadge}</p> : null}
      <p className="pc-engage-rate">{option.rateLine}</p>
      {option.rateCompareLine ? (
        <p className="pc-engage-rate-compare">{option.rateCompareLine}</p>
      ) : null}
      <p className="pc-engage-rate-note">{option.rateNote}</p>
    </div>
  )
}
