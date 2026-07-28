import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { useSiteI18n } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import { getLegalPage } from './getLegalPage'
import { isLegalSlug, type LegalSlug } from './legalPages'
import './legal.css'

export { isLegalPath } from './paths'

function slugFromPath(pathname: string): LegalSlug | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  const slug = p.replace(/^\//, '')
  return isLegalSlug(slug) ? slug : null
}

function LegalView({ slug }: { slug: LegalSlug }) {
  const { t, href, lang } = useSiteI18n()
  const page = useMemo(() => getLegalPage(lang, slug), [lang, slug])

  useEffect(() => {
    applyPageMeta(`/${slug}`, lang)
  }, [slug, lang])

  const navItems = useMemo(
    () =>
      (['privacy', 'terms', 'cookies'] as const).map((s) => ({
        slug: s,
        label: t(`legal.nav.${s}`),
        path: `/${s}`,
      })),
    [t],
  )

  return (
    <div className="legal-page">
      <p className="legal-eyebrow">{t('legal.eyebrow')}</p>
      <h1 className="legal-title">{page.title}</h1>
      <p className="legal-updated">
        {t('legal.lastUpdated', { date: page.lastUpdated })}
      </p>
      <p className="legal-disclosure">{page.disclosure}</p>

      {page.sections.map((section) => (
        <section key={section.id} className="legal-section" aria-labelledby={`legal-${section.id}`}>
          <h2 id={`legal-${section.id}`}>{section.heading}</h2>
          {section.paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
          {section.bullets?.length ? (
            <ul>
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <nav className="legal-nav" aria-label={t('legal.navAria')}>
        {navItems.map((item) => (
          <a
            key={item.slug}
            href={href(item.path)}
            aria-current={item.slug === slug ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
        <a href={href('/')}>{t('legal.backHome')}</a>
      </nav>
    </div>
  )
}

export function LegalApp({ path: pathProp }: { path?: string } = {}) {
  const { t, href, lang } = useSiteI18n()
  const [pathState, setPath] = useState(
    () => pathProp ?? (window.location.pathname.replace(/\/+$/, '') || '/'),
  )

  useEffect(() => {
    if (pathProp) {
      setPath(pathProp)
      return
    }
    const sync = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/')
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [pathProp])

  const path = pathProp ?? pathState
  const slug = slugFromPath(path)

  useEffect(() => {
    if (slug) return
    applyPageMeta('/', lang)
  }, [path, slug, lang])

  return (
    <>
      <Header />
      <main id="main-content" className="legal-main">
        {slug ? (
          <LegalView slug={slug} />
        ) : (
          <div className="legal-page">
            <h1 className="legal-title">{t('legal.eyebrow')}</h1>
            <nav className="legal-nav" aria-label={t('legal.navAria')}>
              <a href={href('/privacy')}>{t('legal.nav.privacy')}</a>
              <a href={href('/terms')}>{t('legal.nav.terms')}</a>
              <a href={href('/cookies')}>{t('legal.nav.cookies')}</a>
            </nav>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
