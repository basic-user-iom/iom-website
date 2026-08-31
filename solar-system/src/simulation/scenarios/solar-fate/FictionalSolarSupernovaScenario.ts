import type { RenderContext } from '../../../rendering/RenderContext';
import type { SimulationContext } from '../../core/SimulationContext';
import type {
  ScenarioModule,
  ScenarioPlaybackState,
  ScenarioUnsubscribe,
} from '../ScenarioModule';
import { DeterministicScenarioClock } from './DeterministicScenarioClock';
import {
  DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS,
  FICTIONAL_SOLAR_SUPERNOVA_REMNANT_KINDS,
  FICTIONAL_SOLAR_SUPERNOVA_TIMING_NOTICE,
  FICTIONAL_SOLAR_SUPERNOVA_WARNING,
  type FictionalRadiationArrival,
  type FictionalSolarSupernovaParameters,
  type FictionalSolarSupernovaSnapshot,
  type FictionalSolarSupernovaStage,
} from './FictionalSolarSupernovaTypes';
import {
  captureFictionalRadiationDistances,
  createCompressedRadiationArrivals,
  FICTIONAL_SOLAR_SUPERNOVA_TIMELINE,
  sampleFictionalSolarSupernovaTimeline,
  type FictionalRadiationDistance,
} from './FictionalSolarSupernovaTimeline';
import { createSolarFateRunSignature } from './SolarFateSerialization';
import {
  validateSolarFateCameraMode,
  validateSolarFatePlaybackRate,
  validateSolarFateSeed,
  type SolarFatePlanetId,
} from './SolarFateTypes';

const EMPTY_ARRIVALS: readonly Readonly<FictionalRadiationArrival>[] =
  Object.freeze([]);
const EMPTY_HEATING: Readonly<Record<SolarFatePlanetId, number>> = Object.freeze({
  mercury: 0,
  venus: 0,
  earth: 0,
  mars: 0,
  jupiter: 0,
  saturn: 0,
  uranus: 0,
  neptune: 0,
});

export const FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT: Readonly<
  FictionalSolarSupernovaSnapshot
> = Object.freeze({
  state: 'idle',
  stage: 'idle',
  classification: 'cinematic',
  title: 'Fictional Solar Supernova',
  warning: FICTIONAL_SOLAR_SUPERNOVA_WARNING,
  timingCompressionNotice: FICTIONAL_SOLAR_SUPERNOVA_TIMING_NOTICE,
  scenarioTimeSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  playbackRate: 1,
  parameters: null,
  pulseScale: 1,
  pulseIntensity: 0,
  flashIntensity: 0,
  coreRadiusM: 0,
  shockProgress: 0,
  shockRadiusM: 0,
  radiationFrontProgress: 0,
  radiationFrontRadiusM: 0,
  radiationArrivals: EMPTY_ARRIVALS,
  heatingByBody: EMPTY_HEATING,
  debrisProgress: 0,
  debrisRadiusM: 0,
  debrisOpacity: 0,
  nebulaRadiusM: 0,
  nebulaOpacity: 0,
  remnantBlend: 0,
  remnantRadiusM: 0,
  remnantKind: DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS.remnantKind,
  runSignature: null,
});

