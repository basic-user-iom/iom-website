import { normalizeLeadEmails, normalizeLeadLinks } from './api'
import {
  atlasPriorityComposite,
  atlasPriorityHintKey,
  hasAtlasEval,
  normalizeAtlasEval,
  type AtlasEval,
} from './atlasEval'
import type { Activity, ActivityType, CrmProject, Lead, LeadStatus, LeadTemperature } from './types'
import { hasInitialEmailDraft } from './outreach'
import { formatLeadEstimatedValue } from './valueEmoji'

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* fall through to execCommand fallback */
    }
  }

  const active = document.activeElement as HTMLElement | null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus({ preventScroll: true })
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(textarea)
    active?.focus?.()
  }

  if (!ok) throw new Error('copy failed')
}

export interface FormatLeadTextContext {
  t: TranslateFn
  statusLabel: (status: LeadStatus) => string
  tempLabel: (temp: LeadTemperature) => string
  activityLabel: (type: ActivityType) => string
  locale: string
  owner: { name: string | null; email: string | null }
  valueLabels: { fromTheHeart: string; noCharge: string }
  activities?: Activity[]
  linkedProjects?: CrmProject[]
  ideaCount?: number
}

const ATLAS_SCORE_KEYS: (keyof AtlasEval)[] = [
  'can_hire_us',
  'thinks_like_us',
  'commercial_potential',
  'creative_compatibility',
  'technical_compatibility',
  'relationship_potential',
  'strategic_value',
]

function field(label: string, value: string): string {
  return `${label}: ${value}`
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function orDash(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed || '—'
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean)
  if (body.length === 0) return ''
  return `\n--- ${title} ---\n${body.join('\n')}`
}

function formatAtlasBlock(atlas: AtlasEval, t: TranslateFn): string[] {
  const lines: string[] = []
  for (const key of ATLAS_SCORE_KEYS) {
    const score = atlas[key]
    if (score <= 0) continue
    lines.push(field(t(`atlas.${key}`), `${score}/5`))
  }
  const composite = atlasPriorityComposite(atlas)
  const hintKey = atlasPriorityHintKey(composite)
  if (hintKey) {
    lines.push(field(t('atlas.priority'), t(hintKey)))
  }
  return lines
}

export function formatLeadAsPlainText(lead: Lead, ctx: FormatLeadTextContext): string {
  const company = lead.company_name || ctx.t('detail.untitled')
  const emails = normalizeLeadEmails(lead.emails)
  const links = normalizeLeadLinks(lead.links)
  const atlas = normalizeAtlasEval(lead.atlas_eval)
  const value = formatLeadEstimatedValue(
    lead.estimated_value,
    lead.value_emoji,
    ctx.locale,
    ctx.valueLabels,
  )
  const valueText = value.isEmotive
    ? `${value.emoji ?? ''} ${value.caption}`.trim()
    : value.primary

  const ownerParts = [ctx.owner.name, ctx.owner.email].filter(Boolean)
  const ownerText = ownerParts.length > 0 ? ownerParts.join(' · ') : '—'

  const lines: string[] = [
    `=== ${ctx.t('detail.kicker').toUpperCase()}: ${company} ===`,
    '',
    field(ctx.t('detail.contact'), orDash(lead.contact_name)),
  ]
  if (lead.contact_role?.trim()) {
    lines.push(field(ctx.t('outreach.contactRole'), lead.contact_role.trim()))
  }
  lines.push(field(ctx.t('detail.email'), orDash(lead.email)))

  if (emails.length > 0) {
    lines.push(`${ctx.t('detail.emails')}:`)
    for (const row of emails) {
      lines.push(`  • ${row.label}: ${row.email}`)
    }
  } else {
    lines.push(field(ctx.t('detail.emails'), '—'))
  }

  lines.push(
    field(ctx.t('detail.phone'), orDash(lead.phone)),
    field(ctx.t('detail.website'), orDash(lead.website)),
  )

  if (links.length > 0) {
    lines.push(`${ctx.t('detail.links')}:`)
    for (const link of links) {
      lines.push(`  • ${link.label || link.url}: ${link.url}`)
    }
  } else {
    lines.push(field(ctx.t('detail.links'), '—'))
  }

  lines.push(
    field(ctx.t('detail.followUp'), orDash(lead.next_follow_up)),
    field(ctx.t('detail.value'), valueText || '—'),
    field(ctx.t('form.temperature'), ctx.tempLabel(lead.temperature)),
    field(ctx.t('form.stage'), ctx.statusLabel(lead.status)),
    field(ctx.t('detail.addedBy'), ownerText),
    field(
      ctx.t('detail.created'),
      lead.created_at ? formatWhen(lead.created_at, ctx.locale) : '—',
    ),
    field(
      ctx.t('detail.updated'),
      lead.updated_at ? formatWhen(lead.updated_at, ctx.locale) : '—',
    ),
  )

  const localeLines = [
    field(ctx.t('form.timezone'), orDash(lead.client_timezone)),
    field(ctx.t('form.city'), orDash(lead.client_city)),
    field(ctx.t('form.country'), orDash(lead.client_country)),
  ]
  if (lead.client_lat != null && lead.client_lon != null) {
    localeLines.push(
      field('Coordinates', `${lead.client_lat.toFixed(4)}, ${lead.client_lon.toFixed(4)}`),
    )
  }

  const sections = [
    section(ctx.t('locale.title'), localeLines),
    hasAtlasEval(lead.atlas_eval) ? section(ctx.t('atlas.title'), formatAtlasBlock(atlas, ctx.t)) : '',
    lead.company_focus?.trim()
      ? section(ctx.t('outreach.companyFocus'), [lead.company_focus.trim()])
      : '',
    hasInitialEmailDraft(lead)
      ? section(ctx.t('outreach.title'), [
          field(ctx.t('outreach.subject'), lead.initial_email_subject.trim()),
          lead.initial_email_body.trim(),
          field(
            ctx.t('outreach.sentAt'),
            lead.initial_email_sent_at
              ? formatWhen(lead.initial_email_sent_at, ctx.locale)
              : ctx.t('outreach.statusPending'),
          ),
        ])
      : '',
    section(ctx.t('detail.offer'), [lead.offer?.trim() || ctx.t('detail.offerEmpty')]),
    section(ctx.t('detail.notes'), lead.notes?.trim() ? [lead.notes.trim()] : []),
  ]

  const activities = ctx.activities ?? []
  if (activities.length > 0) {
    const actLines = [...activities]
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .map((act) => {
        const when = formatWhen(act.occurred_at, ctx.locale)
        const type = ctx.activityLabel(act.type)
        const subject = act.subject.trim()
        const body = act.body.trim()
        const detail = body ? `\n    ${body.replace(/\n/g, '\n    ')}` : ''
        return `• [${when}] ${type} — ${subject}${detail}`
      })
    sections.push(section(ctx.t('act.title'), actLines))
  }

  const projects = ctx.linkedProjects ?? []
  if (projects.length > 0 || (ctx.ideaCount ?? 0) > 0) {
    const projLines: string[] = []
    for (const project of projects) {
      projLines.push(`• ${project.name} (${ctx.t(`projStatus.${project.status}`)})`)
    }
    if ((ctx.ideaCount ?? 0) > 0) {
      projLines.push(
        field(ctx.t('detail.openIdeas'), String(ctx.ideaCount)),
      )
    }
    sections.push(section(ctx.t('detail.projects'), projLines))
  }

  return [...lines, ...sections.filter(Boolean)].join('\n').trim()
}
