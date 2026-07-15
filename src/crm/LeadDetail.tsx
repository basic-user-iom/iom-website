import { useEffect, useRef, useState } from 'react'
import { claimLeadOwner, deleteLead, listActivities, updateLead } from './api'
import { ActivityPanel } from './ActivityPanel'
import { useCrmI18n } from './i18n'
import { LeadClientLocal } from './LeadClientLocal'
import { AtlasEvalFields } from './AtlasEvalFields'
import { hasAtlasEval, normalizeAtlasEval } from './atlasEval'
import { formatLeadAsPlainText, copyTextToClipboard } from './formatLeadText'
import { LeadForm } from './LeadForm'
import { normalizeLeadEmails } from './api'
import { UserAvatar } from './UserProfileMenu'
import type { CrmProject, CrmUser, Lead, LeadInput, StaffProfile } from './types'
import { resolveLeadOwner } from './types'
import { formatLeadEstimatedValue } from './valueEmoji'
import {
  createMindMap,
  createProjectFromLead,
  listMindMaps,
  listProjectsForLead,
} from './workspaceApi'

const DETAIL_EXPANDED_KEY = 'iom-crm-detail-expanded'

function readDetailExpanded(): boolean {
  try {
    const raw = localStorage.getItem(DETAIL_EXPANDED_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

function writeDetailExpanded(expanded: boolean) {
  try {
    localStorage.setItem(DETAIL_EXPANDED_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

interface LeadDetailProps {
  lead: Lead
  currentUser: CrmUser | null
  staffById?: Map<string, StaffProfile> | null
  /** DB missing client_timezone / client_city / … columns */
  clientLocaleSchemaMissing?: boolean
  /** Called after save/claim; may receive the updated lead for immediate UI merge. */
  onChanged: (updated?: Lead) => void
  onDeleted: () => void
  onOpenProject?: (projectId: string) => void
  onOpenIdeas?: (leadId: string) => void
}

export function LeadDetail({
  lead,
  currentUser,
  staffById,
  clientLocaleSchemaMissing = false,
  onChanged,
  onDeleted,
  onOpenProject,
  onOpenIdeas,
}: LeadDetailProps) {
  const { t, statusLabel, tempLabel, activityLabel, locale } = useCrmI18n()
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(readDetailExpanded)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [sending, setSending] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkedProjects, setLinkedProjects] = useState<CrmProject[]>([])
  const [ideaCount, setIdeaCount] = useState(0)
  const autoHealKey = useRef<string | null>(null)
  const owner = resolveLeadOwner(lead, currentUser, staffById)
  const showOwner = !!(owner.name || owner.email || owner.avatar_url)
  const ownerLabel = owner.name || null
  const isOwnIncomplete =
    !!currentUser &&
    lead.owner_id === currentUser.id &&
    !lead.owner_email?.trim()

  const setExpandedPref = (next: boolean) => {
    setExpanded(next)
    writeDetailExpanded(next)
  }

  // If Iva already owns the row but snapshot email is missing, persist it so Mirjan sees her.
  useEffect(() => {
    if (!currentUser || !isOwnIncomplete || !owner.claimable) return
    const key = `${lead.id}:${currentUser.id}`
    if (autoHealKey.current === key) return
    autoHealKey.current = key
    let cancelled = false
    void claimLeadOwner(lead.id)
      .then(() => {
        if (!cancelled) onChanged()
      })
      .catch(() => {
        // Allow retry / show migration hint if columns are still missing.
        autoHealKey.current = null
        if (!cancelled) setError(t('detail.healFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [
    currentUser,
    isOwnIncomplete,
    lead.id,
    onChanged,
    owner.claimable,
    t,
  ])

  useEffect(() => {
    let alive = true
    void Promise.all([
      listProjectsForLead(lead.id),
      listMindMaps({ leadId: lead.id }),
    ])
      .then(([projects, maps]) => {
        if (!alive) return
        setLinkedProjects(projects)
        setIdeaCount(maps.length)
      })
      .catch(() => {
        if (!alive) return
        setLinkedProjects([])
        setIdeaCount(0)
      })
    return () => {
      alive = false
    }
  }, [lead.id, lead.updated_at])

  const handleSendToProjects = async () => {
    setError('')
    setSending(true)
    try {
      const project = await createProjectFromLead(lead)
      setLinkedProjects((prev) => [project, ...prev])
      onOpenProject?.(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  const handleCreateIdea = async () => {
    setError('')
    try {
      await createMindMap({
        title: lead.company_name || lead.contact_name || t('ideas.untitled'),
        lead_id: lead.id,
        project_id: null,
      })
      setIdeaCount((n) => n + 1)
      onOpenIdeas?.(lead.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ideas.createFailed'))
    }
  }

  const handleSave = async (input: LeadInput) => {
    const updated = await updateLead(lead.id, input)
    setEditing(false)
    onChanged(updated)
  }

  const handleClaim = async () => {
    if (!currentUser || !owner.claimable) return
    if (!confirm(t('detail.claimConfirm'))) return
    setError('')
    setClaiming(true)
    try {
      await claimLeadOwner(lead.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.claimFailed'))
    } finally {
      setClaiming(false)
    }
  }

  const handleDelete = async () => {
    const name = lead.company_name || lead.contact_name || t('list.untitled')
    if (!confirm(t('detail.deleteConfirm', { name }))) return
    setError('')
    try {
      await deleteLead(lead.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.deleteFailed'))
    }
  }

  const handleCopyAsText = async () => {
    setError('')
    setCopying(true)
    try {
      const activities = await listActivities(lead.id)
      const text = formatLeadAsPlainText(lead, {
        t,
        statusLabel,
        tempLabel,
        activityLabel,
        locale,
        owner: { name: ownerLabel, email: owner.email },
        valueLabels: {
          fromTheHeart: t('detail.valueFromHeart'),
          noCharge: t('detail.valueNoCharge'),
        },
        activities,
        linkedProjects,
        ideaCount,
      })
      await copyTextToClipboard(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.copyFailed'))
    } finally {
      setCopying(false)
    }
  }

  const copyButtonLabel = copying ? t('detail.copying') : copied ? t('detail.copied') : t('detail.copyAsText')

  if (editing) {
    return (
      <div className="crm-detail">
        <h2 className="crm-detail-title">{t('detail.editTitle')}</h2>
        <LeadForm initial={lead} onSubmit={handleSave} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className="crm-detail crm-detail--collapsed">
        <div className="crm-detail-summary">
          <div className="crm-detail-summary-main">
            {showOwner && (
              <UserAvatar
                photoUrl={owner.avatar_url}
                name={ownerLabel || owner.email || '?'}
                size="sm"
              />
            )}
            <div className="crm-detail-summary-body">
              <div className="crm-detail-summary-top">
                <span className="crm-lead-company">
                  {lead.company_name || t('detail.untitled')}
                </span>
              </div>
              <div className="crm-lead-row-meta">
                <span>{statusLabel(lead.status)}</span>
                {lead.contact_name && <span>{lead.contact_name}</span>}
                {showOwner && (ownerLabel || owner.email) ? (
                  <span className="crm-lead-owner" title={owner.email || undefined}>
                    {t('detail.addedBy')} {ownerLabel || owner.email}
                  </span>
                ) : null}
                {!lead.owner_id && owner.claimable && !showOwner ? (
                  <span className="crm-lead-owner crm-muted">{t('list.noOwner')}</span>
                ) : null}
                <LeadClientLocal lead={lead} compact />
              </div>
            </div>
          </div>
          <div className="crm-detail-actions crm-detail-actions--compact">
            <span className={`crm-temp crm-temp--${lead.temperature}`}>
              {tempLabel(lead.temperature)}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={copying}
              onClick={() => void handleCopyAsText()}
            >
              {copyButtonLabel}
            </button>
            <button
              type="button"
              className="btn btn-ghost crm-collapse-btn"
              aria-expanded={false}
              aria-label={t('detail.expandAria')}
              onClick={() => setExpandedPref(true)}
            >
              {t('detail.expand')}
            </button>
          </div>
        </div>

        {error && (
          <p className="crm-feedback crm-feedback--error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="crm-detail crm-detail--expanded">
      <header className="crm-detail-header">
        <div>
          <p className="crm-kicker">{t('detail.kicker')}</p>
          <h2 className="crm-detail-title">
            {lead.company_name || t('detail.untitled')}
          </h2>
          <div className="crm-detail-badges">
            <span className={`crm-temp crm-temp--${lead.temperature}`}>
              {tempLabel(lead.temperature)}
            </span>
            <span className="crm-status-pill">{statusLabel(lead.status)}</span>
            <LeadClientLocal lead={lead} compact />
          </div>
          {showOwner && (
            <div className="crm-detail-owner" title={owner.email || undefined}>
              <UserAvatar
                photoUrl={owner.avatar_url}
                name={ownerLabel || owner.email || '?'}
                size="sm"
              />
              <span>
                {t('detail.addedBy')}{' '}
                <strong>{ownerLabel || owner.email}</strong>
                {owner.email ? (
                  <span className="crm-muted crm-detail-owner-email"> · {owner.email}</span>
                ) : null}
              </span>
            </div>
          )}
          {owner.claimable && currentUser && !isOwnIncomplete && (
            <div className="crm-detail-claim">
              <p className="crm-muted crm-detail-claim-hint">{t('detail.claimHint')}</p>
              <button
                type="button"
                className="btn btn-ghost crm-claim-btn"
                disabled={claiming}
                onClick={() => void handleClaim()}
              >
                {claiming ? t('detail.claiming') : t('detail.claimOwner')}
              </button>
            </div>
          )}
          {isOwnIncomplete && (
            <p className="crm-muted crm-detail-claim-hint">{t('detail.claiming')}</p>
          )}
        </div>
        <div className="crm-detail-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={copying}
            onClick={() => void handleCopyAsText()}
          >
            {copyButtonLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost crm-collapse-btn"
            aria-expanded={true}
            aria-label={t('detail.collapseAria')}
            onClick={() => setExpandedPref(false)}
          >
            {t('detail.collapse')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            {t('detail.edit')}
          </button>
          <button type="button" className="btn btn-ghost crm-danger" onClick={() => void handleDelete()}>
            {t('detail.delete')}
          </button>
        </div>
      </header>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      <dl className="crm-facts">
        <div>
          <dt>{t('detail.contact')}</dt>
          <dd>{lead.contact_name || '—'}</dd>
        </div>
        <div>
          <dt>{t('detail.email')}</dt>
          <dd>
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="crm-inline-link">
                {lead.email}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {normalizeLeadEmails(lead.emails).length > 0 && (
          <div className="crm-detail-links">
            <dt>{t('detail.emails')}</dt>
            <dd>
              <ul className="crm-named-links">
                {normalizeLeadEmails(lead.emails).map((row, i) => (
                  <li key={`${row.email}-${i}`}>
                    <span className="crm-named-email-label">{row.label}</span>
                    {': '}
                    <a href={`mailto:${row.email}`} className="crm-inline-link">
                      {row.email}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div>
          <dt>{t('detail.phone')}</dt>
          <dd>
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="crm-inline-link">
                {lead.phone}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>{t('detail.website')}</dt>
          <dd>
            {lead.website ? (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noreferrer"
                className="crm-inline-link"
              >
                {lead.website}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {(lead.links?.length ?? 0) > 0 && (
          <div className="crm-detail-links">
            <dt>{t('detail.links')}</dt>
            <dd>
              <ul className="crm-named-links">
                {lead.links.map((link, i) => (
                  <li key={`${link.url}-${i}`}>
                    <a
                      href={
                        link.url.startsWith('http') ? link.url : `https://${link.url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="crm-inline-link"
                    >
                      {link.label || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div>
          <dt>{t('detail.followUp')}</dt>
          <dd>{lead.next_follow_up || '—'}</dd>
        </div>
        <div>
          <dt>{t('detail.value')}</dt>
          <dd>
            {(() => {
              const formatted = formatLeadEstimatedValue(
                lead.estimated_value,
                lead.value_emoji,
                locale,
                {
                  fromTheHeart: t('detail.valueFromHeart'),
                  noCharge: t('detail.valueNoCharge'),
                },
              )
              if (formatted.isEmotive) {
                return (
                  <span className="crm-value-display crm-value-display--emotive">
                    <span className="crm-value-display__emoji" aria-hidden="true">
                      {formatted.emoji}
                    </span>
                    <span className="crm-value-display__caption">{formatted.caption}</span>
                  </span>
                )
              }
              return (
                <span className="crm-value-display">
                  {formatted.primary}
                </span>
              )
            })()}
          </dd>
        </div>
        <div>
          <dt>{t('detail.created')}</dt>
          <dd>
            {lead.created_at
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lead.created_at))
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('detail.updated')}</dt>
          <dd>
            {lead.updated_at
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lead.updated_at))
              : '—'}
          </dd>
        </div>
      </dl>

      <LeadClientLocal lead={lead} schemaMissing={clientLocaleSchemaMissing} />

      {hasAtlasEval(lead.atlas_eval) && (
        <section className="crm-offer-block crm-atlas-detail">
          <h3 className="crm-panel-title">{t('atlas.title')}</h3>
          <AtlasEvalFields value={normalizeAtlasEval(lead.atlas_eval)} readOnly />
        </section>
      )}

      <section className="crm-offer-block">
        <h3 className="crm-panel-title">{t('detail.offer')}</h3>
        <p className="crm-offer-text">{lead.offer || t('detail.offerEmpty')}</p>
      </section>

      {lead.notes && (
        <section className="crm-offer-block">
          <h3 className="crm-panel-title">{t('detail.notes')}</h3>
          <p className="crm-offer-text">{lead.notes}</p>
        </section>
      )}

      <div className="crm-projects-hook">
        <h3 className="crm-panel-title">{t('detail.projects')}</h3>
        <p className="crm-muted">{t('detail.projectsBlurb')}</p>
        <div className="crm-detail-actions" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending}
            onClick={() => void handleSendToProjects()}
          >
            {sending ? t('form.saving') : t('detail.sendToProjects')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleCreateIdea()}
          >
            {t('detail.openIdeas')}
            {ideaCount > 0 ? ` (${ideaCount})` : ''}
          </button>
        </div>
        {linkedProjects.length > 0 && (
          <ul className="crm-linked-list">
            {linkedProjects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="crm-inline-link"
                  onClick={() => onOpenProject?.(p.id)}
                >
                  {p.name}
                </button>
                <span className="crm-muted"> · {t(`projStatus.${p.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ActivityPanel leadId={lead.id} />
    </div>
  )
}