/** Authored cinematic kept wholly separate from scientific solar evolution. */
export class FictionalSolarSupernovaScenario
  implements
    ScenarioModule<
      FictionalSolarSupernovaParameters,
      FictionalSolarSupernovaSnapshot
    >
{
  public readonly id = 'fictional-solar-supernova';
  public readonly classification = 'cinematic' as const;
  public readonly destructive = true;

  readonly #listeners = new Set<
    (snapshot: Readonly<FictionalSolarSupernovaSnapshot>) => void
  >();
  #context: SimulationContext | null = null;
  #playbackState: ScenarioPlaybackState = 'idle';
  #parameters: Readonly<FictionalSolarSupernovaParameters> | null = null;
  #clock: DeterministicScenarioClock | null = null;
  #distances: readonly Readonly<FictionalRadiationDistance>[] | null = null;
  #baseArrivals: readonly Readonly<FictionalRadiationArrival>[] | null = null;
  #snapshot = FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT;
  #signature: string | null = null;
  #disposed = false;

  public get state(): ScenarioPlaybackState {
    return this.#playbackState;
  }

  public init(context: SimulationContext): void {
    this.#assertNotDisposed();
    this.#context = context;
  }

  public onTick(_context: SimulationContext, _dtSimSeconds: number): void {
    void _context;
    void _dtSimSeconds;
  }

  public onRender(_context: RenderContext, dtRealSeconds: number): void {
    void _context;
    this.advance(dtRealSeconds);
  }

  public start(parameters: Readonly<FictionalSolarSupernovaParameters>): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'idle') {
      throw new Error(
        'Reset the active Fictional Solar Supernova run before starting another one.',
      );
    }
    const normalized = validateFictionalSolarSupernovaParameters(parameters);
    const distances = captureFictionalRadiationDistances(this.#context);
    const arrivals = createCompressedRadiationArrivals(distances);
    this.#parameters = normalized;
    this.#distances = distances;
    this.#baseArrivals = arrivals;
    this.#clock = new DeterministicScenarioClock(
      FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.totalDurationSeconds,
      normalized.playbackRate,
    );
    this.#signature = fictionalSolarSupernovaRunSignature(normalized, distances);
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public advance(realDeltaSeconds: number): void {
    this.#assertNotDisposed();
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError(
        'Fictional Solar Supernova delta must be finite and non-negative.',
      );
    }
    if (this.#playbackState !== 'running' || realDeltaSeconds === 0) return;
    const clock = this.#requiredClock();
    if (!clock.advanceRealTime(realDeltaSeconds)) return;
    if (clock.complete) this.#playbackState = 'complete';
    this.#publishSnapshot();
  }

  public pause(): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'running') return;
    this.#playbackState = 'paused';
    this.#publishSnapshot();
  }

  public resume(): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'paused') return;
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public frameStep(): void;
  public frameStep(stepSeconds: number): void;
  public frameStep(stepSeconds?: number): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'paused') {
      throw new Error(
        'Fictional Solar Supernova frame-step is available only while paused.',
      );
    }
    const clock = this.#requiredClock();
    const changed = stepSeconds === undefined
      ? clock.frameStep()
      : clock.frameStep(stepSeconds);
    if (!changed) return;
    if (clock.complete) this.#playbackState = 'complete';
    this.#publishSnapshot();
  }

  public replay(): void {
    this.#assertNotDisposed();
    const clock = this.#clock;
    if (
      clock === null ||
      this.#parameters === null ||
      this.#distances === null ||
      this.#baseArrivals === null
    ) {
      throw new Error('Fictional Solar Supernova has no prepared run to replay.');
    }
    clock.restart();
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public setPlaybackRate(playbackRate: number): void {
    this.#assertNotDisposed();
    const clock = this.#requiredClock();
    const normalized = validateSolarFatePlaybackRate(playbackRate);
    if (clock.playbackRate === normalized) return;
    clock.setPlaybackRate(normalized);
    this.#publishSnapshot();
  }

  public skipToStage(stage: FictionalSolarSupernovaStage): void {
    this.#assertNotDisposed();
    if (stage === 'idle') {
      throw new RangeError('Cannot skip an active fictional scenario to idle.');
    }
    this.#seek(stageStartSeconds(stage));
  }

  public skipToNextStage(): void {
    this.#assertNotDisposed();
    const clock = this.#requiredClock();
    const nextStart = fictionalStageStartTimes().find(
      (startSeconds) => startSeconds > clock.timeSeconds + 1e-9,
    );
    this.#seek(nextStart ?? clock.totalDurationSeconds);
  }

  public skipToRemnant(): void {
    this.#assertNotDisposed();
    this.#seek(FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.remnantStartSeconds);
  }

  public getSnapshot(): Readonly<FictionalSolarSupernovaSnapshot> {
    return this.#snapshot;
  }

  public serializeParameters(): string | null {
    return this.#parameters === null
      ? null
      : serializeFictionalSolarSupernovaParameters(this.#parameters);
  }

  public subscribe(
    listener: (snapshot: Readonly<FictionalSolarSupernovaSnapshot>) => void,
  ): ScenarioUnsubscribe {
    this.#assertNotDisposed();
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public reset(context?: SimulationContext): void {
    if (this.#disposed) return;
    if (context !== undefined) this.#context = context;
    this.#parameters = null;
    this.#clock = null;
    this.#distances = null;
    this.#baseArrivals = null;
    this.#signature = null;
    this.#playbackState = 'idle';
    this.#snapshot = FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT;
    this.#notify();
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.reset();
    this.#listeners.clear();
    this.#context = null;
    this.#disposed = true;
  }

  #seek(timeSeconds: number): void {
    const clock = this.#requiredClock();
    clock.seek(timeSeconds);
    if (clock.complete) {
      this.#playbackState = 'complete';
    } else if (this.#playbackState === 'complete') {
      this.#playbackState = 'paused';
    }
    this.#publishSnapshot();
  }

  #publishSnapshot(): void {
    const parameters = this.#parameters;
    const clock = this.#clock;
    const baseArrivals = this.#baseArrivals;
    if (parameters === null || clock === null || baseArrivals === null) {
      this.#snapshot = FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT;
      this.#notify();
      return;
    }
    const sample = sampleFictionalSolarSupernovaTimeline(
      clock.timeSeconds,
      baseArrivals,
      parameters.remnantKind,
    );
    assertFiniteSnapshotClock(clock);
    this.#snapshot = Object.freeze({
      state: this.#playbackState,
      stage: this.#playbackState === 'complete' ? 'complete' : sample.stage,
      classification: 'cinematic',
      title: 'Fictional Solar Supernova',
      warning: FICTIONAL_SOLAR_SUPERNOVA_WARNING,
      timingCompressionNotice: FICTIONAL_SOLAR_SUPERNOVA_TIMING_NOTICE,
      scenarioTimeSeconds: clock.timeSeconds,
      totalDurationSeconds: clock.totalDurationSeconds,
      progress: clock.progress,
      playbackRate: clock.playbackRate,
      parameters,
      pulseScale: sample.pulseScale,
      pulseIntensity: sample.pulseIntensity,
      flashIntensity: sample.flashIntensity,
      coreRadiusM: sample.coreRadiusM,
      shockProgress: sample.shockProgress,
      shockRadiusM: sample.shockRadiusM,
      radiationFrontProgress: sample.radiationFrontProgress,
      radiationFrontRadiusM: sample.radiationFrontRadiusM,
      radiationArrivals: sample.radiationArrivals,
      heatingByBody: sample.heatingByBody,
      debrisProgress: sample.debrisProgress,
      debrisRadiusM: sample.debrisRadiusM,
      debrisOpacity: sample.debrisOpacity,
      nebulaRadiusM: sample.nebulaRadiusM,
      nebulaOpacity: sample.nebulaOpacity,
      remnantBlend: sample.remnantBlend,
      remnantRadiusM: sample.remnantRadiusM,
      remnantKind: parameters.remnantKind,
      runSignature: this.#signature,
    });
    this.#notify();
  }

  #requiredClock(): DeterministicScenarioClock {
    if (this.#clock === null) {
      throw new Error('Fictional Solar Supernova has not been started.');
    }
    return this.#clock;
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener(this.#snapshot);
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('FictionalSolarSupernovaScenario has been disposed.');
    }
  }
}

