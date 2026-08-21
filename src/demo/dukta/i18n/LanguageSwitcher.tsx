import { LOCALES } from './locale'
import { useLocale } from './LocaleContext'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <div className="dk-lang" role="group" aria-label={t.a11y.language}>
      {LOCALES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={locale === item.id ? 'is-active' : undefined}
          aria-pressed={locale === item.id}
          onClick={() => setLocale(item.id)}
        >
          {item.short}
        </button>
      ))}
    </div>
  )
}
