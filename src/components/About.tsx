import { memo, useMemo, useState } from 'react'
import { RFO, TEAM, TEAM_PORTRAIT_EXTS, type TeamMember } from '../data/team'
import { ContactForm } from './ContactForm'
import { useSiteOrbsOptional } from './SiteOrbZone'

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
  const orbs = useSiteOrbsOptional()

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
                <p className="about-eyebrow">Studio</p>
                <h2 className="about-title" id="about-heading">
                  The team behind the objects
                </h2>
              </div>
              <div className="about-lead-copy">
                <p className="about-lead-blurb">
                  IOM is a studio for interactive media, browser-based 3D, WebGPU experiments, 360°
                  experiences, and spatial archives — technical development and artistic direction
                  for digital objects that feel clear, purposeful, and alive.
                </p>
                <p className="about-lead-note">
                  Public identities: Raven, Fox, and Octopus. Collaboration stays human — clients
                  meet the real people on calls and work with everyone on the project.
                </p>
              </div>
            </header>

            <div className="about-pathway" id="rfo" aria-labelledby="rfo-heading">
              <div className="about-pathway-head">
                <p className="about-eyebrow" id="rfo-heading">
                  Process · {RFO.title}
                </p>
                <p className="about-pathway-tagline">{RFO.tagline}</p>
              </div>

              <ol className="about-pathway-flow" aria-label="RFO stages">
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
                    <span className="about-pathway-stage">{member.rfoStage}</span>
                    <span className="about-pathway-who">{member.name}</span>
                    {i < TEAM.length - 1 ? (
                      <span className="about-pathway-link" aria-hidden="true" />
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <p className="about-team-label">Studio identities · R F O</p>
        <ul className="about-team">
          {TEAM.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </ul>

        <p className="about-rfo-close-text">{RFO.close}</p>
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
