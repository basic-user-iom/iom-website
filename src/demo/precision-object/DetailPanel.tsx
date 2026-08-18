import { HOTSPOTS } from './productConfig'

type Props = {
  activeId: string | null
  onClose: () => void
}

export function DetailPanel({ activeId, onClose }: Props) {
  const hotspot = HOTSPOTS.find((item) => item.id === activeId) ?? null
  if (!hotspot) return null

  return (
    <aside
      className="pov-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="pov-detail-title"
    >
      <div className="pov-detail__bar">
        <p className="pov-detail__index">{hotspot.label}</p>
        <button type="button" className="pov-detail__close" onClick={onClose} aria-label="Close detail">
          Close
        </button>
      </div>
      <h2 id="pov-detail-title" className="pov-detail__title">
        {hotspot.title}
      </h2>
      <p className="pov-detail__body">{hotspot.body}</p>
    </aside>
  )
}
