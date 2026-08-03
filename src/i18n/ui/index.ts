import type { Dict, SiteLang } from '../types'
import { enUi } from './en'
import { ensureUiDictionary, getUiDictionary } from './loadDictionary'

export { ensureUiDictionary, getUiDictionary }

/**
 * Eager map kept for anything that still expects `uiDictionaries.en`.
 * Non-English packs are loaded on demand via `ensureUiDictionary`.
 */
export const uiDictionaries: Record<SiteLang, Dict> = new Proxy({ en: enUi } as Record<SiteLang, Dict>, {
  get(target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined
    if (prop in target) return target[prop as SiteLang]
    return getUiDictionary(prop as SiteLang)
  },
})
