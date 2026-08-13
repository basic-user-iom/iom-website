/** Single source of truth for /project-costs planning ranges. */

export const PROJECT_COSTS_META = {
  path: '/project-costs',
  pageTitle: 'Project Costs',
  seoTitle: 'Project Costs & Production Capacity | IOM',
  seoDescription:
    'Plain-language project costs for custom interactive 3D, realtime web experiences and 360° work. Hire one specialist, add studio capacity, or scope a complete project with IOM.',
  rateMin: 75,
  rateMax: 110,
  rateLabel: 'Typically €75–€110 per hour',
  specialistDayRate: 550,
  specialistIntroDayRate: 450,
  studioTeamFromDayRate: 900,
  studioTeamIntroFromDayRate: 800,
  consultMail:
    'mailto:projects@iobjectm.com?subject=Free%2030-minute%20project%20consultation',
  estimateMail:
    'mailto:projects@iobjectm.com?subject=Project%20estimate%20request',
  caseStudiesPath: '/case-studies',
  contactEmail: 'projects@iobjectm.com',
  siteUrl: 'https://iobjectm.com',
  augustOfferDeadline: '31 August 2026',
} as const

export type EngagementOption = {
  id: string
  anchor: string
  optionLabel: string
  title: string
  summary: string
  rateBadge?: string
  rateLine: string
  rateCompareLine?: string
  rateNote: string
  learnMoreLabel: string
  learnMoreTitle: string
  learnMoreParagraphs: string[]
}

export const ENGAGEMENT_OPTIONS: EngagementOption[] = [
  {
    id: 'specialist',
    anchor: 'specialist',
    optionLabel: 'Option 01',
    title: 'Work with one specialist',
    summary:
      'Best for a clearly defined task, technical problem, prototype, optimisation package or a role inside your existing production team.',
    rateBadge: 'August 2026 intro',
    rateLine: `Senior specialist: €${PROJECT_COSTS_META.specialistIntroDayRate} / day`,
    rateCompareLine: `Standard rate: €${PROJECT_COSTS_META.specialistDayRate} / day`,
    rateNote:
      'A single specialist keeps daily cost lower, but larger packages may take longer because there is less work happening in parallel.',
    learnMoreLabel: 'Learn more about specialist work',
    learnMoreTitle: 'One specialist — technical detail',
    learnMoreParagraphs: [
      'A single senior specialist can work directly within your existing production pipeline or take ownership of a clearly defined package.',
      'Typical work includes Three.js/WebGL/WebGPU development, realtime 3D prototyping, Blender or Unreal production, CAD/BIM-to-realtime preparation, GLB/FBX/OBJ optimisation, photogrammetry, 360° production, technical troubleshooting, performance work and handoff-ready asset preparation.',
      'This model works best when the task is well defined or when your own team already owns the wider project.',
      'For larger packages, a single specialist can still complete the work, but the schedule will be longer than a setup where independent tasks can run in parallel.',
      `Standard rate: €${PROJECT_COSTS_META.specialistDayRate}/day. During the August 2026 introductory period, eligible new collaborations may start from €${PROJECT_COSTS_META.specialistIntroDayRate}/day when confirmed by ${PROJECT_COSTS_META.augustOfferDeadline}. Longer recurring engagements or defined partner arrangements may be quoted separately.`,
    ],
  },
  {
    id: 'studio-capacity',
    anchor: 'studio-capacity',
    optionLabel: 'Option 02',
    title: 'Add IOM studio capacity',
    summary:
      'Best when several workstreams need to move together — 3D, realtime development, assets, integration and testing.',
    rateBadge: 'August 2026 intro',
    rateLine: `Small studio team: from €${PROJECT_COSTS_META.studioTeamIntroFromDayRate} / day`,
    rateCompareLine: `Standard from: €${PROJECT_COSTS_META.studioTeamFromDayRate} / day`,
    rateNote:
      'Team size can change during the project. You only need additional capacity during phases where it is useful.',
    learnMoreLabel: 'Learn more about studio capacity',
    learnMoreTitle: 'Small studio team — technical detail',
    learnMoreParagraphs: [
      'IOM can increase production capacity when a project contains several independent workstreams — for example one person preparing and optimising 3D assets while another develops the realtime experience, with integration and testing running in parallel where useful.',
      'Team size is adjusted to the phase. Additional capacity is brought in only when parallel work genuinely shortens the schedule — not as a default staffing formula.',
      'Approximate guide rates: about €950/day for two-person capacity and about €1,300/day for three-person studio capacity, subject to scope review.',
      'During the August 2026 introductory period, team rates from about €800/day (two people) and €1,100/day (three people) may apply to eligible new collaborations confirmed by 31 August.',
    ],
  },
  {
    id: 'project-scoping',
    anchor: 'project-scoping',
    optionLabel: 'Option 03',
    title: 'Build a complete project with IOM',
    summary:
      'Best when you want us to take responsibility for a defined interactive, 3D, 360° or realtime package from preparation through delivery.',
    rateBadge: 'August 2026 intro',
    rateLine: 'Larger projects are scoped after a short consultation',
    rateCompareLine: `Introductory rates for projects confirmed by ${PROJECT_COSTS_META.augustOfferDeadline}.`,
    rateNote:
      'We review the source material, requirements and schedule, then recommend the smallest useful setup.',
    learnMoreLabel: 'Learn more about project scoping',
    learnMoreTitle: 'Complete project — technical detail',
    learnMoreParagraphs: [
      'When IOM takes responsibility for a full interactive, 3D, 360° or realtime package, production is planned in stages: source review, technical approach, capacity plan, consolidated scope and delivery.',
      'There is no single fixed price for a “large” project. The estimate reflects required deliverables, asset condition, integration needs, visual fidelity, testing coverage and schedule.',
      'Capacity can change during production — a larger team is not required from day one unless parallel workstreams justify it.',
      'Following a short consultation, you receive a clear scope, recommended capacity and indicative budget before production begins.',
    ],
  },
]

