import { type FormEvent, useMemo, useState } from 'react';

import type {
  ObservatoryCameraMode,
  SelectedTrailInterval,
  SimulationDirection,
  SimulationUiSnapshot,
} from '../../state/useAppStore';
import type { RenderScaleMode } from '../../rendering/RenderScaleModel';
import {
  findMatchingPreset,
  formatTimeScale,
  LOG_SPEED_MAX,
  LOG_SPEED_MIN,
  PHASE_ONE_TIME_PRESETS,
  type TimePresetView,
} from './timeControlModel';
import {
  logValueToTimeScale,
  timeScaleToLogValue,
} from '../../simulation/core/TimePresets';

const TIMELINE_START_UTC_MS = Date.UTC(2000, 0, 1, 0, 0, 0);
const TIMELINE_END_UTC_MS = Date.UTC(2100, 0, 1, 0, 0, 0);
const MILLISECONDS_PER_DAY = 86_400_000;
const TIMELINE_DAY_COUNT = Math.round(
  (TIMELINE_END_UTC_MS - TIMELINE_START_UTC_MS) / MILLISECONDS_PER_DAY,
);

export interface SimulationControlPort {
  setPaused(paused: boolean): void;
  setDirection(direction: SimulationDirection): void;
  setTimeScale(timeScale: number): void;
  setExactDateUtc(isoUtc: string): void;
  applyPreset(preset: TimePresetView): void;
  selectBody(bodyId: string): void;
  focusBody(bodyId: string): void;
  rebaseToBody(bodyId: string): void;
  setCameraMode(mode: ObservatoryCameraMode): void;
  setRenderScaleMode(mode: RenderScaleMode): void;
  setOrbitLinesVisible(visible: boolean): void;
  setBodyLabelsVisible(visible: boolean): void;
  setSelectedTrailInterval(interval: SelectedTrailInterval): void;
}

export interface DebugBodyControlOption {
  readonly id: string;
  readonly displayName: string;
}

export interface DebugTimeControlsProps {
  readonly snapshot: Readonly<SimulationUiSnapshot>;
  readonly controls: SimulationControlPort;
  readonly bodyOptions: readonly DebugBodyControlOption[];
  readonly selectedBodyId: string;
  readonly disabled?: boolean;
}

