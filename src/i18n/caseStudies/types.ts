export type StageOverlay = {
  title?: string
  summary?: string
  detail?: string
  mediaAlt?: string
}

export type CaseStudyOverlay = {
  eyebrow?: string
  title?: string
  lead?: string
  impact?: string
  primaryCtaLabel?: string
  secondaryCtaLabel?: string
  stages?: Record<string, StageOverlay> // keyed by stage id: brief, wire, engineering, final
  deliverables?: string[]
}

export type CaseStudiesLocalePack = {
  studies: Record<string, CaseStudyOverlay>
}
