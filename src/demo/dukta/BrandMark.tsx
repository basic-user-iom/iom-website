import { BASE } from './data/site'
import { useLocale } from './i18n/LocaleContext'

type Props = {
  size?: 'hero' | 'nav' | 'footer'
  withTagline?: boolean
}

export function BrandMark({ size = 'nav', withTagline = false }: Props) {
  const { t } = useLocale()

  return (
    <span className={`dk-mark dk-mark--${size}`}>
      <a className="dk-mark__name" href={`${BASE}/`} aria-label={t.a11y.brandHome}>
        dukta
      </a>
      {withTagline ? <span className="dk-mark__tag">{t.brand.tagline}</span> : null}
    </span>
  )
}
