import {
  type ChangeEvent,
  type RefObject,
  useId,
  useRef,
  useState,
} from 'react';

import {
  IMPACT_TARGET_BODY_IDS,
  type ImpactCameraMode,
  type ImpactParameters,
  type ImpactPhysicalSummary,
  type ImpactScenarioSnapshot,
  type ImpactTargetProfile,
  type ImpactVisualProfile,
} from '../../simulation/scenarios/impact/ImpactTypes';
import { IMPACT_PARAMETER_LIMITS } from '../../simulation/scenarios/impact/ImpactConfiguration';
import { getImpactTargetProfile } from '../../simulation/scenarios/impact/ImpactTargetProfiles';
import { ObservatoryDialog } from './ObservatoryDialog';

export interface ImpactLabPanelProps {
  readonly parameters: Readonly<ImpactParameters>;
  readonly summary: Readonly<ImpactPhysicalSummary>;
  readonly visualProfile: Readonly<ImpactVisualProfile>;
  readonly snapshot: Readonly<ImpactScenarioSnapshot>;
  readonly disabled?: boolean;
  readonly reduceFlashes: boolean;
  readonly onParametersChange: (parameters: Readonly<ImpactParameters>) => void;
  readonly onReduceFlashesChange: (reduceFlashes: boolean) => void;
  readonly onConfirmRun: () => void;
  readonly onClose: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
  readonly onCameraModeChange: (cameraMode: ImpactCameraMode) => void;
}

interface NumericParameterDefinition {
  readonly field:
    | 'diameterM'
    | 'densityKgM3'
    | 'entrySpeedKmps'
    | 'entryAngleDeg'
    | 'entryAzimuthDeg'
    | 'impactLatitudeDeg'
    | 'impactLongitudeDeg'
    | 'seed';
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly testId: string;
  readonly help: string;
}

const NUMERIC_PARAMETERS: readonly Readonly<NumericParameterDefinition>[] = Object.freeze([
  Object.freeze({
    field: 'diameterM',
    label: 'Impactor diameter',
    unit: 'm',
    min: IMPACT_PARAMETER_LIMITS.diameterM.minimum,
    max: IMPACT_PARAMETER_LIMITS.diameterM.maximum,
    step: 1,
    testId: 'impact-diameter',
    help: 'Spherical-equivalent diameter used by the mass calculation.',
  }),
  Object.freeze({
    field: 'densityKgM3',
    label: 'Bulk density',
    unit: 'kg/m³',
    min: IMPACT_PARAMETER_LIMITS.densityKgM3.minimum,
    max: IMPACT_PARAMETER_LIMITS.densityKgM3.maximum,
    step: 10,
    testId: 'impact-density',
    help: 'Mean bulk density; material presets are descriptive and do not overwrite this value.',
  }),
  Object.freeze({
    field: 'entrySpeedKmps',
    label: 'Entry speed',
    unit: 'km/s',
    min: IMPACT_PARAMETER_LIMITS.entrySpeedKmps.minimum,
    max: IMPACT_PARAMETER_LIMITS.entrySpeedKmps.maximum,
    step: 0.1,
    testId: 'impact-speed',
    help: 'Speed at the top of the modeled atmosphere.',
  }),
  Object.freeze({
    field: 'entryAngleDeg',
    label: 'Entry angle',
    unit: 'deg above horizon',
    min: IMPACT_PARAMETER_LIMITS.entryAngleDeg.minimum,
    max: IMPACT_PARAMETER_LIMITS.entryAngleDeg.maximum,
    step: 1,
    testId: 'impact-angle',
    help: 'One degree is shallow; ninety degrees is vertical.',
  }),
  Object.freeze({
    field: 'entryAzimuthDeg',
    label: 'Entry azimuth',
    unit: 'deg clockwise from north',
    min: 0,
    max: 360,
    step: 0.1,
    testId: 'impact-azimuth',
    help: 'Zero degrees approaches from north; ninety degrees approaches from east.',
  }),
  Object.freeze({
    field: 'impactLatitudeDeg',
    label: 'Impact latitude',
    unit: 'deg',
    min: IMPACT_PARAMETER_LIMITS.impactLatitudeDeg.minimum,
    max: IMPACT_PARAMETER_LIMITS.impactLatitudeDeg.maximum,
    step: 0.1,
    testId: 'impact-latitude',
    help: 'Geodetic-style latitude of the target point in the selected body-local visualization.',
  }),
  Object.freeze({
    field: 'impactLongitudeDeg',
    label: 'Impact longitude',
    unit: 'deg',
    min: IMPACT_PARAMETER_LIMITS.impactLongitudeDeg.minimum,
    max: IMPACT_PARAMETER_LIMITS.impactLongitudeDeg.maximum,
    step: 0.1,
    testId: 'impact-longitude',
    help: 'Longitude of the target point; east is positive.',
  }),
  Object.freeze({
    field: 'seed',
    label: 'Deterministic seed',
    unit: 'integer',
    min: 0,
    max: 4_294_967_295,
    step: 1,
    testId: 'impact-seed',
    help: 'Replay with the same parameters and seed to reproduce procedural breakup and ejecta.',
  }),
]);

