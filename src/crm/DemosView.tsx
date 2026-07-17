import { SITE_ORIGIN } from '../seo/siteConfig'
import { useCrmI18n } from './i18n'

export type ClientDemo = {
  id: string
  name: string
  client: string
  status: 'preview' | 'draft' | 'live'
  /** Path on iobjectm.com, e.g. /demo/icm */
  path: string
  password?: string
  blurb: string
  tags: string[]
  /** Paths under the demo — shown in CRM so the pitch card has real site imagery */
  images: string[]
}

function demoUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

function assetUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return demoUrl(path)
}

/** Private client demos — not listed on the public site. */
export const CLIENT_DEMOS: ClientDemo[] = [
  {
    id: 'icm',
    name: 'ICM',
    client: 'Client pitch — photographer & film director',
    status: 'preview',
    path: '/demo/icm',
    password: 'volimte',
    blurb:
      'Private demo for a client pitch: light portfolio shell, Stills / Motion / Exhibitions, and a WebGL Clouds chapter with fly-through navigation. Not linked from the public homepage.',
    tags: ['Portfolio', 'WebGL', 'Exhibitions'],
    images: [
      '/demo/icm/clouds.jpg',
      '/demo/icm/still-01.jpg',
      '/demo/icm/still-02.jpg',
      '/demo/icm/still-05.jpg',
      '/demo/icm/motion-01.jpg',
      '/demo/icm/g-01.jpg',
      '/demo/icm/g-04.jpg',
      '/demo/icm/ex-02.jpg',
    ],
  },
]

function statusLabel(
  status: ClientDemo['status'],
  t: (key: string) => string,
): string {
  if (status === 'preview') return t('demos.status.preview')
  if (status === 'draft') return t('demos.status.draft')
  return t('demos.status.live')
}

export function DemosView() {
  const { t } = useCrmI18n()

  return (
    <div className="crm-demos-view">
      <header className="crm-demos-header">
        <p className="crm-demos-kicker">{t('demos.kicker')}</p>
        <h2 className="crm-demos-title">{t('demos.title')}</h2>
        <p className="crm-demos-intro">{t('demos.intro')}</p>
      </header>

      <ul className="crm-demos-list">
        {CLIENT_DEMOS.map((demo) => {
          const url = demoUrl(demo.path)
          const cover = assetUrl(demo.images[0])
          const strip = demo.images.slice(1).map(assetUrl)
          const embedSrc = `${demo.path}?crmEmbed=1`
          return (
            <li key={demo.id} className="crm-demos-card crm-demos-card--full">
              <div className="crm-demos-card-preview">
                <iframe
                  className="crm-demos-card-embed"
                  src={embedSrc}
                  title={`${demo.name} website preview`}
                  loading="lazy"
                  referrerPolicy="same-origin"
                />
                <a
                  className="crm-demos-card-media"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={cover} alt="" />
                </a>
              </div>
              <div className="crm-demos-card-body">
                <div className="crm-demos-card-top">
                  <div>
                    <h3 className="crm-demos-card-name">{demo.name}</h3>
                    <p className="crm-demos-card-client">{demo.client}</p>
                  </div>
                  <span className={`crm-demos-status crm-demos-status--${demo.status}`}>
                    {statusLabel(demo.status, t)}
                  </span>
                </div>
                <p className="crm-demos-card-blurb">{demo.blurb}</p>
                <div className="crm-demos-card-tags">
                  {demo.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                {strip.length > 0 ? (
                  <div className="crm-demos-card-strip" aria-label={t('demos.gallery')}>
                    {strip.map((src) => (
                      <a key={src} href={url} target="_blank" rel="noreferrer">
                        <img src={src} alt="" />
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="crm-demos-card-meta">
                  <p className="crm-demos-card-url">
                    <span>{t('demos.url')}</span>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </p>
                  {demo.password ? (
                    <p className="crm-demos-card-pass">
                      <span>{t('demos.password')}</span>
                      <code>{demo.password}</code>
                    </p>
                  ) : null}
                </div>
                <div className="crm-demos-card-actions">
                  <a
                    className="btn btn-primary"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('demos.open')}
                  </a>
                  <a
                    className="crm-demos-card-local"
                    href={demo.path}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('demos.openLocal')}
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
