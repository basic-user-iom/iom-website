import { lazy, Suspense, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { ProjectSectionBlock } from './components/ProjectSectionBlock'
import { About } from './components/About'
import { Clients } from './components/Clients'
import { SiteOrbZone } from './components/SiteOrbZone'
import { Footer } from './components/Footer'
import { SiteAmbientAudio } from './components/SiteAmbientAudio'
import { isArtistGlobePath } from './artist-globe/paths'
import { isBlogPath } from './blog/types'
import { isCaseStudyPath } from './case-studies/paths'
import { isLegalPath } from './legal/paths'
import { isRecordingSharePath, recordingSlugFromPath } from './crm/recordingSharePaths'
import { isIcmDemoPath } from './demo/icm/paths'
import { isImagePrepPath } from './tools/image-prep/paths'
import {
  disableCrmDemoMode,
  enableCrmDemoMode,
  isCrmDemoMode,
  isCrmDemoPath,
} from './crm/demoMode'
import { SiteI18nProvider, parseLocalePath } from './i18n'
import { localizedSections } from './i18n/projects/localize'
import { usePageMeta } from './seo/usePageMeta'

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
    return () => document.body.classList.remove('crm-route')
  }, [isClientLogin, isCrmDemo])

  /** Deep-link hashes (e.g. /#image-prep or /de/#software) after SPA mount. */
  useEffect(() => {
    if (path !== '/') return

    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, '')
      if (!id) return true
      const el = document.getElementById(id)
      if (!el) return false
      el.classList.add('is-visible')
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }

    if (scrollToHash()) return

    const started = Date.now()
    const timer = window.setInterval(() => {
      if (scrollToHash() || Date.now() - started > 2500) {
        window.clearInterval(timer)
      }
    }, 50)

    const onHash = () => {
      window.requestAnimationFrame(() => {
        scrollToHash()
      })
    }
    window.addEventListener('hashchange', onHash)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('hashchange', onHash)
    }
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

  if (isClientLogin || isCrmDemo) {
    return (
      <>
        <Header />
        <main id="main-content">
          <Suspense fallback={null}>
            <CrmApp demo={isCrmDemo} />
          </Suspense>
        </main>
      </>
    )
  }

  const sections = localizedSections(lang)

  return (
    <SiteI18nProvider lang={lang}>
      <Header />
      <SiteAmbientAudio />
      <main id="main-content">
        <SiteOrbZone>
          <Hero />
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
          <About />
        </SiteOrbZone>
      </main>
      <Footer />
    </SiteI18nProvider>
  )
}