export function validateFictionalSolarSupernovaParameters(
  parameters: Readonly<FictionalSolarSupernovaParameters>,
): Readonly<FictionalSolarSupernovaParameters> {
  if (!FICTIONAL_SOLAR_SUPERNOVA_REMNANT_KINDS.includes(parameters.remnantKind)) {
    throw new RangeError(
      `Unknown fictional remnant kind "${String(parameters.remnantKind)}".`,
    );
  }
  return Object.freeze({
    cameraMode: validateSolarFateCameraMode(parameters.cameraMode),
    playbackRate: validateSolarFatePlaybackRate(parameters.playbackRate),
    remnantKind: parameters.remnantKind,
    seed: validateSolarFateSeed(parameters.seed),
  });
}

export function serializeFictionalSolarSupernovaParameters(
  parameters: Readonly<FictionalSolarSupernovaParameters>,
): string {
  const normalized = validateFictionalSolarSupernovaParameters(parameters);
  return JSON.stringify({
    cameraMode: normalized.cameraMode,
    playbackRate: normalized.playbackRate,
    remnantKind: normalized.remnantKind,
    seed: normalized.seed,
  });
}

export function fictionalSolarSupernovaRunSignature(
  parameters: Readonly<FictionalSolarSupernovaParameters>,
  distances = captureFictionalRadiationDistances(null),
): string {
  const serializedDistances = distances
    .map((entry) =>
      `${entry.bodyId}:${entry.distanceM.toPrecision(17)}:${entry.source}`,
    )
    .join('|');
  return createSolarFateRunSignature(
    FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.version,
    `${serializeFictionalSolarSupernovaParameters(parameters)}\n${serializedDistances}`,
  );
}

function fictionalStageStartTimes(): readonly number[] {
  const timeline = FICTIONAL_SOLAR_SUPERNOVA_TIMELINE;
  return [
    timeline.coreFlashStartSeconds,
    timeline.shockStartSeconds,
    timeline.radiationStartSeconds,
    timeline.debrisStartSeconds,
    timeline.remnantStartSeconds,
  ];
}

function stageStartSeconds(stage: FictionalSolarSupernovaStage): number {
  const timeline = FICTIONAL_SOLAR_SUPERNOVA_TIMELINE;
  switch (stage) {
    case 'surface-pulse':
      return timeline.surfacePulseStartSeconds;
    case 'core-flash':
      return timeline.coreFlashStartSeconds;
    case 'shock-breakout':
      return timeline.shockStartSeconds;
    case 'radiation-front':
      return timeline.radiationStartSeconds;
    case 'debris-nebula':
      return timeline.debrisStartSeconds;
    case 'fictional-remnant':
      return timeline.remnantStartSeconds;
    case 'complete':
      return timeline.totalDurationSeconds;
    case 'idle':
      throw new RangeError('Idle is not an active fictional scenario stage.');
  }
}

function assertFiniteSnapshotClock(clock: DeterministicScenarioClock): void {
  if (
    !Number.isFinite(clock.timeSeconds) ||
    !Number.isFinite(clock.totalDurationSeconds) ||
    !Number.isFinite(clock.progress) ||
    !Number.isFinite(clock.playbackRate)
  ) {
    throw new Error('Fictional Solar Supernova produced a non-finite clock snapshot.');
  }
}

export { DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS };
