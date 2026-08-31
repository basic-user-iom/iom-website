import { type RefObject, useId, useRef, useState } from 'react';

import type { ScenarioPlaybackState } from '../../simulation/scenarios/ScenarioModule';
import { ObservatoryDialog } from './ObservatoryDialog';

export const SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT =
  'Compressed educational narrative, not a detailed stellar-evolution solver. Radius, luminosity, mass loss, sizes, and timescale are qualitative/compressed.';

export const FICTIONAL_SOLAR_SUPERNOVA_WARNING =
  'Cinematic scenario: the real Sun is not massive enough to explode as a supernova.';

export const FICTIONAL_SOLAR_SUPERNOVA_PHOTOSENSITIVITY_WARNING =
  'Photosensitivity warning: this cinematic scenario includes pulsing light, an intense flash, abrupt exposure changes, and expanding shells.';

export type SolarFateMode = 'scientific-evolution' | 'fictional-supernova';
export type SolarFateActivePlaybackState = Exclude<ScenarioPlaybackState, 'idle'>;

export interface ScientificSolarEvolutionPanelState {
  readonly mode: 'scientific-evolution';
  readonly playbackState: SolarFateActivePlaybackState;
  readonly stageId: string;
  readonly phaseName: string;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly radiusLabel: string;
  readonly luminosityLabel: string;
  readonly massLossLabel: string;
  readonly timeCompressionNotice: string;
  readonly caveats: readonly string[];
  readonly uncertainBodyIds: readonly string[];
  readonly compactRemnantSizeExaggerationRequired: boolean;
}

export interface FictionalSolarSupernovaPanelState {
  readonly mode: 'fictional-supernova';
  readonly playbackState: SolarFateActivePlaybackState;
  readonly stageId: string;
  readonly stageName: string;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
}

export type SolarFateActiveScenario =
  | ScientificSolarEvolutionPanelState
  | FictionalSolarSupernovaPanelState;

export interface SolarFatePanelProps {
  readonly activeScenario: Readonly<SolarFateActiveScenario> | null;
  readonly disabled?: boolean;
  readonly reduceFlashes: boolean;
  readonly onReduceFlashesChange: (reduceFlashes: boolean) => void;
  readonly onStartScientificEvolution: () => void;
  readonly onStartFictionalSupernova: () => void;
  readonly onClose: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}

