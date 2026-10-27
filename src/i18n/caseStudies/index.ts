import storm from '../../data/stormPublication.json'
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
  if (slug === storm.slug && lang !== 'en') {
    const c=storm.locales[lang]
    return {eyebrow:c.eyebrow,title:c.title,lead:c.lead,impact:c.impact,
      primaryCtaLabel:c.open,secondaryCtaLabel:c.read,deliverables:c.deliverables,
      stages:Object.fromEntries(c.stages.map((s,i)=>[["brief","clouds","materials","delivery"][i],{...s,mediaAlt:s.alt}]))}
  }
  if (lang === 'en') return undefined
  return packs[lang]?.studies[slug]
}
