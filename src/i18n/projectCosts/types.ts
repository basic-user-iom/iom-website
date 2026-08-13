export type EngagementId = 'specialist' | 'studio-capacity' | 'project-scoping'

export type EngagementCopy = {
  title: string
  question: string
  summary: string
  rateLine: string
  rateNote: string
  learnMoreLabel: string
  learnMoreTitle: string
  learnMoreParagraphs: string[]
}

export type CostReferenceCopy = {
  category: string
  glanceCategory: string
  title: string
  description: string
  imageAlt: string
  learnMoreLabel: string
  includes: string[]
  priceDrivers?: string[]
  productAdditions?: string[]
  assumption?: string
  explainer?: string
  tiers: { label: string; hours: string; delivery: string }[]
}

export type ProjectCostsCopy = {
  page: {
    print: string
    engageHeading: string
    engageLead: string
    refsHeading: string
    refsLead: string
    factorsHeading: string
    factorsLearnLabel: string
    factorsLearnTitle: string
    glanceAria: string
    glanceProject: string
    glanceEffort: string
    glanceDelivery: string
    glanceBudget: string
    glanceReference: string
    typicallyIncludes: string
    priceDrivers: string
    productAdditions: string
    viewCaseStudy: string
    protoHeading: string
    protoLead: string
    protoNote: string
    protoAria: string
    howHeading: string
    howLead: string
    estimateHeading: string
    estimateIntro: string
    estimateQuotes: string
    estimateHighlightsAria: string
    estimateHighlightsEyebrow: string
    estimateExcludes: string
    checklistLabel: string
    viewCaseStudies: string
    bookConsult: string
    requestEstimate: string
    compareOptions: string
    startsPanelEyebrow: string
    startsPanelAria: string
    scopedAfterConsultation: string
    productionDay: string
    fromProductionDay: string
  }
  hero: {
    eyebrow: string
    title: string
    lead: string
    sub: string
    ctaPrimary: string
    ctaSecondary: string
  }
  engagement: Record<EngagementId, EngagementCopy>
  capacity: {
    title: string
    summary: string
    learnMoreLabel: string
    learnMoreTitle: string
    learnMoreParagraphs: string[]
  }
  august: {
    eyebrow: string
    title: string
    lines: string[]
    cta: string
  }
  examples: {
    title: string
    lead: string
    glanceNote: string
    rangeNote: string
  }
  factors: { title: string; text: string }[]
  factorsSimple: string
  starts: {
    title: string
    lead: string
    steps: { title: string; text: string }[]
    footer: string
    consultationNote: string
    cta: string
  }
  prototype: {
    title: string
    text: string
    stage: string
    stageLine: string
  }[]
  howIomWorks: { title: string; text: string }[]
  finalCta: {
    title: string
    lead: string
    cta: string
  }
  contactChecklist: string[]
  selectedSupport: {
    title: string
    lead: string
    footer: string
  }
  estimate: {
    productionTime: string
    blended: string
    highlights: { label: string; value: string }[]
    exclusions: string[]
  }
  references: Record<string, CostReferenceCopy>
  inquiry: {
    requestType: string
    consultation: string
    estimate: string
    name: string
    email: string
    company: string
    timeframe: string
    budget: string
    message: string
    optional: string
    timeframePh: string
    budgetPh: string
    messagePh: string
    sending: string
    success: string
    error: string
    required: string
    invalidEmail: string
    messageShort: string
    emailDirect: string
  }
}