export function DebugTimeControls({
  snapshot,
  controls,
  bodyOptions,
  selectedBodyId,
  disabled = false,
}: DebugTimeControlsProps) {
  const [dateInput, setDateInput] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const displayedDateInput = dateInput ?? toDateTimeInput(snapshot.currentUtcIso);
  const activeBodyId = bodyOptions.some((body) => body.id === selectedBodyId)
    ? selectedBodyId
    : (bodyOptions[0]?.id ?? 'sun');
  const activeBodyName =
    bodyOptions.find((body) => body.id === activeBodyId)?.displayName ?? activeBodyId;

  const selectedPreset = useMemo(
    () => findMatchingPreset(snapshot),
    [snapshot],
  );
  const sliderValue = timeScaleToLogValue(snapshot.timeScale);
  const directionWord = snapshot.direction === -1 ? 'reverse' : 'forward';
  const currentUtcMs = Date.parse(snapshot.currentUtcIso);
  const timelineDay = Number.isFinite(currentUtcMs)
    ? Math.min(
        TIMELINE_DAY_COUNT,
        Math.max(0, Math.round((currentUtcMs - TIMELINE_START_UTC_MS) / MILLISECONDS_PER_DAY)),
      )
    : 0;

  const submitDate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedIso = parseUtcInput(displayedDateInput);
    if (parsedIso === null) {
      setDateError('Enter a valid UTC date and time.');
      return;
    }

    setDateError(null);
    setDateInput(null);
    controls.setExactDateUtc(parsedIso);
  };

  return (
    <section
      className="control-panel time-controls"
      data-testid="simulation-time-controls"
      aria-labelledby="time-controls-heading"
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Simulation clock</p>
          <h2 id="time-controls-heading">Travel through time</h2>
        </div>
        <span className="direction-readout" data-direction={directionWord}>
          {snapshot.paused ? 'Paused' : directionWord}
        </span>
      </div>

      <div className="epoch-timeline" data-testid="epoch-timeline">
        <div className="speed-label-row">
          <label htmlFor="epoch-scrubber">Ephemeris timeline</label>
          <output htmlFor="epoch-scrubber">{formatTimelineDate(snapshot.currentUtcIso)}</output>
        </div>
        <input
          id="epoch-scrubber"
          type="range"
          min="0"
          max={TIMELINE_DAY_COUNT}
          step="1"
          value={timelineDay}
          disabled={disabled}
          aria-describedby="epoch-scrubber-help"
          aria-valuetext={formatTimelineDate(snapshot.currentUtcIso)}
          onChange={(event) => {
            const nextUtcMs =
              TIMELINE_START_UTC_MS +
              Number(event.currentTarget.value) * MILLISECONDS_PER_DAY;
            controls.setExactDateUtc(new Date(nextUtcMs).toISOString());
          }}
        />
        <div className="range-extents" id="epoch-scrubber-help">
          <span>2000</span>
          <span>Bundled JPL coverage</span>
          <span>2100</span>
        </div>
      </div>

      <form className="exact-time-form" onSubmit={submitDate}>
        <label htmlFor="exact-utc-time">Exact date and time · UTC</label>
        <div className="input-action-row">
          <input
            id="exact-utc-time"
            type="datetime-local"
            step="1"
            value={displayedDateInput}
            disabled={disabled}
            onFocus={() => setDateInput(displayedDateInput)}
            onChange={(event) => {
              setDateInput(event.currentTarget.value);
              setDateError(null);
            }}
          />
          <button className="button button-secondary" type="submit" disabled={disabled}>
            Set UTC
          </button>
        </div>
        {dateError === null ? null : (
          <p className="field-error" role="alert">
            {dateError}
          </p>
        )}
      </form>

      <div className="transport-row" aria-label="Playback controls">
        <button
          className="button button-primary"
          type="button"
          disabled={disabled}
          aria-label={snapshot.paused ? 'Run simulation' : 'Pause simulation'}
          aria-keyshortcuts="Space"
          onClick={() => controls.setPaused(!snapshot.paused)}
        >
          <span aria-hidden="true">{snapshot.paused ? '▶' : 'Ⅱ'}</span>
          {snapshot.paused ? 'Run' : 'Pause'}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={disabled}
          aria-pressed={snapshot.direction === -1}
          aria-keyshortcuts="R"
          onClick={() => controls.setDirection(snapshot.direction === 1 ? -1 : 1)}
        >
          Reverse
        </button>
      </div>

      <label className="field-stack" htmlFor="time-preset">
        <span>Speed preset</span>
        <select
          id="time-preset"
          value={selectedPreset}
          disabled={disabled}
          onChange={(event) => {
            const preset = PHASE_ONE_TIME_PRESETS.find(
              (candidate) => candidate.id === event.currentTarget.value,
            );
            if (preset !== undefined) {
              controls.applyPreset(preset);
            }
          }}
        >
          {selectedPreset === 'custom' ? <option value="custom">Custom speed</option> : null}
          {PHASE_ONE_TIME_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>

      <div className="speed-control">
        <div className="speed-label-row">
          <label htmlFor="log-speed">Logarithmic speed</label>
          <output htmlFor="log-speed">
            {snapshot.direction === -1 ? '−' : ''}
            {formatTimeScale(snapshot.timeScale)}
          </output>
        </div>
        <input
          id="log-speed"
          type="range"
          min={LOG_SPEED_MIN}
          max={LOG_SPEED_MAX}
          step="0.01"
          value={sliderValue}
          disabled={disabled}
          aria-describedby="log-speed-extents"
          aria-valuetext={`${directionWord}, ${formatTimeScale(snapshot.timeScale)}`}
          onChange={(event) =>
            controls.setTimeScale(logValueToTimeScale(Number(event.currentTarget.value)))
          }
        />
        <div className="range-extents" id="log-speed-extents">
          <span>1×</span>
          <span>10 years / second</span>
        </div>
      </div>

      <fieldset className="focus-controls" disabled={disabled}>
        <legend>Camera and render origin</legend>
        <label className="field-stack body-target-field" htmlFor="debug-body-target">
          <span>Target body</span>
          <select
            id="debug-body-target"
            value={activeBodyId}
            onChange={(event) => controls.selectBody(event.currentTarget.value)}
          >
            {bodyOptions.map((body) => (
              <option key={body.id} value={body.id}>
                {body.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented-row">
          <button type="button" onClick={() => controls.focusBody(activeBodyId)}>
            Focus {activeBodyName}
          </button>
          <button type="button" onClick={() => controls.rebaseToBody(activeBodyId)}>
            Rebase {activeBodyName}
          </button>
        </div>
      </fieldset>
    </section>
  );
}

function toDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 19);
}

function parseUtcInput(input: string): string | null {
  if (input.trim() === '') {
    return null;
  }

  const date = new Date(`${input}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatTimelineDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
