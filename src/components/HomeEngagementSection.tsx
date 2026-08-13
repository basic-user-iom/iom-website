import { useState } from 'react'
import {
  PROJECT_COSTS_META,
  RELEVANT_WORK,
  isAugustIntroActive,
  type EngagementOption,
} from '../project-costs/data'
import { localizedEngagementOptions } from '../i18n/projectCosts'
import { useSiteI18n } from '../i18n'
import { EngagementCardShell } from './EngagementCardShell'
import './engagement.css'

function HomeLearnMore({ option }: { option: EngagementOption }) {
  return (
    <details className="pc-learn home-engage-learn">
      <summary className="pc-learn-trigger">{option.learnMoreLabel}</summary>
      <div className="pc-learn-panel">
        <p className="pc-learn-panel-title">{option.learnMoreTitle}</p>
        {option.learnMoreParagraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>
    </details>
  )
}

export function HomeEngagementSection() {
  const { href, t, lang } = useSiteI18n()
  const costsHref = href('/project-costs')
  const [augustActive] = useState(() => isAugustIntroActive())
  const options = localizedEngagementOptions(lang)
  const proofNotes = [
    t('home.engage.proof.viewer'),
    t('home.engage.proof.ssr'),
    t('home.engage.proof.witness'),
    t('home.engage.proof.miab'),
  ]

  return (
    <section
      className="home-engage"
      id="engage-iom"
      aria-labelledby="home-engage-heading"
    >
      <h2 className="about-title" id="home-engage-heading">
        {t('home.engage.title')}
      </h2>
      <p className="about-text">{t('home.engage.lead')}</p>
      <p className="home-engage-outcomes">{t('home.engage.outcomes')}</p>

      <div className="pc-engage-grid home-engage-grid">
        {options.map((option) => (
          <EngagementCardShell
            key={option.id}
            option={option}
            variant="home"
            footer={
              option.homeCta === 'discuss' ? (
                <a className="pc-engage-card-link" href={PROJECT_COSTS_META.discussMail}>
                  {t('home.engage.discuss')}
                </a>
              ) : (
                <HomeLearnMore option={option} />
              )
            }
          />
        ))}
      </div>

      <p className="home-engage-fixed">{t('home.engage.fixed')}</p>

      <ul className="home-engage-trust" aria-label={t('home.engage.trustAria')}>
        <li>{t('home.engage.trust.whiteLabel')}</li>
        <li>{t('home.engage.trust.nda')}</li>
        <li>{t('home.engage.trust.remote')}</li>
        <li>{t('home.engage.trust.project')}</li>
      </ul>

      <div className="home-engage-proof">
        <p className="home-engage-proof-label">{t('home.engage.proofLabel')}</p>
        <ul className="home-engage-proof-list">
          {RELEVANT_WORK.map((item, index) => (
            <li key={item.href}>
              <a href={href(item.href)}>{item.title}</a>
              <span>{proofNotes[index]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="home-engage-actions">
        <a className="btn btn-primary" href={costsHref}>
          {t('home.engage.cta')}
        </a>
        {augustActive ? (
          <a className="home-engage-august-link" href={`${costsHref}#august-offer`}>
            {t('home.engage.augustCta')}
          </a>
        ) : null}
      </div>
    </section>
  )
}
