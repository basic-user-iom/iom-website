import { AtlasEvalCompact } from './AtlasEvalFields'
import { normalizeAtlasEval } from './atlasEval'
import { useCrmI18n } from './i18n'
import { LeadClientLocal } from './LeadClientLocal'
import { initialEmailPending } from './outreach'
import { UserAvatar } from './UserProfileMenu'
import type { CrmUser, Lead, StaffProfile } from './types'
import { resolveLeadOwner } from './types'
import { isHeartValueEmoji, isNoChargeValueEmoji, normalizeValueEmoji } from './valueEmoji'

interface LeadListProps {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  currentUser: CrmUser | null
  staffById?: Map<string, StaffProfile> | null
}

export function LeadList({
  leads,
  selectedId,
  onSelect,
  loading,
  currentUser,
  staffById,
}: LeadListProps) {
  const { t, statusLabel, tempLabel, locale } = useCrmI18n()

  const formatFollowUp = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso.slice(0, 10)
    }
  }

  // Keep existing cards visible during soft refetch — only show the loading
  // placeholder when we have nothing to display yet.
  if (loading && leads.length === 0) {
    return <p className="crm-empty crm-muted">{t('empty.loading')}</p>
  }

  if (leads.length === 0) {
    return <p className="crm-empty crm-muted">{t('empty.none')}</p>
  }

  return (
    <ul className="crm-lead-list">
      {leads.map((lead) => {
        const owner = resolveLeadOwner(lead, currentUser, staffById)
        const showOwner = !!(owner.name || owner.email || owner.avatar_url)
        const ownerLabel = owner.name || null
        return (
          <li key={lead.id}>
            <button
              type="button"
              className={`crm-lead-row${selectedId === lead.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(lead.id)}
            >
              <div className="crm-lead-row-main">
                {showOwner && (
                  <UserAvatar
                    photoUrl={owner.avatar_url}
                    name={ownerLabel || owner.email || '?'}
                    size="sm"
                  />
                )}
                <div className="crm-lead-row-body">
                  <div className="crm-lead-row-top">
                    <span className="crm-lead-company">
                      {lead.company_name || lead.contact_name || t('list.untitled')}
                    </span>
                    {initialEmailPending(lead) && (
                      <span className="crm-outreach-badge" title={t('outreach.pendingAlert')}>
                        {t('outreach.badgePending')}
                      </span>
                    )}
                    <span className="crm-lead-row-top-end">
                      <LeadClientLocal lead={lead} compact />
                      <span className={`crm-temp crm-temp--${lead.temperature}`}>
                        {tempLabel(lead.temperature)}
                      </span>
                    </span>
                  </div>
                  <div className="crm-lead-row-meta">
                    <span>{statusLabel(lead.status)}</span>
                    {lead.contact_name && <span>{lead.contact_name}</span>}
                    {normalizeValueEmoji(lead.value_emoji) && (
                      <span
                        className="crm-lead-value-emoji"
                        title={
                          isNoChargeValueEmoji(lead.value_emoji)
                            ? isHeartValueEmoji(lead.value_emoji)
                              ? t('list.valueFromHeart')
                              : t('list.valueNoCharge')
                            : t('detail.value')
                        }
                      >
                        {normalizeValueEmoji(lead.value_emoji)}
                        {lead.estimated_value != null &&
                          lead.estimated_value > 0 &&
                          ` ${new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: 'EUR',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(lead.estimated_value)}`}
                      </span>
                    )}
                    <AtlasEvalCompact eval={normalizeAtlasEval(lead.atlas_eval)} />
                    {showOwner && ownerLabel && (
                      <span className="crm-lead-owner" title={owner.email || undefined}>
                        {t('list.addedBy')} {ownerLabel}
                      </span>
                    )}
                    {!lead.owner_id && owner.claimable && !showOwner && (
                      <span className="crm-lead-owner crm-muted">{t('list.noOwner')}</span>
                    )}
                    {lead.next_follow_up && (
                      <span>
                        {t('list.followUp')} {formatFollowUp(lead.next_follow_up)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
