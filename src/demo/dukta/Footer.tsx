import { BrandMark } from './BrandMark'
import { CONTACT } from './data/site'
import { useLocale } from './i18n/LocaleContext'

export function Footer() {
  const { locale, t } = useLocale()
  const address = CONTACT.address[locale]
  const duktaHref = locale === 'de' ? 'https://dukta.com/' : 'https://dukta.com/en/'

  return (
    <footer className="dk-footer">
      <div className="dk-footer__grid">
        <BrandMark size="footer" withTagline />
        <div>
          <p>{CONTACT.company}</p>
          {address.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
        </div>
        <div>
          <p className="dk-kicker">{t.footer.studio}</p>
          {CONTACT.studio.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="dk-footer__meta">
          <p>Zürich</p>
          <p>
            <a href={duktaHref} rel="noreferrer">
              dukta.com
            </a>
          </p>
          <p className="dk-footer__iom">
            <a href="https://iobjectm.com/">{t.footer.conceptBy}</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
