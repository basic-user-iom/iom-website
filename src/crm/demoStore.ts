/**
 * In-memory CRM sandbox for the public /crm-demo experience.
 * Fictional companies + @iom-showcase.example accounts only —
 * never seeded from Supabase, real outreach lists, or staff emails.
 */

import type {
  Activity,
  BoardColumn,
  CrmProject,
  CrmTask,
  CrmUser,
  Lead,
  LeadMessage,
  MindMap,
  MindNode,
  ResearchNote,
  StaffProfile,
  TimeEntry,
} from './types'
import type { BlogAudience, BlogCommentAdmin, BlogPost } from '../blog/types'
import { ALL_DEMO_BLOG_POSTS } from '../blog/posts'
import { DEMO_USEFUL_LINKS } from './linksCatalog'

/** Public demo guide — not a real person / mailbox. */
export const DEMO_USER: CrmUser = {
  id: 'demo-user-iom',
  email: 'demo.guide@iom-showcase.example',
  avatar_url: null,
}

/** Second fictional teammate for “Added by” variety in the sandbox. */
export const DEMO_PARTNER: CrmUser = {
  id: 'demo-user-partner',
  email: 'demo.partner@iom-showcase.example',
  avatar_url: null,
}

export const DEMO_STAFF: StaffProfile = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  display_name: 'Demo Guide',
  avatar_url: null,
}

export const DEMO_PARTNER_STAFF: StaffProfile = {
  id: DEMO_PARTNER.id,
  email: DEMO_PARTNER.email,
  display_name: 'Demo Partner',
  avatar_url: null,
}

/** Same key strings as local mode so existing local CRUD paths keep working. */
export const DEMO_KEYS = {
  leads: 'iom-crm-leads',
  activities: 'iom-crm-activities',
  messages: 'iom-crm-lead-messages',
  session: 'iom-crm-local-session',
  projects: 'iom-crm-projects',
  columns: 'iom-crm-board-columns',
  tasks: 'iom-crm-tasks',
  time: 'iom-crm-time-entries',
  maps: 'iom-crm-mind-maps',
  nodes: 'iom-crm-mind-nodes',
  notes: 'iom-crm-research-notes',
  blogPosts: 'iom-crm-blog-posts',
  blogComments: 'iom-crm-blog-comments',
  blogAudience: 'iom-crm-blog-audience',
  usefulLinks: 'iom-crm-useful-links',
} as const

type Store = Record<string, unknown>

let memory: Store | null = null

