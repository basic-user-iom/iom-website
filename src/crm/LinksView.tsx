import { useMemo, useState } from 'react'
import { useCrmI18n } from './i18n'
import {
  LINK_CATEGORIES,
  USEFUL_LINKS,
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
}: {
  link: UsefulLink
  t: (key: string) => string
  copiedId: string | null
  onCopy: (link: UsefulLink) => void
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
        <p className="crm-links-item-note">{link.note}</p>
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
      </div>
    </li>
  )
}

export function LinksView() {
  const { t } = useCrmI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return USEFUL_LINKS.filter((link) => {
      if (filter !== 'all' && link.category !== filter) return false
      return matchesQuery(link, normalizedQuery)
    })
  }, [filter, normalizedQuery])

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
    for (const link of USEFUL_LINKS) {
      if (!matchesQuery(link, normalizedQuery)) continue
      map.all += 1
      map[link.category] += 1
    }
    return map
  }, [normalizedQuery])

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

  return (
    <div className="crm-links-view">
      <header className="crm-links-header">
        <p className="crm-links-kicker">{t('links.kicker')}</p>
        <h2 className="crm-links-title">{t('links.title')}</h2>
        <p className="crm-links-intro">{t('links.intro')}</p>
      </header>

      <div className="crm-links-toolbar">
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

      {filtered.length === 0 ? (
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
            />
          ))}
        </ul>
      )}
    </div>
  )
}
