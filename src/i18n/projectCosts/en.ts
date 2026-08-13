import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const studioIntro = PROJECT_COSTS_META.studioTeamIntroFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const enProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Print / Save as PDF',
    engageHeading: 'How you can engage IOM',
    engageLead:
      'Choose the level of production capacity that fits the project. Use specialist capacity for a focused task, add studio capacity when parallel work is useful, or scope a larger project with us.',
    refsHeading: 'Detailed reference projects',
    refsLead:
      'What was included in each example, typical production ranges and why the reference may — or may not — be comparable to a new request. Not fixed package prices.',
    factorsHeading: 'What affects cost and timeline?',
    factorsLearnLabel: 'Learn more about pricing factors',
    factorsLearnTitle: 'Technical factors that change production effort',
    glanceAria: 'Quick project comparison',
    glanceProject: 'Project',
    glanceEffort: 'Typical comparable effort',
    glanceDelivery: 'Typical delivery',
    glanceBudget: 'Indicative budget',
    glanceReference: 'Reference: {title}',
    typicallyIncludes: 'Typically includes',
    priceDrivers: 'Usually changes in price because of',
    productAdditions: 'Possible product-level additions',
    viewCaseStudy: 'View case study →',
    protoHeading: 'Start with a focused prototype',
    protoLead:
      'Most projects do not need to begin with the complete reference build. A smaller, clearly defined prototype can validate the central interaction, visual direction and technical workflow before the full production scope is approved.',
    protoNote:
      'Prototype work is structured so that useful code, assets and design decisions can continue into the next production stage wherever practical — carried through Research (Raven), Form (Fox), and Output (Octopus).',
    protoAria: 'Prototype stages · Research Form Output',
    howHeading: 'Small core team, scalable production',
    howLead:
      'IOM scales production capacity according to the needs of the project. Some phases may be handled by one senior specialist, while production-heavy phases can expand when parallel work is genuinely useful.',
    estimateHeading: 'About these estimates',
    estimateIntro:
      'All figures on this page are indicative planning ranges for work comparable to the referenced case studies. They are not fixed package prices, contractual quotations or statements of the exact historic cost of the original projects.',
    estimateQuotes:
      'Project quotes for larger scopes are prepared separately after consultation. Unless specifically included in a quotation, the items listed alongside are usually estimated separately.',
    estimateHighlightsAria: 'Key rate highlights',
    estimateHighlightsEyebrow: 'Planning ranges',
    estimateExcludes: 'Usually quoted separately',
    checklistLabel: 'Helpful information to include:',
    viewCaseStudies: 'View all case studies',
    bookConsult: 'Book a free consultation',
    requestEstimate: 'Request a project estimate',
    compareOptions: 'Compare engagement options',
    startsPanelEyebrow: 'Free 30-minute consultation',
    startsPanelAria: 'Next steps',
    scopedAfterConsultation: 'Scoped after consultation',
    productionDay: '€{rate} / production day',
    fromProductionDay: 'from €{rate} / production day',
    fixedTitle: 'Small, clearly defined work',
    fixedBody:
      'Not every collaboration needs to begin with a large project or a day-rate engagement. Small interactions, product-presentation improvements, prototypes and clearly defined website components can also be quoted as fixed-price scopes.',
  },
  hero: {
    eyebrow: 'Scope · Time · Budget',
    title: 'Flexible production capacity',
    lead:
      'IOM can be engaged for focused senior production, additional studio capacity, or a larger scoped project. The right setup depends on the work that can genuinely progress in parallel.',
    sub:
      'This page is transparent guidance, not a catalogue of fixed packages. Day rates qualify a starting point; larger work is scoped after a short consultation.',
    ctaPrimary: 'Discuss a project',
    ctaSecondary: 'View reference projects',
  },
  engagement: {
    specialist: {
      title: 'Senior specialist capacity',
      question: 'Need one experienced specialist?',
      summary:
        'For a focused technical, 3D or realtime task within a wider project.',
      rateLine: `€${specialist} / production day`,
      rateNote: 'Focused senior production for a defined workstream.',
      learnMoreLabel: 'Learn more about senior specialist capacity',
      learnMoreTitle: 'Senior specialist capacity — technical detail',
      learnMoreParagraphs: [
        'Suitable for clearly defined work such as real-time 3D development, browser-based interactive components, 3D asset preparation and optimisation, Blender or Unreal production, CAD/BIM-to-realtime workflows, photogrammetry, 360 production, prototyping, troubleshooting and technical R&D.',
        'A single specialist keeps the daily production cost lower, but provides less parallel capacity. Larger packages may therefore require a longer delivery period.',
        'The exact technical stack is selected according to the project rather than treated as the product itself.',
        'Typical tools and formats when they are useful: Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · photogrammetry · 360° production.',
      ],
    },
    'studio-capacity': {
      title: 'Additional studio capacity',
      question: 'Need more production capacity?',
      summary:
        'For larger production packages or parallel workstreams where extra capacity is genuinely useful.',
      rateLine: `from €${studioFrom} / production day`,
      rateNote: 'Extra parallel capacity when the project genuinely benefits from it.',
      learnMoreLabel: 'Learn more about additional studio capacity',
      learnMoreTitle: 'Additional studio capacity — technical detail',
      learnMoreParagraphs: [
        'For work that benefits from parallel production, IOM can add capacity across 3D production, real-time development, asset preparation, content integration, optimisation and testing.',
        'Additional people do not automatically make every task proportionally faster. Some phases are sequential, while others can progress in parallel. The production setup should therefore follow the real dependencies of the project.',
        'Capacity can also change by phase: one specialist during preparation, additional capacity during production, and a smaller team again for final integration and delivery.',
      ],
    },
    'project-scoping': {
      title: 'Complete / larger project',
      question: 'Need us to take the project further?',
      summary:
        'For end-to-end work where scope, source material, schedule and required capacity should be reviewed together.',
      rateLine: 'Scoped after consultation',
      rateNote:
        'Production structure and price follow the real scope, material, schedule and dependencies.',
      learnMoreLabel: 'Learn more about complete and larger projects',
      learnMoreTitle: 'Complete / larger project — technical detail',
      learnMoreParagraphs: [
        'Before quoting a larger project, IOM reviews available source material, technical requirements, deliverables, timeline, integration responsibilities, review process and any external dependencies.',
        'The goal is to recommend only the level of studio capacity that is genuinely useful. Larger scopes can be structured as milestones, phases or defined production packages rather than as a fixed headcount for the full duration.',
      ],
    },
  },
  capacity: {
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
  },
  august: {
    eyebrow: 'August 2026 — introductory availability',
    title: 'Limited specialist production capacity for new collaborations',
    lines: [
      `For new collaborations confirmed by ${deadline}, a limited amount of specialist production capacity is available at €${intro} / production day instead of the standard €${specialist} / production day.`,
      'The agreed introductory rate can continue beyond August for the initial confirmed scope.',
    ],
    cta: 'Ask about August availability',
    cardBadge: 'August intro',
    specialistCompare: `€${intro} / production day`,
    studioCompare: `from €${studioIntro} / production day`,
    untilNotice: 'Available until the end of August',
    standardLabel: 'Standard {rate}',
  },
  examples: {
    title: 'Reference projects',
    lead:
      'These examples show the approximate scale of previous work. They are not fixed packages; final scope, schedule and production capacity depend on the source material, interaction requirements and delivery context.',
    glanceNote:
      'Select a row to scroll to the detailed reference card. Figures are planning ranges, not catalogue prices.',
    rangeNote:
      'The lower end generally assumes a clearly defined scope, well-prepared assets, a standard production schedule and limited technical uncertainty. Complex integrations, specialist development, incomplete source material or accelerated delivery can increase the final quotation.',
  },
  factorsSimple:
    'The estimate depends on what needs to be built, the condition of your source material, how complex the interaction and visuals need to be, and how quickly you need it delivered.',
  factors: [
    {
      title: 'Quality and condition of source material',
      text: 'Clean production-ready assets versus incomplete or difficult CAD/BIM/3D source data.',
    },
    {
      title: 'Interaction complexity',
      text: 'Simple presentation versus custom realtime logic, tools, configuration or multi-step behaviours.',
    },
    {
      title: 'Visual complexity',
      text: 'Number of environments, objects, materials, lighting requirements, animation and content states.',
    },
    {
      title: 'Integration requirements',
      text: 'Standalone module versus integration into an existing site, software product or client pipeline.',
    },
    {
      title: 'Performance and QA requirements',
      text: 'Supported browsers, devices, mobile targets, GPU constraints and optimisation targets.',
    },
    {
      title: 'Schedule',
      text: 'Compressed timelines can require more parallel production capacity.',
    },
    {
      title: 'Feedback and revision structure',
      text: 'One decision-maker and defined review rounds are different from continuous multi-stakeholder changes.',
    },
    {
      title: 'Third-party costs',
      text: 'Paid assets, licences, special hosting, external services, travel or hardware should be quoted separately where relevant.',
    },
    {
      title: 'Ongoing support',
      text: 'Maintenance, content updates or post-launch support can be structured separately when needed.',
    },
  ],
  starts: {
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
  },
  prototype: [
    {
      title: 'Define the challenge',
      text: 'Defines the central objective, primary interaction and the single most important project outcome.',
      stage: 'Research',
      stageLine:
        'Understands the client, audience, story and technical challenge before anything is built.',
    },
    {
      title: 'Shape the solution',
      text: 'Builds and tests a focused working version using representative content and realistic technical conditions.',
      stage: 'Form',
      stageLine:
        'Transforms the research into a clear visual language, interaction structure and technical approach.',
    },
    {
      title: 'Deliver the outcome',
      text: 'Expands the approved solution into the complete experience, additional content and production deployment.',
      stage: 'Output',
      stageLine:
        'Refines and delivers the finished result as an experience people can open, understand and use.',
    },
  ],
  howIomWorks: [
    {
      title: 'Capacity follows the work',
      text: 'IOM scales production capacity according to the needs of the project. Some phases may be handled by one senior specialist, while production-heavy phases can expand when parallel work is genuinely useful.',
    },
    {
      title: 'Clear production setup',
      text: 'For larger engagements, the production setup is agreed in advance so responsibilities, capacity and communication remain clear throughout the project.',
    },
    {
      title: 'Clear stages',
      text: 'Research, prototype, production and delivery can be quoted as separate stages, allowing the scope to be reviewed before each major commitment.',
    },
  ],
  finalCta: {
    title: 'Tell us what you are trying to build',
    lead:
      'You do not need a technical brief. Send us the goal, anything you already have, and the date you are working toward. We can help determine the appropriate production setup.',
    cta: 'Discuss a project',
  },
  contactChecklist: [
    'Main project objective',
    'Intended audience',
    'Existing 3D, 360° or media assets',
    'Required website, desktop, mobile, VR or installation delivery',
    'Preferred completion date',
    'Approximate available budget, when known',
  ],
  selectedSupport: {
    title: 'Selected project support',
    lead:
      'Projects with particularly strong creative, technical, cultural, educational or social value may occasionally receive additional support from IOM. When the project is a strong fit and the production schedule allows, this may take the form of a reduced project fee or a clearly defined number of complimentary production hours.',
    footer:
      'Any such support is considered individually and agreed in writing before production begins.',
  },
  estimate: {
    productionTime:
      'The displayed schedules describe approximate active production periods. Final calendar delivery may also depend on the availability of client materials, consolidated feedback, external approvals, third-party services and the timing of project decisions.',
    blended:
      'IOM’s typical production rate ranges from €75 to €110 per hour, depending on technical complexity, specialist requirements, asset readiness and delivery timeframe. Defined projects may be quoted as fixed production stages or using a blended project rate. The reference budgets below are therefore planning ranges rather than a direct multiplication of every estimated hour by the highest hourly rate.',
    highlights: [
      { label: 'Senior specialist capacity', value: `€${specialist} / production day` },
      { label: 'Additional studio capacity', value: `from €${studioFrom} / production day` },
      { label: 'Larger / complete projects', value: 'Scoped after consultation' },
    ],
    exclusions: [
      'Travel',
      'On-location photography',
      'Scanning',
      'Paid assets',
      'Third-party software licences',
      'Hosting charges',
      'Taxes',
      'Ongoing maintenance',
    ],
  },
  references: {
    cursor: {
      category: 'UI · Cursor · Interaction',
      glanceCategory: 'Custom website interaction',
      title: 'Labelled Custom Cursor',
      description:
        'A custom context-aware cursor for an existing website, including labelled interaction states, hover behaviour, animated pointer transitions and a standard responsive fallback.',
      imageAlt: 'Labelled custom cursor case study',
      learnMoreLabel: 'Learn more about scope and pricing',
      tiers: [
        {
          label: 'Typical comparable effort',
          hours: '4–7 production hours',
          delivery: 'Approximately 1 working day',
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
    'black-witness': {
      category: '360° · Storytelling · WebGPU',
      glanceCategory: 'Guided 360° experience',
      title: 'The Black Witness',
      description:
        'A guided 360° storytelling experience using equirectangular scenes, structured navigation, hotspots, interface design, visual effect layers and a shareable browser-based presentation.',
      imageAlt: 'The Black Witness 360° case study',
      learnMoreLabel: 'Learn more about scope and pricing',
      tiers: [
        { label: 'Focused version', hours: '40–80 production hours', delivery: '1–2 weeks' },
        { label: 'Case-study-level build', hours: '80–160 production hours', delivery: '2–4 weeks' },
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
    miab: {
      category: 'WebGPU · Ocean · Interaction',
      glanceCategory: 'Real-time browser experience',
      title: 'Message in a Bottle',
      description:
        'An original real-time browser experience combining procedural water and sky, animated objects, interface design, day and night conditions, a message-writing flow and shareable interactive output.',
      imageAlt: 'Message in a Bottle case study',
      learnMoreLabel: 'Learn more about scope and pricing',
      tiers: [
        { label: 'Focused prototype', hours: '80–160 production hours', delivery: '2–4 weeks' },
        { label: 'Case-study-level build', hours: '160–320 production hours', delivery: '4–7 weeks' },
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
    viewer: {
      category: 'Three.js · WebGL · Product',
      glanceCategory: 'Custom 3D software',
      title: 'Custom 3D Viewer',
      description:
        'A custom browser or desktop 3D viewer with model loading, interface architecture, camera and navigation tools, lighting, environmental context, optimisation, testing and deployment.',
      imageAlt: '3D Viewer case study',
      learnMoreLabel: 'Learn more about scope and pricing',
      tiers: [
        { label: 'Focused adaptation', hours: '120–240 production hours', delivery: '3–6 weeks' },
        {
          label: 'New product-level platform',
          hours: '320–640 production hours',
          delivery: '8–16 weeks',
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
  },
  inquiry: {
    requestType: 'Request type',
    consultation: 'Free consultation',
    estimate: 'Project estimate',
    name: 'Name',
    email: 'Email',
    company: 'Company or organisation',
    timeframe: 'Preferred delivery timeframe',
    budget: 'Approximate budget',
    message: 'Please include a short project description.',
    optional: '(optional)',
    timeframePh: 'e.g. within 6 weeks, Q4, flexible',
    budgetPh: 'e.g. €5,000–€15,000',
    messagePh:
      'Describe the main idea, intended audience, available materials and what you would like the experience to achieve.',
    sending: 'Sending…',
    success: 'Message sent to projects@iobjectm.com — we’ll reply within two business days.',
    error: 'Could not send the message. Please email projects@iobjectm.com directly.',
    required: 'Please fill in this field.',
    invalidEmail: 'Enter a valid email address.',
    messageShort: 'Please include a short project description.',
    emailDirect: 'email projects@iobjectm.com directly',
  },
}
