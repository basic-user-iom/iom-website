import { lazy, Suspense, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { SiteOrbZone } from './components/SiteOrbZone'
import { Footer } from './components/Footer'
import { SiteAmbientAudio } from './components/SiteAmbientAudio'
import { DeferredHomeBody } from './components/DeferredHomeBody'
import { isArtistGlobePath } from './artist-globe/paths'
import { isBlogPath } from './blog/paths'
import { isCaseStudyPath } from './case-studies/paths'
import { isLegalPath } from './legal/paths'
import { isLegacyStartPath, isProjectCostsPath } from './project-costs/paths'
import { isRecordingSharePath, recordingSlugFromPath } from './crm/recordingSharePaths'
import { isIcmDemoPath } from './demo/icm/paths'
import { isImagePrepPath } from './tools/image-prep/paths'
import {
  disableCrmDemoMode,
  enableCrmDemoMode,
  isCrmDemoMode,
} from './crm/demoMode'
import { isCrmDemoPath } from './crm/demoPaths'
import { SiteI18nProvider, parseLocalePath } from './i18n'
import { localizedSectionNav } from './i18n/projects/sectionNav'
import { usePageMeta } from './seo/usePageMeta'
import { setCustomCursorEnabled } from './cursor/mountCustomCursor'
import { watchLocationHashScroll } from './utils/homeHashScroll'

const ProjectSectionBlock = lazy(() =>
  import('./components/ProjectSectionBlock').then((m) => ({ default: m.ProjectSectionBlock })),
)
const About = lazy(() => import('./components/About').then((m) => ({ default: m.About })))
const Clients = lazy(() => import('./components/Clients').then((m) => ({ default: m.Clients })))
const ArtistGlobeApp = lazy(() =>
  import('./artist-globe/ArtistGlobeApp').then((m) => ({ default: m.ArtistGlobeApp })),
)
const IcmDemoApp = lazy(() =>
  import('./demo/icm/IcmDemoApp').then((m) => ({ default: m.IcmDemoApp })),
)
const CrmApp = lazy(() => import('./crm/CrmApp').then((m) => ({ default: m.CrmApp })))
const BlogApp = lazy(() => import('./blog/BlogApp').then((m) => ({ default: m.BlogApp })))
const CaseStudyApp = lazy(() =>
  import('./case-studies/CaseStudyApp').then((m) => ({ default: m.CaseStudyApp })),
)
const LegalApp = lazy(() => import('./legal/LegalApp').then((m) => ({ default: m.LegalApp })))
const ProjectCostsApp = lazy(() =>
  import('./project-costs/ProjectCostsApp').then((m) => ({ default: m.ProjectCostsApp })),
)
const ImagePrepApp = lazy(() =>
  import('./tools/image-prep/ImagePrepApp').then((m) => ({ default: m.ImagePrepApp })),
)
const RecordingSharePage = lazy(() =>
  import('./crm/RecordingSharePage').then((m) => ({ default: m.RecordingSharePage })),
)

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
  const rawPath = usePathname()
  const { lang, path } = parseLocalePath(rawPath)
  const isClientLogin = path === '/client-login'
  const isCrmDemo = isCrmDemoPath(path)
  const isRecordingShare = isRecordingSharePath(path)
  const recordingSlug = isRecordingShare ? recordingSlugFromPath(path) : null
  const isArtistGlobe = isArtistGlobePath(path)
  const isBlog = isBlogPath(path)
  const isCaseStudy = isCaseStudyPath(path)
  const isLegal = isLegalPath(path)
  const isProjectCosts = isProjectCostsPath(path) || isLegacyStartPath(path)
  const isIcmDemo = isIcmDemoPath(path)
  const isImagePrep = isImagePrepPath(path)

  syncCrmDemoFlag(isCrmDemo)

  usePageMeta(path, lang)

  useEffect(() => {
    let cancelled = false
    let idleId = 0
    let timeoutId = 0
    let cleanup: (() => void) | undefined

    const start = () => {
      if (cancelled) return
      void import('./analytics/track').then(({ initAnalytics }) => {
        if (cancelled) return
        cleanup = initAnalytics(() => window.location.pathname.replace(/\/+$/, '') || '/')
      })
    }

    // After full load + idle so pageview stays off the LCP / critical-path chain.
    const armIdle = () => {
      if (cancelled) return
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(start, { timeout: 6000 })
      } else {
        timeoutId = window.setTimeout(start, 3000)
      }
    }

    if (document.readyState === 'complete') {
      armIdle()
    } else {
      window.addEventListener('load', armIdle, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', armIdle)
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) window.clearTimeout(timeoutId)
      cleanup?.()
    }
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
    document.body.classList.toggle('crm-demo-route', isCrmDemo)
    setCustomCursorEnabled(!onCrm)
    if (onCrm) {
      document.documentElement.classList.remove('is-hash-scrolling')
      document.documentElement.style.removeProperty('--hash-scroll-pad')
    }
    return () => {
      document.body.classList.remove('crm-route', 'crm-demo-route')
      setCustomCursorEnabled(true)
    }
  }, [isClientLogin, isCrmDemo])

  /** Deep-link + same-page hashes after SPA mount. Wait for the real section, not placeholders. */
  useEffect(() => {
    if (path !== '/') return
    return watchLocationHashScroll()
  }, [path])

  if (isArtistGlobe) {
    return (
      <Suspense fallback={null}>
        <ArtistGlobeApp />
      </Suspense>
    )
  }

  if (isIcmDemo) {
    return (
      <Suspense fallback={null}>
        <IcmDemoApp />
      </Suspense>
    )
  }

  if (isRecordingShare && recordingSlug) {
    return (
      <Suspense fallback={null}>
        <RecordingSharePage slug={recordingSlug} />
      </Suspense>
    )
  }

  if (isImagePrep) {
    return (
      <Suspense fallback={null}>
        <ImagePrepApp />
      </Suspense>
    )
  }

  if (isBlog) {
    return (
      <SiteI18nProvider lang={lang}>
        <Suspense fallback={null}>
          <BlogApp path={path} />
        </Suspense>
      </SiteI18nProvider>
    )
  }

  if (isCaseStudy) {
    return (
      <SiteI18nProvider lang={lang}>
        <Suspense fallback={null}>
          <CaseStudyApp path={path} />
        </Suspense>
      </SiteI18nProvider>
    )
  }

  if (isLegal) {
    return (
      <SiteI18nProvider lang={lang}>
        <Suspense fallback={null}>
          <LegalApp path={path} />
        </Suspense>
      </SiteI18nProvider>
    )
  }

  if (isProjectCosts) {
    return (
      <SiteI18nProvider lang={lang}>
        <Suspense fallback={null}>
          <ProjectCostsApp />
        </Suspense>
      </SiteI18nProvider>
    )
  }

  if (isCrmDemo) {
    return (
      <main id="main-content">
        <Suspense fallback={null}>
          <CrmApp demo />
        </Suspense>
      </main>
    )
  }

  if (isClientLogin) {
    return (
      <>
        <Header />
        <main id="main-content">
          <Suspense fallback={null}>
            <CrmApp />
          </Suspense>
        </main>
      </>
    )
  }

  const sections = localizedSectionNav(lang)

  return (
    <SiteI18nProvider lang={lang}>
      <Header />
      <SiteAmbientAudio />
      <main id="main-content">
        <SiteOrbZone>
          <Hero />
          <DeferredHomeBody sectionIds={sections.map((section) => section.id)}>
            {sections.map((section, i) => (
              <ProjectSectionBlock
                key={section.id}
                id={section.id}
                index={String(i + 1).padStart(2, '0')}
                label={section.label}
                blurb={section.blurb}
              />
            ))}
            <Clients />
          </DeferredHomeBody>
          <Suspense fallback={null}>
            <About />
          </Suspense>
        </SiteOrbZone>
      </main>
      <Footer />
    </SiteI18nProvider>
  )
}
