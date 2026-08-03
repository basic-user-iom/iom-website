import type { Dict, SiteLang } from '../types'
import { enUi } from './en'

const cache: Partial<Record<SiteLang, Dict>> = { en: enUi }

const loaders: Record<Exclude<SiteLang, 'en'>, () => Promise<Dict>> = {
  de: () => import('./de').then((m) => m.deUi),
  fr: () => import('./fr').then((m) => m.frUi),
  nl: () => import('./nl').then((m) => m.nlUi),
  it: () => import('./it').then((m) => m.itUi),
  es: () => import('./es').then((m) => m.esUi),
}

/** Sync lookup — English always available; other langs after `ensureUiDictionary`. */
export function getUiDictionary(lang: SiteLang): Dict {
  return cache[lang] ?? enUi
}

/** Load and cache a locale pack (no-op when already cached). */
export async function ensureUiDictionary(lang: SiteLang): Promise<Dict> {
  const hit = cache[lang]
  if (hit) return hit
  if (lang === 'en') {
    cache.en = enUi
    return enUi
  }
  const dict = await loaders[lang]()
  cache[lang] = dict
  return dict
}
