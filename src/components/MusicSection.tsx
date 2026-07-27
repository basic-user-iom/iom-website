import { memo, useEffect, useRef, useState } from 'react'
import { useSiteI18n } from '../i18n'
import { localizedProjectsForSection } from '../i18n/projects/localize'
import { MusicPlayer } from './MusicPlayer'

interface MusicSectionProps {
  index: string
  label: string
  blurb: string
}

export const MusicSection = memo(function MusicSection({ index, label, blurb }: MusicSectionProps) {
  const { lang } = useSiteI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const projects = localizedProjectsForSection('music', lang)
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
    <section
      className="section-block section-block--music"
      id="music"
      ref={sectionRef}
      aria-labelledby="music-heading"
    >
      <header className="section-header">
        <span className="section-index" aria-hidden="true">
          {index}
        </span>
        <div>
          <h2 className="section-title" id="music-heading">
            {label}
          </h2>
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
