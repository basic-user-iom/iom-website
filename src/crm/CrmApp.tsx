import { useCallback, useEffect, useRef, useState } from 'react'
import {
  atlasEvalSchemaKnownMissing,
  backfillOwnLeadOwnerSnapshot,
  clientLocaleSchemaKnownMissing,
  createLead,
  emailsSchemaKnownMissing,
  getCurrentUser,
  linksSchemaKnownMissing,
  listLeads,
  listStaffProfiles,
  onAuthChange,
  preserveAtlasEvalFields,
  preserveClientLocaleFields,
  preserveLeadEmailsFields,
  preserveLeadLinksFields,
  preserveOutreachFields,
  preserveValueEmojiFields,
  probeAtlasEvalSchema,
  probeClientLocaleSchema,
  probeEmailsSchema,
  probeLinksSchema,
  probeOutreachSchema,
  probeOwnerAttributionSchema,
  probeValueEmojiSchema,
  outreachSchemaKnownMissing,
  valueEmojiSchemaKnownMissing,
  signOut,
  storageMode,
} from './api'
import { enableCrmDemoMode, isCrmDemoMode } from './demoMode'
import { DEMO_USER, resetDemoStore } from './demoStore'
import { CrmLogin } from './CrmLogin'
import { CrmMusicPlayer } from './CrmMusicPlayer'
import {
  CrmWelcomeGuide,
  hasSeenCrmWelcome,
  markCrmWelcomeSeen,
} from './CrmWelcomeGuide'
import {
  CrmI18nProvider,
  LEAD_STATUS_VALUES,
  LEAD_TEMP_VALUES,
  useCrmI18n,
} from './i18n'
import { IdeasView } from './IdeasView'
import { LeadDetail } from './LeadDetail'
import { LeadForm } from './LeadForm'
import { LeadList } from './LeadList'
import { ProjectsView } from './ProjectsView'
import { TimeView } from './TimeView'
import { UserProfileMenu } from './UserProfileMenu'
import type {
  CrmUser,
  Lead,
  LeadFilters,
  LeadInput,
  LeadOwnerOption,
  LeadSort,
  LeadStatus,
  LeadTemperature,
  StaffProfile,
} from './types'
import { collectOwnerOptions } from './types'
import './crm.css'

type View = 'list' | 'create'
type CrmSection = 'leads' | 'projects' | 'time' | 'ideas'

interface CrmAppProps {
  /** Public sandbox — sample data only, no live CRM backend. */
  demo?: boolean
}

function UkFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  )
}

function RsFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="60" height="10" y="0" fill="#C6363C" />
      <rect width="60" height="10" y="10" fill="#0C4076" />
      <rect width="60" height="10" y="20" fill="#FFFFFF" />
    </svg>
  )
}

function DeFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="60" height="10" y="0" fill="#000" />
      <rect width="60" height="10" y="10" fill="#D00" />
      <rect width="60" height="10" y="20" fill="#FFCE00" />
    </svg>
  )
}

function NlFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="60" height="10" y="0" fill="#AE1C28" />
      <rect width="60" height="10" y="10" fill="#FFF" />
      <rect width="60" height="10" y="20" fill="#21468B" />
    </svg>
  )
}

function FrFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="20" height="30" x="0" fill="#002395" />
      <rect width="20" height="30" x="20" fill="#FFF" />
      <rect width="20" height="30" x="40" fill="#ED2939" />
    </svg>
  )
}

function ItFlagIcon() {
  return (
    <svg
      className="crm-lang-flag-svg"
      viewBox="0 0 60 30"
      width="16"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="20" height="30" x="0" fill="#009246" />
      <rect width="20" height="30" x="20" fill="#FFF" />
      <rect width="20" height="30" x="40" fill="#CE2B37" />
    </svg>
  )
}

