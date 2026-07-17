import type { Artist } from './types'
import { CATEGORY_LABELS } from './types'

interface ArtistCardProps {
  artist: Artist
  onClose: () => void
  onOpenPortfolio: () => void
}

export function ArtistCard({ artist, onClose, onOpenPortfolio }: ArtistCardProps) {
  const links = [
    artist.links.website && { label: 'Website', href: artist.links.website },
    artist.links.instagram && { label: 'Instagram', href: artist.links.instagram },
  ].filter(Boolean) as { label: string; href: string }[]

  const workCount = artist.portfolio?.length ?? 0

  return (
    <aside className="ag-card" aria-label={`${artist.displayName} profile`}>
      <button type="button" className="ag-card-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="ag-card-cat">{CATEGORY_LABELS[artist.category]}</p>
      <h2 className="ag-card-name">{artist.displayName}</h2>
      <p className="ag-card-loc">
        {artist.city}
        {artist.country ? `, ${artist.country}` : ''}
      </p>
      {artist.bio ? <p className="ag-card-bio">{artist.bio}</p> : null}
      {artist.tags.length > 0 ? (
        <ul className="ag-card-tags">
          {artist.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="ag-btn ag-btn-primary ag-card-portfolio-btn" onClick={onOpenPortfolio}>
        Open portfolio{workCount ? ` (${workCount})` : ''}
      </button>
      {links.length > 0 ? (
        <div className="ag-card-links">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
