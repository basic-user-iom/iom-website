import type { RenderContext } from '../../../rendering/RenderContext';
import type { SimulationContext } from '../../core/SimulationContext';
import type {
  ScenarioModule,
  ScenarioPlaybackState,
  ScenarioUnsubscribe,
} from '../ScenarioModule';
import { DeterministicScenarioClock } from './DeterministicScenarioClock';
import {
  DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS,
  type ScientificSolarEvolutionParameters,
  type ScientificSolarEvolutionSnapshot,
  type SolarEvolutionPhaseId,
} from './ScientificSolarEvolutionTypes';
import {
  sampleSolarEvolutionProfile,
  SOLAR_EVOLUTION_PROFILE,
  SOLAR_MEAN_RADIUS_M,
} from './SolarEvolutionProfile';
import { createSolarFateRunSignature } from './SolarFateSerialization';
import {
  validateSolarFateCameraMode,
  validateSolarFatePlaybackRate,
  validateSolarFateSeed,
  type SolarFatePlanetId,
} from './SolarFateTypes';

const EMPTY_STRINGS: readonly string[] = Object.freeze([]);
const EMPTY_PLANET_IDS: ScientificSolarEvolutionSnapshot['engulfedBodyIds'] =
  Object.freeze([]);
const EMPTY_BODY_EFFECTS: Readonly<Record<SolarFatePlanetId, number>> =
  Object.freeze({
    mercury: 0,
    venus: 0,
    earth: 0,
    mars: 0,
    jupiter: 0,
    saturn: 0,
    uranus: 0,
    neptune: 0,
  });

export const SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT: Readonly<
  ScientificSolarEvolutionSnapshot
> = Object.freeze({
  state: 'idle',
  stage: 'idle',
  classification: 'educational-approximation',
  title: 'Scientific Solar Evolution',
  scenarioTimeSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  normalizedEvolutionProgress: 0,
  phaseId: null,
  phaseLabel: '',
  phaseProgress: 0,
  playbackRate: 1,
  parameters: null,
  radiusSolarRadii: 0,
  physicalRadiusM: 0,
  luminositySolar: 0,
  massSolarMasses: 0,
  effectiveTemperatureK: 0,
  radiusLabel: '',
  luminosityLabel: '',
  massLossLabel: '',
  innerSystemHeating: 0,
  massLossShellOpacity: 0,
  nebulaOpacity: 0,
  nebulaDisplayRadiusSolarRadii: 0,
  nebulaDisplayRadiusM: 0,
  whiteDwarfBlend: 0,
  heatingByBody: EMPTY_BODY_EFFECTS,
  engulfmentByBody: EMPTY_BODY_EFFECTS,
  engulfedBodyIds: EMPTY_PLANET_IDS,
  uncertainBodyIds: EMPTY_PLANET_IDS,
  caveats: EMPTY_STRINGS,
  timeCompressionNotice: SOLAR_EVOLUTION_PROFILE.timeCompressionNotice,
  compactRemnantSizeExaggerationRequired: false,
  runSignature: null,
});