function LangFlag({ lang }: { lang: string }) {
  switch (lang) {
    case 'de':
      return <DeFlagIcon />
    case 'nl':
      return <NlFlagIcon />
    case 'fr':
      return <FrFlagIcon />
    case 'it':
      return <ItFlagIcon />
    case 'sr':
      return <RsFlagIcon />
    default:
      return <UkFlagIcon />
  }
}

function langTitleKey(lang: string): string {
  switch (lang) {
    case 'de':
      return 'topbar.langDe'
    case 'nl':
      return 'topbar.langNl'
    case 'fr':
      return 'topbar.langFr'
    case 'it':
      return 'topbar.langIt'
    case 'sr':
      return 'topbar.langSr'
    default:
      return 'topbar.langEn'
  }
}

function LanguageToggle() {
  const { lang, toggleLang, t, availableLangs, demo } = useCrmI18n()
  const next =
    availableLangs[
      (availableLangs.indexOf(lang) + 1) % availableLangs.length
    ] ?? 'en'
  return (
    <button
      type="button"
      className="crm-lang-btn"
      onClick={toggleLang}
      aria-label={t('topbar.langToggle')}
      title={`${t(langTitleKey(lang))} → ${t(langTitleKey(next))}${demo ? ' (EN·DE·NL·FR·IT)' : ''}`}
    >
      <span className="crm-lang-flag" aria-hidden="true">
        <LangFlag lang={lang} />
      </span>
      <span className="crm-lang-code">{lang.toUpperCase()}</span>
    </button>
  )
}

