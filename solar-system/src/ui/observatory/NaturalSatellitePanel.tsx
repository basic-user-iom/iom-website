import { useMemo, useState } from 'react';

import {
  getNaturalSatellitesByParent,
  getNaturalSatelliteDefinition,
  NATURAL_SATELLITE_CATALOG_METADATA,
  NATURAL_SATELLITE_DEFINITIONS,
  type NaturalSatelliteDefinition,
} from '../../simulation/satellites';

export interface NaturalSatellitePanelProps {
  readonly visible: boolean;
  readonly majorVisible: boolean;
  readonly minorVisible: boolean;
  readonly orbitsVisible: boolean;
  readonly labelsVisible: boolean;
  readonly selectedSatelliteId: string | null;
  readonly disabled?: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly onMajorVisibleChange: (visible: boolean) => void;
  readonly onMinorVisibleChange: (visible: boolean) => void;
  readonly onOrbitsVisibleChange: (visible: boolean) => void;
  readonly onLabelsVisibleChange: (visible: boolean) => void;
  readonly onSelectSatellite: (id: string | null) => void;
  readonly onFocusSatellite: (id: string) => void;
  readonly onFocusParent: (parentId: string) => void;
}

const PARENT_OPTIONS = ['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;

export function NaturalSatellitePanel({
  visible,
  majorVisible,
  minorVisible,
  orbitsVisible,
  labelsVisible,
  selectedSatelliteId,
  disabled = false,
  onVisibleChange,
  onMajorVisibleChange,
  onMinorVisibleChange,
  onOrbitsVisibleChange,
  onLabelsVisibleChange,
  onSelectSatellite,
  onFocusSatellite,
  onFocusParent,
}: NaturalSatellitePanelProps) {
  const [parentFilter, setParentFilter] = useState('jupiter');
  const [query, setQuery] = useState('');
  const selected = selectedSatelliteId === null ? undefined : getNaturalSatelliteDefinition(selectedSatelliteId);
  const majorMoons = useMemo(
    () => getNaturalSatellitesByParent(parentFilter, 'major'),
    [parentFilter],
  );
  const filteredMajorMoons = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) return majorMoons;
    return NATURAL_SATELLITE_DEFINITIONS.filter((moon) =>
      `${moon.name} ${moon.id} ${moon.parentId} ${moon.tier}`.toLocaleLowerCase().includes(normalized),
    ).slice(0, 80);
  }, [majorMoons, query]);
  const totalCount = NATURAL_SATELLITE_DEFINITIONS.length;

  return (
    <section className="control-panel natural-satellite-panel" data-testid="natural-satellite-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Natural satellites</h2>
        </div>
        <span className="panel-count" aria-label={`${totalCount} generated satellite records`}>
          {totalCount}
        </span>
      </div>
      <p className="field-help">
        Dated JPL/NASA snapshot · {NATURAL_SATELLITE_CATALOG_METADATA.officialSnapshotDateUtc} · parent-relative time-aware orbits.
      </p>
      <div className="layer-controls" role="group" aria-label="Natural satellite layers">
        <label><input type="checkbox" checked={visible} disabled={disabled} onChange={(event) => onVisibleChange(event.currentTarget.checked)} /> Natural satellites</label>
        <label><input type="checkbox" checked={majorVisible} disabled={disabled || !visible} onChange={(event) => onMajorVisibleChange(event.currentTarget.checked)} /> Major moons</label>
        <label><input type="checkbox" checked={minorVisible} disabled={disabled || !visible} onChange={(event) => onMinorVisibleChange(event.currentTarget.checked)} /> Minor point layer</label>
        <label><input type="checkbox" checked={orbitsVisible} disabled={disabled || !visible} onChange={(event) => onOrbitsVisibleChange(event.currentTarget.checked)} /> Moon orbits</label>
        <label><input type="checkbox" checked={labelsVisible} disabled={disabled || !visible} onChange={(event) => onLabelsVisibleChange(event.currentTarget.checked)} /> Moon labels</label>
      </div>
      <label className="field-stack" htmlFor="natural-satellite-parent">
        <span>Parent system</span>
        <select id="natural-satellite-parent" value={parentFilter} disabled={disabled} onChange={(event) => setParentFilter(event.currentTarget.value)}>
          {PARENT_OPTIONS.map((parentId) => <option key={parentId} value={parentId}>{formatParentName(parentId)} · {getNaturalSatellitesByParent(parentId).length}</option>)}
        </select>
      </label>
      <label className="field-stack" htmlFor="natural-satellite-search">
        <span>Find any cataloged moon</span>
        <input id="natural-satellite-search" type="search" value={query} placeholder="Io, Titan, Jupiter minor 001…" disabled={disabled || !visible} onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      <div className="natural-satellite-list" role="listbox" aria-label={query.trim() === '' ? `${formatParentName(parentFilter)} major moons` : 'All matching natural satellites'}>
        {filteredMajorMoons.map((moon) => (
          <button
            className="natural-satellite-option"
            type="button"
            role="option"
            aria-selected={selectedSatelliteId === moon.id}
            key={moon.id}
            disabled={disabled || !visible || (moon.tier === 'major' ? !majorVisible : !minorVisible)}
            onClick={() => onSelectSatellite(moon.id)}
          >
            <span className="natural-satellite-dot" data-profile={moon.visualProfile} aria-hidden="true" />
            <span>{moon.name}</span>
            <small>{query.trim() === '' ? formatPeriod(moon.orbitalPeriodSeconds) : `${formatParentName(moon.parentId)} · ${moon.tier === 'major' ? 'major' : 'point'}`}</small>
          </button>
        ))}
        {filteredMajorMoons.length === 0 ? <p className="field-help">No moon matches this search.</p> : null}
      </div>
      {selected === undefined ? (
        <p className="field-help">Select a major moon to inspect its parent-relative orbit.</p>
      ) : (
        <SatelliteSelectionSummary satellite={selected} onFocusParent={onFocusParent} onFocusSatellite={onFocusSatellite} />
      )}
    </section>
  );
}

function SatelliteSelectionSummary({
  satellite,
  onFocusParent,
  onFocusSatellite,
}: {
  readonly satellite: NaturalSatelliteDefinition;
  readonly onFocusParent: (parentId: string) => void;
  readonly onFocusSatellite: (id: string) => void;
}) {
  return (
    <div className="natural-satellite-summary" data-testid="natural-satellite-summary">
      <strong>{satellite.name}</strong>
      <span>{formatParentName(satellite.parentId)} · {satellite.retrograde ? 'retrograde' : 'prograde'} · {satellite.synchronous ? 'synchronous' : 'independent rotation'}</span>
      <span>Radius {(satellite.physicalRadiusM / 1_000).toFixed(1)} km · period {formatPeriod(satellite.orbitalPeriodSeconds)}</span>
      <button className="button button-secondary" type="button" onClick={() => onFocusSatellite(satellite.id)}>Frame selected moon</button>
      <button className="button button-secondary" type="button" onClick={() => onFocusParent(satellite.parentId)}>Focus parent system</button>
    </div>
  );
}

function formatParentName(parentId: string): string {
  return parentId.charAt(0).toLocaleUpperCase() + parentId.slice(1);
}

function formatPeriod(seconds: number): string {
  const days = seconds / 86_400;
  if (days < 2) return `${days.toFixed(2)} d`;
  if (days < 365) return `${days.toFixed(1)} d`;
  return `${(days / 365.25).toFixed(1)} y`;
}
