import { COMET_SHAPE_SOURCE, ROSETTA_BODY_ID } from '../../rendering/comets/CometNucleusSources';
import type { ObservatoryBodyDefinition } from '../../simulation/bodies/ObservatoryBodyCatalog';
import { NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2 } from '../../simulation/lighting/BodySunLighting';
import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY } from '../../simulation/core/Units';
import type { ObservatoryCameraMode } from '../../state/useAppStore';

export interface SelectedBodyTelemetry {
  readonly distanceFromSunM: number;
  readonly speedMps: number;
}

export interface BodyInspectorProps {
  readonly body: Readonly<ObservatoryBodyDefinition>;
  readonly telemetry: Readonly<SelectedBodyTelemetry>;
  readonly cameraMode: ObservatoryCameraMode;
  /** True while any exaggerated presentation-scale geometry contributes. */
  readonly presentationWarningRequired: boolean;
  readonly pathCoverageWarning?: string | null;
  readonly materialLabel?: string;
  readonly assetState?: string | null;
  readonly cometStatus?: Readonly<{
    activity: number;
    dustHistorySpanDays: number;
    orbitId: string;
    elementEpochJdTdb: number;
    approximationWarning: string | null;
  }> | null;
}

export function BodyInspector({
  body,
  telemetry,
  cameraMode,
  presentationWarningRequired,
  pathCoverageWarning = null,
  materialLabel = 'Visual material pending',
  assetState = null,
  cometStatus = null,
}: BodyInspectorProps) {
  return (
    <aside
      className="control-panel body-inspector"
      aria-labelledby="body-inspector-heading"
      data-testid="body-inspector"
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Selected object</p>
          <h2 id="body-inspector-heading">{body.displayName}</h2>
        </div>
        <span className="classification-badge">{classificationLabel(body)}</span>
      </div>

      <dl className="inspector-grid">
        <div>
          <dt>Mean radius</dt>
          <dd>{formatBodyRadius(body)}</dd>
        </div>
        <div>
          <dt>Mass</dt>
          <dd>{body.massKg === null ? 'Not available in pinned JPL record' : `${formatScientific(body.massKg)} kg`}</dd>
        </div>
        <div>
          <dt>Rotation period</dt>
          <dd>{body.rotationPeriodSeconds === null ? 'Not available in pinned JPL record' : formatRotation(body.rotationPeriodSeconds, 'retrogradeRotation' in body && body.retrogradeRotation === true)}</dd>
        </div>
        <div>
          <dt>Distance from Sun</dt>
          <dd>{formatDistance(telemetry.distanceFromSunM)}</dd>
        </div>
        <div>
          <dt>Heliocentric speed</dt>
          <dd>{formatSpeed(telemetry.speedMps)}</dd>
        </div>
        <div>
          <dt>Solar irradiance</dt>
          <dd data-testid="body-solar-irradiance">
            {formatSolarIrradiance(body.id, telemetry.distanceFromSunM)}
          </dd>
        </div>
        <div>
          <dt>Camera</dt>
          <dd>{cameraLabel(cameraMode)}</dd>
        </div>
        <div>
          <dt>Translation layer</dt>
          <dd><abbr title="Jet Propulsion Laboratory">JPL</abbr> Horizons / Hermite</dd>
        </div>
        <div>
          <dt>Body renderer</dt>
          <dd data-testid="body-material-label">{materialLabel}</dd>
        </div>
        {assetState === null ? null : (
          <div>
            <dt>Asset state</dt>
            <dd data-testid="body-asset-state" aria-live="polite">
              {body.id === ROSETTA_BODY_ID ? assetState.replace('map', 'shape') : assetState}
            </dd>
          </div>
        )}
        {cometStatus === null ? null : (
          <>
            <div>
              <dt>Comet activity</dt>
              <dd data-testid="comet-activity">{Math.round(cometStatus.activity * 100)}% · distance profile</dd>
            </div>
            <div>
              <dt>Dust memory</dt>
              <dd>{cometStatus.dustHistorySpanDays.toFixed(1)} simulated days</dd>
            </div>
            <div>
              <dt>JPL orbit solution</dt>
              <dd>{cometStatus.orbitId} · epoch {cometStatus.elementEpochJdTdb.toFixed(1)} JD</dd>
            </div>
          </>
        )}
      </dl>

      {presentationWarningRequired ? (
        <p
          className="scale-warning inspector-warning"
          role="status"
          data-testid="body-inspector-scale-warning"
        >
          Rendered body radii remain exaggerated while presentation-scale geometry contributes;
          distances and ephemeris states remain physical.
        </p>
      ) : null}
      {pathCoverageWarning !== null ? (
        <p
          className="scale-warning inspector-warning"
          role="status"
          data-testid="body-inspector-path-warning"
        >
          {pathCoverageWarning}
        </p>
      ) : null}
      {cometStatus?.approximationWarning ? (
        <p
          className="scale-warning inspector-warning"
          role="status"
          data-testid="comet-approximation-warning"
        >
          Approximation warning: {cometStatus.approximationWarning}
        </p>
      ) : null}
      <p className="technical-note">
        {body.kind === 'comet'
          ? 'Identity and orbit are JPL-sourced. Surface detail, rotation, coma and tails are illustrative. Exposure and view-facing inspection lighting reveal the dark nucleus; brightness is not calibrated photometry.'
          : 'Surface assets are provenance-tracked; a procedural fallback remains available if an optional map cannot load.'}
      </p>
      {body.id === 'c-1995-o1-hale-bopp' || body.id === 'c-2020-f3-neowise' ? (
        <p className="technical-note" data-testid="comet-orbit-window-note">
          The orbit line shows the bundled 2000–2100 interval, not a complete revolution.
          These long-period comets travel beyond that time window; the displayed arc stays open.
        </p>
      ) : null}
      {body.kind === 'comet' && body.id === ROSETTA_BODY_ID ? (
        <p className="technical-note" data-testid="comet-shape-credit">
          Shape: <a href={COMET_SHAPE_SOURCE.sourcePage} target="_blank" rel="noreferrer">ESA/Rosetta/NAVCAM</a>
          {' '}(simplified and uniformly scaled to the catalog radius).{' '}
          <a href={COMET_SHAPE_SOURCE.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 3.0 IGO</a>.
          {' '}An illustrative shape is retained if the model cannot load. No ESA endorsement.
        </p>
      ) : body.kind === 'comet' && body.id === '1p-halley' ? (
        <p className="technical-note">
          Elongation follows <a href="https://www.esa.int/ESA_Multimedia/Images/2016/03/Giotto_approaching_Comet_Halley" target="_blank" rel="noreferrer">Giotto observations</a>;
          {' '}this is an illustrative reconstruction, not a measured surface map.
        </p>
      ) : null}
    </aside>
  );
}

function classificationLabel(body: Readonly<ObservatoryBodyDefinition>): string {
  if (body.kind === 'moon') return 'Natural satellite';
  return body.kind[0]?.toLocaleUpperCase() + body.kind.slice(1);
}

function formatKilometres(valueM: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(valueM / 1_000)} km`;
}

function formatBodyRadius(body: Readonly<ObservatoryBodyDefinition>): string {
  if (body.meanRadiusM !== null) return formatKilometres(body.meanRadiusM);
  if ('visualNucleusRadiusM' in body) {
    return `Unknown · ${formatKilometres(body.visualNucleusRadiusM)} illustrative render fallback`;
  }
  return 'Unknown';
}

function formatScientific(value: number): string {
  return value.toExponential(4).replace('+', '');
}

function formatRotation(seconds: number, retrograde: boolean): string {
  const days = seconds / SECONDS_PER_DAY;
  return `${days.toLocaleString('en-US', { maximumFractionDigits: 4 })} d${retrograde ? ' retrograde' : ''}`;
}

function formatDistance(valueM: number): string {
  if (valueM < 1_000_000) return formatKilometres(valueM);
  return `${(valueM / ASTRONOMICAL_UNIT_M).toFixed(6)} AU`;
}

function formatSpeed(valueMps: number): string {
  return `${(valueMps / 1_000).toFixed(3)} km/s`;
}

function formatSolarIrradiance(bodyId: string, distanceFromSunM: number): string {
  if (bodyId === 'sun' || !Number.isFinite(distanceFromSunM) || distanceFromSunM <= 0) {
    return 'Source body';
  }
  const irradianceWm2 =
    NOMINAL_SOLAR_IRRADIANCE_AT_1_AU_W_M2 *
    (ASTRONOMICAL_UNIT_M / distanceFromSunM) ** 2;
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: irradianceWm2 >= 100 ? 1 : 3,
  }).format(irradianceWm2);
  return `${formatted} W/m² · inverse-square`;
}

function cameraLabel(mode: ObservatoryCameraMode): string {
  switch (mode) {
    case 'free-orbit':
      return 'Free orbit';
    case 'top-down-ecliptic':
      return 'Top-down ecliptic';
    case 'body-follow':
      return 'Body follow';
    case 'chase':
      return 'Velocity chase';
    case 'earth-moon-system':
      return 'Earth–Moon system';
    default:
      return 'System overview';
  }
}
