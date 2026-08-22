import type { ReactNode } from 'react'
import type { EngagementOption } from '../project-costs/data'
import { EngagementPricing } from './EngagementPricing'
import { useCardOrbPointerProps } from './SiteOrbZone'

type EngagementCardShellProps = {
  option: EngagementOption
  id?: string
  footer: ReactNode
  variant?: 'default' | 'home'
}

function optionNumber(option: EngagementOption) {
  const digits = option.optionLabel.replace(/\D/g, '')
  return digits.padStart(2, '0').slice(-2)
}

export function EngagementCardShell({
  option,
  id,
  footer,
  variant = 'default',
}: EngagementCardShellProps) {
  const orbPointerProps = useCardOrbPointerProps()
  const isHome = variant === 'home'
  const num = optionNumber(option)
  const titleId = `engage-title-${option.id}`
  const rateId = `engage-rate-${option.id}`
  const compareId = option.rateCompareLine ? `engage-rate-intro-${option.id}` : undefined
  const labelledBy = isHome ? titleId : [titleId, rateId, compareId].filter(Boolean).join(' ')

  return (
    <article
      id={id}
      className={isHome ? 'pc-engage-card pc-engage-card--home' : 'pc-engage-card'}
      data-cursor-orbit={isHome ? undefined : 'card'}
      aria-labelledby={labelledBy}
      {...orbPointerProps}
    >
      {isHome ? (
        <>
          <span className="pc-engage-monogram" aria-hidden="true">
            {num}
          </span>
          <span className="pc-engage-badge" aria-hidden="true">
            <span className="pc-engage-badge-letter" data-letter={num}>
              {num}
            </span>
          </span>
        </>
      ) : null}
      <div className="pc-engage-copy">
        <p className="pc-engage-option">{option.optionLabel}</p>
        <h3 className="pc-engage-card-title" id={titleId}>
          {option.title}
          {isHome ? null : (
          <span className="sr-only">
            {' '}
            —{' '}
            {option.rateCompareLine
              ? `${option.rateBadge ? `${option.rateBadge}. ` : ''}${option.rateCompareLine}${option.rateUntilLine ? `. ${option.rateUntilLine}. ` : ' '}${option.rateStandardLine ?? option.rateLine}`
              : option.rateLine}
          </span>
          )}
        </h3>
        {isHome ? <span className="pc-engage-rule" aria-hidden="true" /> : null}
        <p className="pc-engage-card-question">{option.question}</p>
        <p className="pc-engage-card-summary">{option.summary}</p>
      </div>
      <EngagementPricing
        option={option}
        compact={isHome}
        rateId={rateId}
        compareId={compareId}
        hidden={isHome}
      />
      <div className="pc-engage-card-footer">{footer}</div>
      {isHome ? (
        <p className="pc-engage-mark" aria-hidden="true">
          IOM
        </p>
      ) : null}
    </article>
  )
}
