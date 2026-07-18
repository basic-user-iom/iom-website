import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCrmI18n } from './i18n'
import {
  createUsefulLink,
  deleteUsefulLink,
  listUsefulLinks,
} from './linksApi'
import {
  LINK_CATEGORIES,
  type LinkCategory,
  type UsefulLink,
} from './linksCatalog'

type Filter = 'all' | LinkCategory

function categoryLabel(category: LinkCategory, t: (key: string) => string): string {
  return t(`links.category.${category}`)
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function matchesQuery(link: UsefulLink, query: string): boolean {
  if (!query) return true
  const haystack = [
    link.title,
    link.note,
    link.url,
    link.category,
    ...(link.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function LinkRow({
  link,
  t,
  copiedId,
  onCopy,
  onRemove,
  removing,
}: {
  link: UsefulLink
  t: (key: string) => string
  copiedId: string | null
  onCopy: (link: UsefulLink) => void
  onRemove: (link: UsefulLink) => void
  removing: boolean
}) {
  return (
    <li className="crm-links-item">
      <div className="crm-links-item-main">
        <div className="crm-links-item-top">
          <span className={`crm-links-badge crm-links-badge--${link.category}`}>
            {categoryLabel(link.category, t)}
          </span>
          <a
            className="crm-links-item-title"
            href={link.url}
            target="_blank"
            rel="noreferrer"
          >
            {link.title}
          </a>
        </div>
        {link.note ? <p className="crm-links-item-note">{link.note}</p> : null}
        <p className="crm-links-item-host">{hostname(link.url)}</p>
      </div>
      <div className="crm-links-item-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onCopy(link)}
        >
          {copiedId === link.id ? t('links.copied') : t('links.copy')}
        </button>
        <a
          className="btn btn-primary crm-links-open"
          href={link.url}
          target="_blank"
          rel="noreferrer"
        >
          {t('links.open')}
        </a>
        <button
          type="button"
          className="btn btn-ghost crm-links-remove"
          disabled={removing}
          onClick={() => onRemove(link)}
        >
          {t('links.remove')}
        </button>
      </div>
    </li>
  )
}

interface LinksViewProps {
  /** Public sandbox — sample bookmarks only. */
  demo?: boolean
}

export function LinksView({ demo = false }: LinksViewProps) {
  const { t } = useCrmI18n()
  const [catalog, setCatalog] = useState<UsefulLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [draftCategory, setDraftCategory] = useState<LinkCategory>('webpage')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCatalog(await listUsefulLinks())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('links.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const normalizedQuery = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return catalog.filter((link) => {
      if (filter !== 'all' && link.category !== filter) return false
      return matchesQuery(link, normalizedQuery)
    })
  }, [catalog, filter, normalizedQuery])

  const grouped = useMemo(() => {
    if (filter !== 'all') return null
    return LINK_CATEGORIES.map((category) => ({
      category,
      links: filtered.filter((link) => link.category === category),
    })).filter((group) => group.links.length > 0)
  }, [filter, filtered])

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: 0,
      youtube: 0,
      webpage: 0,
      forum: 0,
      blog: 0,
    }
    for (const link of catalog) {
      if (!matchesQuery(link, normalizedQuery)) continue
      map.all += 1
      map[link.category] += 1
    }
    return map
  }, [catalog, normalizedQuery])

  async function handleCopy(link: UsefulLink) {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiedId(link.id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === link.id ? null : current))
      }, 1600)
    } catch {
      // Clipboard can fail in restricted contexts — ignore quietly.
    }
  }

  async function handleRemove(link: UsefulLink) {
    if (!confirm(t('links.deleteConfirm', { name: link.title }))) return
    setRemovingId(link.id)
    setError('')
    try {
      await deleteUsefulLink(link.id)
      setCatalog((prev) => prev.filter((item) => item.id !== link.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('links.deleteFailed'))
    } finally {
      setRemovingId(null)
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setAdding(true)
    setError('')
    try {
      const created = await createUsefulLink({
        title: draftTitle,
        url: draftUrl,
        category: draftCategory,
        note: draftNote,
      })
      setCatalog((prev) => [created, ...prev])
      setDraftTitle('')
      setDraftUrl('')
      setDraftNote('')
      setDraftCategory('webpage')
      setFormOpen(false)
      setFilter('all')
      setQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('links.createFailed'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="crm-links-view">
      <header className="crm-links-header">
        <p className="crm-links-kicker">
          {demo ? t('links.kickerDemo') : t('links.kicker')}
        </p>
        <h2 className="crm-links-title">{t('links.title')}</h2>
        <p className="crm-links-intro">
          {demo ? t('links.introDemo') : t('links.intro')}
        </p>
      </header>

      <div className="crm-links-toolbar">
        <div className="crm-links-toolbar-row">
          <label className="crm-links-search">
            <span className="crm-sr-only">{t('links.searchAria')}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('links.searchPlaceholder')}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? t('links.cancelAdd') : t('links.add')}
          </button>
        </div>

        {formOpen ? (
          <form className="crm-links-form" onSubmit={(event) => void handleAdd(event)}>
            <input
              className="crm-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={t('links.form.title')}
              required
              autoFocus
            />
            <input
              className="crm-input"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder={t('links.form.url')}
              required
              inputMode="url"
            />
            <select
              className="crm-input"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value as LinkCategory)}
              aria-label={t('links.form.category')}
            >
              {LINK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category, t)}
                </option>
              ))}
            </select>
            <input
              className="crm-input crm-links-form-note"
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder={t('links.form.note')}
            />
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? t('links.saving') : t('links.save')}
            </button>
          </form>
        ) : null}

        <div className="crm-links-filters" role="tablist" aria-label={t('links.filtersAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`crm-links-filter${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('links.filter.all')}
            <span className="crm-links-filter-count">{counts.all}</span>
          </button>
          {LINK_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={filter === category}
              className={`crm-links-filter${filter === category ? ' is-active' : ''}`}
              onClick={() => setFilter(category)}
            >
              {categoryLabel(category, t)}
              <span className="crm-links-filter-count">{counts[category]}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="crm-links-empty">{t('links.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="crm-links-empty">
          {normalizedQuery ? t('links.emptySearch') : t('links.empty')}
        </p>
      ) : grouped ? (
        <div className="crm-links-groups">
          {grouped.map((group) => (
            <section key={group.category} className="crm-links-group">
              <h3 className="crm-links-group-title">
                {categoryLabel(group.category, t)}
                <span className="crm-links-filter-count">{group.links.length}</span>
              </h3>
              <ul className="crm-links-list">
                {group.links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    t={t}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onRemove={handleRemove}
                    removing={removingId === link.id}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="crm-links-list">
          {filtered.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              t={t}
              copiedId={copiedId}
              onCopy={handleCopy}
              onRemove={handleRemove}
              removing={removingId === link.id}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
