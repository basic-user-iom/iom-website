export type LegalSlug = 'privacy' | 'terms' | 'cookies'

export type LegalSection = {
  id: string
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export type LegalPage = {
  slug: LegalSlug
  title: string
  description: string
  lastUpdated: string
  disclosure: string
  sections: LegalSection[]
}

export type LegalLocalePack = Record<LegalSlug, LegalPage>

export const LEGAL_CONTACT = 'contact@iobjectm.com'

export const LEGAL_LAST_UPDATED = '2026-07-28'

export const LEGAL_DISCLOSURE_EN =
  'IOM (Interactive Object Media) is an independent studio brand. Contracting and invoicing arrangements are confirmed transparently for each engagement.'

export const LEGAL_PAGES_EN: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    description:
      'How Interactive Object Media collects, uses, and protects information when you use iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure: LEGAL_DISCLOSURE_EN,
    sections: [
      {
        id: 'who',
        heading: 'Who we are',
        paragraphs: [
          LEGAL_DISCLOSURE_EN,
          `This site is operated under the Interactive Object Media (IOM) studio brand. For privacy questions, email ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'confidentiality',
        heading: 'Client confidentiality',
        paragraphs: [
          'Client project work is confidential. We use NDAs when appropriate and do not publish client names, proprietary assets, or project details on this site without permission.',
          'Public case studies and demos describe our process and craft in general terms — or with materials the client has cleared for presentation.',
        ],
      },
      {
        id: 'collect',
        heading: 'Information we collect',
        paragraphs: [
          'We collect only what we need to respond to you and to understand how the public site is used.',
        ],
        bullets: [
          'Contact form: name, email address, and message content you submit.',
          'Optional technical metadata from the form provider (e.g. approximate time of submission).',
          'Privacy-friendly site analytics: page path, referrer, device class, and a short-lived session id stored in sessionStorage — not a persistent advertising cookie.',
          'Client portal (/client-login): account and project data for authenticated staff and active clients only; that workspace is separate from the public marketing site.',
        ],
      },
      {
        id: 'use',
        heading: 'How we use information',
        paragraphs: [
          'Contact submissions are used to reply to inquiries and, where relevant, to prepare a proposal or project discussion.',
          'Analytics events help us improve navigation, content, and performance. They are not sold to third parties for advertising.',
        ],
      },
      {
        id: 'processors',
        heading: 'Service providers',
        paragraphs: [
          'Public contact messages are delivered through Web3Forms (web3forms.com), which processes the form fields you submit so we can receive them by email.',
          'Hosting and delivery run on Vercel. Authenticated CRM data (when used) is stored with Supabase under our project configuration.',
          'Those providers process data only as needed to run their services for us.',
        ],
      },
      {
        id: 'retention',
        heading: 'Retention',
        paragraphs: [
          'Contact emails are kept as long as needed to handle your request and maintain a reasonable business record of correspondence.',
          'Analytics session identifiers live in sessionStorage and clear when the browser session ends.',
          'Client-portal records follow the retention practices agreed for that project.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your choices',
        paragraphs: [
          `You may email ${LEGAL_CONTACT} to ask what contact information we hold about you from this site, or to request correction or deletion of inquiry records where we can reasonably do so.`,
          'You can clear site data in your browser (including sessionStorage) at any time.',
        ],
      },
      {
        id: 'updates',
        heading: 'Updates',
        paragraphs: [
          'We may update this policy when our practices or tools change. The “Last updated” date at the top of this page will change when we do.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    description:
      'Terms for using the Interactive Object Media website and related public tools.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure: LEGAL_DISCLOSURE_EN,
    sections: [
      {
        id: 'brand',
        heading: 'Studio brand',
        paragraphs: [
          LEGAL_DISCLOSURE_EN,
          'References to “IOM,” “we,” or “us” on this site mean the Interactive Object Media studio brand unless a signed agreement says otherwise.',
        ],
      },
      {
        id: 'site',
        heading: 'Using this website',
        paragraphs: [
          'You may browse the public site, demos, and published materials for evaluation and information.',
          'Do not misuse the site (including attempts to disrupt services, scrape private areas, or access /client-login without authorization).',
        ],
      },
      {
        id: 'projects',
        heading: 'Client work',
        paragraphs: [
          'Paid project work, deliverables, timelines, fees, and intellectual-property terms are governed by a separate written agreement confirmed for each engagement — not by these website terms alone.',
          'A secure client portal may be provided for active projects; access is limited to invited users and remains confidential.',
        ],
      },
      {
        id: 'demos',
        heading: 'Demos and experiments',
        paragraphs: [
          'Public demos, experiments, and sandbox tools (including /crm-demo) are provided as-is for illustration. They may change, break, or be removed without notice, and should not be relied on as production systems.',
        ],
      },
      {
        id: 'ip',
        heading: 'Content and trademarks',
        paragraphs: [
          'Site text, branding, and original media remain owned by their respective rights holders. Client project assets remain subject to the relevant contract.',
          'Third-party libraries, fonts, and demo sources keep their own licenses.',
        ],
      },
      {
        id: 'liability',
        heading: 'Disclaimer',
        paragraphs: [
          'The public website and demos are provided without warranties of uninterrupted availability or fitness for a particular purpose.',
          'To the extent permitted by law, IOM is not liable for indirect or consequential losses arising from use of the public site alone. Contracted project liability is defined in the signed agreement for that engagement.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contact',
        paragraphs: [`Questions about these terms: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    description:
      'How Interactive Object Media uses cookies and similar storage on iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure: LEGAL_DISCLOSURE_EN,
    sections: [
      {
        id: 'summary',
        heading: 'Summary',
        paragraphs: [
          LEGAL_DISCLOSURE_EN,
          'This site does not use third-party advertising cookies. We use limited local and session storage for preferences and privacy-friendly analytics.',
        ],
      },
      {
        id: 'what',
        heading: 'What we store',
        paragraphs: ['Depending on what you use, the browser may keep:'],
        bullets: [
          'Session analytics id (sessionStorage) — ties pageviews in one visit; clears when the tab/session ends.',
          'Mute / audio preference — so ambient sound stays off if you muted it.',
          'Language preference where applicable — so locale routing stays consistent.',
          'Authenticated portal session cookies or tokens on /client-login — only when you sign in; required for the private workspace.',
        ],
      },
      {
        id: 'why',
        heading: 'Why',
        paragraphs: [
          'Analytics help us see which public pages are useful. Preferences keep the interface from resetting every visit. Portal credentials keep client work secure.',
        ],
      },
      {
        id: 'control',
        heading: 'Your control',
        paragraphs: [
          'You can clear cookies and site data in your browser settings. Blocking all storage may break login on the client portal and some demos.',
          `For questions: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Related',
        paragraphs: [
          'See also our Privacy Policy for how contact and analytics data are handled.',
        ],
      },
    ],
  },
}

/** @deprecated Use LEGAL_PAGES_EN or getLegalPage() */
export const LEGAL_PAGES = LEGAL_PAGES_EN
export const LEGAL_DISCLOSURE = LEGAL_DISCLOSURE_EN

export function isLegalSlug(value: string): value is LegalSlug {
  return value === 'privacy' || value === 'terms' || value === 'cookies'
}