export const CAPACITY_TIMELINE = {
  title: 'Price and time are connected through production capacity',
  summary:
    'One specialist has a lower daily cost. A small team costs more per day but can often move several parts of the work forward at the same time. Larger projects may use one person in some phases and two or three people only when parallel production is useful.',
  learnMoreLabel: 'Learn more about timelines and capacity',
  learnMoreTitle: 'Timelines, capacity and parallel production',
  learnMoreParagraphs: [
    'Daily rates describe production capacity, not a guarantee that every task completes proportionally faster with more people. Some work must happen sequentially; other workstreams — asset preparation, development, integration, testing — can run in parallel when planned carefully.',
    'A single specialist is often the most efficient starting point for a focused task or when your team already owns part of the pipeline. Studio capacity is added when the schedule or scope genuinely benefits from parallel production.',
    'Project quotes for larger scopes remain separate from day rates. The consultation establishes deliverables, source material condition, technical approach and the smallest useful capacity plan before work begins.',
  ],
} as const

export const AUGUST_OFFER = {
  eyebrow: 'August 2026 — introductory availability',
  title: 'A limited amount of capacity is available for new collaborations this August',
  lines: [
    `Senior specialist: €${PROJECT_COSTS_META.specialistIntroDayRate} / day during the introductory period (standard rate €${PROJECT_COSTS_META.specialistDayRate} / day).`,
    'Introductory studio rates are also available for new projects that need additional production capacity.',
    `Projects confirmed by ${PROJECT_COSTS_META.augustOfferDeadline} can retain the agreed introductory rate for the initial scope even when delivery continues beyond August.`,
  ],
  cta: 'Ask about August availability',
} as const

export const PROJECT_EXAMPLES_INTRO = {
  title: 'What different project sizes can look like',
  lead:
    'The examples below are reference projects — not fixed packages. Each shows what was included, typical production effort and an indicative budget range for comparable work. Your project may differ depending on source material, features and schedule.',
  glanceNote:
    'Select a row to scroll to the detailed reference card. Figures are planning ranges, not catalogue prices.',
} as const

