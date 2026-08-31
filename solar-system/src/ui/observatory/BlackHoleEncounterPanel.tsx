import {
  type ChangeEvent,
  type RefObject,
  useId,
  useRef,
  useState,
} from 'react';

import type { ScenarioPlaybackState } from '../../simulation/scenarios/ScenarioModule';
import { ObservatoryDialog } from './ObservatoryDialog';

export const COMPLETE_CONSUMPTION_CINEMATIC_WARNING =
  'Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.';

export const BLACK_HOLE_EQUAL_MASS_NOTE =
  'Equal-mass misconception check: replacing the Sun with an equal-mass black hole, while keeping every body\'s position and velocity unchanged, would not by gravity alone make the planets fall in.';

export const BLACK_HOLE_PHYSICS_CAVEAT =
  'Educational approximation: Newtonian N-body gravity uses a numerical capture threshold; this is not an orbital general-relativity solver. Survival, ejection, and capture are possible outcomes, never guaranteed.';

export const BLACK_HOLE_CINEMATIC_PHOTOSENSITIVITY_WARNING =
  'Photosensitivity warning: this cinematic includes bright accretion flares, lensing pulses, and abrupt exposure changes.';

const ASTRONOMICAL_UNIT_M = 149_597_870_700;
const SPEED_OF_LIGHT_MPS = 299_792_458;
const GRAVITATIONAL_CONSTANT_M3_KG_S2 = 6.674_30e-11;
const SOLAR_MASS_KG = 1.988_47e30;

const PARAMETER_LIMITS = Object.freeze({
  massSolarMasses: Object.freeze({ minimum: 1, maximum: 1_000 }),
  vectorPositionAu: Object.freeze({ minimum: -10_000, maximum: 10_000 }),
  vectorVelocityKmps: Object.freeze({ minimum: -10_000, maximum: 10_000 }),
  closestApproachTimeSeconds: Object.freeze({ minimum: 1, maximum: 6_220_800 }),
  seed: Object.freeze({ minimum: 0, maximum: 4_294_967_295 }),
});

export type BlackHoleEncounterMode =
  | 'physics-flyby'
  | 'complete-consumption-cinematic';

export type BlackHoleAccuracy = 'balanced' | 'high' | 'ultra';
export type BlackHoleActivePlaybackState = Exclude<ScenarioPlaybackState, 'idle'>;
export type BlackHoleBodyOutcome =
  | 'intact'
  | 'tidally-stressed'
  | 'disrupted'
  | 'accretion-stream'
  | 'captured'
  | 'ejected';

export type BlackHoleVector3 = readonly [number, number, number];

export interface BlackHoleFlybyPanelParameters {
  readonly massSolarMasses: number;
  readonly initialPositionM: BlackHoleVector3;
  readonly initialVelocityMps: BlackHoleVector3;
  readonly closestApproachTargetM: BlackHoleVector3;
  readonly closestApproachTimeSeconds: number;
  readonly spinVisualization: number;
  readonly accretionDiskEnabled: boolean;
  readonly captureRadiusMultiple: number;
  readonly accuracy: BlackHoleAccuracy;
  readonly seed: number;
}

export interface BlackHolePanelDiagnostics {
  readonly kineticEnergyJ: number;
  readonly potentialEnergyJ: number;
  readonly totalEnergyJ: number;
  readonly linearMomentumMagnitudeKgMps: number;
  readonly angularMomentumMagnitudeKgM2ps: number;
  readonly relativeEnergyDrift: number;
  readonly relativeLinearMomentumDrift: number;
  readonly relativeAngularMomentumDrift: number;
  readonly minimumPairDistanceM: number;
  readonly chosenSubstepSeconds: number;
  readonly completedSubsteps: number;
  readonly finite: boolean;
}

export interface BlackHolePanelBodyState {
  readonly bodyId: string;
  readonly outcome: BlackHoleBodyOutcome;
  readonly tidalStress: number;
  readonly streamProgress: number;
  readonly captureProgress: number;
}

interface BlackHolePanelStateBase {
  readonly state: BlackHoleActivePlaybackState;
  readonly stage: string;
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly diagnostics: Readonly<BlackHolePanelDiagnostics>;
  readonly bodyStates: readonly Readonly<BlackHolePanelBodyState>[];
  readonly captureCount: number;
  readonly ejectionCount: number;
  readonly survivorCount: number;
  readonly allBodiesCaptured: boolean;
}

export interface BlackHolePhysicsFlybyPanelState extends BlackHolePanelStateBase {
  readonly mode: 'physics-flyby';
}

export interface CompleteConsumptionPanelState extends BlackHolePanelStateBase {
  readonly mode: 'complete-consumption-cinematic';
}

export type BlackHoleEncounterActiveScenario =
  | BlackHolePhysicsFlybyPanelState
  | CompleteConsumptionPanelState;

export interface BlackHoleEncounterPanelProps {
  readonly parameters: Readonly<BlackHoleFlybyPanelParameters>;
  readonly activeScenario: Readonly<BlackHoleEncounterActiveScenario> | null;
  readonly disabled?: boolean;
  readonly reduceFlashes: boolean;
  readonly onParametersChange: (parameters: Readonly<BlackHoleFlybyPanelParameters>) => void;
  readonly onReduceFlashesChange: (reduceFlashes: boolean) => void;
  readonly onStartPhysicsFlyby: (parameters: Readonly<BlackHoleFlybyPanelParameters>) => void;
  readonly onStartCompleteConsumption: () => void;
  readonly onClose: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}

interface VectorParameterDefinition {
  readonly field: 'initialPositionM' | 'initialVelocityMps' | 'closestApproachTargetM';
  readonly legend: string;
  readonly unit: 'AU' | 'km/s';
  readonly scale: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly testIdPrefix: string;
  readonly help: string;
}

