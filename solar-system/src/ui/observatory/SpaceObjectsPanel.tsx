import { useMemo, useState } from 'react';

import {
  EARTH_SATELLITE_CATALOG_METADATA,
  EARTH_SATELLITE_DEFINITIONS,
  sampleEarthSatellite,
} from '../../simulation/artificial';
import {
  SPACECRAFT_CATALOG_METADATA,
  SPACECRAFT_DEFINITIONS,
  sampleSpacecraftTrajectory,
} from '../../simulation/spacecraft';
import { ISS_MODEL_ASSET } from '../../rendering/spaceobjects/SpaceObjectAssetCatalog';

export interface SpaceObjectsPanelProps {
  readonly currentJdTdb: number;
  readonly visible: boolean;
  readonly earthSatellitesVisible: boolean;
  readonly spacecraftVisible: boolean;
  readonly selectedObjectId: string | null;
  readonly disabled?: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly onEarthSatellitesVisibleChange: (visible: boolean) => void;
  readonly onSpacecraftVisibleChange: (visible: boolean) => void;
  readonly onSelectObject: (id: string | null) => void;
  readonly onFocusObject: (id: string) => void;
  readonly onFocusEarth: () => void;
  readonly onFocusSun: () => void;
  readonly onReturnToSatelliteEpoch: () => void;
}

type ObjectTab = 'earth-satellites' | 'spacecraft';

