import type { CSSProperties } from 'react';

import type {
  ExperimentalTideComponent,
  ExperimentalTideMode,
} from '../../app/ExperimentalFeatures';
import type { ObservatoryBodyId } from '../../simulation/bodies/ObservatoryBodyCatalog';

interface BodyLegendShortcut {
  readonly id: ObservatoryBodyId;
  readonly label: string;
  readonly color: string;
}

const CANVAS_LEGEND_BODY_SHORTCUTS = Object.freeze([
  Object.freeze({ id: 'sun', label: 'Sun', color: '#ffc45c' }),
  Object.freeze({ id: 'mercury', label: 'Mercury', color: '#b9b4aa' }),
  Object.freeze({ id: 'venus', label: 'Venus', color: '#e7b66f' }),
  Object.freeze({ id: 'earth', label: 'Earth', color: '#55a9ff' }),
  Object.freeze({ id: 'moon', label: 'Moon', color: '#d7dbe2' }),
  Object.freeze({ id: 'mars', label: 'Mars', color: '#d86e4a' }),
  Object.freeze({ id: 'jupiter', label: 'Jupiter', color: '#d7aa7c' }),
  Object.freeze({ id: 'saturn', label: 'Saturn', color: '#e2ca86' }),
  Object.freeze({ id: 'uranus', label: 'Uranus', color: '#84d7df' }),
  Object.freeze({ id: 'neptune', label: 'Neptune', color: '#567ee8' }),
] satisfies readonly BodyLegendShortcut[]);

export interface CanvasLegendProps {
  readonly selectedBodyId: ObservatoryBodyId;
  readonly selectedBodyIsComet: boolean;
  readonly cometsVisible: boolean;
  readonly cometShortcutAvailable: boolean;
  readonly experimentalTidesEnabled: boolean;
  readonly activeTideMode: ExperimentalTideMode;
  readonly disabled?: boolean;
  readonly onFocusBody: (bodyId: ObservatoryBodyId) => void;
  readonly onFocusComet: () => void;
  readonly onToggleTideComponent: (component: ExperimentalTideComponent) => void;
}

export function CanvasLegend({
  selectedBodyId,
  selectedBodyIsComet,
  cometsVisible,
  cometShortcutAvailable,
  experimentalTidesEnabled,
  activeTideMode,
  disabled = false,
  onFocusBody,
  onFocusComet,
  onToggleTideComponent,
}: CanvasLegendProps) {
  return (
    <div
      className="canvas-legend"
      role="group"
      aria-label="Solar System locations and overlays"
      data-testid="canvas-legend"
    >
      {CANVAS_LEGEND_BODY_SHORTCUTS.map(({ id, label, color }) => (
        <button
          key={id}
          className="canvas-legend-action"
          type="button"
          style={{ '--legend-color': color } as CSSProperties}
          data-testid={`legend-body-${id}`}
          data-body-id={id}
          aria-label={`Focus ${label}`}
          aria-pressed={selectedBodyId === id}
          disabled={disabled}
          onClick={() => onFocusBody(id)}
        >
          <i aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}

      <button
        className="canvas-legend-action"
        type="button"
        style={{ '--legend-color': '#84d9ff' } as CSSProperties}
        data-testid="legend-comets"
        data-layer-visible={String(cometsVisible)}
        aria-label="Show named comets and focus 1P/Halley"
        aria-pressed={selectedBodyIsComet}
        disabled={disabled || !cometShortcutAvailable}
        title={
          cometShortcutAvailable
            ? 'Show named comets and focus 1P/Halley'
            : 'The named-comet bundle is unavailable'
        }
        onClick={onFocusComet}
      >
        <i aria-hidden="true" />
        <span>Comets</span>
      </button>

      {experimentalTidesEnabled ? (
        <>
          <TideLegendButton
            component="lunar"
            label="Lunar tide"
            color="#55d9ff"
            activeMode={activeTideMode}
            disabled={disabled}
            onToggle={onToggleTideComponent}
          />
          <TideLegendButton
            component="solar"
            label="Solar tide"
            color="#ffb247"
            activeMode={activeTideMode}
            disabled={disabled}
            onToggle={onToggleTideComponent}
          />
        </>
      ) : null}
    </div>
  );
}

function TideLegendButton({
  component,
  label,
  color,
  activeMode,
  disabled,
  onToggle,
}: {
  readonly component: ExperimentalTideComponent;
  readonly label: string;
  readonly color: string;
  readonly activeMode: ExperimentalTideMode;
  readonly disabled: boolean;
  readonly onToggle: (component: ExperimentalTideComponent) => void;
}) {
  const visible = tideComponentIsVisible(activeMode, component);
  return (
    <button
      className="canvas-legend-action canvas-legend-tide"
      type="button"
      style={{ '--legend-color': color } as CSSProperties}
      data-testid={`legend-tide-${component}`}
      aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()} overlay and frame Earth with the Moon`}
      aria-pressed={visible}
      disabled={disabled}
      title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()} overlay and frame Earth with the Moon`}
      onClick={() => onToggle(component)}
    >
      <i aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function tideComponentIsVisible(
  mode: ExperimentalTideMode,
  component: ExperimentalTideComponent,
): boolean {
  return mode === component || mode === 'both';
}