export const ESTIMATE_FACTORS_SIMPLE =
  'The estimate depends on what needs to be built, the condition of your source material, how complex the interaction and visuals need to be, and how quickly you need it delivered.'

export const ESTIMATE_FACTORS_TECHNICAL = [
  {
    title: 'Source assets',
    text: 'Clean, approved 3D models, panoramas, copy and media reduce production time. Geometry repair, modelling, retopology, photogrammetry and content preparation add work.',
  },
  {
    title: 'Realtime complexity',
    text: 'A lightweight product viewer has a different performance budget from a public mobile browser experience with advanced shaders, effects or large environments.',
  },
  {
    title: 'Interaction',
    text: 'Orbit and view controls are simpler than configurators, object editing, annotations, saved states, multi-user logic, guided sequences or custom UI.',
  },
  {
    title: 'Visual requirements',
    text: 'Lighting, materials, animation, effects, environments, shadows and post-processing can range from simple to highly specialised.',
  },
  {
    title: 'Integration',
    text: 'CMS, ecommerce, analytics, authentication, APIs, existing applications or client-owned codebases add integration and testing requirements.',
  },
  {
    title: 'Delivery and QA',
    text: 'Browser and device coverage, performance testing, packaging, documentation and handoff affect the final production effort.',
  },
  {
    title: 'Schedule',
    text: 'A compressed deadline may require more work to happen in parallel and therefore more studio capacity.',
  },
] as const

export const HOW_PROJECT_STARTS = {
  title: 'How a project starts',
  lead:
    'Four clear steps from first conversation to a scoped estimate. No commitment until you approve the approach and budget.',
  steps: [
    {
      title: 'Share the idea',
      text: 'Tell us what you are trying to build — even if the brief is still rough.',
    },
    {
      title: 'Review together',
      text: 'We review the goal, available source material, delivery format and deadline.',
    },
    {
      title: 'Match capacity',
      text: 'We recommend whether the work is best handled by one specialist, additional studio capacity, or a scoped project team.',
    },
    {
      title: 'Receive a clear estimate',
      text: 'You receive a clear scope, production approach and estimate before work begins.',
    },
  ],
  footer:
    'For larger projects, capacity can change during production so you are not paying for a larger team during phases that do not need it.',
  consultationNote:
    'Every potential project can begin with a free 30-minute consultation. Technical research, file inspection, workflow testing, design work and prototype development are quoted separately when required.',
  cta: 'Book a free consultation',
} as const

export const HERO_COPY = {
  eyebrow: 'Scope · Time · Budget',
  title: 'Project costs, without the technical guesswork',
  lead:
    'You can work with one experienced specialist, add IOM production capacity to your existing team, or ask us to take ownership of a complete interactive or 3D project.',
  sub:
    'The right setup depends on what needs to be made, how quickly it needs to be delivered, and how much of the work can happen in parallel.',
  ctaPrimary: 'Discuss a project',
  ctaSecondary: 'View project examples',
} as const

export type CostTier = {
  label: string
  hours: string
  delivery: string
  budget: string
}

export type CostReference = {
  id: string
  refLabel: string
  category: string
  glanceCategory: string
  title: string
  description: string
  caseStudyPath: string
  image: string
  imageAlt: string
  /** Quick-comparison + card tiers (cursor has a single typical range). */
  tiers: CostTier[]
  learnMoreLabel: string
  includes: string[]
  priceDrivers?: string[]
  productAdditions?: string[]
  assumption?: string
  explainer?: string
}

export const COST_FACTS = [
  {
    id: 'rate',
    label: 'Production rate',
    value: PROJECT_COSTS_META.rateLabel,
  },
  {
    id: 'consultation',
    label: 'Consultation',
    value: 'First 30 minutes free',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    value: 'Remote production worldwide',
  },
  {
    id: 'format',
    label: 'Project format',
    value: 'Fixed stages or time-based production',
  },
] as const

