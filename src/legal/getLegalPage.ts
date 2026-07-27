import type { SiteLang } from '../i18n'
import { LEGAL_PAGES_EN, type LegalLocalePack, type LegalPage, type LegalSlug } from './legalPages'
import { deLegal } from './locales/de'
import { esLegal } from './locales/es'
import { frLegal } from './locales/fr'
import { itLegal } from './locales/it'
import { nlLegal } from './locales/nl'

const packs: Partial<Record<Exclude<SiteLang, 'en'>, LegalLocalePack>> = {
  de: deLegal,
  fr: frLegal,
  nl: nlLegal,
  it: itLegal,
  es: esLegal,
}

export function getLegalPage(lang: SiteLang, slug: LegalSlug): LegalPage {
  if (lang === 'en') return LEGAL_PAGES_EN[slug]
  return packs[lang]?.[slug] ?? LEGAL_PAGES_EN[slug]
}