/** Deterministic compressed narrative; it never advances or rewrites ephemeris state. */
export class ScientificSolarEvolutionScenario
  implements
    ScenarioModule<
      ScientificSolarEvolutionParameters,
      ScientificSolarEvolutionSnapshot
    >
{
  public readonly id = 'scientific-solar-evolution';
  public readonly classification = 'educational-approximation' as const;
  public readonly destructive = true;

  readonly #listeners = new Set<
    (snapshot: Readonly<ScientificSolarEvolutionSnapshot>) => void
  >();
  #playbackState: ScenarioPlaybackState = 'idle';
  #parameters: Readonly<ScientificSolarEvolutionParameters> | null = null;
  #clock: DeterministicScenarioClock | null = null;
  #snapshot = SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT;
  #signature: string | null = null;
  #disposed = false;

  public get state(): ScenarioPlaybackState {
    return this.#playbackState;
  }

  public init(_context: SimulationContext): void {
    void _context;
    this.#assertNotDisposed();
  }

  public onTick(_context: SimulationContext, _dtSimSeconds: number): void {
    void _context;
    void _dtSimSeconds;
  }

  public onRender(_context: RenderContext, dtRealSeconds: number): void {
    void _context;
    this.advance(dtRealSeconds);
  }

  public start(parameters: Readonly<ScientificSolarEvolutionParameters>): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'idle') {
      throw new Error(
        'Reset the active Scientific Solar Evolution run before starting another one.',
      );
    }
    const normalized = validateScientificSolarEvolutionParameters(parameters);
    this.#parameters = normalized;
    this.#clock = new DeterministicScenarioClock(
      SOLAR_EVOLUTION_PROFILE.totalDurationSeconds,
      normalized.playbackRate,
    );
    this.#signature = scientificSolarEvolutionRunSignature(normalized);
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public advance(realDeltaSeconds: number): void {
    this.#assertNotDisposed();
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError(
        'Scientific Solar Evolution delta must be finite and non-negative.',
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
        'Scientific Solar Evolution frame-step is available only while paused.',
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
    if (clock === null || this.#parameters === null) {
      throw new Error('Scientific Solar Evolution has no prepared run to replay.');
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

  public skipToPhase(phaseId: SolarEvolutionPhaseId): void {
    this.#assertNotDisposed();
    const phaseStart = phaseStartSeconds(phaseId);
    this.#seek(phaseStart);
  }

  public skipToNextPhase(): void {
    this.#assertNotDisposed();
    const clock = this.#requiredClock();
    const nextStart = phaseStartTimes().find(
      (startSeconds) => startSeconds > clock.timeSeconds + 1e-9,
    );
    this.#seek(nextStart ?? clock.totalDurationSeconds);
  }

  public skipToEnd(): void {
    this.#assertNotDisposed();
    const clock = this.#requiredClock();
    this.#seek(clock.totalDurationSeconds);
  }

  public getSnapshot(): Readonly<ScientificSolarEvolutionSnapshot> {
    return this.#snapshot;
  }

  public serializeParameters(): string | null {
    return this.#parameters === null
      ? null
      : serializeScientificSolarEvolutionParameters(this.#parameters);
  }

  public subscribe(
    listener: (snapshot: Readonly<ScientificSolarEvolutionSnapshot>) => void,
  ): ScenarioUnsubscribe {
    this.#assertNotDisposed();
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public reset(_context?: SimulationContext): void {
    void _context;
    if (this.#disposed) return;
    this.#parameters = null;
    this.#clock = null;
    this.#signature = null;
    this.#playbackState = 'idle';
    this.#snapshot = SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT;
    this.#notify();
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.reset();
    this.#listeners.clear();
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
    if (parameters === null || clock === null) {
      this.#snapshot = SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT;
      this.#notify();
      return;
    }
    const sample = sampleSolarEvolutionProfile(
      SOLAR_EVOLUTION_PROFILE,
      clock.timeSeconds,
    );
    const physicalRadiusM = sample.radiusSolarRadii * SOLAR_MEAN_RADIUS_M;
    const nebulaDisplayRadiusM =
      sample.nebulaDisplayRadiusSolarRadii * SOLAR_MEAN_RADIUS_M;
    const heatingByBody = createScientificHeatingRecord(sample.innerSystemHeating);
    const engulfmentByBody = createEngulfmentRecord(sample.engulfedBodyIds);
    assertFiniteScientificSnapshotValues([
      clock.timeSeconds,
      clock.totalDurationSeconds,
      clock.progress,
      sample.phaseProgress,
      sample.radiusSolarRadii,
      physicalRadiusM,
      sample.luminositySolar,
      sample.massSolarMasses,
      sample.effectiveTemperatureK,
      sample.innerSystemHeating,
      sample.massLossShellOpacity,
      sample.nebulaOpacity,
      sample.nebulaDisplayRadiusSolarRadii,
      nebulaDisplayRadiusM,
      sample.whiteDwarfBlend,
      ...Object.values(heatingByBody),
      ...Object.values(engulfmentByBody),
    ]);
    this.#snapshot = Object.freeze({
      state: this.#playbackState,
      stage: this.#playbackState === 'complete' ? 'complete' : sample.phaseId,
      classification: 'educational-approximation',
      title: 'Scientific Solar Evolution',
      scenarioTimeSeconds: clock.timeSeconds,
      totalDurationSeconds: clock.totalDurationSeconds,
      progress: clock.progress,
      normalizedEvolutionProgress: clock.progress,
      phaseId: sample.phaseId,
      phaseLabel: sample.phaseLabel,
      phaseProgress: sample.phaseProgress,
      playbackRate: clock.playbackRate,
      parameters,
      radiusSolarRadii: sample.radiusSolarRadii,
      physicalRadiusM,
      luminositySolar: sample.luminositySolar,
      massSolarMasses: sample.massSolarMasses,
      effectiveTemperatureK: sample.effectiveTemperatureK,
      radiusLabel: sample.radiusLabel,
      luminosityLabel: sample.luminosityLabel,
      massLossLabel: sample.massLossLabel,
      innerSystemHeating: sample.innerSystemHeating,
      massLossShellOpacity: sample.massLossShellOpacity,
      nebulaOpacity: sample.nebulaOpacity,
      nebulaDisplayRadiusSolarRadii: sample.nebulaDisplayRadiusSolarRadii,
      nebulaDisplayRadiusM,
      whiteDwarfBlend: sample.whiteDwarfBlend,
      heatingByBody,
      engulfmentByBody,
      engulfedBodyIds: sample.engulfedBodyIds,
      uncertainBodyIds: sample.uncertainBodyIds,
      caveats: sample.caveats,
      timeCompressionNotice: SOLAR_EVOLUTION_PROFILE.timeCompressionNotice,
      compactRemnantSizeExaggerationRequired: sample.whiteDwarfBlend > 0.5,
      runSignature: this.#signature,
    });
    this.#notify();
  }

  #requiredClock(): DeterministicScenarioClock {
    if (this.#clock === null) {
      throw new Error('Scientific Solar Evolution has not been started.');
    }
    return this.#clock;
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener(this.#snapshot);
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('ScientificSolarEvolutionScenario has been disposed.');
    }
  }
}

export function validateScientificSolarEvolutionParameters(
  parameters: Readonly<ScientificSolarEvolutionParameters>,
): Readonly<ScientificSolarEvolutionParameters> {
  if (parameters.profileId !== SOLAR_EVOLUTION_PROFILE.profileId) {
    throw new RangeError(
      `Unknown solar evolution profile "${String(parameters.profileId)}".`,
    );
  }
  return Object.freeze({
    profileId: SOLAR_EVOLUTION_PROFILE.profileId,
    cameraMode: validateSolarFateCameraMode(parameters.cameraMode),
    playbackRate: validateSolarFatePlaybackRate(parameters.playbackRate),
    seed: validateSolarFateSeed(parameters.seed),
  });
}

export function serializeScientificSolarEvolutionParameters(
  parameters: Readonly<ScientificSolarEvolutionParameters>,
): string {
  const normalized = validateScientificSolarEvolutionParameters(parameters);
  return JSON.stringify({
    profileId: normalized.profileId,
    cameraMode: normalized.cameraMode,
    playbackRate: normalized.playbackRate,
    seed: normalized.seed,
  });
}

export function scientificSolarEvolutionRunSignature(
  parameters: Readonly<ScientificSolarEvolutionParameters>,
): string {
  return createSolarFateRunSignature(
    `${SOLAR_EVOLUTION_PROFILE.modelVersion}/scientific`,
    serializeScientificSolarEvolutionParameters(parameters),
  );
}

function phaseStartTimes(): readonly number[] {
  let elapsedSeconds = 0;
  return SOLAR_EVOLUTION_PROFILE.phases.map((phase) => {
    const startSeconds = elapsedSeconds;
    elapsedSeconds += phase.durationSeconds;
    return startSeconds;
  });
}

function phaseStartSeconds(phaseId: SolarEvolutionPhaseId): number {
  let elapsedSeconds = 0;
  for (const phase of SOLAR_EVOLUTION_PROFILE.phases) {
    if (phase.id === phaseId) return elapsedSeconds;
    elapsedSeconds += phase.durationSeconds;
  }
  throw new RangeError(`Unknown solar evolution phase "${String(phaseId)}".`);
}

function assertFiniteScientificSnapshotValues(values: readonly number[]): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Scientific Solar Evolution produced a non-finite snapshot.');
  }
}

function createScientificHeatingRecord(
  innerSystemHeating: number,
): Readonly<Record<SolarFatePlanetId, number>> {
  return Object.freeze({
    mercury: innerSystemHeating,
    venus: innerSystemHeating * 0.75,
    earth: innerSystemHeating * 0.5,
    mars: innerSystemHeating * 0.28,
    jupiter: innerSystemHeating * 0.1,
    saturn: innerSystemHeating * 0.07,
    uranus: innerSystemHeating * 0.04,
    neptune: innerSystemHeating * 0.03,
  });
}

function createEngulfmentRecord(
  engulfedBodyIds: readonly SolarFatePlanetId[],
): Readonly<Record<SolarFatePlanetId, number>> {
  const engulfment = {
    mercury: 0,
    venus: 0,
    earth: 0,
    mars: 0,
    jupiter: 0,
    saturn: 0,
    uranus: 0,
    neptune: 0,
  } satisfies Record<SolarFatePlanetId, number>;
  for (const bodyId of engulfedBodyIds) engulfment[bodyId] = 1;
  return Object.freeze(engulfment);
}

export { DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS };
