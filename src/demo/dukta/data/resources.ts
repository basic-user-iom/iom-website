import type { LocalizedString } from '../i18n/locale'
import type { Messages } from '../i18n/messages'

export type ResourceId = keyof Messages['resources']['items']
export type ResourceCategory = keyof Messages['resources']['categories']
export type ResourceType = keyof Messages['resources']['types']

export type Resource = {
  id: ResourceId
  category: ResourceCategory
  /** Product codes / brand names shown as-is, or `all` for the localized "All" label. */
  system: 'all' | string
  type: ResourceType
  href: LocalizedString
}

export const RESOURCES: Resource[] = [
  {
    id: 'semiFinished',
    category: 'technical',
    system: 'all',
    type: 'page',
    href: {
      en: 'https://dukta.com/en/products/semi-finished/',
      de: 'https://dukta.com/produkte/halbfabrikate/',
    },
  },
  {
    id: 'linar',
    category: 'technical',
    system: 'LINAR',
    type: 'page',
    href: {
      en: 'https://dukta.com/en/products/semi-finished/linar/',
      de: 'https://dukta.com/produkte/halbfabrikate/linar/',
    },
  },
  {
    id: 'acoustic',
    category: 'acoustic',
    system: 'all',
    type: 'page',
    href: {
      en: 'https://dukta.com/en/products/acoustic-systems/',
      de: 'https://dukta.com/produkte/akustik-systeme/',
    },
  },
  {
    id: 'partitions',
    category: 'application',
    system: 'JANUS',
    type: 'page',
    href: {
      en: 'https://dukta.com/en/products/partition-walls/',
      de: 'https://dukta.com/produkte/trennwaende/',
    },
  },
  {
    id: 'furniture',
    category: 'application',
    system: 'all',
    type: 'page',
    href: {
      en: 'https://dukta.com/en/products/furniture-lights/',
      de: 'https://dukta.com/produkte/moebel-leuchten/',
    },
  },
  {
    id: 'samples',
    category: 'samples',
    system: 'SONAR, LINAR, FOLI, JANUS',
    type: 'form',
    href: {
      en: 'https://dukta.com/en/products/samples/',
      de: 'https://dukta.com/produkte/muster/',
    },
  },
]
