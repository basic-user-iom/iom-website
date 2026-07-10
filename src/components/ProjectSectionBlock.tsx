import { memo, useEffect, useRef } from 'react'
import { projectsForSection, type ProjectSection } from '../data/projects'
import { MusicSection } from './MusicSection'
import { ProjectCard } from './ProjectCard'

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
  const sectionRef = useRef<HTMLElement>(null)
  const projects = projectsForSection(id)
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
    return <MusicSection index={index} label={label} blurb={blurb} />
  }

  return (
    <section className="section-block" id={id} ref={sectionRef}>
      <header className="section-header">
        <span className="section-index">{index}</span>
        <div>
          <h2 className="section-title">{label}</h2>
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
