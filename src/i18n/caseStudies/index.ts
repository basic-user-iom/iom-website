import type { SiteLang } from '../types'
import { deCaseStudies } from './de'
import { esCaseStudies } from './es'
import { frCaseStudies } from './fr'
import { itCaseStudies } from './it'
import { nlCaseStudies } from './nl'
import type { CaseStudiesLocalePack, CaseStudyOverlay } from './types'

export type { StageOverlay, CaseStudyOverlay, CaseStudiesLocalePack } from './types'
export { deCaseStudies } from './de'
export { frCaseStudies } from './fr'
export { nlCaseStudies } from './nl'
export { itCaseStudies } from './it'
export { esCaseStudies } from './es'

const packs: Partial<Record<Exclude<SiteLang, 'en'>, CaseStudiesLocalePack>> = {
  de: deCaseStudies,
  fr: frCaseStudies,
  nl: nlCaseStudies,
  it: itCaseStudies,
  es: esCaseStudies,
}

export function getCaseStudyOverlay(
  lang: SiteLang,
  slug: string,
): CaseStudyOverlay | undefined {
  if (lang === 'en') return undefined
  return packs[lang]?.studies[slug]
}
