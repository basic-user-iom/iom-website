import { STORY } from './productConfig'
import type { CameraPresetId } from './types'

type Props = {
  onFocus: (preset: CameraPresetId, hotspotId?: string) => void
}

export function StorySection({ onFocus }: Props) {
  return (
    <section className="pov-story" id="narrative" aria-labelledby="pov-story-title">
      <div className="pov-story__intro">
        <p className="pov-eyebrow">Product language</p>
        <h2 id="pov-story-title">Made to be inspected.</h2>
        <p className="pov-story__lead">
          A precision object is understood through material, form and mechanism — not through a
          single hero photograph. This study keeps those readings in one place.
        </p>
      </div>
      <ol className="pov-story__list">
        {STORY.map((item) => (
          <li key={item.id} className="pov-story__item">
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <button
              type="button"
              className="pov-text-link"
              onClick={() => onFocus(item.cameraPreset, item.hotspotId)}
            >
              {item.actionLabel}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
