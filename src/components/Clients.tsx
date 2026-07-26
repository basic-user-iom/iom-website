import { memo, useEffect, useState } from 'react'
import { CLIENTS } from '../data/clients'

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
  const [style, setStyle] = useState<ClientsStyle>(() => readStoredStyle())

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, style)
    } catch {
      /* ignore */
    }
  }, [style])

  return (
    <section className="clients-block" id="clients" aria-labelledby="clients-heading">
      <p className="clients-eyebrow">Selected clients</p>
      <h2 className="clients-title" id="clients-heading">
        Organizations we&apos;ve built with
      </h2>
      <p className="clients-text">
        Hotels, developers, utilities, and platforms — project work across interactive media and
        digital experiences.
      </p>

      <div className="clients-style-toggle" role="group" aria-label="Show client wordmarks or logos">
        <button
          type="button"
          className={style === 'wordmarks' ? 'is-active' : undefined}
          aria-pressed={style === 'wordmarks'}
          onClick={() => setStyle('wordmarks')}
        >
          Wordmarks
        </button>
        <button
          type="button"
          className={style === 'logos' ? 'is-active' : undefined}
          aria-pressed={style === 'logos'}
          onClick={() => setStyle('logos')}
        >
          Logos
        </button>
      </div>

      <ul className={`clients-grid clients-grid--${style}`}>
        {CLIENTS.map((client) => (
          <li key={client.id}>
            <a
              className="clients-mark"
              href={client.href}
              target="_blank"
              rel="noopener noreferrer"
              title={client.name}
              style={{ ['--client-brand' as string]: client.brandColor }}
            >
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
    </section>
  )
})
