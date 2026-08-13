import type { SiteLang } from '../types'
import {
  COST_REFERENCES,
  ENGAGEMENT_OPTION_DEFS,
  PROTOTYPE_STEPS,
  isAugustIntroActive,
  type CostReference,
  type EngagementOption,
} from '../../project-costs/data'
import { deProjectCosts } from './de'
import { enProjectCosts } from './en'
import { esProjectCosts } from './es'
import { frProjectCosts } from './fr'
import { itProjectCosts } from './it'
import { nlProjectCosts } from './nl'
import type { ProjectCostsCopy } from './types'

export type { ProjectCostsCopy, EngagementCopy, CostReferenceCopy } from './types'

const packs: Record<SiteLang, ProjectCostsCopy> = {
  en: enProjectCosts,
  de: deProjectCosts,
  fr: frProjectCosts,
  nl: nlProjectCosts,
  it: itProjectCosts,
  es: esProjectCosts,
}

export function getProjectCostsCopy(lang: SiteLang): ProjectCostsCopy {
  return packs[lang] ?? enProjectCosts
}

export function localizedEngagementOptions(
  lang: SiteLang,
  now = Date.now(),
): EngagementOption[] {
  const copy = getProjectCostsCopy(lang)
  const augustOn = isAugustIntroActive(now)
  return ENGAGEMENT_OPTION_DEFS.map((def) => {
    const base: EngagementOption = { ...def, ...copy.engagement[def.id] }
    if (!augustOn) return base
    if (def.id === 'specialist') {
      return {
        ...base,
        rateBadge: copy.august.cardBadge,
        rateCompareLine: copy.august.specialistCompare,
        rateUntilLine: copy.august.untilNotice,
        rateStandardLine: copy.august.standardLabel.replace('{rate}', base.rateLine),
      }
    }
    if (def.id === 'studio-capacity') {
      return {
        ...base,
        rateBadge: copy.august.cardBadge,
        rateCompareLine: copy.august.studioCompare,
        rateUntilLine: copy.august.untilNotice,
        rateStandardLine: copy.august.standardLabel.replace('{rate}', base.rateLine),
      }
    }
    return base
  })
}

export function localizedCostReferences(lang: SiteLang): CostReference[] {
  const copy = getProjectCostsCopy(lang)
  return COST_REFERENCES.map((ref) => {
    const overlay = copy.references[ref.id]
    if (!overlay) return ref
    return {
      ...ref,
      category: overlay.category,
      glanceCategory: overlay.glanceCategory,
      title: overlay.title,
      description: overlay.description,
      imageAlt: overlay.imageAlt,
      learnMoreLabel: overlay.learnMoreLabel,
      includes: overlay.includes,
      priceDrivers: overlay.priceDrivers,
      productAdditions: overlay.productAdditions,
      assumption: overlay.assumption,
      explainer: overlay.explainer,
      tiers: ref.tiers.map((tier, index) => ({
        ...tier,
        label: overlay.tiers[index]?.label ?? tier.label,
        hours: overlay.tiers[index]?.hours ?? tier.hours,
        delivery: overlay.tiers[index]?.delivery ?? tier.delivery,
      })),
    }
  })
}

export function localizedPrototypeSteps(lang: SiteLang) {
  const copy = getProjectCostsCopy(lang)
  return PROTOTYPE_STEPS.map((step, index) => ({
    ...step,
    title: copy.prototype[index]?.title ?? step.title,
    text: copy.prototype[index]?.text ?? step.text,
    stage: copy.prototype[index]?.stage ?? step.stage,
    stageLine: copy.prototype[index]?.stageLine ?? step.stageLine,
  }))
}
