import { ENGAGEMENT_OPTIONS } from '../project-costs/data'
import { useSiteI18n } from '../i18n'
import { EngagementCardShell } from './EngagementCardShell'
import './engagement.css'

export function HomeEngagementSection() {
  const { href, t } = useSiteI18n()
  const costsHref = href('/project-costs')

  return (
    <section
      className="home-engage"
      id="engage-iom"
      aria-labelledby="home-engage-heading"
    >
      <p className="about-eyebrow">{t('home.engage.eyebrow')}</p>
      <h2 className="about-title" id="home-engage-heading">
        {t('home.engage.title')}
      </h2>
      <p className="about-text">{t('home.engage.lead')}</p>

      <div className="pc-engage-grid home-engage-grid">
        {ENGAGEMENT_OPTIONS.map((option) => (
          <EngagementCardShell
            key={option.id}
            option={option}
            variant="home"
            footer={
              <a
                className="pc-engage-card-link"
                href={`${costsHref}#${option.anchor}`}
              >
                {option.learnMoreLabel}
              </a>
            }
          />
        ))}
      </div>

      <div className="home-engage-actions">
        <a className="btn btn-primary" href={costsHref}>
          {t('home.engage.cta')}
        </a>
        <a className="btn btn-ghost" href={href('/#contact')} data-cursor="start">
          {t('home.engage.augustCta')}
        </a>
      </div>
    </section>
  )
}
