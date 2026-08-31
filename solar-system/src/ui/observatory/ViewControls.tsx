import type { RenderScaleMode } from '../../rendering/RenderScaleModel';
import {
  CAMERA_CLOSE_UP_PRESETS,
  type CameraCloseUpPresetId,
} from '../../rendering/camera';
import type {
  VenusSurfaceMode,
  VisualQuality,
} from '../../rendering/bodies/VisualQuality';
import type {
  ObservatoryCameraMode,
  SelectedTrailInterval,
} from '../../state/useAppStore';

export interface ViewControlsProps {
  readonly cameraMode: ObservatoryCameraMode;
  readonly renderScaleMode: RenderScaleMode;
  readonly visualQuality?: VisualQuality;
  readonly venusSurfaceMode?: VenusSurfaceMode;
  readonly activeCloseUpPresetId?: CameraCloseUpPresetId | null;
  readonly presentationWarningRequired: boolean;
  readonly selectedTrailInterval: SelectedTrailInterval;
  readonly disabled?: boolean;
  readonly onCameraModeChange: (mode: ObservatoryCameraMode) => void;
  readonly onRenderScaleModeChange: (mode: RenderScaleMode) => void;
  readonly onVisualQualityChange?: (quality: VisualQuality) => void;
  readonly onVenusSurfaceModeChange?: (mode: VenusSurfaceMode) => void;
  readonly onCloseUpPresetSelect?: (presetId: CameraCloseUpPresetId) => void;
  readonly onSelectedTrailIntervalChange: (interval: SelectedTrailInterval) => void;
}

const CAMERA_OPTIONS: readonly Readonly<{
  id: ObservatoryCameraMode;
  label: string;
  description: string;
}>[] = Object.freeze([
  Object.freeze({
    id: 'overview',
    label: 'Overview',
    description: 'Frame the planetary system from above the ecliptic.',
  }),
  Object.freeze({
    id: 'free-orbit',
    label: 'Free orbit',
    description: 'Orbit, pan, and dolly around the selected target.',
  }),
  Object.freeze({
    id: 'body-follow',
    label: 'Body follow',
    description: 'Preserve a stable offset while the target moves.',
  }),
  Object.freeze({
    id: 'earth-moon-system',
    label: 'Earth–Moon system',
    description: 'Frame Earth and the Moon together from ecliptic north.',
  }),
  Object.freeze({
    id: 'top-down-ecliptic',
    label: 'Top-down',
    description: 'Lock ecliptic north above the selected target.',
  }),
  Object.freeze({
    id: 'chase',
    label: 'Velocity chase',
    description: 'Look forward from behind the target velocity vector.',
  }),
]);