export function SolarFatePanel({
  activeScenario,
  disabled = false,
  reduceFlashes,
  onReduceFlashesChange,
  onStartScientificEvolution,
  onStartFictionalSupernova,
  onClose,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: SolarFatePanelProps) {
  const [fictionalConfirmationOpen, setFictionalConfirmationOpen] = useState(false);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();
  const active = activeScenario !== null;
  const activeMode = activeScenario?.mode ?? 'idle';
  const heading = activeScenario === null
    ? 'Solar Fate'
    : activeScenario.mode === 'scientific-evolution'
      ? 'Scientific Solar Evolution'
      : 'Fictional Solar Supernova';

  const confirmFictionalScenario = () => {
    setFictionalConfirmationOpen(false);
    onStartFictionalSupernova();
  };

  return (
    <aside
      className="control-panel solar-fate-panel"
      aria-labelledby={`${idPrefix}-heading`}
      data-testid="solar-fate-panel"
      data-solar-fate-mode={activeMode}
      data-solar-fate-state={activeScenario?.playbackState ?? 'idle'}
      data-solar-fate-stage={activeScenario?.stageId ?? 'idle'}
    >
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Two independent scenarios</p>
          <h2 id={`${idPrefix}-heading`} ref={panelHeadingRef} tabIndex={-1}>
            {heading}
          </h2>
        </div>
        <button
          className="button button-secondary"
          type="button"
          data-testid="solar-fate-close"
          aria-label="Close Solar Fate"
          disabled={disabled || active}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {activeScenario === null ? (
        <SolarFateChoices
          idPrefix={idPrefix}
          disabled={disabled}
          onStartScientificEvolution={onStartScientificEvolution}
          onRequestFictionalSupernova={() => setFictionalConfirmationOpen(true)}
        />
      ) : activeScenario.mode === 'scientific-evolution' ? (
        <ScientificSolarEvolutionActive
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
        <FictionalSolarSupernovaActive
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
        open={fictionalConfirmationOpen}
        title="Confirm Fictional Solar Supernova"
        description={FICTIONAL_SOLAR_SUPERNOVA_PHOTOSENSITIVITY_WARNING}
        onClose={() => setFictionalConfirmationOpen(false)}
        initialFocusRef={confirmationCancelRef}
        returnFocusRef={panelHeadingRef as RefObject<HTMLElement | null>}
        closeLabel="Cancel"
        className="solar-fate-confirmation fictional-supernova-confirmation"
        testId="fictional-supernova-confirmation"
      >
        <p
          className="mode-badge mode-badge-warning"
          data-testid="fictional-supernova-confirmation-classification"
        >
          Fictional · cinematic · impossible for the Sun
        </p>
        <p className="scale-warning" data-testid="fictional-supernova-confirmation-warning">
          {FICTIONAL_SOLAR_SUPERNOVA_WARNING}
        </p>
        <p>
          The flash, shock shell, radiation front, debris, and remnant are deliberately
          nonphysical spectacle. Displayed timing and propagation are visually compressed.
        </p>
        <label className="reduce-flashes-control">
          <input
            type="checkbox"
            checked={reduceFlashes}
            data-testid="fictional-supernova-confirm-reduce-flashes"
            onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
          />
          Reduce flashes and abrupt exposure changes
        </label>
        <div className="dialog-action-row">
          <button
            ref={confirmationCancelRef}
            className="button button-secondary"
            type="button"
            data-testid="fictional-supernova-confirm-cancel"
            onClick={() => setFictionalConfirmationOpen(false)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            data-testid="fictional-supernova-confirm"
            disabled={disabled}
            onClick={confirmFictionalScenario}
          >
            Start fictional cinematic
          </button>
        </div>
      </ObservatoryDialog>
    </aside>
  );
}

function SolarFateChoices({
  idPrefix,
  disabled,
  onStartScientificEvolution,
  onRequestFictionalSupernova,
}: {
  readonly idPrefix: string;
  readonly disabled: boolean;
  readonly onStartScientificEvolution: () => void;
  readonly onRequestFictionalSupernova: () => void;
}) {
  const scientificHeadingId = `${idPrefix}-scientific-heading`;
  const scientificCaveatId = `${idPrefix}-scientific-caveat`;
  const fictionalHeadingId = `${idPrefix}-fictional-heading`;
  const fictionalWarningId = `${idPrefix}-fictional-warning`;
  return (
    <div className="solar-fate-choice-list">
      <p className="solar-fate-distinction" data-testid="solar-fate-distinction">
        Choose one mutually exclusive scenario. The first is a compressed educational account
        of the Sun&apos;s expected evolution; the second is deliberately fictional cinema.
      </p>

      <section
        className="solar-fate-option solar-evolution-option"
        aria-labelledby={scientificHeadingId}
        data-testid="solar-evolution-option"
        data-classification="scientific"
      >
        <p className="mode-badge" data-testid="solar-evolution-classification">
          Scientific · compressed educational visualization
        </p>
        <h3 id={scientificHeadingId}>Scientific Solar Evolution</h3>
        <p>
          Present-day Sun → red-giant expansion and inner-system heating → mass-loss and
          nebular phase → white-dwarf and cooling remnant.
        </p>
        <p
          className="field-help"
          id={scientificCaveatId}
          data-testid="solar-evolution-caveat"
        >
          {SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT}
        </p>
        <button
          className="button button-primary"
          type="button"
          data-testid="solar-evolution-start"
          disabled={disabled}
          aria-describedby={scientificCaveatId}
          onClick={onStartScientificEvolution}
        >
          Scientific Solar Evolution
        </button>
      </section>

      <p className="solar-fate-separator" role="note">
        Separate scenario · neither mode changes the bundled observatory ephemerides
      </p>

      <section
        className="solar-fate-option fictional-supernova-option"
        aria-labelledby={fictionalHeadingId}
        data-testid="fictional-supernova-option"
        data-classification="fictional-cinematic"
      >
        <p
          className="mode-badge mode-badge-warning"
          data-testid="fictional-supernova-classification"
        >
          Fictional · cinematic · impossible for the Sun
        </p>
        <h3 id={fictionalHeadingId}>Fictional Solar Supernova</h3>
        <p
          className="scale-warning"
          id={fictionalWarningId}
          data-testid="fictional-supernova-warning"
        >
          {FICTIONAL_SOLAR_SUPERNOVA_WARNING}
        </p>
        <p>
          Pulse, flash, shock shell, radiation front, debris, nebula, and remnant use
          scenario-local time and visually compressed propagation.
        </p>
        <button
          className="button button-primary"
          type="button"
          data-testid="fictional-supernova-start"
          disabled={disabled}
          aria-describedby={fictionalWarningId}
          onClick={onRequestFictionalSupernova}
        >
          Fictional Solar Supernova
        </button>
      </section>
    </div>
  );
}

function ScientificSolarEvolutionActive({
  scenario,
  disabled,
  onPause,
  onResume,
  onFrameStep,
  onSkip,
  onReplay,
  onReset,
}: {
  readonly scenario: Readonly<ScientificSolarEvolutionPanelState>;
  readonly disabled: boolean;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  const progress = normalizedProgress(scenario.progress);
  return (
    <section
      className="solar-fate-active solar-evolution-active"
      aria-label="Scientific Solar Evolution status and controls"
      data-testid="solar-evolution-active"
    >
      <p className="mode-badge" data-testid="solar-evolution-active-classification">
        Scientific · compressed educational visualization
      </p>
      <p className="field-help" data-testid="solar-evolution-active-caveat">
        {SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT}
      </p>
      <p className="field-help" data-testid="solar-evolution-time-compression">
        {scenario.timeCompressionNotice}
      </p>
      {scenario.uncertainBodyIds.length > 0 ? (
        <p className="scale-warning" data-testid="solar-evolution-uncertainty">
          Outcome explicitly uncertain: {formatBodyIds(scenario.uncertainBodyIds)}.
        </p>
      ) : null}
      {scenario.compactRemnantSizeExaggerationRequired ? (
        <p className="field-help" data-testid="solar-evolution-remnant-scale-note">
          Compact-remnant visibility uses a close-up camera while retaining physical-radius
          geometry; no display-size floor is applied.
        </p>
      ) : null}
      <details className="solar-evolution-caveats" data-testid="solar-evolution-profile-caveats">
        <summary>Profile caveats ({scenario.caveats.length})</summary>
        <ul>
          {scenario.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
        </ul>
      </details>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Scientific Solar Evolution phase: {scenario.phaseName}.
      </p>
      <div className="solar-fate-progress" data-testid="solar-evolution-status">
        <label>
          <span>Sequence progress</span>
          <progress
            max={1}
            value={progress}
            aria-label="Scientific Solar Evolution progress"
          />
          <output>{formatPercent(progress)}</output>
        </label>
        <dl className="inspector-grid solar-fate-summary">
          <StatusValue label="Phase" value={scenario.phaseName} />
          <StatusValue
            label="Compressed sequence time"
            value={`${formatNumber(scenario.scenarioTimeSeconds)} s`}
          />
          <StatusValue label="Qualitative radius" value={scenario.radiusLabel} />
          <StatusValue label="Qualitative luminosity" value={scenario.luminosityLabel} />
          <StatusValue label="Qualitative mass loss" value={scenario.massLossLabel} />
        </dl>
      </div>
      <SolarFateTransport
        mode="scientific-evolution"
        playbackState={scenario.playbackState}
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

function formatBodyIds(bodyIds: readonly string[]): string {
  return bodyIds
    .map((bodyId) => bodyId.length === 0 ? bodyId : `${bodyId.charAt(0).toUpperCase()}${bodyId.slice(1)}`)
    .join(', ');
}

function FictionalSolarSupernovaActive({
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
  readonly scenario: Readonly<FictionalSolarSupernovaPanelState>;
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
  const progress = normalizedProgress(scenario.progress);
  return (
    <section
      className="solar-fate-active fictional-supernova-active"
      aria-label="Fictional Solar Supernova status, warning, and controls"
      data-testid="fictional-supernova-active"
    >
      <p
        className="mode-badge mode-badge-warning"
        data-testid="fictional-supernova-active-classification"
      >
        Fictional · cinematic · impossible for the Sun
      </p>
      <p className="scale-warning" data-testid="fictional-supernova-active-warning">
        {FICTIONAL_SOLAR_SUPERNOVA_WARNING}
      </p>
      <p className="field-help" data-testid="fictional-supernova-timing-caveat">
        Displayed timing and propagation are visually compressed.
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Fictional Solar Supernova stage: {scenario.stageName}.
      </p>
      <div className="solar-fate-progress" data-testid="fictional-supernova-status">
        <label>
          <span>Sequence progress</span>
          <progress
            max={1}
            value={progress}
            aria-label="Fictional Solar Supernova progress"
          />
          <output>{formatPercent(progress)}</output>
        </label>
        <dl className="inspector-grid solar-fate-summary">
          <StatusValue label="Cinematic stage" value={scenario.stageName} />
          <StatusValue
            label="Scenario-local time"
            value={`${formatNumber(scenario.scenarioTimeSeconds)} s`}
          />
        </dl>
      </div>
      <label className="reduce-flashes-control">
        <input
          type="checkbox"
          checked={reduceFlashes}
          data-testid="fictional-supernova-active-reduce-flashes"
          onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
        />
        Reduce flashes and abrupt exposure changes
      </label>
      <SolarFateTransport
        mode="fictional-supernova"
        playbackState={scenario.playbackState}
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

function SolarFateTransport({
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
  readonly mode: SolarFateMode;
  readonly playbackState: SolarFateActivePlaybackState;
  readonly disabled: boolean;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFrameStep: () => void;
  readonly onSkip: () => void;
  readonly onReplay: () => void;
  readonly onReset: () => void;
}) {
  const testIdPrefix = mode === 'scientific-evolution'
    ? 'solar-evolution'
    : 'fictional-supernova';
  const title = mode === 'scientific-evolution'
    ? 'Scientific Solar Evolution'
    : 'Fictional Solar Supernova';
  const running = playbackState === 'running';
  const paused = playbackState === 'paused';
  const complete = playbackState === 'complete';
  return (
    <section
      className="solar-fate-active-controls"
      aria-label={`${title} transport controls`}
      data-testid={`${testIdPrefix}-controls`}
    >
      <h3>{title} controls</h3>
      <div className="transport-row">
        {running ? (
          <button
            className="button button-secondary"
            type="button"
            data-testid={`${testIdPrefix}-pause`}
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
              data-testid={`${testIdPrefix}-resume`}
              disabled={disabled}
              onClick={onResume}
            >
              Resume sequence
            </button>
            <button
              className="button button-secondary"
              type="button"
              data-testid={`${testIdPrefix}-step`}
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
            data-testid={`${testIdPrefix}-skip`}
            disabled={disabled}
            onClick={onSkip}
          >
            {mode === 'scientific-evolution' ? 'Next phase' : 'Skip current stage'}
          </button>
        ) : null}
        <button
          className="button button-secondary"
          type="button"
          data-testid={`${testIdPrefix}-replay`}
          disabled={disabled}
          onClick={onReplay}
        >
          Replay same sequence
        </button>
        <button
          className="button button-primary"
          type="button"
          data-testid={`${testIdPrefix}-reset`}
          disabled={disabled}
          onClick={onReset}
        >
          Reset to observatory
        </button>
      </div>
    </section>
  );
}

function StatusValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function normalizedProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function formatPercent(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