const VECTOR_PARAMETERS: readonly Readonly<VectorParameterDefinition>[] = Object.freeze([
  Object.freeze({
    field: 'initialPositionM',
    legend: 'Initial black-hole position vector',
    unit: 'AU',
    scale: ASTRONOMICAL_UNIT_M,
    minimum: PARAMETER_LIMITS.vectorPositionAu.minimum,
    maximum: PARAMETER_LIMITS.vectorPositionAu.maximum,
    step: 0.1,
    testIdPrefix: 'black-hole-position',
    help: 'Cartesian start position. Editing it recalculates velocity from the planned target and time.',
  }),
  Object.freeze({
    field: 'initialVelocityMps',
    legend: 'Initial black-hole velocity vector',
    unit: 'km/s',
    scale: 1_000,
    minimum: PARAMETER_LIMITS.vectorVelocityKmps.minimum,
    maximum: PARAMETER_LIMITS.vectorVelocityKmps.maximum,
    step: 0.1,
    testIdPrefix: 'black-hole-velocity',
    help: 'Cartesian velocity relative to the scenario origin. Editing it recalculates the planning target.',
  }),
  Object.freeze({
    field: 'closestApproachTargetM',
    legend: 'Closest-approach target vector',
    unit: 'AU',
    scale: ASTRONOMICAL_UNIT_M,
    minimum: PARAMETER_LIMITS.vectorPositionAu.minimum,
    maximum: PARAMETER_LIMITS.vectorPositionAu.maximum,
    step: 0.1,
    testIdPrefix: 'black-hole-target',
    help: 'A ballistic planning target coupled to velocity and time; gravity can move the actual pericenter.',
  }),
]);

const AXES = Object.freeze(['x', 'y', 'z'] as const);

