import { useMemo, useState } from 'react'
import { PROJECTS, type ProjectApplication } from './data/projects'
import type { SystemId } from './data/systems'
import { pickLocale } from './i18n/locale'
import { useLocale } from './i18n/LocaleContext'
import { MaskImage } from './MaskImage'
import { navigate } from './router'

const APP_IDS = ['all', 'walls', 'ceilings', 'acoustics', 'partitions', 'furniture', 'lighting'] as const
const SYSTEM_IDS = ['all', 'linar', 'sonar', 'foli', 'janus', 'janus-tex', 'duna'] as const

export function ProjectsPage() {
  const { locale, t } = useLocale()
  const [app, setApp] = useState<'all' | ProjectApplication>('all')
  const [system, setSystem] = useState<'all' | SystemId>('all')

  const filtered = useMemo(
    () =>
      PROJECTS.filter((project) => {
        if (app !== 'all' && project.application !== app) return false
        if (system !== 'all' && project.system !== system) return false
        return true
      }),
    [app, system],
  )

  const appLabel = (id: (typeof APP_IDS)[number]) => {
    if (id === 'all') return t.projects.filters.all
    return t.projects.filters[id]
  }

  const systemLabel = (id: (typeof SYSTEM_IDS)[number]) => {
    if (id === 'all') return t.projects.filters.allSystems
    return id.toUpperCase()
  }

  return (
    <main id="main" className="dk-projects-page">
      <section className="dk-section">
        <div className="dk-container">
          <header className="dk-intro">
            <p className="dk-kicker">{t.projects.kicker}</p>
            <h1>{t.projects.archiveTitle}</h1>
            <p>{t.projects.archiveIntro}</p>
            <a
              className="dk-link"
              href="/demos/dukta/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/demos/dukta/')
              }}
            >
              {t.actions.home}
            </a>
          </header>

          <div className="dk-filters" role="toolbar" aria-label={t.a11y.filterProjects}>
            <div className="dk-filters__row">
              {APP_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={app === id ? 'is-active' : undefined}
                  onClick={() => setApp(id)}
                >
                  {appLabel(id)}
                </button>
              ))}
            </div>
            <div className="dk-filters__row">
              {SYSTEM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={system === id ? 'is-active' : undefined}
                  onClick={() => setSystem(id)}
                >
                  {systemLabel(id)}
                </button>
              ))}
            </div>
          </div>

          <div className="dk-project-grid dk-project-grid--archive">
            {filtered.map((project) => (
              <article key={project.slug} id={project.slug} className="dk-project-card dk-project-card--archive">
                <div className="dk-project-card__visual">
                  <MaskImage src={project.image} alt={project.title} reveal="crop" />
                  <div className="dk-project-card__overlay">
                    <h2>{project.title}</h2>
                    <p>
                      {project.system.toUpperCase()} · {t.projects.filters[project.application]} ·{' '}
                      {project.location}
                      {project.year ? ` · ${project.year}` : ''}
                    </p>
                  </div>
                </div>
                <div className="dk-project-card__meta">
                  <p className="dk-project-card__intro">{pickLocale(project.intro, locale)}</p>
                  <dl className="dk-spec dk-spec--compact">
                    <div>
                      <dt>{t.projects.material}</dt>
                      <dd>{pickLocale(project.material, locale)}</dd>
                    </div>
                    {project.architect ? (
                      <div>
                        <dt>{t.projects.architect}</dt>
                        <dd>{project.architect}</dd>
                      </div>
                    ) : null}
                    {project.designer ? (
                      <div>
                        <dt>{t.projects.design}</dt>
                        <dd>{project.designer}</dd>
                      </div>
                    ) : null}
                    {project.partner ? (
                      <div>
                        <dt>{t.projects.partner}</dt>
                        <dd>{project.partner}</dd>
                      </div>
                    ) : null}
                    {project.photos ? (
                      <div>
                        <dt>{t.projects.photos}</dt>
                        <dd>{project.photos}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 ? <p className="dk-note">{t.projects.empty}</p> : null}
        </div>
      </section>
    </main>
  )
}
