import { useState } from 'react'
import { SITE_ORIGIN } from '../seo/siteConfig'
import { useCrmI18n } from './i18n'

export type ClientDemo = {
  id: string
  name: string
  client: string
  status: 'preview' | 'draft' | 'live'
  /**
   * Same-origin path (e.g. /demo/icm) or absolute external URL
   * (e.g. https://iom-website-demo.vercel.app).
   */
  path: string
  password?: string
  blurb: string
  tags: string[]
  /** Paths under the demo — shown in CRM so the pitch card has real site imagery */
  images: string[]
  /**
   * External password-gated demos: open in a new tab only — never iframe
   * (X-Frame-Options / unlock gate break embeds).
   */
  external?: boolean
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function demoUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

function assetUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path
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
  {
    id: 'icm-building',
    name: 'ICM - viewer',
    client: 'Client preview — International Congress Center Messe München',
    status: 'preview',
    path: '/demos/icm-building/',
    password: 'animated',
    blurb:
      'Private 3D building viewer for ICM: orbit, walk, and stairs on the current campus model. ICM branding stays in the viewer chrome. Not linked from the public homepage.',
    tags: ['Architecture', 'WebGL', 'Walk'],
    images: [],
  },
  {
    id: 'evly',
    name: 'EVLY Corporation',
    client: 'Client pitch — fictional corporate recruitment / merchandise site',
    status: 'preview',
    path: '/demo/evly/',
    password: 'evly',
    blurb:
      'Private demo: EVLY Corporation personnel directorate. Shirt purchase is treated as a fictional uniform and department assignment. Not linked from the public homepage.',
    tags: ['Website', 'Merchandise', 'Recruitment'],
    images: [
      '/demo/evly/images/tower-hero.png',
      '/demo/evly/images/profile/public-presence.png',
      '/demo/evly/images/profile/internal-structure.png',
      '/demo/evly/images/shirt-yes.png',
      '/demo/evly/images/reels/plaza-approach.png',
      '/demo/evly/images/reels/lobby-protocol.png',
    ],
  },
  {
    id: 'kelly-kettle',
    name: 'Kelly Kettle',
    client: 'Client pitch — Base Camp 1.6 L concept demonstration',
    status: 'preview',
    path: '/demos/kelly-kettle/',
    password: 'kettle',
    blurb:
      'Private demo: how a Kelly Kettle heats water through a chimney fire. Cutaway 3D model plus an illustrated how-it-works board. Not linked from the public homepage.',
    tags: ['Product', 'WebGL', 'Cutaway'],
    images: [
      '/demos/kelly-kettle/forest-background.png',
      '/media/kettle-how-heat.webp',
      '/media/kettle-how-fire.webp',
      '/media/kettle-how-water.webp',
    ],
  },
  {
    id: 'precision-object',
    name: 'Precision object study',
    client: 'Capability study — interactive product presentation',
    status: 'preview',
    path: '/demos/precision-object/',
    password: 'precision',
    blurb:
      'Private demo: a browser-based product presentation concept for objects where material, mechanism and detail matter. Not linked from the public homepage.',
    tags: ['Product', 'WebGL', 'Look studio'],
    images: [],
  },
  {
    id: 'bas-rutten',
    name: 'Bas Rutten',
    client: 'Client pitch — official Bas Rutten website redesign',
    status: 'preview',
    path: 'https://iom-website-demo.vercel.app',
    password: 'rutten',
    external: true,
    blurb:
      'Password-gated Next.js redesign pitch for Bas Rutten — hosted on a separate Vercel project (iom-website-demo). Unlock with the site password on the card; CRM login is separate.',
    tags: ['Website', 'Next.js', 'Client pitch'],
    images: [],
  },
  {
    id: 'automotive-studio',
    name: 'Automotive Studio',
    client: 'Capability study — interactive vehicle presentation',
    status: 'preview',
    path: '/demos/automotive-studio/',
    password: 'automotive',
    blurb:
      'Private demo: browser-based automotive studio with vehicle materials, hotspots, route drive, and a client Present mode. Ships with a bundled starter project. Not linked from the public homepage.',
    tags: ['Product', 'WebGL', 'Vehicle'],
    images: [],
  },
  {
    id: 'dukta',
    name: 'Dukta',
    client: 'Client pitch — flexible wood marketing site',
    status: 'preview',
    path: '/demos/dukta/',
    password: 'dukta',
    blurb:
      'Private demo: password-gated Dukta marketing site for flexible wood systems — material, applications, and product storytelling. Not linked from the public homepage.',
    tags: ['Website', 'Product', 'Client pitch'],
    images: [
      '/demos/dukta/media/material/flexible-ribbon.jpg',
      '/demos/dukta/media/material/linar-bend-hi.jpg',
      '/demos/dukta/media/applications/acoustic-wall.jpg',
      '/demos/dukta/media/applications/furniture.jpg',
      '/demos/dukta/media/brand/logo-wordmark.jpg',
    ],
  },
  {
    id: 'superbright-rock',
    name: 'Superbright rock',
    client: 'Capability study — photoreal stone hero with orbiting light probes',
    status: 'preview',
    path: '/demos/floating-stone/',
    password: 'superbright',
    blurb:
      'Private demo: a browser-based stratified stone in day/night lighting, with orbit-tool rotation and probe orbs that inspect the surface. Not linked from the public homepage.',
    tags: ['WebGL', 'Product', 'Hero'],
    images: [],
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
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  function isExpanded(id: string): boolean {
    return expandedIds[id] === true
  }

  function setExpanded(id: string, next: boolean) {
    setExpandedIds((prev) => ({ ...prev, [id]: next }))
  }

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
          const external = demo.external === true || isAbsoluteUrl(demo.path)
          const cover = demo.images[0] ? assetUrl(demo.images[0]) : ''
          const strip = demo.images.slice(1).map(assetUrl)
          const embedSrc = external ? '' : `${demo.path}?crmEmbed=1`
          const expanded = isExpanded(demo.id)

          if (!expanded) {
            return (
              <li key={demo.id} className="crm-demos-card crm-demos-card--collapsed">
                <div className="crm-demos-summary">
                  <div className="crm-demos-summary-body">
                    <span className="crm-demos-summary-name">{demo.name}</span>
                    <span className="crm-demos-summary-blurb">{demo.blurb}</span>
                  </div>
                  <div className="crm-demos-summary-actions">
                    <a
                      className="btn btn-primary"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('demos.preview')}
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost crm-collapse-btn"
                      aria-expanded={false}
                      aria-label={t('demos.expandAria', { name: demo.name })}
                      onClick={() => setExpanded(demo.id, true)}
                    >
                      {t('demos.expand')}
                    </button>
                  </div>
                </div>
              </li>
            )
          }

          return (
            <li key={demo.id} className="crm-demos-card crm-demos-card--full">
              {(cover || !external) && (
                <div className="crm-demos-card-preview">
                  {!external && embedSrc ? (
                    <iframe
                      className="crm-demos-card-embed"
                      src={embedSrc}
                      title={`${demo.name} website preview`}
                      loading="lazy"
                      referrerPolicy="same-origin"
                    />
                  ) : null}
                  {cover ? (
                    <a
                      className="crm-demos-card-media"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={cover} alt="" />
                    </a>
                  ) : null}
                </div>
              )}
              <div className="crm-demos-card-body">
                <div className="crm-demos-card-top">
                  <div>
                    <h3 className="crm-demos-card-name">{demo.name}</h3>
                    <p className="crm-demos-card-client">{demo.client}</p>
                  </div>
                  <div className="crm-demos-card-top-actions">
                    <span className={`crm-demos-status crm-demos-status--${demo.status}`}>
                      {statusLabel(demo.status, t)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost crm-collapse-btn"
                      aria-expanded={true}
                      aria-label={t('demos.collapseAria', { name: demo.name })}
                      onClick={() => setExpanded(demo.id, false)}
                    >
                      {t('demos.collapse')}
                    </button>
                  </div>
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
                  {!external ? (
                    <a
                      className="crm-demos-card-local"
                      href={demo.path}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('demos.openLocal')}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
