import { ENGAGEMENT_OPTIONS } from '../project-costs/data'
import { useSiteI18n } from '../i18n'
import { EngagementPricing } from './EngagementPricing'
import './engagement.css'

export function HomeEngagementSection() {
  const { href, t } = useSiteI18n()
  const costsHref = href('/project-costs')

  return (
    <section
      className="section-block home-engage"
      id="engage-iom"
      aria-labelledby="home-engage-heading"
    >
      <div className="home-engage-intro">
        <p className="home-engage-eyebrow">{t('home.engage.eyebrow')}</p>
        <h2 className="home-engage-title" id="home-engage-heading">
          {t('home.engage.title')}
        </h2>
        <p className="home-engage-lead">{t('home.engage.lead')}</p>
      </div>

      <div className="pc-engage-grid">
        {ENGAGEMENT_OPTIONS.map((option) => (
          <article
            key={option.id}
            className="pc-engage-card"
            data-cursor-orbit="card"
          >
            <div className="pc-engage-card-body">
              <p className="pc-engage-option">{option.optionLabel}</p>
              <h3 className="pc-engage-card-title">{option.title}</h3>
              <p className="pc-engage-card-summary">{option.summary}</p>
            </div>
            <EngagementPricing option={option} />
            <a
              className="pc-engage-card-link"
              href={`${costsHref}#${option.anchor}`}
            >
              {option.learnMoreLabel} →
            </a>
          </article>
        ))}
      </div>

      <div className="home-engage-actions">
        <a className="btn btn-primary" href={costsHref}>
          {t('home.engage.cta')}
        </a>
        <a className="btn btn-ghost" href={`${costsHref}#august-offer`}>
          {t('home.engage.augustCta')}
        </a>
      </div>
    </section>
  )
}