function daysAgo(n: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

function emptyAtlas() {
  return {
    can_hire_us: 0,
    thinks_like_us: 0,
    commercial_potential: 0,
    creative_compatibility: 0,
    technical_compatibility: 0,
    relationship_potential: 0,
    strategic_value: 0,
  }
}

function emptyOutreach() {
  return {
    contact_role: '',
    company_focus: '',
    client_address: '',
    initial_email_subject: '',
    initial_email_body: '',
    initial_email_drafted_at: null as string | null,
    initial_email_sent_at: null as string | null,
  }
}

function buildSeed(): Store {
  const guide = DEMO_USER.id
  const guideEmail = DEMO_USER.email
  const partner = DEMO_PARTNER.id
  const partnerEmail = DEMO_PARTNER.email

  const lead1: Lead = {
    id: 'demo-lead-northwind',
    company_name: 'Northwind Arcade Labs',
    website: 'https://northwind-arcade.example',
    links: [
      { label: 'Pitch deck', url: 'https://northwind-arcade.example/deck' },
      { label: 'Figma board', url: 'https://www.figma.com/file/demo-northwind' },
      { label: 'Case study', url: 'https://northwind-arcade.example/work/booth' },
    ],
    contact_name: 'Jordan Blake',
    contact_role: 'Head of Partnerships',
    email: 'jordan.blake@northwind-arcade.example',
    emails: [
      { label: 'Sales', email: 'sales@northwind-arcade.example' },
      { label: 'New Business', email: 'newbiz@northwind-arcade.example' },
      { label: 'Press', email: 'press@northwind-arcade.example' },
    ],
    phone: '+381 11 555 0101',
    offer: 'Interactive 360° showroom + lead capture for trade events',
    company_focus:
      'Trade-show interactive booths, arcade licensing, and event lead capture for B2B brands.',
    notes:
      'DEMO SAMPLE — fictional brand. Hot interest in web presentations + weather sky presets. Atlas scores are sample rankings only.',
    initial_email_subject: 'Interactive 360° showroom for Northwind trade events',
    initial_email_body:
      'Hi Jordan,\n\nI wanted to introduce IOM — Interactive Object Media. We build browser-based 360° showrooms and interactive lead capture for trade events.\n\nWould you be open to a brief call to explore fit for Northwind Arcade Labs?\n\nBest,\nMirjan',
    initial_email_drafted_at: daysAgo(2),
    initial_email_sent_at: null,
    temperature: 'hot',
    status: 'proposal',
    next_follow_up: daysAgo(-3, 14),
    estimated_value: 18500,
    value_emoji: '',
    atlas_eval: {
      can_hire_us: 5,
      thinks_like_us: 4,
      commercial_potential: 5,
      creative_compatibility: 4,
      technical_compatibility: 5,
      relationship_potential: 4,
      strategic_value: 5,
    },
    client_timezone: 'Europe/Belgrade',
    client_city: 'Belgrade',
    client_country: 'Serbia',
    client_address: 'Belgrade, Serbia',
    client_lat: 44.7866,
    client_lon: 20.4489,
    owner_id: guide,
    owner_email: guideEmail,
    owner_avatar_url: null,
    created_at: daysAgo(21),
    updated_at: hoursAgo(5),
  }

  const lead2: Lead = {
    id: 'demo-lead-harbor',
    company_name: 'Harbor & Pine Studio',
    website: 'https://harborpine.example',
    links: [
      { label: 'Mood board', url: 'https://harborpine.example/mood' },
      { label: 'Contact', url: 'https://harborpine.example/contact' },
    ],
    contact_name: 'Samira Okonkwo',
    contact_role: 'Creative Director',
    company_focus:
      'Boutique furniture studios and retail showrooms seeking product configurators.',
    email: 'samira@harborpine.example',
    emails: [
      { label: 'General', email: 'hello@harborpine.example' },
      { label: 'Projects', email: 'projects@harborpine.example' },
    ],
    phone: '+46 8 555 2200',
    offer: 'Product configurator + CRM handoff for furniture retailers',
    notes: 'DEMO SAMPLE — warm pipeline; waiting on fictional scope workshop.',
    initial_email_subject: 'Product configurator concept for Harbor & Pine',
    initial_email_body:
      'Hi Samira,\n\nFollowing our chat about interactive product experiences — IOM can build a browser configurator with CRM handoff for your retail partners.\n\nHappy to share a short demo reel when useful.\n\nBest,\nMirjan',
    initial_email_drafted_at: daysAgo(5),
    initial_email_sent_at: null,
    temperature: 'warm',
    status: 'qualified',
    next_follow_up: daysAgo(-7, 11),
    estimated_value: 9200,
    value_emoji: '⭐',
    atlas_eval: {
      can_hire_us: 3,
      thinks_like_us: 4,
      commercial_potential: 3,
      creative_compatibility: 4,
      technical_compatibility: 3,
      relationship_potential: 4,
      strategic_value: 3,
    },
    client_timezone: 'Europe/Stockholm',
    client_city: 'Stockholm',
    client_country: 'Sweden',
    client_address: '',
    client_lat: 59.3293,
    client_lon: 18.0686,
    owner_id: partner,
    owner_email: partnerEmail,
    owner_avatar_url: null,
    created_at: daysAgo(35),
    updated_at: hoursAgo(28),
  }

  const lead3: Lead = {
    id: 'demo-lead-aurora',
    company_name: 'Aurora Grove Collective',
    website: 'https://auroragrove.example',
    links: [
      { label: 'Press kit', url: 'https://auroragrove.example/press' },
      { label: 'Festival map', url: 'https://auroragrove.example/festival' },
    ],
    contact_name: 'Elliot Marsh',
    ...emptyOutreach(),
    email: 'elliot@auroragrove.example',
    emails: [{ label: 'Community', email: 'hello@auroragrove.example' }],
    phone: '+1 415 555 0199',
    offer: 'Pro-bono community festival pavilion walkthrough',
    notes: 'DEMO SAMPLE — marked with ❤️ value tag (care / gift work, €0).',
    temperature: 'warm',
    status: 'contacted',
    next_follow_up: daysAgo(-1, 16),
    estimated_value: 0,
    value_emoji: '❤️',
    atlas_eval: {
      can_hire_us: 2,
      thinks_like_us: 5,
      commercial_potential: 2,
      creative_compatibility: 5,
      technical_compatibility: 3,
      relationship_potential: 5,
      strategic_value: 4,
    },
    client_timezone: 'America/Los_Angeles',
    client_city: 'San Francisco',
    client_country: 'United States',
    client_lat: 37.7749,
    client_lon: -122.4194,
    owner_id: guide,
    owner_email: guideEmail,
    owner_avatar_url: null,
    created_at: daysAgo(12),
    updated_at: hoursAgo(50),
  }

  const lead4: Lead = {
    id: 'demo-lead-lumen',
    company_name: 'Lumen Circuit Atelier',
    website: 'https://lumencircuit.example',
    links: [{ label: 'Showreel', url: 'https://lumencircuit.example/reel' }],
    contact_name: 'Priya Natarajan',
    ...emptyOutreach(),
    email: 'priya@lumencircuit.example',
    emails: [
      { label: 'New Business', email: 'newbiz@lumencircuit.example' },
      { label: 'Studio', email: 'studio@lumencircuit.example' },
    ],
    phone: '+31 20 555 8844',
    offer: 'Browser WebGPU particles + brand-home companion experience',
    notes: 'DEMO SAMPLE — new inbound from fictional referral; atlas mostly unset.',
    temperature: 'cold',
    status: 'new',
    next_follow_up: daysAgo(-10, 9),
    estimated_value: 6400,
    value_emoji: '',
    atlas_eval: {
      ...emptyAtlas(),
      can_hire_us: 3,
      commercial_potential: 2,
    },
    client_timezone: 'Europe/Amsterdam',
    client_city: 'Amsterdam',
    client_country: 'Netherlands',
    client_lat: 52.3676,
    client_lon: 4.9041,
    owner_id: guide,
    owner_email: guideEmail,
    owner_avatar_url: null,
    created_at: daysAgo(4),
    updated_at: hoursAgo(8),
  }

  const lead5: Lead = {
    id: 'demo-lead-copper',
    company_name: 'Copper Lantern Museums',
    website: 'https://copperlantern.example',
    links: [
      { label: 'Exhibits', url: 'https://copperlantern.example/exhibits' },
      { label: 'Partnerships', url: 'https://copperlantern.example/partners' },
    ],
    contact_name: 'Noah Castillo',
    contact_role: 'Director of Partnerships',
    company_focus:
      'Museum partnerships, photogrammetry galleries, and guided visitor companions.',
    email: 'noah.castillo@copperlantern.example',
    emails: [
      { label: 'Partnerships', email: 'partners@copperlantern.example' },
      { label: 'General', email: 'info@copperlantern.example' },
    ],
    phone: '+1 212 555 0142',
    offer: 'Photogrammetry gallery + guided 360° visitor companion',
    notes: 'DEMO SAMPLE — negotiation stage with 🤝 partner tag on value.',
    initial_email_subject: 'Guided 360° visitor companion for Copper Lantern',
    initial_email_body:
      'Hi Noah,\n\nThank you for the intro call. Attached is a short outline of how IOM would deliver a photogrammetry gallery with a guided 360° visitor companion for Copper Lantern Museums.\n\nHappy to iterate on scope before the next board review.\n\nBest,\nMirjan',
    initial_email_drafted_at: daysAgo(14),
    initial_email_sent_at: daysAgo(12),
    temperature: 'hot',
    status: 'negotiation',
    next_follow_up: daysAgo(-2, 15),
    estimated_value: 42000,
    value_emoji: '🤝',
    atlas_eval: {
      can_hire_us: 4,
      thinks_like_us: 4,
      commercial_potential: 5,
      creative_compatibility: 4,
      technical_compatibility: 4,
      relationship_potential: 5,
      strategic_value: 5,
    },
    client_timezone: 'America/New_York',
    client_city: 'New York',
    client_country: 'United States',
    client_address: '',
    client_lat: 40.7128,
    client_lon: -74.006,
    owner_id: partner,
    owner_email: partnerEmail,
    owner_avatar_url: null,
    created_at: daysAgo(48),
    updated_at: hoursAgo(2),
  }

  const lead6: Lead = {
    id: 'demo-lead-tideframe',
    company_name: 'Tideframe Media',
    website: 'https://tideframe.example',
    links: [{ label: 'Portfolio', url: 'https://tideframe.example/work' }],
    contact_name: 'Mei Chen',
    ...emptyOutreach(),
    email: 'mei.chen@tideframe.example',
    emails: [{ label: 'Production', email: 'production@tideframe.example' }],
    phone: '+44 20 7946 0958',
    offer: 'Gift delivery — sample WebGL shader pack for internal R&D',
    notes: 'DEMO SAMPLE — closed won with 🎁 gift tag (no invoice).',
    temperature: 'warm',
    status: 'closed_won',
    next_follow_up: null,
    estimated_value: 0,
    value_emoji: '🎁',
    atlas_eval: {
      can_hire_us: 5,
      thinks_like_us: 5,
      commercial_potential: 3,
      creative_compatibility: 5,
      technical_compatibility: 5,
      relationship_potential: 5,
      strategic_value: 4,
    },
    client_timezone: 'Europe/London',
    client_city: 'London',
    client_country: 'United Kingdom',
    client_lat: 51.5074,
    client_lon: -0.1278,
    owner_id: guide,
    owner_email: guideEmail,
    owner_avatar_url: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(9),
  }

  const project: CrmProject = {
    id: 'demo-project-northwind',
    lead_id: lead1.id,
    name: 'Northwind Event Showroom',
    description:
      'DEMO board — backlog → ship for the fictional Northwind Arcade booth.',
    status: 'active',
    created_at: daysAgo(18),
    updated_at: hoursAgo(3),
    owner_id: guide,
  }

  const project2: CrmProject = {
    id: 'demo-project-copper',
    lead_id: lead5.id,
    name: 'Copper Lantern Companion Tour',
    description: 'DEMO board — delivery board for the fictional museum walkthrough.',
    status: 'planned',
    created_at: daysAgo(10),
    updated_at: hoursAgo(20),
    owner_id: partner,
  }

  const columns: BoardColumn[] = [
    {
      id: 'demo-col-backlog',
      project_id: project.id,
      name: 'Backlog',
      position: 0,
      color: '#64748b',
      created_at: daysAgo(18),
    },
    {
      id: 'demo-col-doing',
      project_id: project.id,
      name: 'Doing',
      position: 1,
      color: '#0ea5e9',
      created_at: daysAgo(18),
    },
    {
      id: 'demo-col-review',
      project_id: project.id,
      name: 'Review',
      position: 2,
      color: '#a855f7',
      created_at: daysAgo(18),
    },
    {
      id: 'demo-col-done',
      project_id: project.id,
      name: 'Done',
      position: 3,
      color: '#22c55e',
      created_at: daysAgo(18),
    },
    {
      id: 'demo-col2-todo',
      project_id: project2.id,
      name: 'To do',
      position: 0,
      color: '#64748b',
      created_at: daysAgo(10),
    },
    {
      id: 'demo-col2-doing',
      project_id: project2.id,
      name: 'Doing',
      position: 1,
      color: '#0ea5e9',
      created_at: daysAgo(10),
    },
  ]

  const tasks: CrmTask[] = [
    {
      id: 'demo-task-1',
      project_id: project.id,
      column_id: columns[1].id,
      title: 'Bake HDRI sky preset for booth lighting',
      description: 'Match cyan brand accents; demo-only task.',
      priority: 'high',
      due_date: daysAgo(-2).slice(0, 10),
      assignee_id: guide,
      position: 0,
      owner_id: guide,
      created_at: daysAgo(10),
      updated_at: hoursAgo(6),
    },
    {
      id: 'demo-task-2',
      project_id: project.id,
      column_id: columns[0].id,
      title: 'Wire lead-capture CTA to CRM handoff',
      description: 'Named department emails + Atlas panel in export notes.',
      priority: 'medium',
      due_date: daysAgo(-5).slice(0, 10),
      assignee_id: guide,
      position: 0,
      owner_id: guide,
      created_at: daysAgo(9),
      updated_at: hoursAgo(40),
    },
    {
      id: 'demo-task-3',
      project_id: project.id,
      column_id: columns[3].id,
      title: 'Approve booth floorplan GLB',
      description: '',
      priority: 'low',
      due_date: null,
      assignee_id: guide,
      position: 0,
      owner_id: guide,
      created_at: daysAgo(14),
      updated_at: daysAgo(4),
    },
    {
      id: 'demo-task-4',
      project_id: project2.id,
      column_id: 'demo-col2-todo',
      title: 'Scan sample gallery hemisphere',
      description: 'Fictional photogrammetry pass.',
      priority: 'urgent',
      due_date: daysAgo(-4).slice(0, 10),
      assignee_id: partner,
      position: 0,
      owner_id: partner,
      created_at: daysAgo(8),
      updated_at: hoursAgo(12),
    },
  ]

  const timeEntries: TimeEntry[] = [
    {
      id: 'demo-time-1',
      project_id: project.id,
      task_id: tasks[0].id,
      user_id: guide,
      user_email: guideEmail,
      started_at: daysAgo(2, 9),
      ended_at: daysAgo(2, 12),
      duration_seconds: 3 * 3600,
      notes: 'Sky + cloud shader pass (demo)',
      created_at: daysAgo(2, 12),
    },
    {
      id: 'demo-time-2',
      project_id: project.id,
      task_id: tasks[1].id,
      user_id: guide,
      user_email: guideEmail,
      started_at: daysAgo(1, 14),
      ended_at: daysAgo(1, 15),
      duration_seconds: 3600,
      notes: 'CTA wiring sketch',
      created_at: daysAgo(1, 15),
    },
    {
      id: 'demo-time-3',
      project_id: project.id,
      task_id: null,
      user_id: guide,
      user_email: guideEmail,
      started_at: hoursAgo(1.5),
      ended_at: null,
      duration_seconds: 0,
      notes: 'Live timer demo — stop anytime',
      created_at: hoursAgo(1.5),
    },
    {
      id: 'demo-time-4',
      project_id: project2.id,
      task_id: tasks[3].id,
      user_id: partner,
      user_email: partnerEmail,
      started_at: daysAgo(3, 10),
      ended_at: daysAgo(3, 13),
      duration_seconds: 3 * 3600,
      notes: 'Sample scan cleanup (demo partner)',
      created_at: daysAgo(3, 13),
    },
  ]

  const mindMap: MindMap = {
    id: 'demo-map-northwind',
    title: 'Northwind pitch ideas',
    lead_id: lead1.id,
    project_id: project.id,
    owner_id: guide,
    created_at: daysAgo(8),
    updated_at: hoursAgo(12),
  }

  const mindMap2: MindMap = {
    id: 'demo-map-copper',
    title: 'Copper visitor journey',
    lead_id: lead5.id,
    project_id: project2.id,
    owner_id: partner,
    created_at: daysAgo(6),
    updated_at: hoursAgo(30),
  }

  const nodes: MindNode[] = [
    {
      id: 'demo-node-root',
      mind_map_id: mindMap.id,
      parent_id: null,
      title: 'Booth experience',
      notes: 'Central topic (demo)',
      color: '#22d3ee',
      link_url: '',
      emphasis: 'bold',
      position: 0,
      created_at: daysAgo(8),
      updated_at: daysAgo(8),
    },
    {
      id: 'demo-node-a',
      mind_map_id: mindMap.id,
      parent_id: 'demo-node-root',
      title: '360° walkthrough',
      notes: '',
      color: '',
      link_url: 'https://northwind-arcade.example/tour',
      emphasis: 'normal',
      position: 0,
      created_at: daysAgo(8),
      updated_at: daysAgo(7),
    },
    {
      id: 'demo-node-b',
      mind_map_id: mindMap.id,
      parent_id: 'demo-node-root',
      title: 'Lead capture → CRM',
      notes: 'Named emails + Atlas + local weather',
      color: '#a855f7',
      link_url: '',
      emphasis: 'italic',
      position: 1,
      created_at: daysAgo(8),
      updated_at: daysAgo(6),
    },
    {
      id: 'demo-node-c',
      mind_map_id: mindMap.id,
      parent_id: 'demo-node-b',
      title: 'Weather-aware sky',
      notes: 'Client local time in Belgrade',
      color: '',
      link_url: '',
      emphasis: 'normal',
      position: 0,
      created_at: daysAgo(7),
      updated_at: daysAgo(5),
    },
    {
      id: 'demo-node2-root',
      mind_map_id: mindMap2.id,
      parent_id: null,
      title: 'Visitor path',
      notes: 'Second map (demo)',
      color: '#f59e0b',
      link_url: '',
      emphasis: 'bold',
      position: 0,
      created_at: daysAgo(6),
      updated_at: daysAgo(6),
    },
    {
      id: 'demo-node2-a',
      mind_map_id: mindMap2.id,
      parent_id: 'demo-node2-root',
      title: 'Lobby capture',
      notes: '',
      color: '',
      link_url: '',
      emphasis: 'normal',
      position: 0,
      created_at: daysAgo(6),
      updated_at: daysAgo(5),
    },
  ]

  const researchNotes: ResearchNote[] = [
    {
      id: 'demo-note-artists',
      title: 'DEMO — artists & studios to watch',
      body: `DEMO SAMPLE — fictional research list only. Names and URLs below are invented for the public CRM demo; nothing here is a real contact list.

Monitor exhibition calendars, fictional gallery partners, and production studios for practice — do not treat these as live outreach targets.

## Nova Helix Collective
https://nova-helix.example/work
Kinetic light + sound rooms. Watch for museum residency announcements (sample).

## Amber Circuit Studio
https://ambercircuit.example
Browser-based generative sculpture. Note software collaborators on show pages.

## Tideglass Atelier
https://tideglass.example/projects
Architectural projection mockups. Follow fictional festival circuit listings.

## Soft Orbit Lab
https://softorbit.example
AI sketch tools for spatial storytelling. Academic crossover notes (demo).

## Lumen Drift Works
https://lumendrift.example
Minimal AV installations — sample museum / opera house partnerships.

## Cobalt Frame Projects
https://cobaltframe.example/reel
Computational sculpture reels. Production studio credits are placeholders.

## Harbor Signal Group
https://harborsignal.example
Media-art research lab — books and workshops listed for demo structure only.`,
      lead_id: null,
      project_id: null,
      owner_id: guide,
      created_at: daysAgo(2),
      updated_at: hoursAgo(4),
    },
  ]

  const activities: Activity[] = [
    {
      id: 'demo-act-1',
      lead_id: lead1.id,
      type: 'meeting',
      subject: 'Discovery call (demo)',
      body: 'Discussed showroom goals — fictional notes only.',
      occurred_at: daysAgo(15, 11),
      created_at: daysAgo(15, 11),
      owner_id: guide,
    },
    {
      id: 'demo-act-2',
      lead_id: lead1.id,
      type: 'email',
      subject: 'Sent proposal draft',
      body: 'Attached sample scope — not a real send.',
      occurred_at: daysAgo(6, 16),
      created_at: daysAgo(6, 16),
      owner_id: guide,
    },
    {
      id: 'demo-act-3',
      lead_id: lead3.id,
      type: 'note',
      subject: 'Pro-bono ❤️ flag',
      body: 'Festival pavilion — value tagged as care/gift work.',
      occurred_at: daysAgo(4, 9),
      created_at: daysAgo(4, 9),
      owner_id: guide,
    },
    {
      id: 'demo-act-4',
      lead_id: lead5.id,
      type: 'call',
      subject: 'Budget checkpoint',
      body: 'Fictional negotiation call — Atlas scores reviewed.',
      occurred_at: daysAgo(2, 17),
      created_at: daysAgo(2, 17),
      owner_id: partner,
    },
    {
      id: 'demo-act-4b',
      lead_id: lead5.id,
      type: 'email',
      subject: 'Guided 360° visitor companion for Copper Lantern',
      body: 'DEMO SAMPLE — simulated CRM send to noah.castillo@copperlantern.example (no real email).',
      occurred_at: daysAgo(12, 14),
      created_at: daysAgo(12, 14),
      owner_id: partner,
    },
    {
      id: 'demo-act-5',
      lead_id: lead4.id,
      type: 'task',
      subject: 'Research WebGPU fit',
      body: 'Check particles demo + brand guidelines (demo checklist).',
      occurred_at: daysAgo(1, 10),
      created_at: daysAgo(1, 10),
      owner_id: guide,
    },
  ]

  const messages: LeadMessage[] = [
    {
      id: 'demo-msg-1',
      lead_id: lead5.id,
      direction: 'outbound',
      from_email: 'contact@iobjectm.com',
      to_email: 'noah.castillo@copperlantern.example',
      subject: lead5.initial_email_subject,
      body_text: lead5.initial_email_body,
      body_html: null,
      message_id: '<demo-outbound-copperlantern@iobjectm.com>',
      in_reply_to: null,
      references_header: null,
      occurred_at: daysAgo(12, 14),
      created_at: daysAgo(12, 14),
      owner_id: partner,
      raw_headers: {},
    },
    {
      id: 'demo-msg-2',
      lead_id: lead5.id,
      direction: 'inbound',
      from_email: 'noah.castillo@copperlantern.example',
      to_email: 'contact@iobjectm.com',
      subject: `Re: ${lead5.initial_email_subject}`,
      body_text:
        'Hi Mirjan,\n\nThanks for the outline — the board liked the guided companion angle. Can you send a rough timeline for photogrammetry capture vs. web delivery?\n\nBest,\nNoah\n\n(DEMO SAMPLE — fictional client reply mirrored into CRM.)',
      body_html: null,
      message_id: '<demo-inbound-copperlantern@copperlantern.example>',
      in_reply_to: '<demo-outbound-copperlantern@iobjectm.com>',
      references_header: '<demo-outbound-copperlantern@iobjectm.com>',
      occurred_at: daysAgo(10, 11),
      created_at: daysAgo(10, 11),
      owner_id: null,
      raw_headers: {},
    },
  ]

  // Blog sandbox — catalog posts start in Pending Review (match live CRM workflow).
  const demoCardBlogPosts: BlogPost[] = ALL_DEMO_BLOG_POSTS.map((post, index) => ({
    ...post,
    id: `demo-blog-${post.slug}`,
    status: 'pending_review' as const,
    published_at: null,
    owner_id: guide,
    created_at: daysAgo(2 + (index % 10), 10),
    updated_at: daysAgo(1 + (index % 10), 12),
  }))

  const blogPost1: BlogPost = {
    id: 'demo-blog-360-showrooms',
    slug: 'browser-360-showrooms-that-convert',
    title: 'Browser 360° showrooms that convert',
    excerpt:
      'How immersive panoramas turn trade-booth curiosity into qualified leads — without an app install.',
    body: `# Browser 360° showrooms that convert

Trade visitors remember experiences. A guided [360° panorama](/demos/panorama-360/) lets them walk a booth, product line, or venue from any device.

## What works

- Clear **call-to-action** hotspots that open contact or brochure links
- Short narration or captions — not a wall of text
- Fast loads on mid-range phones

## Internal links (SEO)

Explore our [360 Tours](/#360) work or [get in touch](/#contact) if you want a showroom for your next event.

DEMO SAMPLE — fictional editorial for CRM Blog sandbox.`,
    cover_image_url: '',
    status: 'published',
    published_at: daysAgo(5, 11),
    seo_title: 'Browser 360° showrooms that convert — IOM',
    seo_description:
      'Immersive panorama showrooms for trade events: guided tours, lead capture, and WebGL delivery without apps.',
    author_name: 'IOM',
    tags: ['360', 'showroom', 'lead capture'],
    owner_id: guide,
    created_at: daysAgo(6, 9),
    updated_at: daysAgo(5, 11),
  }

  const blogPost2: BlogPost = {
    id: 'demo-blog-case-copper',
    slug: 'case-study-guided-museum-companion',
    title: 'Case study: guided museum companion',
    excerpt:
      'How a spatial web companion for Copper Lantern Museums extended visits beyond the gallery floor (fictional case study tied to the demo lead).',
    body: `## The brief

[Copper Lantern Museums](/crm-demo) (demo lead) needed a **browser companion** visitors could open on their phones — waypoints, short stories, and a calm visual language.

## What we shipped

- Photogrammetry-backed spaces previewed in WebGL
- A lightweight path UI inspired by our [raven path](/demos/raven-path/) experiments
- Analytics hooks so the museum team could see which stops held attention

## Outcome (sample)

Dwell time on featured exhibits rose; staff reported fewer “where do I go next?” questions.

See [3D work](/#3d) or [contact IOM](/#contact).

DEMO SAMPLE — case study style post for Blog → Posts.`,
    cover_image_url: '',
    status: 'published',
    published_at: daysAgo(12, 15),
    seo_title: 'Case study: guided museum companion — IOM',
    seo_description:
      'How a browser-based guided companion extended museum visits with spatial storytelling and WebGL.',
    author_name: 'IOM',
    tags: ['case study', 'museum', 'WebGL'],
    owner_id: partner,
    created_at: daysAgo(14, 10),
    updated_at: daysAgo(12, 15),
  }

  const blogPost3: BlogPost = {
    id: 'demo-blog-webgpu-particles',
    slug: 'why-webgpu-particles-matter-for-brands',
    title: 'Why WebGPU particles matter for brands',
    excerpt:
      'Field notes on real-time particle systems as atmospheric brand moments — not just tech demos.',
    body: `Real-time particles used to mean native apps. With [WebGPU particle demos](/demos/webgpu-particles/), brands can ship atmosphere in the browser.

## When to use them

- Product launches that need motion without video files
- Spatial identity moments on a landing page
- Live audio-reactive visuals (see [FFT ocean](/demos/fft-ocean/) and music experiments)

## Before publish

- Add internal links to [Experiments](/#experiments) and a CTA to [/#contact](/#contact)
- Fill SEO title + description in the Blog editor
- Public site stays **Coming soon** until staff flip \`BLOG_PUBLIC_ENABLED\`

DEMO SAMPLE — draft waiting in Blog → Posts.`,
    cover_image_url: '',
    status: 'draft',
    published_at: null,
    seo_title: 'Why WebGPU particles matter for brands — IOM',
    seo_description:
      'Field notes on WebGPU particle systems as atmospheric brand experiences on the web.',
    author_name: 'IOM',
    tags: ['WebGPU', 'particles', 'brand'],
    owner_id: guide,
    created_at: daysAgo(2, 16),
    updated_at: daysAgo(1, 12),
  }

  const blogPost4: BlogPost = {
    id: 'demo-blog-internal-links',
    slug: 'how-we-use-the-iom-journal-for-seo',
    title: 'How we use the IOM Journal for SEO',
    excerpt:
      'Short playbook: case studies, service explainers, and verified comments that grow an email list without publishing addresses.',
    body: `## Why a studio blog

Search and AI answers reward useful depth. The Journal is where we publish:

1. Service explainers (360°, WebGL, immersive)
2. Client-style success stories
3. Field notes with links into [demos](/demos/panorama-360/) and [/#contact](/#contact)

## Comment emails stay private

Readers must verify a real email. Addresses never appear on the public page — they land in **Blog → Emails** for the team.

DEMO SAMPLE — SEO / process post for Blog sandbox.`,
    cover_image_url: '',
    status: 'published',
    published_at: daysAgo(8, 10),
    seo_title: 'How we use the IOM Journal for SEO — IOM',
    seo_description:
      'How IOM uses case studies, service articles, and private verified comments to support search and lead capture.',
    author_name: 'IOM',
    tags: ['SEO', 'journal', 'process'],
    owner_id: guide,
    created_at: daysAgo(9, 9),
    updated_at: daysAgo(8, 10),
  }

  const blogComments: BlogCommentAdmin[] = [
    {
      id: 'demo-blog-c1',
      post_id: blogPost1.id,
      parent_id: null,
      author_name: 'Sam Okonkwo',
      author_email: 'sam.okonkwo@eventlab.example',
      body: 'We ran a panorama booth last year — curious how you handle offline fallbacks on venue Wi‑Fi.',
      created_at: daysAgo(3, 14),
      status: 'approved',
      email_verified_at: daysAgo(3, 14),
      marketing_opt_in: false,
      verify_expires_at: null,
    },
    {
      id: 'demo-blog-c2',
      post_id: blogPost1.id,
      parent_id: 'demo-blog-c1',
      author_name: 'IOM Studio',
      author_email: 'contact@iobjectm.com',
      body: 'Great question — we pre-cache critical tiles and degrade hotspots first when bandwidth drops.',
      created_at: daysAgo(3, 16),
      status: 'approved',
      email_verified_at: daysAgo(3, 16),
      marketing_opt_in: false,
      verify_expires_at: null,
    },
    {
      id: 'demo-blog-c3',
      post_id: blogPost2.id,
      parent_id: null,
      author_name: 'Priya Nair',
      author_email: 'priya.nair@culturetech.example',
      body: 'Would love a follow-up on accessibility for screen readers in guided companions.',
      created_at: daysAgo(1, 11),
      status: 'pending_moderation',
      email_verified_at: daysAgo(1, 11),
      marketing_opt_in: true,
      verify_expires_at: null,
    },
    {
      id: 'demo-blog-c4',
      post_id: blogPost4.id,
      parent_id: null,
      author_name: 'Jordan Blake',
      author_email: 'jordan.blake@northwind-arcade.example',
      body: 'Useful SEO framing — do you publish drafts to CRM only before the public Journal goes live?',
      created_at: hoursAgo(6),
      status: 'pending_moderation',
      email_verified_at: hoursAgo(6),
      marketing_opt_in: true,
      verify_expires_at: null,
    },
    {
      id: 'demo-blog-c5',
      post_id: blogPost1.id,
      parent_id: null,
      author_name: 'Botty McSpam',
      author_email: 'promo@cheap-leads.example',
      body: 'Buy followers cheap!!! http://spam.example http://spam2.example http://spam3.example',
      created_at: daysAgo(4, 9),
      status: 'spam',
      email_verified_at: null,
      marketing_opt_in: false,
      verify_expires_at: null,
    },
    {
      id: 'demo-blog-c6',
      post_id: blogPost4.id,
      parent_id: null,
      author_name: 'Mei Chen',
      author_email: 'mei.chen@tideframe.example',
      body: 'Clicked comment but have not confirmed email yet — should stay hidden until verify.',
      created_at: hoursAgo(2),
      status: 'pending_verify',
      email_verified_at: null,
      marketing_opt_in: false,
      verify_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    },
  ]

  const blogAudience: BlogAudience[] = [
    {
      id: 'demo-aud-1',
      email: 'sam.okonkwo@eventlab.example',
      name: 'Sam Okonkwo',
      source: 'comment',
      marketing_opt_in: false,
      verified_at: daysAgo(3, 14),
      last_comment_at: daysAgo(3, 14),
      notes: 'Event / trade-show contact — comment only, no marketing opt-in',
      created_at: daysAgo(3, 14),
    },
    {
      id: 'demo-aud-2',
      email: 'priya.nair@culturetech.example',
      name: 'Priya Nair',
      source: 'comment',
      marketing_opt_in: true,
      verified_at: daysAgo(1, 11),
      last_comment_at: daysAgo(1, 11),
      notes: 'Wants a11y follow-up post — marketing opt-in from comment checkbox',
      created_at: daysAgo(1, 11),
    },
    {
      id: 'demo-aud-3',
      email: 'jordan.blake@northwind-arcade.example',
      name: 'Jordan Blake',
      source: 'comment',
      marketing_opt_in: true,
      verified_at: hoursAgo(6),
      last_comment_at: hoursAgo(6),
      notes: 'Also a Leads demo contact (Northwind) — keep Blog list separate from sales pipeline',
      created_at: hoursAgo(6),
    },
    {
      id: 'demo-aud-4',
      email: 'press@museum-partners.example',
      name: 'Museum Partners Press',
      source: 'manual',
      marketing_opt_in: true,
      verified_at: daysAgo(7, 12),
      last_comment_at: null,
      notes: 'Added manually in Blog → Emails for launch announcement list',
      created_at: daysAgo(7, 12),
    },
  ]

  return {
    [DEMO_KEYS.leads]: [lead1, lead2, lead3, lead4, lead5, lead6],
    [DEMO_KEYS.activities]: activities,
    [DEMO_KEYS.messages]: messages,
    [DEMO_KEYS.session]: {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      avatar_url: null,
    },
    [DEMO_KEYS.projects]: [project, project2],
    [DEMO_KEYS.columns]: columns,
    [DEMO_KEYS.tasks]: tasks,
    [DEMO_KEYS.time]: timeEntries,
    [DEMO_KEYS.maps]: [mindMap, mindMap2],
    [DEMO_KEYS.nodes]: nodes,
    [DEMO_KEYS.notes]: researchNotes,
    [DEMO_KEYS.blogPosts]: [...demoCardBlogPosts, blogPost1, blogPost2, blogPost3, blogPost4],
    [DEMO_KEYS.blogComments]: blogComments,
    [DEMO_KEYS.blogAudience]: blogAudience,
    [DEMO_KEYS.usefulLinks]: structuredClone(DEMO_USEFUL_LINKS),
  }
}

export function ensureDemoSeeded(): void {
  if (!memory) memory = buildSeed()
}

/** Reset sandbox to original sample data (in-memory only). */
export function resetDemoStore(): void {
  memory = buildSeed()
}

export function demoRead<T>(key: string, fallback: T): T {
  ensureDemoSeeded()
  const value = memory![key]
  if (value === undefined) return fallback
  // Return a deep clone so callers can mutate copies safely
  return structuredClone(value) as T
}

export function demoWrite<T>(key: string, value: T): void {
  ensureDemoSeeded()
  memory![key] = structuredClone(value)
}

export function demoRemove(key: string): void {
  ensureDemoSeeded()
  delete memory![key]
}

export function clearDemoStore(): void {
  memory = null
}
