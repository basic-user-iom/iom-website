import { useMemo, useState } from 'react';

import type { ObservatoryBodyId } from '../../simulation/bodies/ObservatoryBodyCatalog';

export interface NavigatorBodyOption {
  readonly id: ObservatoryBodyId;
  readonly displayName: string;
  readonly kind: 'star' | 'planet' | 'moon' | 'comet';
}

export interface ObjectNavigatorProps {
  readonly bodies: readonly NavigatorBodyOption[];
  readonly selectedBodyId: ObservatoryBodyId;
  readonly orbitLinesVisible: boolean;
  readonly bodyLabelsVisible: boolean;
  readonly skyBackgroundVisible?: boolean;
  readonly brightStarsVisible?: boolean;
  readonly cometsVisible?: boolean;
  readonly asteroidBeltVisible?: boolean;
  readonly kuiperBeltVisible?: boolean;
  readonly disabled?: boolean;
  readonly onSelectBody: (bodyId: ObservatoryBodyId) => void;
  readonly onOrbitLinesVisibleChange: (visible: boolean) => void;
  readonly onBodyLabelsVisibleChange: (visible: boolean) => void;
  readonly onSkyBackgroundVisibleChange?: (visible: boolean) => void;
  readonly onBrightStarsVisibleChange?: (visible: boolean) => void;
  readonly onCometsVisibleChange?: (visible: boolean) => void;
  readonly onAsteroidBeltVisibleChange?: (visible: boolean) => void;
  readonly onKuiperBeltVisibleChange?: (visible: boolean) => void;
}

export function ObjectNavigator({
  bodies,
  selectedBodyId,
  orbitLinesVisible,
  bodyLabelsVisible,
  skyBackgroundVisible = true,
  brightStarsVisible = true,
  cometsVisible = true,
  asteroidBeltVisible = true,
  kuiperBeltVisible = false,
  disabled = false,
  onSelectBody,
  onOrbitLinesVisibleChange,
  onBodyLabelsVisibleChange,
  onSkyBackgroundVisibleChange = () => undefined,
  onBrightStarsVisibleChange = () => undefined,
  onCometsVisibleChange = () => undefined,
  onAsteroidBeltVisibleChange = () => undefined,
  onKuiperBeltVisibleChange = () => undefined,
}: ObjectNavigatorProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingBodies = useMemo(
    () =>
      normalizedQuery === ''
        ? bodies
        : bodies.filter((body) =>
            `${body.displayName} ${classificationLabel(body.kind)}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          ),
    [bodies, normalizedQuery],
  );

  return (
    <nav
      className="control-panel object-navigator"
      aria-labelledby="object-navigator-heading"
      data-testid="object-navigator"
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Object navigator</p>
          <h2 id="object-navigator-heading">Choose a target</h2>
        </div>
        <span className="navigator-count">{matchingBodies.length}/{bodies.length}</span>
      </div>

      <label className="field-stack navigator-search" htmlFor="body-search">
        <span>Search bodies</span>
        <input
          id="body-search"
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Earth, planet, comet..."
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div className="body-list" role="group" aria-label="Ephemeris bodies">
        {matchingBodies.map((body) => {
          const selected = body.id === selectedBodyId;
          return (
            <button
              key={body.id}
              className="body-list-item"
              type="button"
              aria-pressed={selected}
              data-body-id={body.id}
              data-testid={`navigator-body-${body.id}`}
              disabled={disabled}
              onClick={() => onSelectBody(body.id)}
            >
              <span className="body-list-marker" data-body-id={body.id} aria-hidden="true" />
              <span>
                <strong>{body.displayName}</strong>
                <small>{classificationLabel(body.kind)}</small>
              </span>
              <span className="body-list-action">{selected ? 'Tracking' : 'Focus'}</span>
            </button>
          );
        })}
        {matchingBodies.length === 0 ? (
          <p className="navigator-empty" role="status">
            No generated body matches this search.
          </p>
        ) : null}
      </div>

      <fieldset className="layer-controls" disabled={disabled}>
        <legend>Reference layers</legend>
        <label>
          <input
            type="checkbox"
            checked={orbitLinesVisible}
            onChange={(event) => onOrbitLinesVisibleChange(event.currentTarget.checked)}
          />
          Ephemeris orbit lines
        </label>
        <label>
          <input
            type="checkbox"
            checked={bodyLabelsVisible}
            onChange={(event) => onBodyLabelsVisibleChange(event.currentTarget.checked)}
          />
          Screen-space labels
        </label>
        <label>
          <input
            type="checkbox"
            checked={skyBackgroundVisible}
            data-testid="sky-background-toggle"
            onChange={(event) => onSkyBackgroundVisibleChange(event.currentTarget.checked)}
          />
          NASA Milky Way / deep-sky map
        </label>
        <label>
          <input
            type="checkbox"
            checked={brightStarsVisible}
            data-testid="bright-stars-toggle"
            onChange={(event) => onBrightStarsVisibleChange(event.currentTarget.checked)}
          />
          HEASARC bright-star catalog
        </label>
        <label>
          <input
            type="checkbox"
            checked={cometsVisible}
            data-testid="comets-toggle"
            onChange={(event) => onCometsVisibleChange(event.currentTarget.checked)}
          />
          Named comets and tails
        </label>
        <label>
          <input
            type="checkbox"
            checked={asteroidBeltVisible}
            data-testid="asteroid-belt-toggle"
            onChange={(event) => onAsteroidBeltVisibleChange(event.currentTarget.checked)}
          />
          Asteroid belt · statistical
        </label>
        <label>
          <input
            type="checkbox"
            checked={kuiperBeltVisible}
            data-testid="kuiper-belt-toggle"
            onChange={(event) => onKuiperBeltVisibleChange(event.currentTarget.checked)}
          />
          Kuiper belt · statistical
        </label>
      </fieldset>
      {asteroidBeltVisible || kuiperBeltVisible ? (
        <p className="statistical-layer-note" data-testid="statistical-belt-warning">
          Statistical visualization — context particles are not one-to-one real objects.
        </p>
      ) : null}
    </nav>
  );
}

function classificationLabel(kind: NavigatorBodyOption['kind']): string {
  switch (kind) {
    case 'star':
      return 'Star';
    case 'moon':
      return 'Natural satellite';
    case 'comet':
      return 'Comet';
    default:
      return 'Planet';
  }
}
