import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react'
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

/** Mount music player JS only when the section is near the viewport. */
function DeferredMusicSection({
  index,
  label,
  blurb,
}: {
  index: string
  label: string
  blurb: string
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setReady(true)
        observer.disconnect()
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={anchorRef}>
      {ready ? (
        <Suspense
          fallback={
            <section className="section-block section-block--music" id="music" aria-busy="true" />
          }
        >
          <MusicSection index={index} label={label} blurb={blurb} />
        </Suspense>
      ) : (
        <section className="section-block section-block--music" id="music" aria-busy="true" />
      )}
    </div>
  )
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
    return <DeferredMusicSection index={index} label={label} blurb={blurb} />
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
