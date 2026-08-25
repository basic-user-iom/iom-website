import { PRODUCT } from './productConfig'
import type { ScreenHotspot } from './types'

type Props = {
  point: ScreenHotspot | undefined
  onExplore: () => void
}

export function ExploreCue({ point, onExplore }: Props) {
  if (!point?.visible) return null

  return (
    <div className="pov-explore-cue">
      <button
        type="button"
        className="pov-explore-cue__hit"
        style={{ left: point.x, top: point.y }}
        onClick={onExplore}
        aria-label={`${PRODUCT.primaryAction}. ${PRODUCT.exploreCueHint}`}
      >
        <span className="pov-explore-cue__pill">
          <span className="pov-explore-cue__label">{PRODUCT.primaryAction}</span>
          <span className="pov-explore-cue__hint">
            <span className="pov-explore-cue__hint-mouse">{PRODUCT.exploreCueHint}</span>
            <span className="pov-explore-cue__hint-touch">{PRODUCT.exploreCueHintTouch}</span>
          </span>
        </span>
      </button>
    </div>
  )
}