export function SpaceObjectsPanel({
  currentJdTdb,
  visible,
  earthSatellitesVisible,
  spacecraftVisible,
  selectedObjectId,
  disabled = false,
  onVisibleChange,
  onEarthSatellitesVisibleChange,
  onSpacecraftVisibleChange,
  onSelectObject,
  onFocusObject,
  onFocusEarth,
  onFocusSun,
  onReturnToSatelliteEpoch,
}: SpaceObjectsPanelProps) {
  const [tab, setTab] = useState<ObjectTab>('earth-satellites');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const satellites = useMemo(
    () => EARTH_SATELLITE_DEFINITIONS.filter((item) => normalizedQuery.length === 0 || `${item.name} ${item.catalogId}`.toLocaleLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );
  const missions = useMemo(
    () => SPACECRAFT_DEFINITIONS.filter((item) => normalizedQuery.length === 0 || `${item.name} ${item.missionId}`.toLocaleLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );
  const selectedSatellite = EARTH_SATELLITE_DEFINITIONS.find((item) => item.id === selectedObjectId);
  const selectedMission = SPACECRAFT_DEFINITIONS.find((item) => item.id === selectedObjectId);

  const activeTab: ObjectTab = normalizedQuery.length > 0 && satellites.length === 0 && missions.length > 0
    ? 'spacecraft'
    : normalizedQuery.length > 0 && missions.length === 0 && satellites.length > 0
      ? 'earth-satellites'
      : tab;

  return (
    <section className="control-panel space-objects-panel" data-testid="space-objects-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Space objects</h2>
        </div>
        <span className="panel-count">{EARTH_SATELLITE_DEFINITIONS.length + SPACECRAFT_DEFINITIONS.length}</span>
      </div>
      <p className="field-help">OMM/SGP4 Earth-orbit markers and JPL Horizons mission paths stay separate from natural-moon physics.</p>
      <label className="layer-toggle-wide"><input type="checkbox" checked={visible} disabled={disabled} onChange={(event) => onVisibleChange(event.currentTarget.checked)} /> Space objects layer</label>
      <div className="space-object-tabs" role="tablist" aria-label="Space object families">
        <button type="button" role="tab" aria-selected={activeTab === 'earth-satellites'} onClick={() => setTab('earth-satellites')}>Earth satellites</button>
        <button type="button" role="tab" aria-selected={activeTab === 'spacecraft'} onClick={() => setTab('spacecraft')}>Spacecraft & probes</button>
      </div>
      <label className="field-stack" htmlFor="space-object-search">
        <span>Search objects</span>
        <input id="space-object-search" type="search" value={query} disabled={disabled || !visible} placeholder="ISS, Voyager, JWST…" onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      {activeTab === 'earth-satellites' ? (
        <ObjectList
          enabled={visible && earthSatellitesVisible}
          checked={earthSatellitesVisible}
          disabled={disabled || !visible}
          label={`Earth satellites · ${EARTH_SATELLITE_CATALOG_METADATA.objectCount}`}
          items={satellites.map((item) => ({ id: item.id, name: item.name, detail: `${item.catalogId} · ${formatAge(sampleEarthSatellite(item, currentJdTdb).dataAgeDays)}` }))}
          selectedId={selectedObjectId}
          onCheckedChange={onEarthSatellitesVisibleChange}
          onSelect={onSelectObject}
        />
      ) : (
        <ObjectList
          enabled={visible && spacecraftVisible}
          checked={spacecraftVisible}
          disabled={disabled || !visible}
          label={`Spacecraft & probes · ${SPACECRAFT_CATALOG_METADATA.missionCount}`}
          items={missions.map((item) => {
            const state = sampleSpacecraftTrajectory(item, currentJdTdb);
            return { id: item.id, name: item.name, detail: `${item.status} · ${state.valid ? 'trajectory valid' : 'outside validity'}` };
          })}
          selectedId={selectedObjectId}
          onCheckedChange={onSpacecraftVisibleChange}
          onSelect={onSelectObject}
        />
      )}
      {activeTab === 'earth-satellites' && satellites.every((item) => sampleEarthSatellite(item, currentJdTdb).dataAgeState === 'outside-hard-window') ? (
        <div className="space-object-warning" role="status">
          <span>OMM snapshot is outside its hard validity window at this date.</span>
          <button className="button button-secondary" type="button" onClick={onReturnToSatelliteEpoch}>Return to satellite epoch</button>
        </div>
      ) : null}
      {selectedSatellite !== undefined ? <SelectedObjectSummary name={selectedSatellite.name} detail={`${selectedSatellite.catalogId} · OMM/TEME · ${formatAge(sampleEarthSatellite(selectedSatellite, currentJdTdb).dataAgeDays)}${selectedSatellite.id === ISS_MODEL_ASSET.objectId ? ` · ${ISS_MODEL_ASSET.physicalSpanMeters} m span · true physical scale on frame` : ''}`} frameLabel="Frame selected satellite" onFrame={() => onFocusObject(selectedSatellite.id)} actionLabel="Focus Earth" onAction={onFocusEarth} /> : null}
      {selectedMission !== undefined ? <SelectedObjectSummary name={selectedMission.name} detail={`${selectedMission.operator} · ${selectedMission.trajectorySource} · ${sampleSpacecraftTrajectory(selectedMission, currentJdTdb).valid ? 'inside validity' : 'outside validity'}`} frameLabel="Frame selected spacecraft" onFrame={() => onFocusObject(selectedMission.id)} actionLabel="Focus Sun" onAction={onFocusSun} /> : null}
    </section>
  );
}

function ObjectList({
  enabled,
  checked,
  disabled,
  label,
  items,
  selectedId,
  onCheckedChange,
  onSelect,
}: {
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly items: readonly { readonly id: string; readonly name: string; readonly detail: string }[];
  readonly selectedId: string | null;
  readonly onCheckedChange: (visible: boolean) => void;
  readonly onSelect: (id: string | null) => void;
}) {
  return (
    <>
      <label className="layer-toggle-wide"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.currentTarget.checked)} /> {label}</label>
      <div className="space-object-list" role="listbox" aria-label={label}>
        {items.map((item) => (
          <button className="space-object-option" type="button" role="option" aria-selected={selectedId === item.id} key={item.id} disabled={!enabled || disabled} onClick={() => onSelect(item.id)}>
            <span>{item.name}</span><small>{item.detail}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function SelectedObjectSummary({ name, detail, frameLabel, onFrame, actionLabel, onAction }: { readonly name: string; readonly detail: string; readonly frameLabel: string; readonly onFrame: () => void; readonly actionLabel: string; readonly onAction: () => void }) {
  return <div className="natural-satellite-summary" data-testid="selected-space-object-summary"><strong>{name}</strong><span>{detail}</span><button className="button button-secondary" type="button" onClick={onFrame}>{frameLabel}</button><button className="button button-secondary" type="button" onClick={onAction}>{actionLabel}</button></div>;
}

function formatAge(days: number): string {
  if (days < 1) return 'fresh data';
  return `${days.toFixed(0)} d old`;
}
