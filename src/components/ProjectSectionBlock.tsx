import { lazy, memo, Suspense, useEffect, useRef } from 'react'
import { type ProjectSection } from '../data/projects'
import { useSiteI18n } from '../i18n'
import { localizedProjectsForSection } from '../i18n/projects/localize'
import { ProjectCard } from './ProjectCard'

const MusicSection = lazy(() =>
  import('./MusicSection').then((m) => ({ default: m.MusicSection })),
)

interface ProjectSectionBlockProps {
  id: ProjectSection
  index: string
  label: string
  blurb: string
}

export const ProjectSectionBlock = memo(function ProjectSectionBlock({
  id,
  index,
  label,
  blurb,
}: ProjectSectionBlockProps) {
  const { lang } = useSiteI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const projects = localizedProjectsForSection(id, lang)
  const isMusic = id === 'music'

  useEffect(() => {
    if (isMusic) return
    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.reveal').forEach((node, i) => {
              window.setTimeout(() => node.classList.add('is-visible'), i * 80)
            })
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isMusic])

  if (isMusic) {
    return (
      <Suspense fallback={<section className="section-block section-block--music" id="music" aria-busy="true" />}>
        <MusicSection index={index} label={label} blurb={blurb} />
      </Suspense>
    )
  }

  return (
    <section
      className="section-block"
      id={id}
      ref={sectionRef}
      aria-labelledby={`${id}-heading`}
    >
      <header className="section-header">
        <span className="section-index" aria-hidden="true">
          {index}
        </span>
        <div>
          <h2 className="section-title" id={`${id}-heading`}>
            {label}
          </h2>
          <p className="section-blurb">{blurb}</p>
        </div>
      </header>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
})