/** Blended-rate explanation — not hour × €110 for every range. */
export const RATE_BLENDED_NOTE =
  'IOM’s typical production rate ranges from €75 to €110 per hour, depending on technical complexity, specialist requirements, asset readiness and delivery timeframe. Defined projects may be quoted as fixed production stages or using a blended project rate. The reference budgets below are therefore planning ranges rather than a direct multiplication of every estimated hour by the highest hourly rate.'

export const ESTIMATE_RATE_HIGHLIGHTS = [
  {
    label: 'August intro · one specialist',
    value: `€${PROJECT_COSTS_META.specialistIntroDayRate} / day`,
    compare: `Standard €${PROJECT_COSTS_META.specialistDayRate} / day`,
  },
  {
    label: 'August intro · studio team',
    value: `from €${PROJECT_COSTS_META.studioTeamIntroFromDayRate} / day`,
    compare: `Standard from €${PROJECT_COSTS_META.studioTeamFromDayRate} / day`,
  },
  {
    label: 'Typical hourly rate',
    value: `€${PROJECT_COSTS_META.rateMin}–€${PROJECT_COSTS_META.rateMax} / hour`,
  },
] as const

export const ESTIMATE_EXCLUSIONS = [
  'Travel',
  'On-location photography',
  'Scanning',
  'Paid assets',
  'Third-party software licences',
  'Hosting charges',
  'Taxes',
  'Ongoing maintenance',
] as const

export const GLANCE_RANGE_NOTE =
  'The lower end generally assumes a clearly defined scope, well-prepared assets, a standard production schedule and limited technical uncertainty. Complex integrations, specialist development, incomplete source material or accelerated delivery can increase the final quotation.'