const CAMERA_OPTIONS: readonly Readonly<{
  readonly id: ImpactCameraMode;
  readonly label: string;
}>[] = Object.freeze([
  Object.freeze({ id: 'overview' as ImpactCameraMode, label: 'Overview' }),
  Object.freeze({ id: 'orbital' as ImpactCameraMode, label: 'Orbital' }),
  Object.freeze({ id: 'side-entry' as ImpactCameraMode, label: 'Side entry' }),
  Object.freeze({ id: 'horizon' as ImpactCameraMode, label: 'Horizon' }),
  Object.freeze({ id: 'chase' as ImpactCameraMode, label: 'Chase' }),
  Object.freeze({ id: 'ground-observer' as ImpactCameraMode, label: 'Ground observer' }),
  Object.freeze({ id: 'slow-motion-replay' as ImpactCameraMode, label: 'Slow-motion replay' }),
]);

const IDLE_STATES = new Set(['idle', 'configuring', 'ready']);
const COMPLETE_STATES = new Set(['complete', 'completed']);
const POST_EVENT_STAGES = new Set([
  'airburst',
  'impact-flash',
  'ejecta',
  'plume',
  'haze',
  'aftermath',
  'complete',
]);

export function ImpactLabPanel({
  parameters,
  summary,
  visualProfile,
  snapshot,
  disabled = false,
  reduceFlashes,
  onParametersChange,
  onReduceFlashesChange,
  onConfirmRun,
  onClose,
  onPause,
  onResume,
  onFrameStep,
  onReplay,
  onReset,
  onCameraModeChange,
}: ImpactLabPanelProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();
  const state = String(snapshot.state);
  const stage = String(snapshot.stage);
  const idle = IDLE_STATES.has(state);
  const running = state === 'running';
  const paused = state === 'paused';
  const complete = COMPLETE_STATES.has(state);
  const active = !idle;
  const valid = parametersAreValid(parameters);
  const targetProfile = getImpactTargetProfile(parameters.targetBodyId);
  const targetName = formatTargetBodyName(parameters.targetBodyId);
  const targetHasAtmosphere = targetProfile.atmosphereProfileId !== undefined;
  const impactorSizeExaggerated =
    active && isImpactorSizeExaggerated(parameters.diameterM, summary.targetRadiusM);
  const aftermath = active
    ? impactAftermathPresentation(targetProfile, summary, stage)
    : null;

  const updateNumericParameter = (
    definition: Readonly<NumericParameterDefinition>,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.valueAsNumber;
    if (!Number.isFinite(value)) return;
    onParametersChange({ ...parameters, [definition.field]: value });
  };

  const updateCameraMode = (cameraMode: ImpactCameraMode) => {
    onParametersChange({ ...parameters, cameraMode });
    onCameraModeChange(cameraMode);
  };

  const confirmRun = () => {
    setConfirmationOpen(false);
    onConfirmRun();
  };

  return (
    <aside
      className="control-panel impact-lab-panel"
      aria-labelledby={`${idPrefix}-heading`}
      data-testid="impact-lab-panel"
      data-impact-state={state}
      data-impact-stage={stage}
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Scenario laboratory</p>
          <h2 id={`${idPrefix}-heading`} ref={panelHeadingRef} tabIndex={-1}>
            {targetName} Impact Lab
          </h2>
        </div>
        <button
          className="button button-secondary"
          type="button"
          data-testid="impact-lab-close"
          aria-label="Close Impact Lab"
          disabled={disabled || active}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p className="mode-badge mode-badge-warning" data-testid="impact-educational-badge">
        Educational approximation
      </p>
      <p className="field-help" id={`${idPrefix}-model-caveat`}>
        Entry, fragmentation, crater, shockwave, plume, and haze use simplified educational
        models. This is not a research-grade impact forecast.
      </p>

      <fieldset
        className="impact-parameter-controls"
        disabled={disabled || active}
        aria-describedby={`${idPrefix}-model-caveat`}
      >
        <legend>Impactor and trajectory</legend>
        <label className="field-stack" htmlFor={`${idPrefix}-target-body`}>
          <span>Target body</span>
          <select
            id={`${idPrefix}-target-body`}
            value={parameters.targetBodyId}
            data-testid="impact-target-body"
            aria-describedby={`${idPrefix}-target-body-help`}
            onChange={(event) => {
              const targetBodyId = event.currentTarget.value as ImpactParameters['targetBodyId'];
              const nextTarget = getImpactTargetProfile(targetBodyId);
              onParametersChange({
                ...parameters,
                targetBodyId,
                atmosphereEnabled:
                  nextTarget.atmosphereProfileId === undefined
                    ? false
                    : parameters.atmosphereEnabled,
              });
            }}
          >
            {IMPACT_TARGET_BODY_IDS.map((bodyId) => (
              <option key={bodyId} value={bodyId}>
                {formatTargetBodyName(bodyId)}
              </option>
            ))}
          </select>
          <small className="field-help" id={`${idPrefix}-target-body-help`}>
            Target physics and visible effects follow the selected body profile.
          </small>
        </label>
        <div className="impact-parameter-grid">
          {NUMERIC_PARAMETERS.slice(0, -1).map((definition) => (
            <NumericParameterField
              key={definition.field}
              definition={definition}
              idPrefix={idPrefix}
              value={parameters[definition.field]}
              onChange={(event) => updateNumericParameter(definition, event)}
            />
          ))}
        </div>

        <label className="field-stack" htmlFor={`${idPrefix}-material`}>
          <span>Material type</span>
          <select
            id={`${idPrefix}-material`}
            value={parameters.material}
            data-testid="impact-material"
            onChange={(event) =>
              onParametersChange({
                ...parameters,
                material: event.currentTarget.value as ImpactParameters['material'],
              })
            }
          >
            <option value="porous-rock">Porous rock</option>
            <option value="stone">Stone</option>
            <option value="iron">Iron</option>
          </select>
        </label>

        <div className="layer-controls impact-toggle-controls">
          <label>
            <input
              type="checkbox"
              checked={parameters.fragmentationEnabled}
              data-testid="impact-fragmentation"
              onChange={(event) =>
                onParametersChange({
                  ...parameters,
                  fragmentationEnabled: event.currentTarget.checked,
                })
              }
            />
            Allow fragmentation
          </label>
          <label>
            <input
              type="checkbox"
              checked={targetHasAtmosphere && parameters.atmosphereEnabled}
              disabled={!targetHasAtmosphere}
              data-testid="impact-atmosphere"
              aria-describedby={`${idPrefix}-atmosphere-help`}
              onChange={(event) =>
                onParametersChange({
                  ...parameters,
                  atmosphereEnabled: event.currentTarget.checked,
                })
              }
            />
            Model atmosphere
          </label>
        </div>
        <p className="field-help" id={`${idPrefix}-atmosphere-help`}>
          {targetHasAtmosphere
            ? `${targetName} has an atmospheric entry model.`
            : `${targetName} is modeled as airless; atmospheric effects are unavailable.`}
        </p>

        {NUMERIC_PARAMETERS.slice(-1).map((definition) => (
          <NumericParameterField
            key={definition.field}
            definition={definition}
            idPrefix={idPrefix}
            value={parameters[definition.field]}
            onChange={(event) => updateNumericParameter(definition, event)}
          />
        ))}
      </fieldset>

      <PhysicalSummary summary={summary} idPrefix={idPrefix} />
      <VisualEstimate
        visualProfile={visualProfile}
        idPrefix={idPrefix}
        targetName={targetName}
        targetProfile={targetProfile}
      />

      <label className="field-stack" htmlFor={`${idPrefix}-impact-camera`}>
        <span>Event camera</span>
        <select
          id={`${idPrefix}-impact-camera`}
          value={parameters.cameraMode}
          disabled={disabled}
          data-testid="impact-camera-preset"
          aria-describedby={`${idPrefix}-camera-help`}
          onChange={(event) => updateCameraMode(event.currentTarget.value as ImpactCameraMode)}
        >
          {CAMERA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help" id={`${idPrefix}-camera-help`}>
        Scenario-local cameras never overwrite the saved observatory camera.
      </p>

      {impactorSizeExaggerated ? (
        <p
          className="mode-badge mode-badge-warning"
          data-testid="impact-size-exaggeration-badge"
        >
          IMPACTOR SIZE EXAGGERATED — enlarged only for visibility
        </p>
      ) : null}

      {aftermath === null ? null : (
        <p
          className="mode-badge mode-badge-warning"
          data-testid="impact-aftermath-badge"
          data-aftermath-kind={aftermath.kind}
        >
          {aftermath.label}
        </p>
      )}

      {active ? (
        <ActiveScenarioControls
          state={state}
          stage={stage}
          scenarioTimeSeconds={snapshot.scenarioTimeSeconds}
          progress={snapshot.progress}
          playbackRate={snapshot.playbackRate}
          disabled={disabled}
          running={running}
          paused={paused}
          complete={complete}
          targetProfile={targetProfile}
          onPause={onPause}
          onResume={onResume}
          onFrameStep={onFrameStep}
          onReplay={onReplay}
          onReset={onReset}
        />
      ) : (
        <div className="impact-run-controls">
          {!valid ? (
            <p className="scale-warning" role="alert" data-testid="impact-parameter-error">
              Correct the highlighted parameter values before running the event.
            </p>
          ) : null}
          <button
            className="button button-primary"
            type="button"
            data-testid="impact-run"
            disabled={disabled || !valid}
            aria-describedby={`${idPrefix}-model-caveat`}
            onClick={() => setConfirmationOpen(true)}
          >
            Run impact
          </button>
        </div>
      )}

      <ObservatoryDialog
        open={confirmationOpen}
        title={`Confirm ${targetName} impact`}
        description="Photosensitivity warning: this event includes an impact flash and abrupt exposure changes."
        onClose={() => setConfirmationOpen(false)}
        initialFocusRef={confirmationCancelRef}
        returnFocusRef={panelHeadingRef as RefObject<HTMLElement | null>}
        closeLabel="Cancel"
        testId="impact-confirmation"
      >
        <p className="mode-badge mode-badge-warning">Educational approximation</p>
        <p>
          The observatory will pause while the deterministic event runs. Reset restores the
          pristine {targetName}, observatory camera, and exposure.
        </p>
        <label className="reduce-flashes-control">
          <input
            type="checkbox"
            checked={reduceFlashes}
            onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
          />
          Reduce flashes and abrupt exposure changes
        </label>
        <div className="dialog-action-row">
          <button
            ref={confirmationCancelRef}
            className="button button-secondary"
            type="button"
            data-testid="impact-confirm-cancel"
            onClick={() => setConfirmationOpen(false)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            data-testid="impact-confirm"
            onClick={confirmRun}
          >
            Start deterministic impact
          </button>
        </div>
      </ObservatoryDialog>
    </aside>
  );
}

function NumericParameterField({
  definition,
  idPrefix,
  value,
  onChange,
}: {
  readonly definition: Readonly<NumericParameterDefinition>;
  readonly idPrefix: string;
  readonly value: number;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputId = `${idPrefix}-${definition.field}`;
  const helpId = `${inputId}-help`;
  const valid =
    Number.isFinite(value) &&
    value >= definition.min &&
    value <= definition.max &&
    (definition.field !== 'seed' || Number.isInteger(value));
  return (
    <label className="field-stack" htmlFor={inputId}>
      <span>
        {definition.label} <small>({definition.unit})</small>
      </span>
      <input
        id={inputId}
        type="number"
        value={value}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        required
        aria-invalid={!valid}
        aria-describedby={helpId}
        data-testid={definition.testId}
        onChange={onChange}
      />
      <small className="field-help" id={helpId}>{definition.help}</small>
    </label>
  );
}

function PhysicalSummary({
  summary,
  idPrefix,
}: {
  readonly summary: Readonly<ImpactPhysicalSummary>;
  readonly idPrefix: string;
}) {
  return (
    <section aria-labelledby={`${idPrefix}-physical-summary-heading`}>
      <p className="eyebrow">Calculated quantities</p>
      <h3 id={`${idPrefix}-physical-summary-heading`}>Physical summary</h3>
      <dl className="inspector-grid impact-physical-summary" aria-live="polite" aria-atomic="true">
        <SummaryValue
          testId="impact-mass"
          label="Mass"
          value={summary.massKg}
          display={formatScientific(summary.massKg, 'kg')}
        />
        <SummaryValue
          testId="impact-energy"
          label="Kinetic energy"
          value={summary.kineticEnergyJ}
          display={formatScientific(summary.kineticEnergyJ, 'J')}
        />
        <SummaryValue
          testId="impact-tnt"
          label="TNT equivalent"
          value={summary.tntMegatons}
          display={`${formatNumber(summary.tntMegatons)} Mt TNT`}
        />
        <SummaryValue
          testId="impact-entry-speed-summary"
          label="Entry speed"
          value={summary.entrySpeedMps}
          display={formatScientific(summary.entrySpeedMps, 'm/s')}
        />
        <div>
          <dt>Outcome</dt>
          <dd data-testid="impact-surface-outcome">
            {impactOutcomeLabel(summary)}
          </dd>
        </div>
        {summary.estimatedAirburstAltitudeM === undefined ? null : (
          <SummaryValue
            testId="impact-airburst-altitude"
            label="Estimated airburst altitude"
            value={summary.estimatedAirburstAltitudeM}
            display={formatScientific(summary.estimatedAirburstAltitudeM, 'm')}
          />
        )}
      </dl>
    </section>
  );
}

function VisualEstimate({
  visualProfile,
  idPrefix,
  targetName,
  targetProfile,
}: {
  readonly visualProfile: Readonly<ImpactVisualProfile>;
  readonly idPrefix: string;
  readonly targetName: string;
  readonly targetProfile: Readonly<ImpactTargetProfile>;
}) {
  const giantTarget =
    targetProfile.targetClass === 'gas-giant' ||
    targetProfile.targetClass === 'ice-giant';
  const craterApplicable = targetProfile.supportsCrater && visualProfile.craterRadiusM > 0;
  const caveat = visualEstimateCaveat(targetProfile);
  return (
    <section aria-labelledby={`${idPrefix}-visual-estimate-heading`}>
      <p className="eyebrow">Artistically scaled effects</p>
      <h3 id={`${idPrefix}-visual-estimate-heading`}>Approximate visual estimate</h3>
      <p className="scale-warning" data-testid="impact-visual-caveat">
        {caveat}
      </p>
      <dl className="inspector-grid impact-visual-summary">
        {craterApplicable ? (
          <SummaryValue
            testId="impact-crater-radius"
            label="Crater radius"
            value={visualProfile.craterRadiusM}
            display={formatScientific(visualProfile.craterRadiusM, 'm')}
          />
        ) : (
          <div>
            <dt>Crater radius</dt>
            <dd data-testid="impact-crater-radius" data-value="0">
              Not applicable for {targetName}
            </dd>
          </div>
        )}
        {giantTarget ? null : (
          <SummaryValue
            testId="impact-ejecta-radius"
            label="Ejecta radius"
            value={visualProfile.ejectaRadiusM}
            display={formatScientific(visualProfile.ejectaRadiusM, 'm')}
          />
        )}
        <SummaryValue
          testId="impact-plume-height"
          label={giantTarget ? 'Atmospheric plume height' : 'Plume height'}
          value={visualProfile.plumeHeightM}
          display={formatScientific(visualProfile.plumeHeightM, 'm')}
        />
        <SummaryValue
          testId="impact-shockwave-speed"
          label={giantTarget ? 'Cloud-ripple visual speed' : 'Ground-wave visual speed'}
          value={giantTarget
            ? visualProfile.atmosphericShockwaveSpeedMps
            : visualProfile.groundShockwaveSpeedMps}
          display={formatScientific(
            giantTarget
              ? visualProfile.atmosphericShockwaveSpeedMps
              : visualProfile.groundShockwaveSpeedMps,
            'm/s',
          )}
        />
        {giantTarget ? (
          <>
            <SummaryValue
              testId="impact-cloud-scar-radius"
              label="Cloud-scar radius"
              value={visualProfile.cloudScarRadiusM}
              display={formatScientific(visualProfile.cloudScarRadiusM, 'm')}
            />
            <SummaryValue
              testId="impact-cloud-scar-lifetime"
              label="Cloud-scar lifetime"
              value={visualProfile.cloudScarLifetimeSeconds}
              display={`${formatNumber(visualProfile.cloudScarLifetimeSeconds)} s`}
            />
          </>
        ) : (
          <SummaryValue
            testId="impact-dust-lifetime"
            label={targetProfile.atmosphereProfileId === undefined
              ? 'Debris/dust lifetime'
              : 'Dust/haze lifetime'}
            value={visualProfile.dustLifetimeSeconds}
            display={`${formatNumber(visualProfile.dustLifetimeSeconds)} s`}
          />
        )}
      </dl>
      {visualProfile.approximationNotes.length === 0 ? null : (
        <ul className="impact-approximation-notes" data-testid="impact-approximation-notes">
          {visualProfile.approximationNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </section>
  );
}

function ActiveScenarioControls({
  state,
  stage,
  scenarioTimeSeconds,
  progress,
  playbackRate,
  disabled,
  running,
  paused,
  complete,
  targetProfile,
  onPause,
  onResume,
  onFrameStep,
  onReplay,
  onReset,
}: {
  readonly state: string;
  readonly stage: string;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly playbackRate: number;
  readonly disabled: boolean;
  readonly running: boolean;
  readonly paused: boolean;
  readonly complete: boolean;
  readonly targetProfile: Readonly<ImpactTargetProfile>;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  const progressPercent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <section className="impact-active-controls" aria-labelledby="impact-active-heading">
      <h3 id="impact-active-heading">Impact event controls</h3>
      <p className="scale-warning" data-testid="impact-active-warning">
        {activeApproximationWarning(targetProfile)}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" data-testid="impact-event-status">
        <strong>{humanize(stage)}</strong>
        {' · '}{formatNumber(scenarioTimeSeconds)} s
        {' · '}{progressPercent}%
        {' · '}{formatNumber(playbackRate)}x
        {complete ? ' · complete' : ` · ${humanize(state)}`}
      </p>
      <div className="transport-row">
        {running ? (
          <button className="button button-secondary" type="button" data-testid="impact-pause" disabled={disabled} onClick={onPause}>
            Pause event
          </button>
        ) : null}
        {paused ? (
          <>
            <button className="button button-secondary" type="button" data-testid="impact-resume" disabled={disabled} onClick={onResume}>
              Resume event
            </button>
            <button className="button button-secondary" type="button" data-testid="impact-step" disabled={disabled} onClick={onFrameStep}>
              Step one frame
            </button>
          </>
        ) : null}
        <button className="button button-secondary" type="button" data-testid="impact-replay" disabled={disabled} onClick={onReplay}>
          Replay same event
        </button>
        <button className="button button-primary" type="button" data-testid="impact-reset" disabled={disabled} onClick={onReset}>
          Reset to observatory
        </button>
      </div>
    </section>
  );
}

function SummaryValue({
  testId,
  label,
  value,
  display,
}: {
  readonly testId: string;
  readonly label: string;
  readonly value: number;
  readonly display: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-testid={testId} data-value={String(value)}>{display}</dd>
    </div>
  );
}

function parametersAreValid(parameters: Readonly<ImpactParameters>): boolean {
  return NUMERIC_PARAMETERS.every((definition) => {
    const value = parameters[definition.field];
    return Number.isFinite(value) && value >= definition.min && value <= definition.max &&
      (definition.field !== 'seed' || Number.isInteger(value));
  });
}

function isImpactorSizeExaggerated(diameterM: number, targetRadiusM: number): boolean {
  if (!(diameterM > 0) || !(targetRadiusM > 0)) return false;
  const physicalRadius = diameterM * 0.5 / targetRadiusM;
  const authoredRadius = Math.min(
    0.012,
    0.00042 * Math.max(0.25, (diameterM / 40) ** 0.38),
  );
  const visualRadius = Math.max(physicalRadius, authoredRadius);
  return visualRadius > physicalRadius * (1 + 1e-6);
}

function visualEstimateCaveat(target: Readonly<ImpactTargetProfile>): string {
  if (target.targetClass === 'gas-giant' || target.targetClass === 'ice-giant') {
    return 'Atmospheric ripple, plume, and cloud-scar scales are educational approximations and may be exaggerated for visibility.';
  }
  if (target.atmosphereProfileId === undefined) {
    return 'Crater, ejecta, ground disturbance, vapor plume, and debris scales are educational approximations and may be exaggerated for visibility.';
  }
  return 'Crater, ejecta, ground and atmospheric waves, plume, and haze scales are educational approximations and may be exaggerated for visibility.';
}

function activeApproximationWarning(target: Readonly<ImpactTargetProfile>): string {
  if (target.targetClass === 'gas-giant' || target.targetClass === 'ice-giant') {
    return 'Educational approximation active. Atmospheric entry, cloud ripple, plume, and cloud scar are simplified.';
  }
  if (target.atmosphereProfileId === undefined) {
    return 'Educational approximation active. This target is airless; crater, ejecta, ground disturbance, and vapor plume are simplified.';
  }
  return 'Educational approximation active. Atmospheric entry, crater, ejecta, waves, and plume are simplified.';
}

function impactAftermathPresentation(
  target: Readonly<ImpactTargetProfile>,
  summary: Readonly<ImpactPhysicalSummary>,
  stage: string,
): Readonly<{ kind: 'crater' | 'dusty-crater' | 'cloud-scar'; label: string }> | null {
  if (!POST_EVENT_STAGES.has(stage)) return null;
  if (summary.outcomeKind === 'solid-surface-impact' && target.supportsCrater) {
    return target.targetClass === 'thin-atmosphere-rocky'
      ? Object.freeze({
          kind: 'dusty-crater' as const,
          label: 'DUSTY CRATER AFTERMATH — PERSISTS UNTIL RESET',
        })
      : Object.freeze({
          kind: 'crater' as const,
          label: 'LOCAL CRATER / SCORCH — PERSISTS UNTIL RESET',
        });
  }
  if (target.supportsCloudScar) {
    return Object.freeze({
      kind: 'cloud-scar' as const,
      label: 'ATMOSPHERIC CLOUD SCAR — TEMPORARY DISTURBANCE',
    });
  }
  return null;
}

function formatScientific(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `Unavailable ${unit}`;
  return `${value.toExponential(4)} ${unit}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function impactOutcomeLabel(summary: Readonly<ImpactPhysicalSummary>): string {
  switch (summary.outcomeKind) {
    case 'solid-surface-impact': return 'Surface impact';
    case 'airburst': return 'Atmospheric airburst';
    case 'deep-atmosphere-breakup': return 'Deep-atmosphere cloud-top encounter';
  }
}

function humanize(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTargetBodyName(bodyId: ImpactParameters['targetBodyId']): string {
  return bodyId.charAt(0).toUpperCase() + bodyId.slice(1);
}
