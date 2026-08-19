import { PRODUCT } from './productConfig'
import type { ScreenHotspot } from './types'

type Props = {
  point: ScreenHotspot | undefined
  onExplore: () => void
}

export function ExploreCue({ point, onExplore }: Props) {
  if (!point?.visible) return null
  const flip = typeof window === 'undefined' || point.x > 160

  return (
    <div className="pov-explore-cue">
      <button
        type="button"
        className={flip ? 'pov-explore-cue__hit is-flip' : 'pov-explore-cue__hit'}
        style={{ left: point.x, top: point.y }}
        onClick={onExplore}
      >
        <span className="pov-explore-cue__marker" aria-hidden="true" />
        <span className="pov-explore-cue__leader" aria-hidden="true" />
        <span className="pov-explore-cue__pill">{PRODUCT.primaryAction}</span>
      </button>
    </div>
  )
}