export const COST_REFERENCES: CostReference[] = [
  {
    id: 'cursor',
    refLabel: 'COST-REF-01',
    category: 'UI · Cursor · Interaction',
    glanceCategory: 'Custom website interaction',
    title: 'Labelled Custom Cursor',
    description:
      'A custom context-aware cursor for an existing website, including labelled interaction states, hover behaviour, animated pointer transitions and a standard responsive fallback.',
    caseStudyPath: '/case-studies/labelled-custom-cursor',
    image: '/assets/posters/labelled-custom-cursor.png?v=20260806',
    imageAlt: 'Labelled custom cursor case study',
    tiers: [
      {
        label: 'Typical comparable effort',
        hours: '4–7 production hours',
        delivery: 'Approximately 1 working day',
        budget: '€300–€500',
      },
    ],
    learnMoreLabel: 'Learn more about scope and pricing',
    includes: [
      'Cursor visual concept',
      'Custom pointer and label styling',
      'Hover states for links, buttons and selected elements',
      'Basic pointer animation',
      'Integration into an existing functional website',
      'Desktop browser testing',
      'Standard mobile fallback',
    ],
    priceDrivers: [
      'Number of cursor states',
      'Complexity of the animation',
      'Existing website framework',
      'Condition and structure of the website code',
      'Additional page-specific behaviour',
      'Configuration or editing controls',
      'Urgent delivery requirements',
    ],
    assumption:
      'This range applies when the cursor is added to an existing, functional website and the required interaction states are clearly defined. Broader interface redesign, extensive animation systems, complex CMS integration or accelerated delivery are estimated separately.',
  },
  {
    id: 'black-witness',
    refLabel: 'COST-REF-02',
    category: '360° · Storytelling · WebGPU',
    glanceCategory: 'Guided 360° experience',
    title: 'The Black Witness',
    description:
      'A guided 360° storytelling experience using equirectangular scenes, structured navigation, hotspots, interface design, visual effect layers and a shareable browser-based presentation.',
    caseStudyPath: '/case-studies/black-witness',
    image: '/assets/posters/panorama-360-tour.webp?v=20260728',
    imageAlt: 'The Black Witness 360° case study',
    tiers: [
      {
        label: 'Focused version',
        hours: '40–80 production hours',
        delivery: '1–2 weeks',
        budget: '€3,000–€6,000',
      },
      {
        label: 'Case-study-level build',
        hours: '80–160 production hours',
        delivery: '2–4 weeks',
        budget: '€6,000–€12,000',
      },
    ],
    learnMoreLabel: 'Learn more about scope and pricing',
    includes: [
      'One or more supplied 360° scenes',
      'Hotspot and annotation system',
      'Guided camera movement',
      'Interface and navigation design',
      'Responsive browser presentation',
      'Visual effect layers',
      'Deployment and testing',
    ],
    priceDrivers: [
      'Number of panoramas',
      'Number and complexity of hotspots',
      'Whether final imagery is already available',
      'Custom animation or WebGPU effects',
      'Audio, narration and accessibility',
      'Content preparation and copywriting',
      'Required delivery timeframe',
    ],
    assumption:
      'The range assumes that final 360° imagery and approved narrative content are supplied by the client. Photography, scanning, travel and content production are quoted separately.',
  },
  {
    id: 'miab',
    refLabel: 'COST-REF-03',
    category: 'WebGPU · Ocean · Interaction',
    glanceCategory: 'Real-time browser experience',
    title: 'Message in a Bottle',
    description:
      'An original real-time browser experience combining procedural water and sky, animated objects, interface design, day and night conditions, a message-writing flow and shareable interactive output.',
    caseStudyPath: '/case-studies/message-in-a-bottle',
    image: '/assets/posters/message-in-a-bottle.webp?v=20260801',
    imageAlt: 'Message in a Bottle case study',
    tiers: [
      {
        label: 'Focused prototype',
        hours: '80–160 production hours',
        delivery: '2–4 weeks',
        budget: '€6,000–€12,000',
      },
      {
        label: 'Case-study-level build',
        hours: '160–320 production hours',
        delivery: '4–7 weeks',
        budget: '€12,000–€24,000',
      },
    ],
    learnMoreLabel: 'Learn more about scope and pricing',
    includes: [
      'Creative and technical concept',
      'Real-time ocean and sky environment',
      'Object animation and interaction',
      'Message-writing interface',
      'Day, night or weather states',
      'Responsive browser delivery',
      'Performance optimisation',
      'Cross-browser testing',
    ],
    priceDrivers: [
      'Required visual realism',
      'Number of environment states',
      'Sharing, storage or backend functionality',
      'Custom 3D asset production',
      'Mobile performance requirements',
      'Sound design and additional animation',
      'Accelerated delivery or launch deadlines',
    ],
  },
  {
    id: 'viewer',
    refLabel: 'COST-REF-04',
    category: 'Three.js · WebGL · Product',
    glanceCategory: 'Custom 3D software',
    title: 'Custom 3D Viewer',
    description:
      'A custom browser or desktop 3D viewer with model loading, interface architecture, camera and navigation tools, lighting, environmental context, optimisation, testing and deployment.',
    caseStudyPath: '/case-studies/3d-viewer',
    image: '/assets/posters/3d-viewer.webp?v=20260729',
    imageAlt: '3D Viewer case study',
    tiers: [
      {
        label: 'Focused adaptation',
        hours: '120–240 production hours',
        delivery: '3–6 weeks',
        budget: '€9,000–€18,000',
      },
      {
        label: 'New product-level platform',
        hours: '320–640 production hours',
        delivery: '8–16 weeks',
        budget: '€24,000–€48,000',
      },
    ],
    learnMoreLabel: 'Learn more about scope and pricing',
    includes: [
      'Project-specific viewer interface',
      'Model import and preparation workflow',
      'Camera and navigation controls',
      'Object selection and information',
      'Lighting and environment setup',
      'Performance optimisation',
      'Responsive interface',
      'Deployment and technical testing',
    ],
    productAdditions: [
      'Multiple model formats',
      'Saved viewpoints',
      'Measurements',
      'Annotations and hotspots',
      'Clipping planes',
      'Object visibility controls',
      'Project saving',
      'User accounts',
      'Client-specific branding',
      'Desktop Electron delivery',
      'Backend or database integration',
    ],
    explainer:
      'A project-specific viewer based on an existing IOM framework can be delivered substantially faster than a new software platform. The higher range applies when the viewer requires new interface architecture, custom tools, data handling, integrations, accelerated delivery and product-level testing.',
  },
]

