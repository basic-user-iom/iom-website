import type { CameraPresetId, LightingPresetId } from './types'

type Props = {
  autoRotate: boolean
  lighting: LightingPresetId
  motion: boolean
  pbr: boolean
  lookOpen: boolean
  exploded: boolean
  hasMotion: boolean
  hasExploded: boolean
  fullscreen: boolean
  onAutoRotate: (value: boolean) => void
  onLighting: (value: LightingPresetId) => void
  onMotion: (value: boolean) => void
  onPbr: (value: boolean) => void
  onLookOpen: () => void
  onExploded: (value: boolean) => void
  onReset: () => void
  onPreset: (id: CameraPresetId) => void
  onFullscreen: () => void
}

const PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'detail', label: 'Detail' },
  { id: 'top', label: 'Top' },
  { id: 'hero', label: 'Hero' },
]

export function ViewerControls({
  autoRotate,
  lighting,
  motion,
  pbr,
  lookOpen,
  exploded,
  hasMotion,
  hasExploded,
  fullscreen,
  onAutoRotate,
  onLighting,
  onMotion,
  onPbr,
  onLookOpen,
  onExploded,
  onReset,
  onPreset,
  onFullscreen,
}: Props) {
  return (
    <div className="pov-controls" role="toolbar" aria-label="Object viewer controls">
      <div className="pov-controls__group">
        <span className="pov-controls__label">View</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pov-chip"
            onClick={() => onPreset(preset.id)}
            aria-label={`Camera ${preset.label}`}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className="pov-chip" onClick={onReset} aria-label="Reset camera">
          Reset
        </button>
      </div>

      <div className="pov-controls__group">
        <span className="pov-controls__label">Light</span>
        <button
          type="button"
          className={lighting === 'studio' ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={lighting === 'studio'}
          onClick={() => onLighting('studio')}
        >
          Studio
        </button>
        <button
          type="button"
          className={lighting === 'detail' ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={lighting === 'detail'}
          onClick={() => onLighting('detail')}
        >
          Detail
        </button>
        <button
          type="button"
          className={pbr ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={pbr}
          onClick={() => onPbr(!pbr)}
        >
          PBR
        </button>
        <button
          type="button"
          className={lookOpen ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={lookOpen}
          onClick={onLookOpen}
        >
          Look
        </button>
      </div>

      <div className="pov-controls__group">
        <button
          type="button"
          className={autoRotate ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={autoRotate}
          onClick={() => onAutoRotate(!autoRotate)}
        >
          Auto-rotate
        </button>
        {hasMotion ? (
          <button
            type="button"
            className={motion ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={motion}
            onClick={() => onMotion(!motion)}
          >
            Motion
          </button>
        ) : null}
        {hasExploded ? (
          <button
            type="button"
            className={exploded ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={exploded}
            onClick={() => onExploded(!exploded)}
          >
            {exploded ? 'Assembled' : 'Inspect mechanism'}
          </button>
        ) : null}
        <button
          type="button"
          className="pov-chip"
          onClick={onFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullscreen ? 'Exit' : 'Fullscreen'}
        </button>
      </div>
    </div>
  )
}
