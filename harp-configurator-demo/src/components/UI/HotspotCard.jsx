import { HOTSPOTS } from '../../config/productConfig.js'
import { useViewer } from '../../hooks/useViewer.js'
import { Icons } from './Icons.jsx'

export function HotspotCard() {
  const hotspot = useViewer((state) => state.hotspot)
  const closeHotspot = useViewer((state) => state.closeHotspot)
  const item = HOTSPOTS.find((entry) => entry.id === hotspot)

  if (!item) return null

  return (
    <article className="hotspot-card" aria-live="polite">
      <button type="button" className="icon-btn overlay-close" onClick={closeHotspot} aria-label="Close hotspot">
        <Icons.Close />
      </button>
      <p className="kicker">{item.kicker}</p>
      <h2>{item.label}</h2>
      <p>{item.body}</p>
      {item.facts?.length > 0 && (
        <ul className="hotspot-facts">
          {item.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {item.related && (
        <p className="hotspot-related">
          <span>Related options</span>
          {item.related}
        </p>
      )}
      <button type="button" className="text-btn" onClick={closeHotspot}>
        Return to view
      </button>
    </article>
  )
}
