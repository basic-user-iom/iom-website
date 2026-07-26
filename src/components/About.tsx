import { memo, useMemo, useState } from 'react'
import { RFO, TEAM, TEAM_PORTRAIT_EXTS, type TeamMember } from '../data/team'
import { ContactForm } from './ContactForm'

const TeamCard = memo(function TeamCard({ member }: { member: TeamMember }) {
  const candidates = useMemo(() => {
    if (!member.portraitBase) return [] as string[]
    return TEAM_PORTRAIT_EXTS.map((ext) => `${member.portraitBase}${ext}`)
  }, [member.portraitBase])

  const [index, setIndex] = useState(0)
  const src = candidates[index]
  const showImage = Boolean(src)

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
          <p className="about-team-rfo">{member.rfoStage}</p>
          <h3 className="about-team-name">{member.name}</h3>
          <p className="about-team-role">{member.role}</p>
          <span className="about-team-rule" aria-hidden="true" />
          <p className="about-team-philosophy">{member.philosophy}</p>
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
  return (
    <>
      <section className="about-block" id="about" aria-labelledby="about-heading">
        <div className="about-intro">
          <div className="about-intro-fx" aria-hidden="true">
            <span className="about-intro-wash" />
            <span className="about-intro-glow about-intro-glow--a" />
            <span className="about-intro-glow about-intro-glow--b" />
            <span className="about-intro-glow about-intro-glow--c" />
            <div className="about-intro-rails">
              <div className="about-intro-rail about-intro-rail--left">
                {TEAM.map((member) => (
                  <span key={member.id} className="about-intro-rail-letter">
                    {member.initials}
                  </span>
                ))}
              </div>
              <div className="about-intro-rail about-intro-rail--right">
                {TEAM.map((member) => (
                  <span key={member.id} className="about-intro-rail-stage">
                    {member.rfoStage}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="about-intro-copy">
            <p className="about-eyebrow">Studio</p>
            <h2 className="about-title" id="about-heading">
              The team behind the objects
            </h2>
            <p className="about-text">
              IOM is a studio for interactive media, browser-based 3D, WebGPU experiments, 360°
              experiences, and spatial archives. We combine technical development with artistic
              direction to create digital objects that feel clear, purposeful, and alive.
            </p>
            <p className="about-text about-text--follow">
              Our public-facing identities are Raven, Fox, and Octopus, but the collaboration is
              entirely human. Clients meet the real people behind them during calls and work
              directly with everyone involved in their project.
            </p>

            <div className="about-rfo" id="rfo" aria-labelledby="rfo-heading">
              <p className="about-eyebrow">Process</p>
              <h3 className="about-rfo-title" id="rfo-heading">
                {RFO.title}
              </h3>
              <p className="about-rfo-tagline">{RFO.tagline}</p>
              <p className="about-text">{RFO.short}</p>
              <p className="about-text about-text--follow">{RFO.bridge}</p>
            </div>
          </div>
        </div>

        <p className="about-team-label">Studio identities · R F O</p>
        <ul className="about-team">
          {TEAM.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </ul>

        <div className="about-rfo-legend">
          <ol className="about-rfo-flow" aria-label="RFO stages">
            {TEAM.map((member) => (
              <li key={member.id} className="about-rfo-flow-item">
                <p className="about-rfo-flow-head">
                  <span className="about-rfo-flow-stage">{member.rfoStage}</span>
                  <span className="about-rfo-flow-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="about-rfo-flow-who">{member.name}</span>
                </p>
                <p className="about-rfo-flow-text">{member.rfoLine}</p>
              </li>
            ))}
          </ol>
          <aside className="about-rfo-close" aria-label="About RFO">
            <p className="about-rfo-close-text">{RFO.close}</p>
          </aside>
        </div>
      </section>

      <section className="about-block about-block--contact" id="contact" aria-labelledby="contact-heading">
        <p className="about-eyebrow">Hire us</p>
        <h2 className="about-title" id="contact-heading">
          Let&apos;s build something worth exploring
        </h2>
        <p className="about-text">
          Tell us about the product, place, or experience you need. We reply within two business
          days with next steps — scope questions, a short call, or a clear “not a fit yet.”
        </p>
        <ContactForm />
      </section>
    </>
  )
})