export function BlackHoleEncounterPanel({
  parameters,
  activeScenario,
  disabled = false,
  reduceFlashes,
  onParametersChange,
  onReduceFlashesChange,
  onStartPhysicsFlyby,
  onStartCompleteConsumption,
  onClose,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: BlackHoleEncounterPanelProps) {
  const [physicsConfirmationOpen, setPhysicsConfirmationOpen] = useState(false);
  const [cinematicConfirmationOpen, setCinematicConfirmationOpen] = useState(false);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const physicsCancelRef = useRef<HTMLButtonElement>(null);
  const cinematicCancelRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();
  const active = activeScenario !== null;
  const valid = parametersAreValid(parameters);
  const heading = activeScenario === null
    ? 'Black-Hole Encounter'
    : activeScenario.mode === 'physics-flyby'
      ? 'Physics Flyby'
      : 'Complete Consumption — Cinematic';

  const updateNumber = (
    field:
      | 'massSolarMasses'
      | 'closestApproachTimeSeconds'
      | 'spinVisualization'
      | 'captureRadiusMultiple'
      | 'seed',
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.valueAsNumber;
    if (!Number.isFinite(value)) return;
    if (field === 'closestApproachTimeSeconds') {
      onParametersChange({
        ...parameters,
        closestApproachTimeSeconds: value,
        initialVelocityMps: velocityForPlannedEncounter(
          parameters.initialPositionM,
          parameters.closestApproachTargetM,
          value,
        ),
      });
      return;
    }
    onParametersChange({ ...parameters, [field]: value });
  };

  const updateVector = (
    definition: Readonly<VectorParameterDefinition>,
    axisIndex: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const displayValue = event.currentTarget.valueAsNumber;
    if (!Number.isFinite(displayValue)) return;
    const vector: [number, number, number] = [...parameters[definition.field]];
    vector[axisIndex] = displayValue * definition.scale;
    if (definition.field === 'initialVelocityMps') {
      onParametersChange({
        ...parameters,
        initialVelocityMps: vector,
        closestApproachTargetM: targetForInitialVelocity(
          parameters.initialPositionM,
          vector,
          parameters.closestApproachTimeSeconds,
        ),
      });
      return;
    }
    const next = { ...parameters, [definition.field]: vector };
    onParametersChange({
      ...next,
      initialVelocityMps: velocityForPlannedEncounter(
        next.initialPositionM,
        next.closestApproachTargetM,
        next.closestApproachTimeSeconds,
      ),
    });
  };

  const confirmPhysics = () => {
    setPhysicsConfirmationOpen(false);
    onStartPhysicsFlyby(parameters);
  };

  const confirmCinematic = () => {
    setCinematicConfirmationOpen(false);
    onStartCompleteConsumption();
  };

  return (
    <aside
      className="control-panel black-hole-encounter-panel"
      aria-labelledby={`${idPrefix}-heading`}
      data-testid="black-hole-encounter-panel"
      data-black-hole-mode={activeScenario?.mode ?? 'idle'}
      data-black-hole-state={activeScenario?.state ?? 'idle'}
      data-black-hole-stage={activeScenario?.stage ?? 'idle'}
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Two independent encounter modes</p>
          <h2 id={`${idPrefix}-heading`} ref={panelHeadingRef} tabIndex={-1}>
            {heading}
          </h2>
        </div>
        <button
          className="button button-secondary"
          type="button"
          data-testid="black-hole-encounter-close"
          aria-label="Close Black-Hole Encounter"
          disabled={disabled || active}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {activeScenario === null ? (
        <BlackHoleChoices
          idPrefix={idPrefix}
          parameters={parameters}
          disabled={disabled}
          valid={valid}
          onParametersChange={onParametersChange}
          onNumberChange={updateNumber}
          onVectorChange={updateVector}
          onRequestPhysics={() => setPhysicsConfirmationOpen(true)}
          onRequestCinematic={() => setCinematicConfirmationOpen(true)}
        />
      ) : activeScenario.mode === 'physics-flyby' ? (
        <PhysicsFlybyActive
          scenario={activeScenario}
          disabled={disabled}
          onPause={onPause}
          onResume={onResume}
          onFrameStep={onFrameStep}
          onSkip={onSkip}
          onReplay={onReplay}
          onReset={onReset}
        />
      ) : (
        <CompleteConsumptionActive
          scenario={activeScenario}
          disabled={disabled}
          reduceFlashes={reduceFlashes}
          onReduceFlashesChange={onReduceFlashesChange}
          onPause={onPause}
          onResume={onResume}
          onFrameStep={onFrameStep}
          onSkip={onSkip}
          onReplay={onReplay}
          onReset={onReset}
        />
      )}

      <ObservatoryDialog
        open={physicsConfirmationOpen}
        title="Confirm Physics Flyby"
        description="This destructive scenario temporarily takes control of the observatory. Reset restores its ephemeris, camera, scales, exposure, and body visibility."
        onClose={() => setPhysicsConfirmationOpen(false)}
        initialFocusRef={physicsCancelRef}
        returnFocusRef={panelHeadingRef as RefObject<HTMLElement | null>}
        closeLabel="Cancel"
        className="black-hole-confirmation black-hole-physics-confirmation"
        testId="black-hole-physics-confirmation"
      >
        <p className="mode-badge" data-testid="black-hole-physics-confirmation-classification">
          Educational approximation · outcome not guaranteed
        </p>
        <p data-testid="black-hole-physics-confirmation-caveat">{BLACK_HOLE_PHYSICS_CAVEAT}</p>
        <p data-testid="black-hole-physics-confirmation-equal-mass-note">
          {BLACK_HOLE_EQUAL_MASS_NOTE}
        </p>
        <div className="dialog-action-row">
          <button
            ref={physicsCancelRef}
            className="button button-secondary"
            type="button"
            data-testid="black-hole-physics-confirm-cancel"
            onClick={() => setPhysicsConfirmationOpen(false)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            data-testid="black-hole-physics-confirm"
            disabled={disabled || !valid}
            onClick={confirmPhysics}
          >
            Start deterministic flyby
          </button>
        </div>
      </ObservatoryDialog>

      <ObservatoryDialog
        open={cinematicConfirmationOpen}
        title="Confirm Complete Consumption — Cinematic"
        description={BLACK_HOLE_CINEMATIC_PHOTOSENSITIVITY_WARNING}
        onClose={() => setCinematicConfirmationOpen(false)}
        initialFocusRef={cinematicCancelRef}
        returnFocusRef={panelHeadingRef as RefObject<HTMLElement | null>}
        closeLabel="Cancel"
        className="black-hole-confirmation black-hole-cinematic-confirmation"
        testId="black-hole-cinematic-confirmation"
      >
        <p
          className="mode-badge mode-badge-warning"
          data-testid="black-hole-cinematic-confirmation-classification"
        >
          Cinematic · deliberately nonphysical · guaranteed outcome
        </p>
        <p
          className="scale-warning"
          data-testid="black-hole-cinematic-confirmation-warning"
        >
          {COMPLETE_CONSUMPTION_CINEMATIC_WARNING}
        </p>
        <p>
          Damping, disruption order, accretion timing, and capture choreography are artistic.
          They are isolated from Physics Flyby and normal observatory propagation.
        </p>
        <label className="reduce-flashes-control">
          <input
            type="checkbox"
            checked={reduceFlashes}
            data-testid="black-hole-cinematic-confirm-reduce-flashes"
            onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
          />
          Reduce flashes and abrupt exposure changes
        </label>
        <div className="dialog-action-row">
          <button
            ref={cinematicCancelRef}
            className="button button-secondary"
            type="button"
            data-testid="black-hole-cinematic-confirm-cancel"
            onClick={() => setCinematicConfirmationOpen(false)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            data-testid="black-hole-cinematic-confirm"
            disabled={disabled}
            onClick={confirmCinematic}
          >
            Start cinematic consumption
          </button>
        </div>
      </ObservatoryDialog>
    </aside>
  );
}

function BlackHoleChoices({
  idPrefix,
  parameters,
  disabled,
  valid,
  onParametersChange,
  onNumberChange,
  onVectorChange,
  onRequestPhysics,
  onRequestCinematic,
}: {
  readonly idPrefix: string;
  readonly parameters: Readonly<BlackHoleFlybyPanelParameters>;
  readonly disabled: boolean;
  readonly valid: boolean;
  readonly onParametersChange: (parameters: Readonly<BlackHoleFlybyPanelParameters>) => void;
  readonly onNumberChange: (
    field:
      | 'massSolarMasses'
      | 'closestApproachTimeSeconds'
      | 'spinVisualization'
      | 'captureRadiusMultiple'
      | 'seed',
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  readonly onVectorChange: (
    definition: Readonly<VectorParameterDefinition>,
    axisIndex: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  readonly onRequestPhysics: () => void;
  readonly onRequestCinematic: () => void;
}) {
  const physicsHeadingId = `${idPrefix}-physics-heading`;
  const physicsCaveatId = `${idPrefix}-physics-caveat`;
  const cinematicHeadingId = `${idPrefix}-cinematic-heading`;
  const cinematicWarningId = `${idPrefix}-cinematic-warning`;
  return (
    <div className="black-hole-choice-list">
      <p className="black-hole-mode-distinction" data-testid="black-hole-mode-distinction">
        Choose one mutually exclusive mode: a deterministic educational physics flyby with
        open outcomes, or a deliberately nonphysical cinematic that guarantees consumption.
      </p>

      <section
        className="black-hole-option black-hole-physics-option"
        aria-labelledby={physicsHeadingId}
        data-testid="black-hole-physics-option"
        data-classification="educational-approximation"
      >
        <p className="mode-badge" data-testid="black-hole-physics-classification">
          Educational approximation · deterministic N-body flyby
        </p>
        <h3 id={physicsHeadingId}>Physics Flyby</h3>
        <p className="field-help" id={physicsCaveatId} data-testid="black-hole-physics-caveat">
          {BLACK_HOLE_PHYSICS_CAVEAT}
        </p>
        <p className="scale-warning" data-testid="black-hole-equal-mass-note">
          {BLACK_HOLE_EQUAL_MASS_NOTE}
        </p>

        <fieldset
          className="black-hole-parameter-controls"
          disabled={disabled}
          aria-describedby={physicsCaveatId}
        >
          <legend>External black-hole initial conditions</legend>
          <div className="black-hole-parameter-grid">
            <NumericField
              id={`${idPrefix}-black-hole-mass`}
              testId="black-hole-mass"
              label="Black-hole mass"
              unit="solar masses"
              value={parameters.massSolarMasses}
              minimum={PARAMETER_LIMITS.massSolarMasses.minimum}
              maximum={PARAMETER_LIMITS.massSolarMasses.maximum}
              step={0.1}
              help="Sets the external compact object's mass; it does not replace the Sun."
              onChange={(event) => onNumberChange('massSolarMasses', event)}
            />

            {VECTOR_PARAMETERS.map((definition) => (
              <VectorField
                key={definition.field}
                idPrefix={idPrefix}
                definition={definition}
                vector={parameters[definition.field]}
                onChange={(axisIndex, event) => onVectorChange(definition, axisIndex, event)}
              />
            ))}

            <NumericField
              id={`${idPrefix}-closest-time`}
              testId="black-hole-closest-time"
              label="Planned closest-approach time"
              unit="physical s"
              value={parameters.closestApproachTimeSeconds}
              minimum={PARAMETER_LIMITS.closestApproachTimeSeconds.minimum}
              maximum={PARAMETER_LIMITS.closestApproachTimeSeconds.maximum}
              step={1}
              help="Ballistic time used with the start and target vectors to recalculate velocity; gravity still changes the actual pericenter."
              onChange={(event) => onNumberChange('closestApproachTimeSeconds', event)}
            />

            <label className="field-stack" htmlFor={`${idPrefix}-accuracy`}>
              <span>Accuracy / fixed-substep policy</span>
              <select
                id={`${idPrefix}-accuracy`}
                value={parameters.accuracy}
                data-testid="black-hole-accuracy"
                aria-describedby={`${idPrefix}-accuracy-help`}
                onChange={(event) => onParametersChange({
                  ...parameters,
                  accuracy: event.currentTarget.value as BlackHoleAccuracy,
                })}
              >
                <option value="balanced">Balanced · wider substep</option>
                <option value="high">High · tighter substep</option>
                <option value="ultra">Ultra · tightest substep</option>
              </select>
              <small className="field-help" id={`${idPrefix}-accuracy-help`}>
                The chosen fixed substep and completed substep count appear in live diagnostics.
              </small>
            </label>

            <NumericField
              id={`${idPrefix}-seed`}
              testId="black-hole-seed"
              label="Deterministic seed"
              unit="integer"
              value={parameters.seed}
              minimum={PARAMETER_LIMITS.seed.minimum}
              maximum={PARAMETER_LIMITS.seed.maximum}
              step={1}
              integer
              help="Selects repeatable disruption-stream visuals and the run signature; the Newtonian force model itself is not randomized."
              onChange={(event) => onNumberChange('seed', event)}
            />
            <NumericField
              id={`${idPrefix}-capture-radius-multiple`}
              testId="black-hole-capture-radius-multiple"
              label="Numerical capture boundary"
              unit="Schwarzschild radii"
              value={parameters.captureRadiusMultiple}
              minimum={1}
              maximum={10_000}
              step={0.1}
              help="Scenario removal threshold only; changing it does not enlarge the event horizon."
              onChange={(event) => onNumberChange('captureRadiusMultiple', event)}
            />
          </div>

          <div className="black-hole-parameter-grid">
            <NumericField
              id={`${idPrefix}-spin`}
              testId="black-hole-spin"
              label="Spin visualization"
              unit="dimensionless"
              value={parameters.spinVisualization}
              minimum={-1}
              maximum={1}
              step={0.05}
              help="Rendering-only spin direction and strength; it does not add orbital general relativity."
              onChange={(event) => onNumberChange('spinVisualization', event)}
            />
          </div>
          <div className="layer-controls black-hole-toggle-controls">
            <label>
              <input
                type="checkbox"
                checked={parameters.accretionDiskEnabled}
                data-testid="black-hole-accretion-disk"
                onChange={(event) => onParametersChange({
                  ...parameters,
                  accretionDiskEnabled: event.currentTarget.checked,
                })}
              />
              Accretion disk
            </label>
          </div>
        </fieldset>

        <BlackHolePhysicalSummary parameters={parameters} />

        {!valid ? (
          <p className="scale-warning" role="alert" data-testid="black-hole-parameter-error">
            Correct the highlighted parameter values before starting Physics Flyby.
          </p>
        ) : null}
        <button
          className="button button-primary"
          type="button"
          data-testid="black-hole-physics-start"
          disabled={disabled || !valid}
          aria-describedby={physicsCaveatId}
          onClick={onRequestPhysics}
        >
          Configure Physics Flyby
        </button>
      </section>

      <p className="black-hole-mode-separator" role="note">
        Separate force providers · artificial damping is never enabled in Physics Flyby
      </p>

      <section
        className="black-hole-option black-hole-cinematic-option"
        aria-labelledby={cinematicHeadingId}
        data-testid="black-hole-cinematic-option"
        data-classification="cinematic"
      >
        <p
          className="mode-badge mode-badge-warning"
          data-testid="black-hole-cinematic-classification"
        >
          Cinematic · deliberately nonphysical · guaranteed outcome
        </p>
        <h3 id={cinematicHeadingId}>Complete Consumption — Cinematic</h3>
        <p
          className="scale-warning"
          id={cinematicWarningId}
          data-testid="black-hole-cinematic-warning"
        >
          {COMPLETE_CONSUMPTION_CINEMATIC_WARNING}
        </p>
        <p>
          A scenario-only damping force stages disruption, accretion streams, and capture of
          every included body: the Sun, Moon, and all eight planets. Damping strength,
          ordering, and timing are artistic; comets are hidden because their catalog does not
          invent unknown masses.
        </p>
        <button
          className="button button-primary"
          type="button"
          data-testid="black-hole-cinematic-start"
          disabled={disabled}
          aria-describedby={cinematicWarningId}
          onClick={onRequestCinematic}
        >
          Configure Complete Consumption
        </button>
      </section>
    </div>
  );
}

function VectorField({
  idPrefix,
  definition,
  vector,
  onChange,
}: {
  readonly idPrefix: string;
  readonly definition: Readonly<VectorParameterDefinition>;
  readonly vector: BlackHoleVector3;
  readonly onChange: (axisIndex: number, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const helpId = `${idPrefix}-${definition.field}-help`;
  return (
    <fieldset className="black-hole-vector-field" aria-describedby={helpId}>
      <legend>{definition.legend} ({definition.unit})</legend>
      <div className="black-hole-vector-grid">
        {AXES.map((axis, axisIndex) => {
          const value = (vector[axisIndex] ?? 0) / definition.scale;
          const inputId = `${idPrefix}-${definition.field}-${axis}`;
          const valid = Number.isFinite(value) &&
            value >= definition.minimum && value <= definition.maximum;
          return (
            <label className="field-stack" htmlFor={inputId} key={axis}>
              <span>{axis.toUpperCase()}</span>
              <input
                id={inputId}
                type="number"
                value={value}
                min={definition.minimum}
                max={definition.maximum}
                step={definition.step}
                required
                aria-invalid={!valid}
                data-testid={`${definition.testIdPrefix}-${axis}`}
                onChange={(event) => onChange(axisIndex, event)}
              />
            </label>
          );
        })}
      </div>
      <small className="field-help" id={helpId}>{definition.help}</small>
    </fieldset>
  );
}

function NumericField({
  id,
  testId,
  label,
  unit,
  value,
  minimum,
  maximum,
  step,
  integer = false,
  help,
  onChange,
}: {
  readonly id: string;
  readonly testId: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly integer?: boolean;
  readonly help: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const helpId = `${id}-help`;
  const valid = Number.isFinite(value) && value >= minimum && value <= maximum &&
    (!integer || Number.isInteger(value));
  return (
    <label className="field-stack" htmlFor={id}>
      <span>{label} <small>({unit})</small></span>
      <input
        id={id}
        type="number"
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        required
        aria-invalid={!valid}
        aria-describedby={helpId}
        data-testid={testId}
        onChange={onChange}
      />
      <small className="field-help" id={helpId}>{help}</small>
    </label>
  );
}

function BlackHolePhysicalSummary({
  parameters,
}: {
  readonly parameters: Readonly<BlackHoleFlybyPanelParameters>;
}) {
  const massKg = parameters.massSolarMasses * SOLAR_MASS_KG;
  const schwarzschildRadiusM = 2 * GRAVITATIONAL_CONSTANT_M3_KG_S2 * massKg /
    SPEED_OF_LIGHT_MPS ** 2;
  const captureRadiusM = schwarzschildRadiusM * parameters.captureRadiusMultiple;
  return (
    <section
      className="black-hole-physical-summary"
      aria-label="Black-hole physical summary"
      data-testid="black-hole-physical-summary"
    >
      <p className="eyebrow">Calculated quantities</p>
      <h4>Physical summary</h4>
      <dl className="inspector-grid" aria-live="polite" aria-atomic="true">
        <StatusValue
          label="Schwarzschild radius"
          value={formatDistance(schwarzschildRadiusM)}
          testId="black-hole-schwarzschild-radius"
          numericValue={schwarzschildRadiusM}
        />
        <StatusValue
          label="Numerical capture radius"
          value={formatDistance(captureRadiusM)}
          testId="black-hole-capture-radius"
          numericValue={captureRadiusM}
        />
      </dl>
      <p className="field-help" data-testid="black-hole-capture-radius-note">
        The Schwarzschild radius follows 2GM/c². The {formatNumber(parameters.captureRadiusMultiple)}×
        capture radius is a scenario removal threshold, not an event-horizon enlargement or an
        orbital-GR prediction.
      </p>
    </section>
  );
}

function PhysicsFlybyActive({
  scenario,
  disabled,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: {
  readonly scenario: Readonly<BlackHolePhysicsFlybyPanelState>;
  readonly disabled: boolean;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  return (
    <section
      className="black-hole-active black-hole-physics-active"
      aria-label="Physics Flyby status, diagnostics, and controls"
      data-testid="black-hole-physics-active"
    >
      <p className="mode-badge" data-testid="black-hole-physics-active-classification">
        Educational approximation · deterministic N-body flyby
      </p>
      <p className="field-help" data-testid="black-hole-physics-active-caveat">
        {BLACK_HOLE_PHYSICS_CAVEAT}
      </p>
      <p className="scale-warning" data-testid="black-hole-physics-active-equal-mass-note">
        {BLACK_HOLE_EQUAL_MASS_NOTE}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Physics Flyby stage: {formatStage(scenario.stage)}.
      </p>
      <ScenarioProgress
        label="Physics Flyby"
        stage={scenario.stage}
        scenarioTimeSeconds={scenario.scenarioTimeSeconds}
        totalDurationSeconds={scenario.totalDurationSeconds}
        progress={scenario.progress}
        testId="black-hole-physics-status"
      />
      <PhysicsDiagnostics scenario={scenario} />
      <OutcomeSummary scenario={scenario} prefix="black-hole-physics" />
      <p className="field-help" data-testid="black-hole-physics-outcome-note">
        A run may leave survivors, eject bodies, or capture bodies. No particular result is
        promised; change the mass, coupled trajectory, accuracy, or capture boundary to explore
        other deterministic outcomes. The seed changes procedural presentation, not gravity.
      </p>
      <BlackHoleTransport
        mode="physics-flyby"
        playbackState={scenario.state}
        disabled={disabled}
        onPause={onPause}
        onResume={onResume}
        onFrameStep={onFrameStep}
        onSkip={onSkip}
        onReplay={onReplay}
        onReset={onReset}
      />
    </section>
  );
}

function CompleteConsumptionActive({
  scenario,
  disabled,
  reduceFlashes,
  onReduceFlashesChange,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: {
  readonly scenario: Readonly<CompleteConsumptionPanelState>;
  readonly disabled: boolean;
  readonly reduceFlashes: boolean;
  readonly onReduceFlashesChange: (reduceFlashes: boolean) => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  return (
    <section
      className="black-hole-active black-hole-cinematic-active"
      aria-label="Complete Consumption cinematic status, warning, and controls"
      data-testid="black-hole-cinematic-active"
    >
      <p
        className="mode-badge mode-badge-warning"
        data-testid="black-hole-cinematic-active-classification"
      >
        Cinematic · deliberately nonphysical · guaranteed outcome
      </p>
      <p className="scale-warning" data-testid="black-hole-cinematic-active-warning">
        {COMPLETE_CONSUMPTION_CINEMATIC_WARNING}
      </p>
      <p className="field-help" data-testid="black-hole-cinematic-artistic-caveat">
        Artificial angular-momentum damping, disruption order, accretion timing, and capture
        choreography are artistic. Scenario timing is compressed.
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Complete Consumption cinematic stage: {formatStage(scenario.stage)}.
      </p>
      <ScenarioProgress
        label="Complete Consumption cinematic"
        stage={scenario.stage}
        scenarioTimeSeconds={scenario.scenarioTimeSeconds}
        totalDurationSeconds={scenario.totalDurationSeconds}
        progress={scenario.progress}
        testId="black-hole-cinematic-status"
      />
      <OutcomeSummary scenario={scenario} prefix="black-hole-cinematic" />
      <BodyCaptureStates bodyStates={scenario.bodyStates} />
      {scenario.allBodiesCaptured ? (
        <p className="mode-badge" data-testid="black-hole-all-bodies-captured">
          Every staged body is captured · cinematic objective complete
        </p>
      ) : null}
      <label className="reduce-flashes-control">
        <input
          type="checkbox"
          checked={reduceFlashes}
          data-testid="black-hole-cinematic-active-reduce-flashes"
          onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
        />
        Reduce flashes and abrupt exposure changes
      </label>
      <BlackHoleTransport
        mode="complete-consumption-cinematic"
        playbackState={scenario.state}
        disabled={disabled}
        onPause={onPause}
        onResume={onResume}
        onFrameStep={onFrameStep}
        onSkip={onSkip}
        onReplay={onReplay}
        onReset={onReset}
      />
    </section>
  );
}

function ScenarioProgress({
  label,
  stage,
  scenarioTimeSeconds,
  totalDurationSeconds,
  progress,
  testId,
}: {
  readonly label: string;
  readonly stage: string;
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly testId: string;
}) {
  const normalized = normalizedProgress(progress);
  return (
    <div className="black-hole-progress" data-testid={testId}>
      <label>
        <span>Sequence progress</span>
        <progress max={1} value={normalized} aria-label={`${label} progress`} />
        <output>{formatPercent(normalized)}</output>
      </label>
      <dl className="inspector-grid black-hole-summary">
        <StatusValue label="Stage" value={formatStage(stage)} />
        <StatusValue
          label="Scenario-local time"
          value={`${formatNumber(scenarioTimeSeconds)} / ${formatNumber(totalDurationSeconds)} s`}
        />
      </dl>
    </div>
  );
}

function PhysicsDiagnostics({
  scenario,
}: {
  readonly scenario: Readonly<BlackHolePhysicsFlybyPanelState>;
}) {
  const { diagnostics } = scenario;
  return (
    <section
      className="black-hole-diagnostics"
      aria-label="Finite integration diagnostics"
      data-testid="black-hole-physics-diagnostics"
      data-finite={String(diagnostics.finite)}
    >
      <h3>Integration diagnostics</h3>
      <dl className="inspector-grid">
        <StatusValue
          label="Kinetic energy"
          value={formatScientific(diagnostics.kineticEnergyJ, 'J')}
          testId="black-hole-kinetic-energy"
          numericValue={diagnostics.kineticEnergyJ}
        />
        <StatusValue
          label="Potential energy"
          value={formatScientific(diagnostics.potentialEnergyJ, 'J')}
          testId="black-hole-potential-energy"
          numericValue={diagnostics.potentialEnergyJ}
        />
        <StatusValue
          label="Total energy"
          value={formatScientific(diagnostics.totalEnergyJ, 'J')}
          testId="black-hole-total-energy"
          numericValue={diagnostics.totalEnergyJ}
        />
        <StatusValue
          label="Relative energy drift"
          value={formatScientific(diagnostics.relativeEnergyDrift, '')}
          testId="black-hole-energy-drift"
          numericValue={diagnostics.relativeEnergyDrift}
        />
        <StatusValue
          label="Linear momentum magnitude"
          value={formatScientific(diagnostics.linearMomentumMagnitudeKgMps, 'kg·m/s')}
          testId="black-hole-linear-momentum"
          numericValue={diagnostics.linearMomentumMagnitudeKgMps}
        />
        <StatusValue
          label="Relative linear-momentum drift"
          value={formatScientific(diagnostics.relativeLinearMomentumDrift, '')}
          testId="black-hole-linear-momentum-drift"
          numericValue={diagnostics.relativeLinearMomentumDrift}
        />
        <StatusValue
          label="Angular momentum magnitude"
          value={formatScientific(diagnostics.angularMomentumMagnitudeKgM2ps, 'kg·m²/s')}
          testId="black-hole-angular-momentum"
          numericValue={diagnostics.angularMomentumMagnitudeKgM2ps}
        />
        <StatusValue
          label="Relative angular-momentum drift"
          value={formatScientific(diagnostics.relativeAngularMomentumDrift, '')}
          testId="black-hole-angular-momentum-drift"
          numericValue={diagnostics.relativeAngularMomentumDrift}
        />
        <StatusValue
          label="Minimum pair distance"
          value={formatDistance(diagnostics.minimumPairDistanceM)}
          testId="black-hole-minimum-distance"
          numericValue={diagnostics.minimumPairDistanceM}
        />
        <StatusValue
          label="Chosen fixed substep"
          value={`${formatNumber(diagnostics.chosenSubstepSeconds)} s`}
          testId="black-hole-chosen-substep"
          numericValue={diagnostics.chosenSubstepSeconds}
        />
        <StatusValue
          label="Completed substeps"
          value={formatInteger(diagnostics.completedSubsteps)}
          testId="black-hole-completed-substeps"
          numericValue={diagnostics.completedSubsteps}
        />
      </dl>
      {!diagnostics.finite ? (
        <p className="scale-warning" role="alert">Integration diagnostics are not finite.</p>
      ) : null}
    </section>
  );
}

function OutcomeSummary({
  scenario,
  prefix,
}: {
  readonly scenario: Readonly<BlackHolePanelStateBase>;
  readonly prefix: 'black-hole-physics' | 'black-hole-cinematic';
}) {
  return (
    <section className="black-hole-outcomes" aria-label="Body outcome counts">
      <h3>Body outcomes</h3>
      <dl className="inspector-grid">
        <StatusValue
          label="Surviving / active"
          value={formatInteger(scenario.survivorCount)}
          testId={`${prefix}-survivors`}
          numericValue={scenario.survivorCount}
        />
        <StatusValue
          label="Ejected"
          value={formatInteger(scenario.ejectionCount)}
          testId={`${prefix}-ejected`}
          numericValue={scenario.ejectionCount}
        />
        <StatusValue
          label="Captured"
          value={formatInteger(scenario.captureCount)}
          testId={`${prefix}-captured`}
          numericValue={scenario.captureCount}
        />
      </dl>
    </section>
  );
}

function BodyCaptureStates({
  bodyStates,
}: {
  readonly bodyStates: readonly Readonly<BlackHolePanelBodyState>[];
}) {
  return (
    <section className="black-hole-body-states" data-testid="black-hole-cinematic-body-states">
      <h3>Staged body capture states</h3>
      <ul>
        {bodyStates.map((bodyState) => {
          const captureProgress = normalizedProgress(bodyState.captureProgress);
          const streamProgress = normalizedProgress(bodyState.streamProgress);
          return (
            <li
              key={bodyState.bodyId}
              data-testid={`black-hole-body-state-${sanitizeTestId(bodyState.bodyId)}`}
              data-body-id={bodyState.bodyId}
              data-outcome={bodyState.outcome}
              data-capture-progress={captureProgress.toFixed(6)}
            >
              <span>{formatBodyId(bodyState.bodyId)}</span>
              <strong>{formatStage(bodyState.outcome)}</strong>
              <progress
                max={1}
                value={captureProgress}
                aria-label={`${formatBodyId(bodyState.bodyId)} capture progress`}
              />
              <small>
                Capture {formatPercent(captureProgress)} · stream {formatPercent(streamProgress)} ·
                tidal stress {formatPercent(normalizedProgress(bodyState.tidalStress))}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BlackHoleTransport({
  mode,
  playbackState,
  disabled,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: {
  readonly mode: BlackHoleEncounterMode;
  readonly playbackState: BlackHoleActivePlaybackState;
  readonly disabled: boolean;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  const prefix = mode === 'physics-flyby' ? 'black-hole-physics' : 'black-hole-cinematic';
  const title = mode === 'physics-flyby' ? 'Physics Flyby' : 'Complete Consumption cinematic';
  const running = playbackState === 'running';
  const paused = playbackState === 'paused';
  const complete = playbackState === 'complete';
  return (
    <section
      className="black-hole-active-controls"
      aria-label={`${title} transport controls`}
      data-testid={`${prefix}-controls`}
    >
      <h3>{title} controls</h3>
      <div className="transport-row">
        {running ? (
          <button
            className="button button-secondary"
            type="button"
            data-testid={`${prefix}-pause`}
            disabled={disabled}
            onClick={onPause}
          >
            Pause sequence
          </button>
        ) : null}
        {paused ? (
          <>
            <button
              className="button button-secondary"
              type="button"
              data-testid={`${prefix}-resume`}
              disabled={disabled}
              onClick={onResume}
            >
              Resume sequence
            </button>
            <button
              className="button button-secondary"
              type="button"
              data-testid={`${prefix}-step`}
              disabled={disabled}
              onClick={onFrameStep}
            >
              Step one frame
            </button>
          </>
        ) : null}
        {!complete ? (
          <button
            className="button button-secondary"
            type="button"
            data-testid={`${prefix}-skip`}
            disabled={disabled}
            onClick={onSkip}
          >
            {mode === 'physics-flyby' ? 'Advance interval' : 'Advance stage'}
          </button>
        ) : null}
        <button
          className="button button-secondary"
          type="button"
          data-testid={`${prefix}-replay`}
          disabled={disabled}
          onClick={onReplay}
        >
          Replay from start
        </button>
        <button
          className="button button-primary"
          type="button"
          data-testid={`${prefix}-reset`}
          disabled={disabled}
          onClick={onReset}
        >
          Reset observatory
        </button>
      </div>
    </section>
  );
}

function StatusValue({
  label,
  value,
  testId,
  numericValue,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
  readonly numericValue?: number;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd
        data-testid={testId}
        data-value={numericValue === undefined ? undefined : finiteAttribute(numericValue)}
      >
        {value}
      </dd>
    </div>
  );
}

function parametersAreValid(parameters: Readonly<BlackHoleFlybyPanelParameters>): boolean {
  return finiteWithin(
    parameters.massSolarMasses,
    PARAMETER_LIMITS.massSolarMasses.minimum,
    PARAMETER_LIMITS.massSolarMasses.maximum,
  ) &&
    vectorIsValid(
      parameters.initialPositionM,
      ASTRONOMICAL_UNIT_M,
      PARAMETER_LIMITS.vectorPositionAu.minimum,
      PARAMETER_LIMITS.vectorPositionAu.maximum,
    ) &&
    vectorIsValid(
      parameters.initialVelocityMps,
      1_000,
      PARAMETER_LIMITS.vectorVelocityKmps.minimum,
      PARAMETER_LIMITS.vectorVelocityKmps.maximum,
    ) &&
    vectorIsValid(
      parameters.closestApproachTargetM,
      ASTRONOMICAL_UNIT_M,
      PARAMETER_LIMITS.vectorPositionAu.minimum,
      PARAMETER_LIMITS.vectorPositionAu.maximum,
    ) &&
    finiteWithin(
      parameters.closestApproachTimeSeconds,
      PARAMETER_LIMITS.closestApproachTimeSeconds.minimum,
      PARAMETER_LIMITS.closestApproachTimeSeconds.maximum,
    ) &&
    finiteWithin(parameters.captureRadiusMultiple, 1, 10_000) &&
    finiteWithin(parameters.spinVisualization, -1, 1) &&
    (parameters.accuracy === 'balanced' ||
      parameters.accuracy === 'high' || parameters.accuracy === 'ultra') &&
    Number.isInteger(parameters.seed) &&
    finiteWithin(parameters.seed, PARAMETER_LIMITS.seed.minimum, PARAMETER_LIMITS.seed.maximum);
}

function vectorIsValid(
  vector: BlackHoleVector3,
  scale: number,
  minimum: number,
  maximum: number,
): boolean {
  return vector.every((value) => finiteWithin(value / scale, minimum, maximum));
}

function finiteWithin(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizedProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function finiteAttribute(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

function formatDistance(valueM: number): string {
  if (!Number.isFinite(valueM)) return '0 m';
  if (Math.abs(valueM) >= 1_000) return `${formatNumber(valueM / 1_000)} km`;
  return `${formatNumber(valueM)} m`;
}

function formatScientific(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `0${unit.length === 0 ? '' : ` ${unit}`}`;
  const suffix = unit.length === 0 ? '' : ` ${unit}`;
  return `${value.toExponential(4)}${suffix}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.max(0, Math.trunc(value)).toLocaleString('en-US');
}

function formatPercent(value: number): string {
  return `${Math.round(normalizedProgress(value) * 100)}%`;
}

function formatStage(stage: string): string {
  if (stage.length === 0) return 'Unknown';
  return stage
    .split('-')
    .map((part) => part.length === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatBodyId(bodyId: string): string {
  return formatStage(bodyId.replaceAll('_', '-'));
}

function sanitizeTestId(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized.length === 0 ? 'unknown' : sanitized;
}

function velocityForPlannedEncounter(
  initialPositionM: BlackHoleVector3,
  targetM: BlackHoleVector3,
  timeSeconds: number,
): BlackHoleVector3 {
  const safeTime = Math.max(timeSeconds, PARAMETER_LIMITS.closestApproachTimeSeconds.minimum);
  return [
    (targetM[0] - initialPositionM[0]) / safeTime,
    (targetM[1] - initialPositionM[1]) / safeTime,
    (targetM[2] - initialPositionM[2]) / safeTime,
  ];
}

function targetForInitialVelocity(
  initialPositionM: BlackHoleVector3,
  initialVelocityMps: BlackHoleVector3,
  timeSeconds: number,
): BlackHoleVector3 {
  return [
    initialPositionM[0] + initialVelocityMps[0] * timeSeconds,
    initialPositionM[1] + initialVelocityMps[1] * timeSeconds,
    initialPositionM[2] + initialVelocityMps[2] * timeSeconds,
  ];
}
