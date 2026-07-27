import type { Lead } from './types'

export type NdaFillOptions = {
  /** IOM authorized signatory (legal name). */
  iomSignatory: string
  /** Governing law / courts, e.g. "the Netherlands" or "Serbia". */
  jurisdiction: string
  /** Effective date ISO or display string; defaults to today. */
  effectiveDate?: string
}

function formatToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function clientAddressBlock(lead: Lead): string {
  const parts = [
    lead.client_address.trim(),
    [lead.client_city.trim(), lead.client_country.trim()].filter(Boolean).join(', '),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : '[Client address]'
}

/**
 * Mutual NDA body for staff use. Not legal advice — fill jurisdiction
 * and signatory, then have counsel review before sending to a client.
 */
export function buildMutualNdaText(lead: Lead, options: NdaFillOptions): string {
  const company = lead.company_name.trim() || '[Client company name]'
  const contact = lead.contact_name.trim() || '[Client representative name]'
  const contactRole = lead.contact_role.trim() || '[Title]'
  const address = clientAddressBlock(lead)
  const date = (options.effectiveDate ?? formatToday()).trim() || formatToday()
  const signatory = options.iomSignatory.trim() || '[IOM authorized signatory]'
  const jurisdiction = options.jurisdiction.trim() || '[Governing jurisdiction]'

  return `MUTUAL NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into and made effective as of ${date} (the "Effective Date"), by and between:

Party 1:
Interactive Object Media ("IOM"), represented by ${signatory}

and

Party 2:
${company}, with its principal place of business at:
${address}
("Client").

IOM and Client may collectively be referred to as the "Parties" and individually as a "Party."

1. Purpose
The Parties wish to explore a potential business relationship regarding interactive media, 3D/web engineering, and related visualization work (the "Purpose"). In connection with this Purpose, either Party may disclose to the other Party proprietary, technical, or business information that is confidential.

2. Definition of Confidential Information
"Confidential Information" means any information disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party") that is marked confidential or that a reasonable person would understand to be confidential given its nature. This includes, without limitation: source code, shader and rendering logic, 3D meshes, CAD or architectural files, client lists, project locations, pricing, financial data, marketing strategies, and the existence of the Parties' discussions — except where a Party has given prior written consent to disclose specific items.

3. Obligations of Confidentiality
The Receiving Party agrees to:
(a) Hold Confidential Information in confidence and take reasonable measures to prevent unauthorized disclosure;
(b) Use Confidential Information solely for the Purpose;
(c) Restrict access to personnel and contractors who need to know and who are bound by confidentiality obligations at least as protective as this Agreement; and
(d) Not publish the other Party's name, proprietary assets, or project details in public portfolios, demos, or search indices without prior written consent.

4. Exclusions
Confidential Information does not include information that:
(a) Is or becomes public through no breach of this Agreement by the Receiving Party;
(b) Was already in the Receiving Party's rightful possession before disclosure;
(c) Is independently developed by the Receiving Party without use of the Disclosing Party's Confidential Information; or
(d) Is rightfully obtained from a third party without restriction on disclosure.

5. Term
This Agreement governs disclosures from the Effective Date. Either Party may terminate it on thirty (30) days' written notice. Confidentiality and non-use obligations for information disclosed during the term survive for three (3) years from the date of disclosure.

6. Governing Law
This Agreement is governed by the laws of ${jurisdiction}, without regard to conflict-of-law principles. Disputes arising under this Agreement shall be resolved in the competent courts of that jurisdiction.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

For: Interactive Object Media (IOM)
Authorized Signature: ___________________________
Name: ${signatory}
Title: ___________________________
Date: ___________________________

For: ${company}
Authorized Signature: ___________________________
Name: ${contact}
Title: ${contactRole}
Date: ___________________________
`
}

export function ndaDownloadFilename(lead: Lead): string {
  const slug = (lead.company_name.trim() || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `iom-nda-${slug || 'client'}.txt`
}
