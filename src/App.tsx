import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { ProjectSectionBlock } from './components/ProjectSectionBlock'
import { About } from './components/About'
import { Footer } from './components/Footer'
import { ArtistGlobeApp, isArtistGlobePath } from './artist-globe/ArtistGlobeApp'
import { BlogApp, isBlogPath } from './blog/BlogApp'
import { CrmApp } from './crm/CrmApp'
import { IcmDemoApp, isIcmDemoPath } from './demo/icm/IcmDemoApp'
import { ImagePrepApp, isImagePrepPath } from './tools/image-prep/ImagePrepApp'
import {
  disableCrmDemoMode,
  enableCrmDemoMode,
  isCrmDemoMode,
  isCrmDemoPath,
} from './crm/demoMode'
import { initAnalytics } from './analytics/track'
import { SECTIONS } from './data/projects'
import { usePageMeta } from './seo/usePageMeta'

function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return path.replace(/\/+$/, '') || '/'
}

/**
 * Must run during render (not only in useEffect) so CrmApp never mounts
 * against a live Supabase session before the sandbox flag is on.
 */
function syncCrmDemoFlag(isDemoRoute: boolean): void {
  if (isDemoRoute) {
    if (!isCrmDemoMode()) enableCrmDemoMode()
  } else if (isCrmDemoMode()) {
    disableCrmDemoMode()
  }
}

export default function App() {
  const path = usePathname()
  const isClientLogin = path === '/client-login'
  const isCrmDemo = isCrmDemoPath(path)
  const isArtistGlobe = isArtistGlobePath(path)
  const isBlog = isBlogPath(path)
  const isIcmDemo = isIcmDemoPath(path)
  const isImagePrep = isImagePrepPath(path)

  syncCrmDemoFlag(isCrmDemo)

  usePageMeta(path)

  useEffect(() => {
    return initAnalytics(() => window.location.pathname.replace(/\/+$/, '') || '/')
  }, [])

  useEffect(() => {
    return () => {
      // Strict Mode remounts still sit on /crm-demo — don't clear the sandbox.
      if (!isCrmDemoPath(window.location.pathname)) {
        disableCrmDemoMode()
      }
    }
  }, [])

  useEffect(() => {
    const onCrm = isClientLogin || isCrmDemo
    document.body.classList.toggle('crm-route', onCrm)
    return () => document.body.classList.remove('crm-route')
  }, [isClientLogin, isCrmDemo])

  if (isArtistGlobe) {
    return <ArtistGlobeApp />
  }

  if (isIcmDemo) {
    return <IcmDemoApp />
  }

  if (isImagePrep) {
    return <ImagePrepApp />
  }

  if (isBlog) {
    return <BlogApp />
  }

  if (isClientLogin || isCrmDemo) {
    return (
      <>
        <Header />
        <CrmApp demo={isCrmDemo} />
      </>
    )
  }

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
