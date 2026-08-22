import { useState } from 'react'
import { RELEVANT_WORK, type EngagementOption } from '../project-costs/data'
import { localizedEngagementOptions } from '../i18n/projectCosts'
import { useSiteI18n } from '../i18n'
import { EngagementCardShell } from './EngagementCardShell'
import { useCardOrbPointerProps } from './SiteOrbZone'
import { handleHomeHashLinkClick } from '../utils/homeHashScroll'
import { navigateSameTabOnClick } from '../utils/demoNav'
import './engagement.css'

function RelevantWorkCard({
  title,
  href,
  note,
  image,
  projectId,
}: {
  title: string
  href: string
  note: string
  image: string
  projectId: string
}) {
  const orbPointerProps = useCardOrbPointerProps()

  return (
    <a
      className="home-engage-proof-card"
      href={href}
      target="_self"
      onClick={(event) => navigateSameTabOnClick(event, href, { id: projectId })}
      {...orbPointerProps}
    >
      <span className="home-engage-proof-visual" aria-hidden="true">
        <img src={image} alt="" loading="lazy" decoding="async" />
      </span>
      <h3 className="pc-engage-card-title">{title}</h3>
      <span className="pc-engage-rule" aria-hidden="true" />
      <p className="pc-engage-card-summary">{note}</p>
      <p className="pc-engage-mark" aria-hidden="true">
        IOM
      </p>
    </a>
  )
}

function HomeLearnMore({ option }: { option: EngagementOption }) {
  const { t } = useSiteI18n()
  const [open, setOpen] = useState(false)

  return (
    <details
      className="pc-learn home-engage-learn"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="pc-learn-trigger"
        aria-expanded={open}
        aria-label={option.learnMoreLabel}
        data-cursor="focus"
      >
        <span className="pc-learn-trigger-row">
          <span className="pc-learn-trigger-label">{t('home.engage.learnMore')}</span>
          <span className="pc-learn-icon" aria-hidden="true">
            {open ? '−' : '→'}
          </span>
        </span>
      </summary>
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
                <a
                  className="btn btn-primary pc-engage-discuss"
                  href={href('/#contact')}
                  data-cursor="start"
                  onClick={(event) => handleHomeHashLinkClick(event, 'contact')}
                >
                  {t('home.engage.discuss')}
                </a>
              ) : (
                <HomeLearnMore option={option} />
              )
            }
          />
        ))}
      </div>

      <div className="home-engage-fixed">
        <h3 className="home-engage-fixed-title">{t('home.engage.fixedTitle')}</h3>
        <p>{t('home.engage.fixed')}</p>
      </div>

      <ul className="home-engage-trust" aria-label={t('home.engage.trustAria')}>
        <li className="home-engage-trust-item">{t('home.engage.trust.whiteLabel')}</li>
        <li className="home-engage-trust-item">{t('home.engage.trust.nda')}</li>
        <li className="home-engage-trust-item">{t('home.engage.trust.remote')}</li>
        <li className="home-engage-trust-item">{t('home.engage.trust.project')}</li>
      </ul>

      <div className="home-engage-proof">
        <p className="about-team-label">{t('home.engage.proofLabel')}</p>
        <ul className="home-engage-proof-list">
          {RELEVANT_WORK.map((item, index) => (
            <li key={item.href}>
              <RelevantWorkCard
                title={item.title}
                href={href(item.href)}
                note={proofNotes[index]}
                image={item.image}
                projectId={item.id}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="home-engage-actions">
        <a
          className="btn btn-primary"
          href={href('/#contact')}
          data-cursor="start"
          onClick={(event) => handleHomeHashLinkClick(event, 'contact')}
        >
          {t('home.engage.cta')}
        </a>
      </div>
    </section>
  )
}
