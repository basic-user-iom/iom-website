import type { RenderScaleMode } from '../../rendering/RenderScaleModel';
import type {
  ObservatoryCameraMode,
  SimulationUiSnapshot,
  WebGLStatus,
} from '../../state/useAppStore';

export interface DebugDiagnosticsProps {
  readonly snapshot: Readonly<SimulationUiSnapshot>;
  readonly webglStatus: WebGLStatus;
  readonly webglMessage: string | null;
  readonly ephemeris: Readonly<EphemerisDiagnosticState>;
  readonly cameraMode: ObservatoryCameraMode;
  readonly renderScaleMode: RenderScaleMode;
  readonly presentationWarningRequired: boolean;
}

export interface EphemerisDiagnosticState {
  readonly status: 'loading' | 'ready' | 'error' | 'out-of-range';
  readonly providerLabel: string;
  readonly coverageLabel: string;
  readonly message: string | null;
}

export function DebugDiagnostics({
  snapshot,
  webglStatus,
  webglMessage,
  ephemeris,
  cameraMode,
  renderScaleMode,
  presentationWarningRequired,
}: DebugDiagnosticsProps) {
  return (
    <aside className="control-panel diagnostics-panel" aria-labelledby="diagnostics-heading">
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Live diagnostics · 10 Hz</p>
          <h2 id="diagnostics-heading">Ephemeris status</h2>
        </div>
        <span className="status-dot-label" data-status={webglStatus}>
          <span aria-hidden="true" />
          {formatWebGLStatus(webglStatus)}
        </span>
      </div>

      {webglMessage === null ? null : (
        <p className="diagnostic-message" role="status">
          {webglMessage}
        </p>
      )}
      {ephemeris.message === null ? null : (
        <p className="diagnostic-message" role="status">
          {ephemeris.message}
        </p>
      )}

      <dl className="diagnostic-grid">
        <div>
          <dt>Ephemeris provider</dt>
          <dd>{ephemeris.providerLabel}</dd>
        </div>
        <div>
          <dt>Data status</dt>
          <dd>{formatEphemerisStatus(ephemeris.status)}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{ephemeris.coverageLabel}</dd>
        </div>
        <div>
          <dt>State contract</dt>
          <dd>
            <abbr title="International Celestial Reference Frame">ICRF</abbr> /
            ECLIPJ2000 · <abbr title="Barycentric Dynamical Time">TDB</abbr> ·
            <abbr title="International System of Units">SI</abbr>
          </dd>
        </div>
        <div>
          <dt>UTC display</dt>
          <dd>{formatUtc(snapshot.currentUtcIso)}</dd>
        </div>
        <div>
          <dt>Julian date · <abbr title="Barycentric Dynamical Time">TDB</abbr> field</dt>
          <dd>{snapshot.currentJdTdb.toFixed(6)}</dd>
        </div>
        <div>
          <dt>Simulation delta</dt>
          <dd>{formatDelta(snapshot.dtSimSeconds)} s</dd>
        </div>
        <div>
          <dt>Render origin</dt>
          <dd>
            {snapshot.originBodyId} · revision {snapshot.originRevision}
          </dd>
        </div>
        <div>
          <dt>Camera focus</dt>
          <dd>{snapshot.focusedBodyId}</dd>
        </div>
        <div>
          <dt>Camera rig</dt>
          <dd>{cameraMode}</dd>
        </div>
        <div>
          <dt>Render scale</dt>
          <dd>
            {renderScaleMode}
            {presentationWarningRequired ? ' · body sizes exaggerated' : ''}
          </dd>
        </div>
        <div>
          <dt>Renderer</dt>
          <dd>{snapshot.renderFps === null ? 'Waiting…' : `${snapshot.renderFps.toFixed(0)} fps`}</dd>
        </div>
        <div>
          <dt>Document</dt>
          <dd>{snapshot.documentVisible ? 'Visible' : 'Backgrounded'}</dd>
        </div>
      </dl>

      <p className="technical-note">
        Runtime translations and sample trails come from bundled Horizons vectors. UTC is
        control/display convenience; the current UTC ↔ TDB conversion remains approximate.
      </p>
    </aside>
  );
}

function formatEphemerisStatus(status: EphemerisDiagnosticState['status']): string {
  switch (status) {
    case 'ready':
      return 'Authoritative bundle ready';
    case 'out-of-range':
      return 'Outside generated range';
    case 'error':
      return 'Bundle unavailable';
    default:
      return 'Worker decoding';
  }
}

function formatWebGLStatus(status: WebGLStatus): string {
  switch (status) {
    case 'ready':
      return 'WebGL 2 ready';
    case 'lost':
      return 'Context lost';
    case 'unavailable':
      return 'Fallback view';
    case 'error':
      return 'Renderer error';
    default:
      return 'Checking GPU';
  }
}

function formatUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

function formatDelta(value: number): string {
  if (Math.abs(value) >= 10_000) {
    return value.toExponential(2);
  }
  return value.toFixed(3);
}
