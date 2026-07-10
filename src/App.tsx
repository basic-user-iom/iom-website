import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { ProjectSectionBlock } from './components/ProjectSectionBlock'
import { About } from './components/About'
import { Footer } from './components/Footer'
import { SECTIONS } from './data/projects'

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        {SECTIONS.map((section, i) => (
          <ProjectSectionBlock
            key={section.id}
            id={section.id}
            index={String(i + 1).padStart(2, '0')}
            label={section.label}
            blurb={section.blurb}
          />
        ))}
        <About />
      </main>
      <Footer />
    </>
  )
}
