import type { EngagementOption } from '../project-costs/data'

export function EngagementPricing({ option }: { option: EngagementOption }) {
  return (
    <>
      <p className="pc-engage-rate-badge">{option.rateBadge ?? '\u00A0'}</p>
      <p className="pc-engage-rate">{option.rateLine}</p>
      <p className="pc-engage-rate-compare">{option.rateCompareLine ?? '\u00A0'}</p>
      <p className="pc-engage-rate-note">{option.rateNote}</p>
    </>
  )
}