export const COST_FACTORS = [
  {
    title: 'Asset readiness',
    text: 'Clean, approved 3D models, panoramas, copy and media reduce production time. Geometry repair, modelling, retopology and content preparation add additional work.',
  },
  {
    title: 'Number of experiences',
    text: 'Additional scenes, models, environments, languages, content states and device targets increase implementation and testing time.',
  },
  {
    title: 'Custom functionality',
    text: 'Accounts, databases, saved projects, sharing systems, analytics, APIs and external platform integrations are estimated separately.',
  },
  {
    title: 'Visual fidelity',
    text: 'Highly realistic environments, advanced lighting, bespoke shaders, animation and original 3D assets require additional design and optimisation.',
  },
  {
    title: 'Review process',
    text: 'The reference ranges assume one primary decision-maker and two consolidated review rounds. Further revisions or major changes in direction are estimated separately.',
  },
  {
    title: 'Delivery timeframe',
    text: 'A standard production schedule allows work to be planned efficiently. Urgent, accelerated or fixed-date delivery may require additional resources and can affect the applicable rate.',
  },
] as const

export const PROTOTYPE_STEPS = [
  {
    index: '01',
    title: 'Define the challenge',
    text: 'Defines the central objective, primary interaction and the single most important project outcome.',
    memberId: 'raven' as const,
    initials: 'R',
    who: 'Raven',
    stage: 'Research',
    stageLine:
      'Understands the client, audience, story and technical challenge before anything is built.',
  },
  {
    index: '02',
    title: 'Shape the solution',
    text: 'Builds and tests a focused working version using representative content and realistic technical conditions.',
    memberId: 'fox' as const,
    initials: 'F',
    who: 'Fox',
    stage: 'Form',
    stageLine:
      'Transforms the research into a clear visual language, interaction structure and technical approach.',
  },
  {
    index: '03',
    title: 'Deliver the outcome',
    text: 'Expands the approved solution into the complete experience, additional content and production deployment.',
    memberId: 'octopus' as const,
    initials: 'O',
    who: 'Octopus',
    stage: 'Output',
    stageLine:
      'Refines and delivers the finished result as an experience people can open, understand and use.',
  },
] as const

export const HOW_IOM_WORKS = [
  {
    title: 'Direct communication',
    text: 'The client works directly with the person responsible for the creative and technical production.',
  },
  {
    title: 'Specialist collaboration',
    text: 'Additional developers, designers, artists, photographers or sound specialists can be included when the project requires them.',
  },
  {
    title: 'Clear stages',
    text: 'Research, prototype, production and delivery can be quoted as separate stages, allowing the scope to be reviewed before each major commitment.',
  },
] as const

export const CONTACT_CHECKLIST = [
  'Main project objective',
  'Intended audience',
  'Existing 3D, 360° or media assets',
  'Required website, desktop, mobile, VR or installation delivery',
  'Preferred completion date',
  'Approximate available budget, when known',
] as const

export const SELECTED_SUPPORT_NOTE = {
  title: 'Selected project support',
  lead:
    'Projects with particularly strong creative, technical, cultural, educational or social value may occasionally receive additional support from IOM. When the project is a strong fit and the production schedule allows, this may take the form of a reduced project fee or a clearly defined number of complimentary production hours.',
  footer:
    'Any such support is considered individually and agreed in writing before production begins.',
} as const

export const PRODUCTION_TIME_NOTE =
  'The displayed schedules describe approximate active production periods. Final calendar delivery may also depend on the availability of client materials, consolidated feedback, external approvals, third-party services and the timing of project decisions.'
