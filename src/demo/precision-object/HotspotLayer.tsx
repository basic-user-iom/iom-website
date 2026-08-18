import { HOTSPOTS } from './productConfig'
import type { ScreenHotspot } from './types'

type Props = {
  points: ScreenHotspot[]
  activeId: string | null
  visible: boolean
  placing?: boolean
  onSelect: (id: string) => void
}

export function HotspotLayer({ points, activeId, visible, placing = false, onSelect }: Props) {
  if (!visible) return null

  return (
    <div className={placing ? 'pov-hotspots is-placing' : 'pov-hotspots'} aria-hidden={false}>
      {HOTSPOTS.map((hotspot) => {
        const point = points.find((p) => p.id === hotspot.id)
        if (!point || !point.visible) return null
        const active = hotspot.id === activeId
        return (
          <button
            key={hotspot.id}
            type="button"
            className={active ? 'pov-hotspot is-active' : 'pov-hotspot'}
            style={{ left: point.x, top: point.y }}
            aria-label={`${hotspot.label}. ${hotspot.title}`}
            aria-pressed={active}
            tabIndex={placing ? -1 : 0}
            onClick={() => onSelect(hotspot.id)}
          >
            <span className="pov-hotspot__dot" />
            <span className="pov-hotspot__label">{hotspot.label}</span>
          </button>
        )
      })}
    </div>
  )
}
