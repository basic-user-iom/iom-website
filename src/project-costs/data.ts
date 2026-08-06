/** Single source of truth for /project-costs planning ranges. */

export const PROJECT_COSTS_META = {
  path: '/project-costs',
  pageTitle: 'Project Scope, Time & Budget',
  seoTitle: 'Project Costs & Timelines | IOM',
  seoDescription:
    'Reference timelines and budget ranges for custom interactive 3D viewers, WebGL and WebGPU experiences, guided 360° tours and bespoke website interactions by IOM.',
  rateMin: 75,
  rateMax: 110,
  rateLabel: 'Typically €75–€110 per hour',
  consultMail:
    'mailto:projects@iobjectm.com?subject=Free%2030-minute%20project%20consultation',
  estimateMail:
    'mailto:projects@iobjectm.com?subject=Project%20estimate%20request',
  caseStudiesPath: '/case-studies',
  contactEmail: 'projects@iobjectm.com',
  siteUrl: 'https://iobjectm.com',
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
    id: 'reviews',
    label: 'Reviews',
    value: 'Two consolidated review rounds assumed',
  },
  {
    id: 'support',
    label: 'Project support',
    value:
      'Reduced fees or complimentary time may be available for selected projects',
  },
] as const

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
        budget: '€3,000–€8,800',
      },
      {
        label: 'Comparable complete build',
        hours: '80–160 production hours',
        delivery: '2–4 weeks',
        budget: '€6,000–€17,600',
      },
    ],
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
        budget: '€6,000–€17,600',
      },
      {
        label: 'Comparable complete build',
        hours: '160–320 production hours',
        delivery: '4–7 weeks',
        budget: '€12,000–€35,200',
      },
    ],
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
        label: 'Focused adaptation of the existing IOM framework',
        hours: '120–240 production hours',
        delivery: '3–6 weeks',
        budget: '€9,000–€26,400',
      },
      {
        label: 'New product-level platform',
        hours: '320–640 production hours',
        delivery: '8–16 weeks',
        budget: '€24,000–€70,400',
      },
    ],
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
    text: 'The reference ranges assume one primary decision-maker and two consolidated review rounds. Fragmented feedback or major direction changes may extend the schedule.',
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

export const SUPPORT_POINTS = [
  {
    title: 'Reduced project fee',
    text: 'For selected projects, part of the production may be offered at a reduced rate.',
  },
  {
    title: 'Complimentary production time',
    text: 'IOM may allocate a defined number of production hours without charge.',
  },
  {
    title: 'Case-by-case decision',
    text: 'Support depends on the project’s objectives, creative and technical potential, available schedule and the possibility of developing meaningful work together.',
  },
] as const

export const CONTACT_CHECKLIST = [
  'Intended audience',
  'Main project objective',
  'Existing 3D, 360° or media assets',
  'Required platforms or devices',
  'Desired completion date',
  'Approximate available budget, when known',
] as const

export const CONSULT_POINTS = [
  'Whether the proposed idea is technically feasible',
  'Which parts of the project should be prioritised',
  'Whether a prototype would be useful',
  'What assets or information are still required',
  'A realistic initial timeline and budget range',
] as const