function CrmAppInner({ demo = false }: CrmAppProps) {
  const { t, statusLabel, tempLabel } = useCrmI18n()
  // Ensure sandbox flag is on before any API call when mounted as /crm-demo.
  if (demo && !isCrmDemoMode()) enableCrmDemoMode()
  const sandboxed = demo || isCrmDemoMode()
  const demoMode = sandboxed
  const [user, setUser] = useState<CrmUser | null>(() =>
    sandboxed ? DEMO_USER : null,
  )
  const [authReady, setAuthReady] = useState(() => sandboxed)
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [section, setSection] = useState<CrmSection>('leads')
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null)
  const [focusIdeaLeadId, setFocusIdeaLeadId] = useState<string | null>(null)
  const [focusIdeaProjectId, setFocusIdeaProjectId] = useState<string | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    status: 'all',
    temperature: 'all',
    owner: 'all',
    sort: 'updated',
  })
  const [ownerOptions, setOwnerOptions] = useState<LeadOwnerOption[]>([])
  const [staffById, setStaffById] = useState<Map<string, StaffProfile>>(
    () => new Map(),
  )
  const [guideOpen, setGuideOpen] = useState(false)
  const [ownerSchemaMissing, setOwnerSchemaMissing] = useState(false)
  const [clientLocaleSchemaMissing, setClientLocaleSchemaMissing] =
    useState(false)
  const [linksSchemaMissing, setLinksSchemaMissing] = useState(false)
  const [valueEmojiSchemaMissing, setValueEmojiSchemaMissing] = useState(false)
  const [emailsSchemaMissing, setEmailsSchemaMissing] = useState(false)
  const [atlasEvalSchemaMissing, setAtlasEvalSchemaMissing] = useState(false)
  const [outreachSchemaMissing, setOutreachSchemaMissing] = useState(false)

  const openProject = useCallback((projectId: string) => {
    setFocusProjectId(projectId)
    setSection('projects')
  }, [])

  const openIdeasForLead = useCallback((leadId: string) => {
    setFocusIdeaLeadId(leadId)
    setFocusIdeaProjectId(null)
    setSection('ideas')
  }, [])

  const openIdeasForProject = useCallback((projectId: string) => {
    setFocusIdeaProjectId(projectId)
    setFocusIdeaLeadId(null)
    setSection('ideas')
  }, [])

  const openTimeForProject = useCallback((projectId: string) => {
    setFocusProjectId(projectId)
    setSection('time')
  }, [])

  useEffect(() => {
    if (sandboxed) {
      // Demo never shows the first-run staff guide / never hits Auth.
      setGuideOpen(false)
      return
    }
    let alive = true
    void getCurrentUser().then((u) => {
      if (!alive) return
      setUser(u)
      setAuthReady(true)
      if (u && !hasSeenCrmWelcome()) setGuideOpen(true)
    })
    const unsub = onAuthChange((u) => {
      if (!alive) return
      setUser(u)
      setAuthReady(true)
      if (u && !hasSeenCrmWelcome()) setGuideOpen(true)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [sandboxed])

  // Demo: resolve user from in-memory sandbox (getCurrentUser skips Supabase).
  useEffect(() => {
    if (!sandboxed) return
    let alive = true
    void getCurrentUser().then((u) => {
      if (!alive) return
      setUser(u)
      setAuthReady(true)
    })
    const unsub = onAuthChange((u) => {
      if (!alive) return
      setUser(u)
      setAuthReady(true)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [sandboxed])

  const dismissGuide = useCallback(() => {
    markCrmWelcomeSeen()
    setGuideOpen(false)
  }, [])

  const leadsRef = useRef(leads)
  leadsRef.current = leads

  const refreshLeads = useCallback(async () => {
    // Soft refresh: keep current cards painted; only show the loading
    // placeholder when the list is still empty (first load / after sign-out).
    const soft = leadsRef.current.length > 0
    if (!soft) setLoading(true)
    setError('')
    try {
      const [schema, staff, clientLocaleOk, linksOk, valueEmojiOk, emailsOk, atlasOk, outreachOk] =
        await Promise.all([
          probeOwnerAttributionSchema(),
          listStaffProfiles(),
          probeClientLocaleSchema(),
          probeLinksSchema(),
          probeValueEmojiSchema(),
          probeEmailsSchema(),
          probeAtlasEvalSchema(),
          probeOutreachSchema(),
        ])
      setOwnerSchemaMissing(
        !schema.ownerSnapshotColumns || !schema.staffProfiles,
      )
      setClientLocaleSchemaMissing(!clientLocaleOk)
      setLinksSchemaMissing(!linksOk)
      setValueEmojiSchemaMissing(!valueEmojiOk)
      setEmailsSchemaMissing(!emailsOk)
      setAtlasEvalSchemaMissing(!atlasOk)
      setOutreachSchemaMissing(!outreachOk)
      setStaffById(staff)
      // Load without owner filter so the "who added" dropdown stays complete.
      const catalog = await listLeads({ ...filters, owner: 'all' })
      setOwnerOptions(collectOwnerOptions(catalog, user, staff))
      const rows =
        filters.owner === 'all'
          ? catalog
          : catalog.filter((lead) => {
              if (filters.owner === 'none') {
                return !lead.owner_id && !lead.owner_email
              }
              const key = lead.owner_id || lead.owner_email || ''
              return key === filters.owner
            })
      // If optional columns are missing, keep optimistic values already in UI.
      setLeads((prev) => {
        let next = rows
        if (clientLocaleSchemaKnownMissing() || !clientLocaleOk) {
          next = preserveClientLocaleFields(next, prev)
        }
        if (linksSchemaKnownMissing() || !linksOk) {
          next = preserveLeadLinksFields(next, prev)
        }
        if (valueEmojiSchemaKnownMissing() || !valueEmojiOk) {
          next = preserveValueEmojiFields(next, prev)
        }
        if (emailsSchemaKnownMissing() || !emailsOk) {
          next = preserveLeadEmailsFields(next, prev)
        }
        if (atlasEvalSchemaKnownMissing() || !atlasOk) {
          next = preserveAtlasEvalFields(next, prev)
        }
        if (outreachSchemaKnownMissing() || !outreachOk) {
          next = preserveOutreachFields(next, prev)
        }
        return next
      })
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.loadLeads'))
    } finally {
      setLoading(false)
    }
  }, [filters, t, user])

  const upsertLeadInList = useCallback((lead: Lead) => {
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l.id === lead.id)
      if (idx < 0) return [lead, ...prev]
      const next = [...prev]
      next[idx] = lead
      return next
    })
    setSelectedId(lead.id)
  }, [])

  // One-shot owner snapshot heal on login — not on every filter-driven refresh.
  useEffect(() => {
    if (!user) return
    void backfillOwnLeadOwnerSnapshot().catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    void refreshLeads()
  }, [user?.id, refreshLeads])

  const selected = leads.find((l) => l.id === selectedId) ?? null

  const handleCreate = async (input: LeadInput) => {
    const lead = await createLead(input)
    setView('list')
    upsertLeadInList(lead)
    if (clientLocaleSchemaKnownMissing()) {
      setClientLocaleSchemaMissing(true)
    }
    if (linksSchemaKnownMissing()) {
      setLinksSchemaMissing(true)
    }
    if (valueEmojiSchemaKnownMissing()) {
      setValueEmojiSchemaMissing(true)
    }
    if (emailsSchemaKnownMissing()) {
      setEmailsSchemaMissing(true)
    }
    if (atlasEvalSchemaKnownMissing()) {
      setAtlasEvalSchemaMissing(true)
    }
    await refreshLeads()
    // Re-apply optimistic locale/links/emoji if reload stripped fields (columns missing).
    if (
      clientLocaleSchemaKnownMissing() ||
      linksSchemaKnownMissing() ||
      valueEmojiSchemaKnownMissing() ||
      emailsSchemaKnownMissing() ||
      atlasEvalSchemaKnownMissing()
    ) {
      upsertLeadInList(lead)
    } else {
      setSelectedId(lead.id)
    }
  }

  const handleLeadChanged = useCallback(
    (updated?: Lead) => {
      if (updated) {
        upsertLeadInList(updated)
        if (clientLocaleSchemaKnownMissing()) {
          setClientLocaleSchemaMissing(true)
        }
        if (linksSchemaKnownMissing()) {
          setLinksSchemaMissing(true)
        }
        if (valueEmojiSchemaKnownMissing()) {
          setValueEmojiSchemaMissing(true)
        }
        if (emailsSchemaKnownMissing()) {
          setEmailsSchemaMissing(true)
        }
        if (atlasEvalSchemaKnownMissing()) {
          setAtlasEvalSchemaMissing(true)
        }
      }
      void refreshLeads().then(() => {
        if (
          updated &&
          (clientLocaleSchemaKnownMissing() ||
            linksSchemaKnownMissing() ||
            valueEmojiSchemaKnownMissing() ||
            emailsSchemaKnownMissing() ||
            atlasEvalSchemaKnownMissing())
        ) {
          upsertLeadInList(updated)
        }
      })
    },
    [refreshLeads, upsertLeadInList],
  )

  const handleSignOut = async () => {
    if (demoMode) {
      window.location.href = '/'
      return
    }
    await signOut()
    setGuideOpen(false)
    setUser(null)
    setLeads([])
    setSelectedId(null)
    setView('list')
    setLoading(true)
  }

  const handleResetDemo = () => {
    resetDemoStore()
    setView('list')
    setSection('leads')
    setFocusProjectId(null)
    setFocusIdeaLeadId(null)
    setFocusIdeaProjectId(null)
    void refreshLeads()
  }

  if (!authReady) {
    return (
      <div className="crm-shell">
        <p className="crm-muted crm-boot">{t('boot.loading')}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="crm-shell">
        <div className="crm-login-lang">
          <LanguageToggle />
        </div>
        <CrmLogin
          onSuccess={() => {
            void getCurrentUser().then((u) => {
              setUser(u)
              if (u && !hasSeenCrmWelcome()) setGuideOpen(true)
            })
          }}
        />
      </div>
    )
  }

  const hotCount = leads.filter((l) => l.temperature === 'hot').length
  const openCount = leads.filter(
    (l) => l.status !== 'closed_won' && l.status !== 'closed_lost',
  ).length
  const workspaceEmpty = !loading && leads.length === 0

  const sectionTitle =
    section === 'projects'
      ? t('nav.projects')
      : section === 'time'
        ? t('nav.time')
        : section === 'ideas'
          ? t('nav.ideas')
          : t('topbar.title')

  return (
    <div className={`crm-shell${demoMode ? ' crm-shell--demo' : ''}`}>
      {demoMode && (
        <div className="crm-demo-banner" role="status">
          <strong>{t('demo.badge')}</strong>
          <span>{t('demo.banner')}</span>
          <button type="button" className="btn btn-ghost crm-demo-reset" onClick={handleResetDemo}>
            {t('demo.reset')}
          </button>
        </div>
      )}
      <header className="crm-topbar">
        <div>
          <p className="crm-kicker">{demoMode ? t('demo.kicker') : t('topbar.kicker')}</p>
          <h1 className="crm-title">{sectionTitle}</h1>
        </div>
        <div className="crm-topbar-right">
          {!demoMode && (
            <UserProfileMenu
              user={user}
              onUserChange={(next) => {
                setUser(next)
                void refreshLeads()
              }}
            />
          )}
          <LanguageToggle />
          <span className={`crm-mode-chip${demoMode ? ' crm-mode-chip--demo' : ''}`}>
            {storageMode() === 'demo'
              ? t('topbar.demo')
              : storageMode() === 'supabase'
                ? t('topbar.online')
                : t('topbar.local')}
          </span>
          <button
            type="button"
            className="btn btn-ghost crm-help-btn"
            onClick={() => setGuideOpen(true)}
            aria-label={t('topbar.helpAria')}
            title={t('topbar.helpTitle')}
          >
            <span className="crm-help-btn-icon" aria-hidden="true">
              ?
            </span>
            {t('topbar.help')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleSignOut()}>
            {demoMode ? t('demo.exit') : t('topbar.signOut')}
          </button>
          <a href="/" className="btn btn-ghost">
            {t('topbar.backSite')}
          </a>
        </div>
      </header>

      <nav className="crm-section-nav" aria-label={t('nav.aria')}>
        <div className="crm-section-tabs">
          {(
            [
              ['leads', 'nav.leads'],
              ['projects', 'nav.projects'],
              ['time', 'nav.time'],
              ['ideas', 'nav.ideas'],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              className={`crm-section-tab${section === id ? ' is-active' : ''}`}
              onClick={() => setSection(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <CrmMusicPlayer />
      </nav>

      <CrmWelcomeGuide open={guideOpen} onClose={dismissGuide} />

      {!sandboxed && ownerSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.ownerSchemaMissing')}
        </p>
      )}

      {!sandboxed && clientLocaleSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.clientLocaleSchemaMissing')}
        </p>
      )}

      {!sandboxed && linksSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.linksSchemaMissing')}
        </p>
      )}

      {!sandboxed && valueEmojiSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.valueEmojiSchemaMissing')}
        </p>
      )}

      {!sandboxed && emailsSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.emailsSchemaMissing')}
        </p>
      )}

      {!sandboxed && atlasEvalSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.atlasEvalSchemaMissing')}
        </p>
      )}

      {!sandboxed && outreachSchemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.outreachSchemaMissing')}
        </p>
      )}

      {/* Keep Leads mounted across tab switches so cards don't remount/flash. */}
      <div
        className="crm-section-panel"
        hidden={section !== 'leads'}
        aria-hidden={section !== 'leads'}
      >
          <div className="crm-stats">
            <div className="crm-stat">
              <span className="crm-stat-value">{leads.length}</span>
              <span className="crm-stat-label">{t('stats.visible')}</span>
            </div>
            <div className="crm-stat">
              <span className="crm-stat-value">{openCount}</span>
              <span className="crm-stat-label">{t('stats.open')}</span>
            </div>
            <div className="crm-stat">
              <span className="crm-stat-value">{hotCount}</span>
              <span className="crm-stat-label">{t('stats.hot')}</span>
            </div>
          </div>

          <div className="crm-toolbar">
            <input
              className="crm-input crm-search"
              type="search"
              placeholder={t('toolbar.search')}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <select
              className="crm-input"
              value={filters.status}
              aria-label={t('toolbar.stageFilter')}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as LeadStatus | 'all',
                }))
              }
            >
              <option value="all">{t('toolbar.allStages')}</option>
              {LEAD_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
            <select
              className="crm-input"
              value={filters.temperature}
              aria-label={t('toolbar.tempFilter')}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  temperature: e.target.value as LeadTemperature | 'all',
                }))
              }
            >
              <option value="all">{t('toolbar.allTemps')}</option>
              {LEAD_TEMP_VALUES.map((value) => (
                <option key={value} value={value}>
                  {tempLabel(value)}
                </option>
              ))}
            </select>
            <select
              className="crm-input"
              value={filters.owner}
              aria-label={t('toolbar.ownerFilter')}
              onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
            >
              <option value="all">{t('toolbar.allOwners')}</option>
              {ownerOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="crm-input"
              value={filters.sort}
              aria-label={t('toolbar.sort')}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sort: e.target.value as LeadSort }))
              }
            >
              <option value="updated">{t('toolbar.sortUpdated')}</option>
              <option value="owner">{t('toolbar.sortOwner')}</option>
              <option value="status">{t('toolbar.sortStatus')}</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setView(view === 'create' ? 'list' : 'create')}
            >
              {view === 'create' ? t('toolbar.backList') : t('toolbar.addLead')}
            </button>
          </div>

          {error && (
            <p className="crm-feedback crm-feedback--error" role="alert">
              {error}
            </p>
          )}

          {view === 'create' ? (
            <div className="crm-create-panel">
              <h2 className="crm-detail-title">{t('create.title')}</h2>
              <LeadForm
                onSubmit={handleCreate}
                onCancel={() => setView('list')}
              />
            </div>
          ) : (
            <div className={`crm-workspace${workspaceEmpty ? ' crm-workspace--empty' : ''}`}>
              <aside className="crm-sidebar">
                <LeadList
                  leads={leads}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  loading={loading}
                  currentUser={user}
                  staffById={staffById}
                />
              </aside>
              <main className="crm-main">
                {selected ? (
                  <LeadDetail
                    lead={selected}
                    currentUser={user}
                    staffById={staffById}
                    clientLocaleSchemaMissing={clientLocaleSchemaMissing}
                    outreachSchemaMissing={outreachSchemaMissing}
                    onChanged={handleLeadChanged}
                    onDeleted={() => {
                      setSelectedId(null)
                      void refreshLeads()
                    }}
                    onOpenProject={openProject}
                    onOpenIdeas={openIdeasForLead}
                  />
                ) : (
                  <p className="crm-empty crm-muted">{t('empty.select')}</p>
                )}
              </main>
            </div>
          )}
      </div>

      {section === 'projects' && (
        <ProjectsView
          user={user}
          staffById={staffById}
          initialProjectId={focusProjectId}
          onOpenIdeas={openIdeasForProject}
          onOpenTime={openTimeForProject}
        />
      )}

      {section === 'time' && (
        <TimeView user={user} initialProjectId={focusProjectId} />
      )}

      {section === 'ideas' && (
        <IdeasView
          initialLeadId={focusIdeaLeadId}
          initialProjectId={focusIdeaProjectId}
        />
      )}
    </div>
  )
}

export function CrmApp({ demo = false }: CrmAppProps) {
  return (
    <CrmI18nProvider demo={demo}>
      <CrmAppInner demo={demo} />
    </CrmI18nProvider>
  )
}
