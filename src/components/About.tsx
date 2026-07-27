import { memo, useMemo, useState } from 'react'
import { TEAM, TEAM_PORTRAIT_EXTS, type TeamMember } from '../data/team'
import { ContactForm } from './ContactForm'
import { useSiteOrbsOptional } from './SiteOrbZone'
import { useSiteI18n } from '../i18n'

const TeamCard = memo(function TeamCard({ member }: { member: TeamMember }) {
  const { t } = useSiteI18n()
  const candidates = useMemo(() => {
    if (!member.portraitBase) return [] as string[]
    return TEAM_PORTRAIT_EXTS.map((ext) => `${member.portraitBase}${ext}`)
  }, [member.portraitBase])

  const [index, setIndex] = useState(0)
  const src = candidates[index]
  const showImage = Boolean(src)
  const role = t(`team.${member.id}.role`)
  const philosophy = t(`team.${member.id}.philosophy`)
  const rfoStage = t(`team.${member.id}.rfoStage`)

  return (
    <li className={`about-team-card about-team-card--${member.id}`}>
      <div className="about-team-visual" aria-hidden="true">
        {showImage ? (
          <img
            className="about-team-photo"
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => {
              setIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))
            }}
          />
        ) : (
          <span className="about-team-monogram">{member.initials}</span>
        )}
      </div>

      <div className="about-team-copy">
        <span className="about-team-badge" aria-hidden="true">
          <span className="about-team-badge-letter" data-letter={member.initials}>
            {member.initials}
          </span>
        </span>
        <div className="about-team-body">
          <p className="about-team-rfo">{rfoStage}</p>
          <h3 className="about-team-name">{member.name}</h3>
          <p className="about-team-role">{role}</p>
          <span className="about-team-rule" aria-hidden="true" />
          <p className="about-team-philosophy">{philosophy}</p>
          <a className="about-team-email" href={`mailto:${member.email}`}>
            {member.email}
          </a>
        </div>
        <p className="about-team-mark" aria-hidden="true">
          IOM
        </p>
      </div>
    </li>
  )
})

export const About = memo(function About() {
  const orbs = useSiteOrbsOptional()
  const { t } = useSiteI18n()

  return (
    <>
      <section className="about-block" id="about" aria-labelledby="about-heading">
        <div className="about-intro">
          <div className="about-intro-fx" aria-hidden="true">
            <span className="about-intro-wash" />
            <span className="about-intro-glow about-intro-glow--a" />
            <span className="about-intro-glow about-intro-glow--b" />
            <span className="about-intro-glow about-intro-glow--c" />
          </div>

          <div className="about-intro-shell">
            <header className="about-lead">
              <div className="about-lead-main">
                <p className="about-eyebrow">{t('about.eyebrow')}</p>
                <h2 className="about-title" id="about-heading">
                  {t('about.title')}
                </h2>
              </div>
              <div className="about-lead-copy">
                <p className="about-lead-blurb">{t('about.blurb')}</p>
                <p className="about-lead-note">{t('about.note')}</p>
              </div>
            </header>

            <div className="about-pathway" id="rfo" aria-labelledby="rfo-heading">
              <div className="about-pathway-head">
                <p className="about-eyebrow" id="rfo-heading">
                  Process · {t('rfo.title')}
                </p>
                <p className="about-pathway-tagline">{t('rfo.tagline')}</p>
                <p className="about-pathway-method">{t('rfo.method')}</p>
              </div>

              <ol className="about-pathway-flow" aria-label={t('about.rfoAria')}>
                {TEAM.map((member, i) => (
                  <li
                    key={member.id}
                    className="about-pathway-item"
                    onPointerEnter={() => {
                      orbs?.setHover('rfo', i)
                    }}
                    onPointerLeave={() => {
                      orbs?.setHover(null, null)
                    }}
                  >
                    <span
                      className="about-pathway-node"
                      aria-hidden="true"
                      ref={(node) => {
                        if (orbs) orbs.rfoNodesRef.current[i] = node
                      }}
                    >
                      {member.initials}
                    </span>
                    <span className="about-pathway-stage">{t(`team.${member.id}.rfoStage`)}</span>
                    <span className="about-pathway-who">{member.name}</span>
                    {i < TEAM.length - 1 ? (
                      <span className="about-pathway-link" aria-hidden="true" />
                    ) : null}
                  </li>
                ))}
              </ol>

              <ol className="about-pathway-phases" aria-label={t('rfo.phasesAria')}>
                {([1, 2, 3, 4] as const).map((n) => (
                  <li key={n} className="about-pathway-phase">
                    <span className="about-pathway-phase-index" aria-hidden="true">
                      {String(n).padStart(2, '0')}
                    </span>
                    <div className="about-pathway-phase-copy">
                      <h3 className="about-pathway-phase-title">{t(`rfo.phase${n}.title`)}</h3>
                      <p className="about-pathway-phase-text">{t(`rfo.phase${n}.text`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <p className="about-team-label">{t('about.teamLabel')}</p>
        <ul className="about-team">
          {TEAM.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </ul>

        <p className="about-rfo-close-text">{t('rfo.close')}</p>
      </section>

      <section className="about-block about-block--contact" id="contact" aria-labelledby="contact-heading">
        <p className="about-eyebrow">{t('about.contactEyebrow')}</p>
        <h2 className="about-title" id="contact-heading">
          {t('about.contactTitle')}
        </h2>
        <p className="about-text">{t('about.contactText')}</p>
        <ContactForm />
      </section>
    </>
  )
})