export function ViewControls({
  cameraMode,
  renderScaleMode,
  visualQuality = 'high',
  venusSurfaceMode = 'clouds',
  activeCloseUpPresetId = null,
  presentationWarningRequired,
  selectedTrailInterval,
  disabled = false,
  onCameraModeChange,
  onRenderScaleModeChange,
  onVisualQualityChange = () => undefined,
  onVenusSurfaceModeChange = () => undefined,
  onCloseUpPresetSelect = () => undefined,
  onSelectedTrailIntervalChange,
}: ViewControlsProps) {
  const activeCamera = CAMERA_OPTIONS.find((option) => option.id === cameraMode);

  return (
    <section
      className="control-panel view-controls"
      aria-labelledby="view-controls-heading"
      data-testid="view-controls"
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Camera and scale</p>
          <h2 id="view-controls-heading">Frame the system</h2>
        </div>
        <span className="direction-readout">{activeCamera?.label ?? cameraMode}</span>
      </div>

      <label className="field-stack" htmlFor="camera-mode">
        <span>Camera mode</span>
        <select
          id="camera-mode"
          value={cameraMode}
          disabled={disabled}
          data-testid="camera-mode-select"
          aria-describedby="camera-mode-help"
          onChange={(event) =>
            onCameraModeChange(event.currentTarget.value as ObservatoryCameraMode)
          }
        >
          {CAMERA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help" id="camera-mode-help">{activeCamera?.description}</p>

      <fieldset
        className="scale-mode-controls"
        disabled={disabled}
        aria-describedby="close-up-preset-help"
      >
        <legend>Close-up presets</legend>
        <div className="segmented-row" data-testid="camera-close-up-presets">
          <button
            type="button"
            aria-pressed={cameraMode === 'earth-moon-system'}
            data-testid="camera-earth-moon-system"
            title="Frame Earth and the Moon together without changing their orbital positions."
            aria-label="Earth and Moon system view: frame both bodies with linear orbital positions."
            onClick={() => onCameraModeChange('earth-moon-system')}
          >
            Earth + Moon
          </button>
          {CAMERA_CLOSE_UP_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activeCloseUpPresetId === preset.id}
              data-testid={`camera-preset-${preset.id}`}
              title={preset.description}
              aria-label={`${preset.id === 'jupiter-great-red-spot' ? 'Jupiter Great Red Spot' : 'Saturn rings'} close-up: ${preset.description}`}
              onClick={() => onCloseUpPresetSelect(preset.id)}
            >
              {preset.id === 'jupiter-great-red-spot' ? 'Jupiter GRS' : 'Saturn rings'}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="field-help" id="close-up-preset-help">
        Frame Earth with its Moon, track Jupiter's body-fixed storm, or view Saturn's ring plane.
      </p>

      <label className="field-stack" htmlFor="visual-quality">
        <span>Visual quality</span>
        <select
          id="visual-quality"
          value={visualQuality}
          disabled={disabled}
          data-testid="visual-quality-select"
          aria-describedby="visual-quality-help"
          onChange={(event) =>
            onVisualQualityChange(event.currentTarget.value as VisualQuality)
          }
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="ultra">Ultra</option>
        </select>
      </label>
      <p className="field-help" id="visual-quality-help">
        Controls texture detail, atmosphere integration, and solar-corona complexity.
      </p>

      <fieldset
        className="scale-mode-controls"
        disabled={disabled}
        aria-describedby="venus-display-help"
      >
        <legend>Venus display</legend>
        <div className="segmented-row" data-testid="venus-surface-controls">
          <button
            type="button"
            aria-pressed={venusSurfaceMode === 'clouds'}
            data-testid="venus-clouds-button"
            onClick={() => onVenusSurfaceModeChange('clouds')}
          >
            Clouds
          </button>
          <button
            type="button"
            aria-pressed={venusSurfaceMode === 'radar'}
            data-testid="venus-radar-button"
            onClick={() => onVenusSurfaceModeChange('radar')}
          >
            Radar surface
          </button>
        </div>
      </fieldset>
      <p className="field-help" id="venus-display-help">
        Radar mode is an authoritative data view beneath Venus’ opaque cloud deck.
      </p>

      <fieldset className="scale-mode-controls" disabled={disabled} aria-describedby="scale-mode-help">
        <legend>Render scale</legend>
        <div className="segmented-row" data-testid="render-scale-controls">
          <button
            type="button"
            aria-pressed={renderScaleMode === 'true'}
            aria-keyshortcuts="S"
            onClick={() => onRenderScaleModeChange('true')}
          >
            True scale
          </button>
          <button
            type="button"
            aria-pressed={renderScaleMode === 'presentation'}
            aria-keyshortcuts="S"
            onClick={() => onRenderScaleModeChange('presentation')}
          >
            Presentation
          </button>
        </div>
      </fieldset>

      <fieldset
        className="scale-mode-controls"
        disabled={disabled}
        aria-describedby="trail-interval-help"
      >
        <legend>Selected-body trail interval</legend>
        <div className="segmented-row" data-testid="trail-interval-controls">
          <button
            type="button"
            aria-pressed={selectedTrailInterval === 'previous'}
            onClick={() => onSelectedTrailIntervalChange('previous')}
          >
            Previous
          </button>
          <button
            type="button"
            aria-pressed={selectedTrailInterval === 'next'}
            onClick={() => onSelectedTrailIntervalChange('next')}
          >
            Next
          </button>
        </div>
      </fieldset>
      <p className="field-help" id="trail-interval-help">
        Draw the sampled interval immediately before or after the current epoch.
      </p>

      {presentationWarningRequired ? (
        <p
          className="scale-warning"
          id="scale-mode-help"
          role="status"
          data-testid="presentation-scale-warning"
        >
          Body sizes are exaggerated. Earth and Moon share a 40× radius scale; all orbital
          positions remain linearly scaled.
        </p>
      ) : (
        <p className="true-scale-note" id="scale-mode-help" data-testid="true-scale-note">
          Physical radius-to-distance ratios are preserved; most planets are subpixel in overview.
        </p>
      )}
    </section>
  );
}
