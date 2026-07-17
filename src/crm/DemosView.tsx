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
  cover: string
}

function demoUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
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
    cover: '/demo/icm/clouds.jpg',
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
          return (
            <li key={demo.id} className="crm-demos-card">
              <a
                className="crm-demos-card-media"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <img src={demo.cover} alt="" loading="lazy" />
              </a>
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
                <p className="crm-demos-card-url">
                  <span>{t('demos.url')}</span>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </p>
                {demo.password ? (
                  <p className="crm-demos-card-pass">
                    {t('demos.password')}: <code>{demo.password}</code>
                  </p>
                ) : null}
                <div className="crm-demos-card-actions">
                  <a
                    className="btn btn-primary"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('demos.open')}
                  </a>
                  <a className="crm-demos-card-local" href={demo.path} target="_blank" rel="noreferrer">
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
