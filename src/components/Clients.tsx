import { memo, useEffect, useState } from 'react'
import { CLIENTS } from '../data/clients'
import { ORB_COUNT, useSiteOrbsOptional } from './SiteOrbZone'
import { useSiteI18n } from '../i18n'

type ClientsStyle = 'wordmarks' | 'logos'

const STYLE_KEY = 'iom.clients.style'

function readStoredStyle(): ClientsStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY)
    if (raw === 'wordmarks' || raw === 'logos') return raw
  } catch {
    /* ignore */
  }
  return 'logos'
}

export const Clients = memo(function Clients() {
  const { t } = useSiteI18n()
  const [style, setStyle] = useState<ClientsStyle>(() => readStoredStyle())
  const orbs = useSiteOrbsOptional()

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, style)
    } catch {
      /* ignore */
    }
  }, [style])

  return (
    <section className="clients-block" id="clients" aria-labelledby="clients-heading">
      <p className="clients-eyebrow">{t('clients.eyebrow')}</p>
      <h2 className="clients-title" id="clients-heading">
        {t('clients.title')}
      </h2>
      <p className="clients-text">{t('clients.text')}</p>

      <div className="clients-style-toggle" role="group" aria-label={t('clients.toggleAria')}>
        <button
          type="button"
          className={style === 'wordmarks' ? 'is-active' : undefined}
          aria-pressed={style === 'wordmarks'}
          onClick={() => setStyle('wordmarks')}
        >
          {t('clients.wordmarks')}
        </button>
        <button
          type="button"
          className={style === 'logos' ? 'is-active' : undefined}
          aria-pressed={style === 'logos'}
          onClick={() => setStyle('logos')}
        >
          {t('clients.logos')}
        </button>
      </div>

      <div className={`clients-stage${orbs ? '' : ' clients-stage--static'}`}>
        {!orbs
          ? Array.from({ length: ORB_COUNT }, (_, i) => (
              <span key={i} className={`clients-orb clients-orb--${i}`} aria-hidden="true" />
            ))
          : null}
        <ul className={`clients-grid clients-grid--${style}`}>
          {CLIENTS.map((client, index) => (
            <li key={client.id}>
              <a
                ref={(node) => {
                  if (orbs) orbs.clientMarksRef.current[index] = node
                }}
                className="clients-mark"
                href={client.href}
                target="_blank"
                rel="noopener noreferrer"
                title={t('clients.openSite', { name: client.name })}
                aria-label={t('clients.siteAria', { name: client.name })}
                style={{ ['--client-brand' as string]: client.brandColor }}
                onPointerEnter={() => {
                  orbs?.setHover('client', index)
                }}
                onPointerLeave={() => {
                  orbs?.setHover(null, null)
                }}
              >
                <span className="clients-mark-reflect" aria-hidden="true" />
                {style === 'logos' && client.logo ? (
                  <img
                    className="clients-logo"
                    src={client.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="clients-mark-text">{client.mark}</span>
                )}
                <span className="sr-only">{client.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
})
