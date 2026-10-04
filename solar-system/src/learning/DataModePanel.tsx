import { useState } from 'react';
import { OBSERVATORY_BODY_DEFINITIONS, type ObservatoryBodyId } from '../simulation/bodies/ObservatoryBodyCatalog';
import type { StartupProgress } from '../app/StartupProgress';
export function DataModePanel({ message, loading, dataError, progress, selected, utc, distanceAu, retrying, onRetry, onSelect, onDate, onSources }: {
  readonly message: string | null; readonly loading: boolean; readonly dataError: string | null; readonly progress: StartupProgress;
  readonly selected: ObservatoryBodyId; readonly utc: string; readonly distanceAu: number | null; readonly retrying: boolean;
  readonly onRetry: () => void; readonly onSelect: (id: ObservatoryBodyId) => void; readonly onDate: (utc: string) => void; readonly onSources: () => void;
}) {
  const body = OBSERVATORY_BODY_DEFINITIONS.find(item => item.id === selected)!;
  const [editedDate, setEditedDate] = useState<{ sourceUtc: string; value: string } | null>(null);
  const date = editedDate?.sourceUtc === utc ? editedDate.value : utc.slice(0, 19);
  const [dateError, setDateError] = useState<string | null>(null);
  return <section className="data-mode-panel" data-testid="data-mode-panel" aria-label="Solar System data and text mode">
    <p className="eyebrow">Data & text mode</p><h2>Explore without 3D</h2>
    <p role="status">The 3D view could not start. Object data and Learn remain available.</p>
    <p>{message}</p><p id="graphics-unavailable-help">Camera controls, visual layers, the animated tour and 3D scenarios require WebGL 2 and are unavailable here. Lowering quality cannot provide a missing WebGL context.</p>
    <button type="button" data-testid="retry-graphics" disabled={retrying} onClick={onRetry}>{retrying ? 'Trying 3D…' : 'Try 3D again'}</button>
    {loading ? <p role="status">Orbital data: {progress.stage} · {(progress.loadedBytes / 1_000_000).toFixed(1)} MB received. Catalog facts are already available.</p> : null}
    {dataError ? <p role="alert">Orbital data unavailable: {dataError} Catalog facts and lesson explanations are still available. <button type="button" onClick={() => window.location.reload()}>Reload data</button></p> : null}
    <label className="field-stack">Object<select data-testid="data-body-select" value={selected} onChange={event => onSelect(event.target.value as ObservatoryBodyId)}>{OBSERVATORY_BODY_DEFINITIONS.map(item => <option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label>
    <h3>{body.displayName}</h3><dl className="data-facts"><div><dt>Mean radius</dt><dd>{body.meanRadiusM === null ? 'Not available' : (body.meanRadiusM / 1000).toLocaleString('en-US') + ' km'}</dd></div><div><dt>Mass</dt><dd>{body.massKg === null ? 'Not available' : body.massKg.toExponential(4) + ' kg'}</dd></div><div><dt>Distance from Sun</dt><dd>{distanceAu === null ? 'Orbital data unavailable' : distanceAu.toFixed(3) + ' AU'}</dd></div></dl>
    <p>Catalog physical values; distances are calculated from the bundled JPL Horizons data. This is a text view, not a 2D orbit simulation.</p>
    <p>UTC snapshot: {utc.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}. Time does not animate in this view.</p>
    <form onSubmit={event => { event.preventDefault(); const value = new Date(date + 'Z'); if (!Number.isFinite(value.getTime()) || value.getUTCFullYear() < 2000 || value.getUTCFullYear() >= 2100) { setDateError('Choose a UTC date from 2000 through 2099.'); return; } setDateError(null); onDate(value.toISOString()); }}>
      <label className="field-stack">Set UTC date<input type="datetime-local" step="1" value={date} onChange={event => setEditedDate({ sourceUtc: utc, value: event.target.value })} disabled={loading || dataError !== null} /></label><button type="submit" disabled={loading || dataError !== null}>Update data</button>{dateError ? <p role="alert">{dateError}</p> : null}
    </form><button type="button" onClick={onSources}>Data & provenance</button>
  </section>;
}
