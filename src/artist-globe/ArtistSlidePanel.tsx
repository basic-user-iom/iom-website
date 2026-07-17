import type { Artist } from './types'
import { CATEGORY_LABELS } from './types'

interface ArtistSlidePanelProps {
  artist: Artist
  recent: Artist[]
  onClose: () => void
  onOpenPortfolio: () => void
  onSelectArtist: (id: string) => void
}

export function ArtistSlidePanel({
  artist,
  recent,
  onClose,
  onOpenPortfolio,
  onSelectArtist,
}: ArtistSlidePanelProps) {
  const idx = recent.findIndex((a) => a.id === artist.id)
  const prev =
    idx > 0 ? recent[idx - 1] : recent.length > 1 ? recent[recent.length - 1] : null
  const next =
    idx >= 0 && idx < recent.length - 1
      ? recent[idx + 1]
      : recent.length > 1
        ? recent[0]
        : null

  const links = [
    artist.email && { label: artist.email, href: `mailto:${artist.email}` },
    artist.links.website && { label: 'Website', href: artist.links.website },
    artist.links.instagram && { label: 'Instagram', href: artist.links.instagram },
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <aside className="ag-slide" aria-label={`${artist.displayName} details`}>
      <div className="ag-slide-inner">
        <header className="ag-slide-top">
          <button type="button" className="ag-btn" onClick={onClose}>
            Close
          </button>
          <div className="ag-slide-nav">
            <button
              type="button"
              className="ag-btn"
              disabled={!prev || prev.id === artist.id}
              onClick={() => prev && onSelectArtist(prev.id)}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="ag-btn"
              disabled={!next || next.id === artist.id}
              onClick={() => next && onSelectArtist(next.id)}
            >
              Next →
            </button>
          </div>
        </header>

        <p className="ag-slide-cat">{CATEGORY_LABELS[artist.category]}</p>
        <h2 className="ag-slide-name">{artist.displayName}</h2>
        <p className="ag-slide-loc">
          {artist.city}
          {artist.country ? `, ${artist.country}` : ''}
        </p>

        {artist.bio ? <p className="ag-slide-bio">{artist.bio}</p> : null}

        {artist.tags.length > 0 ? (
          <ul className="ag-card-tags">
            {artist.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}

        {links.length > 0 ? (
          <div className="ag-slide-contact">
            <span className="ag-filter-label">Contact</span>
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target={l.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noreferrer"
              >
                {l.label}
              </a>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="ag-btn ag-btn-primary ag-slide-cta"
          onClick={onOpenPortfolio}
        >
          Open portfolio{artist.portfolio?.length ? ` (${artist.portfolio.length})` : ''}
        </button>
      </div>
    </aside>
  )
}
