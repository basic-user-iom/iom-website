import { memo } from 'react'
import { ContactForm } from './ContactForm'

export const About = memo(function About() {
  return (
    <section className="about-block" id="contact">
      <h2 className="about-title">Objects worth exploring</h2>
      <p className="about-text">
        IOM is a studio for interactive media — from production software like 3D Viewer
        to cinematic web experiments and spatial archives. We combine technical craft with
        artistic direction to make digital objects feel alive.
      </p>
      <ContactForm />
    </section>
  )
})
