import { memo, useEffect, useRef, useState } from 'react'
import { projectsForSection } from '../data/projects'
import { MusicPlayer } from './MusicPlayer'

interface MusicSectionProps {
  index: string
  label: string
  blurb: string
}

export const MusicSection = memo(function MusicSection({ index, label, blurb }: MusicSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const projects = projectsForSection('music')
  const playableIds = projects.filter((project) => project.audioUrl).map((project) => project.id)
  const [activeTrackId, setActiveTrackId] = useState<string | null>(() => playableIds[0] ?? null)

  useEffect(() => {
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
  }, [])

  return (
    <section className="section-block section-block--music" id="music" ref={sectionRef}>
      <header className="section-header">
        <span className="section-index">{index}</span>
        <div>
          <h2 className="section-title">{label}</h2>
          <p className="section-blurb">{blurb}</p>
        </div>
      </header>

      <MusicPlayer
        tracks={projects}
        activeTrackId={activeTrackId}
        onActiveTrackChange={setActiveTrackId}
      />
    </section>
  )
})
