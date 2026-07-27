import { deUi } from './de'
import { enUi } from './en'
import { esUi } from './es'
import { frUi } from './fr'
import { itUi } from './it'
import { nlUi } from './nl'
import type { Dict, SiteLang } from '../types'

export const uiDictionaries: Record<SiteLang, Dict> = {
  en: enUi,
  de: deUi,
  fr: frUi,
  nl: nlUi,
  it: itUi,
  es: esUi,
}
