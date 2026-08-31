import type { RenderContext } from '../../../rendering/RenderContext';
import type { SimulationContext } from '../../core/SimulationContext';
import type {
  ScenarioClassification,
  ScenarioModule,
  ScenarioPlaybackState,
  ScenarioUnsubscribe,
} from '../ScenarioModule';
import {
  BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS,
  SOLAR_MASS_KG,
} from './BlackHoleConfiguration';
import {
  computeBlackHoleDiagnostics,
  initializeBlackHoleKernel,
  schwarzschildRadiusM,
  type BlackHoleKernelAdvanceResult,
  type BlackHoleKernelConfiguration,
} from './BlackHolePhysicsKernel';
import { createBlackHolePhysicsRunner, type BlackHolePhysicsRunner } from './BlackHolePhysicsRunner';
import { createBlackHoleRunSignature } from './BlackHoleSerialization';
import type {
  BlackHoleBodyOutcome,
  BlackHoleBodySnapshot,
  BlackHoleEncounterParameters,
  BlackHoleRenderState,
  BlackHoleVector3,
  CompleteConsumptionParameters,
  CompleteConsumptionSnapshot,
  CompleteConsumptionStage,
  PhysicsFlybySnapshot,
  PhysicsFlybyStage,
} from './BlackHoleTypes';

type SupportedParameters = BlackHoleEncounterParameters | CompleteConsumptionParameters;
type SupportedSnapshot = PhysicsFlybySnapshot | CompleteConsumptionSnapshot;
type SupportedStage = PhysicsFlybyStage | CompleteConsumptionStage;

const OUTCOME_BY_CODE: readonly BlackHoleBodyOutcome[] = Object.freeze([
  'intact',
  'tidally-stressed',
  'disrupted',
  'accretion-stream',
  'captured',
  'ejected',
]);

export abstract class BlackHoleScenarioBase<
  Parameters extends SupportedParameters,
  Snapshot extends SupportedSnapshot,
> implements ScenarioModule<Parameters, Snapshot> {
  public abstract readonly id: string;
  public abstract readonly classification: ScenarioClassification;
  public readonly destructive = true;
  protected abstract readonly mode:
    | 'physics-flyby'
    | 'complete-consumption-cinematic';
  protected abstract readonly title: string;
  protected abstract readonly warning: string;

  readonly #listeners = new Set<(snapshot: Readonly<Snapshot>) => void>();
  #parameters: Readonly<Parameters> | null = null;
  #result: BlackHoleKernelAdvanceResult | null = null;
  #runner: BlackHolePhysicsRunner | null = null;
  #snapshot: Readonly<Snapshot>;
  #playbackState: ScenarioPlaybackState = 'idle';
  #signature: string | null = null;
  #completedTicks = 0;
  #desiredTicks = 0;
  #pendingTicks = 0;
  #pendingCommandTicks = 0;
  #remainderSeconds = 0;
  #inFlight = false;
  #generation = 0;
  #disposed = false;

  protected constructor(idleSnapshot: Readonly<Snapshot>) {
    this.#snapshot = idleSnapshot;
  }

  public get state(): ScenarioPlaybackState {
    return this.#playbackState;
  }

  public get physicsExecution(): BlackHolePhysicsRunner['execution'] | null {
    return this.#runner?.execution ?? null;
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

  public start(parameters: Readonly<Parameters>): Promise<void> | void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'idle') {
      throw new Error(`Reset the active ${this.title} run before starting another one.`);
    }
    const validated = this.validateParameters(parameters);
    this.#parameters = validated;
    this.#signature = createBlackHoleRunSignature(this.mode, validated);
    this.#playbackState = 'running';
    this.#completedTicks = 0;
    this.#desiredTicks = 0;
    this.#pendingTicks = 0;
    this.#pendingCommandTicks = 0;
    this.#remainderSeconds = 0;
    const generation = ++this.#generation;
    const initial = initializeBlackHoleKernel(
      validated.initialState,
      validated.blackHole,
    );
    this.#result = initial;
    this.#publishSnapshot();
    this.#runner = createBlackHolePhysicsRunner(
      `${this.id}-${this.#signature ?? validated.seed}`,
    );
    const initialized = this.#runner.initialize(
      validated.initialState,
      validated.blackHole,
      this.kernelConfiguration(validated),
    );
    if (isPromise(initialized)) {
      return initialized.then((result) => {
        if (generation !== this.#generation || this.#disposed) return;
        this.#result = result;
        this.#publishSnapshot();
      });
    }
    this.#result = initialized;
    this.#publishSnapshot();
  }

  public advance(realDeltaSeconds: number): void {
    this.#assertNotDisposed();
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Black-hole scenario delta must be finite and non-negative.');
    }
    if (this.#playbackState !== 'running' || realDeltaSeconds === 0) return;
    const parameters = this.#requiredParameters();
    const accumulated =
      this.#remainderSeconds + realDeltaSeconds * parameters.playbackRate;
    const ticks = Math.floor(
      (accumulated + BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS * 1e-9) /
        BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS,
    );
    this.#remainderSeconds =
      accumulated - ticks * BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS;
    if (Math.abs(this.#remainderSeconds) < 1e-12) this.#remainderSeconds = 0;
    if (ticks <= 0) return;
    this.#queueTicks(ticks);
  }

  public pause(): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'running') return;
    // Real-time ticks queued behind the currently submitted worker batch are
    // stale once the user pauses. Remove only that automatic backlog so a
    // paused frame-step or skip can target the visible state immediately.
    // Explicit command ticks remain queued, and an already submitted batch is
    // bounded/non-cancellable and may finish once.
    const pendingAutomaticTicks = Math.max(
      0,
      this.#pendingTicks - this.#pendingCommandTicks,
    );
    this.#pendingTicks -= pendingAutomaticTicks;
    this.#desiredTicks = Math.max(
      this.#completedTicks,
      this.#desiredTicks - pendingAutomaticTicks,
    );
    this.#playbackState = 'paused';
    this.#publishSnapshot();
  }

  public resume(): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'paused') return;
    this.#playbackState = 'running';
    this.#publishSnapshot();
    this.#drainQueue();
  }

  public frameStep(stepSeconds = BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'paused') {
      throw new Error('Black-hole scenario frame-step is available only while paused.');
    }
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError('Black-hole frame-step duration must be finite and positive.');
    }
    this.#queueTicks(Math.max(
      1,
      Math.round(stepSeconds / BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS),
    ), true);
  }

  public replay(): void {
    this.#assertNotDisposed();
    const parameters = this.#requiredParameters();
    this.#disposeRunner();
    const generation = ++this.#generation;
    this.#completedTicks = 0;
    this.#desiredTicks = 0;
    this.#pendingTicks = 0;
    this.#pendingCommandTicks = 0;
    this.#remainderSeconds = 0;
    this.#inFlight = false;
    this.#playbackState = 'running';
    this.#result = initializeBlackHoleKernel(
      parameters.initialState,
      parameters.blackHole,
    );
    this.#publishSnapshot();
    this.#runner = createBlackHolePhysicsRunner(
      `${this.id}-${this.#signature ?? parameters.seed}-replay-${generation}`,
    );
    const initialized = this.#runner.initialize(
      parameters.initialState,
      parameters.blackHole,
      this.kernelConfiguration(parameters),
    );
    if (isPromise(initialized)) {
      void initialized.then((result) => {
        if (generation !== this.#generation || this.#disposed) return;
        this.#result = result;
        this.#publishSnapshot();
        this.#drainQueue();
      }).catch(() => {
        if (generation === this.#generation) this.#playbackState = 'paused';
      });
      return;
    }
    this.#result = initialized;
    this.#publishSnapshot();
  }

  public getSnapshot(): Readonly<Snapshot> {
    return this.#snapshot;
  }

  public serializeParameters(): string | null {
    return this.#parameters === null
      ? null
      : this.serializeValidatedParameters(this.#parameters);
  }

  public subscribe(
    listener: (snapshot: Readonly<Snapshot>) => void,
  ): ScenarioUnsubscribe {
    this.#assertNotDisposed();
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public reset(_context?: SimulationContext): void {
    void _context;
    if (this.#disposed) return;
    this.#generation += 1;
    this.#disposeRunner();
    this.#parameters = null;
    this.#result = null;
    this.#signature = null;
    this.#completedTicks = 0;
    this.#desiredTicks = 0;
    this.#pendingTicks = 0;
    this.#pendingCommandTicks = 0;
    this.#remainderSeconds = 0;
    this.#inFlight = false;
    this.#playbackState = 'idle';
    this.#snapshot = this.idleSnapshot();
    this.#notify();
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.reset();
    this.#listeners.clear();
    this.#disposed = true;
  }

  protected abstract validateParameters(parameters: Readonly<Parameters>): Readonly<Parameters>;
  protected abstract serializeValidatedParameters(parameters: Readonly<Parameters>): string;
  protected abstract idleSnapshot(): Readonly<Snapshot>;
  protected abstract stageAtTime(
    scenarioTimeSeconds: number,
    complete: boolean,
    parameters: Readonly<Parameters>,
  ): SupportedStage;

  protected skipToScenarioTime(targetSeconds: number): void {
    this.#assertNotDisposed();
    const parameters = this.#requiredParameters();
    if (!Number.isFinite(targetSeconds) || targetSeconds < 0) {
      throw new RangeError('Black-hole skip target must be finite and non-negative.');
    }
    const clampedSeconds = Math.min(targetSeconds, parameters.durationSeconds);
    const targetTicks = Math.min(
      this.#totalTicks(),
      Math.ceil(clampedSeconds / BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS),
    );
    this.#queueTicks(Math.max(0, targetTicks - this.#desiredTicks), true);
  }

  #queueTicks(requestedTicks: number, commandWhilePaused = false): void {
    const maximumTicks = this.#totalTicks();
    const acceptedTicks = Math.min(
      requestedTicks,
      maximumTicks - this.#desiredTicks,
    );
    if (acceptedTicks <= 0) return;
    this.#desiredTicks += acceptedTicks;
    this.#pendingTicks += acceptedTicks;
    if (commandWhilePaused) this.#pendingCommandTicks += acceptedTicks;
    this.#drainQueue();
  }

  #drainQueue(): void {
    const runner = this.#runner;
    const parameters = this.#parameters;
    if (runner === null || parameters === null || this.#inFlight || this.#pendingTicks <= 0) {
      return;
    }
    const canAdvanceNormally = this.#playbackState === 'running';
    const canAdvanceCommandWhilePaused =
      this.#playbackState === 'paused' && this.#pendingCommandTicks > 0;
    if (!canAdvanceNormally && !canAdvanceCommandWhilePaused) return;
    // The runner preserves each tick boundary internally, so batching does not
    // change adaptive-step choices across display-frame partitioning.
    const submittedTicks = canAdvanceNormally
      ? this.#pendingTicks
      : Math.min(this.#pendingTicks, this.#pendingCommandTicks);
    const submittedCommandTicks = Math.min(
      submittedTicks,
      this.#pendingCommandTicks,
    );
    this.#pendingTicks -= submittedTicks;
    this.#pendingCommandTicks -= submittedCommandTicks;
    const physicalTickSeconds = BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS *
      parameters.physicsSecondsPerScenarioSecond;
    const generation = this.#generation;
    const advanced = runner.advance(physicalTickSeconds, submittedTicks);
    if (!isPromise(advanced)) {
      this.#acceptAdvance(advanced, submittedTicks, generation);
      this.#drainQueue();
      return;
    }
    this.#inFlight = true;
    void advanced.then((result) => {
      if (generation !== this.#generation || this.#disposed) return;
      this.#inFlight = false;
      this.#acceptAdvance(result, submittedTicks, generation);
      this.#drainQueue();
    }).catch(() => {
      if (generation !== this.#generation || this.#disposed) return;
      this.#inFlight = false;
      this.#pendingTicks += submittedTicks;
      this.#pendingCommandTicks += submittedCommandTicks;
      this.#playbackState = 'paused';
      this.#publishSnapshot();
    });
  }

  #acceptAdvance(
    result: BlackHoleKernelAdvanceResult,
    submittedTicks: number,
    generation: number,
  ): void {
    if (generation !== this.#generation) return;
    this.#result = result;
    this.#completedTicks = Math.min(
      this.#totalTicks(),
      this.#completedTicks + submittedTicks,
    );
    if (this.#completedTicks >= this.#totalTicks()) {
      this.#playbackState = 'complete';
      this.#remainderSeconds = 0;
    }
    this.#publishSnapshot();
  }

  #publishSnapshot(): void {
    const parameters = this.#parameters;
    const result = this.#result;
    if (parameters === null || result === null) {
      this.#snapshot = this.idleSnapshot();
      this.#notify();
      return;
    }
    const scenarioTimeSeconds =
      this.#completedTicks * BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS;
    const complete = this.#playbackState === 'complete';
    const bodyStates = this.createBodySnapshots(
      result,
      parameters,
      scenarioTimeSeconds,
    );
    const captureCount = bodyStates.filter((body) => body.outcome === 'captured').length;
    const ejectionCount = bodyStates.filter((body) => body.outcome === 'ejected').length;
    const survivorCount = bodyStates.length - captureCount - ejectionCount;
    const blackHole = this.createBlackHoleRenderState(
      result,
      parameters,
      bodyStates,
    );
    const snapshot = {
      state: this.#playbackState,
      mode: this.mode,
      classification: this.classification,
      title: this.title,
      warning: this.warning,
      stage: this.stageAtTime(scenarioTimeSeconds, complete, parameters),
      scenarioTimeSeconds,
      totalDurationSeconds:
        this.#totalTicks() * BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS,
      progress: this.#totalTicks() === 0 ? 0 : this.#completedTicks / this.#totalTicks(),
      playbackRate: parameters.playbackRate,
      parameters,
      bodyStates,
      blackHole,
      diagnostics: result.diagnostics,
      scenarioOriginM: vectorAt(result.state.originM, 0),
      scenarioOriginVelocityMps: vectorAt(result.state.originVelocityMps, 0),
      runSignature: this.#signature,
      captureCount,
      ejectionCount,
      survivorCount,
      allBodiesCaptured: captureCount === bodyStates.length,
    };
    if (!allNumbersFinite(snapshot)) {
      throw new Error(`${this.title} produced a non-finite snapshot.`);
    }
    this.#snapshot = Object.freeze(snapshot) as unknown as Readonly<Snapshot>;
    this.#notify();
  }

  protected createBodySnapshots(
    result: BlackHoleKernelAdvanceResult,
    parameters: Readonly<Parameters>,
    _scenarioTimeSeconds: number,
  ): readonly Readonly<BlackHoleBodySnapshot>[] {
    void parameters;
    void _scenarioTimeSeconds;
    const state = result.state;
    const bhOffset = state.blackHoleIndex * 3;
    const bhX = state.positionsM[bhOffset] ?? 0;
    const bhY = state.positionsM[bhOffset + 1] ?? 0;
    const bhZ = state.positionsM[bhOffset + 2] ?? 0;
    const captureRadiusM = schwarzschildRadiusM(
      state.massesKg[state.blackHoleIndex] ?? 1,
    ) * this.#requiredParameters().blackHole.captureRadiusMultiple;
    return Object.freeze(state.bodyIds.map((bodyId, index) => {
      const offset = index * 3;
      const outcome = OUTCOME_BY_CODE[state.outcomeCodes[index] ?? 0] ?? 'intact';
      const distanceM = Math.hypot(
        (state.positionsM[offset] ?? 0) - bhX,
        (state.positionsM[offset + 1] ?? 0) - bhY,
        (state.positionsM[offset + 2] ?? 0) - bhZ,
      );
      const bodyMass = this.#requiredParameters().initialState.massesKg[index] ?? 1;
      const radiusM = this.#requiredParameters().initialState.radiiM[index] ?? 1;
      const tidalRadiusM = radiusM * Math.cbrt(
        2 * (state.massesKg[state.blackHoleIndex] ?? 1) / bodyMass,
      );
      const tidalStress = clamp01(1 - (distanceM - captureRadiusM) /
        Math.max(tidalRadiusM * 2 - captureRadiusM, 1));
      return Object.freeze({
        bodyId,
        massKg: bodyMass,
        radiusM,
        positionLocalM: vectorAt(state.positionsM, offset),
        velocityLocalMps: vectorAt(state.velocitiesMps, offset),
        outcome,
        tidalStress,
        streamProgress: outcome === 'accretion-stream' ? tidalStress : 0,
        captureProgress: outcome === 'captured' ? 1 : clamp01(
          1 - distanceM / Math.max(tidalRadiusM * 2, captureRadiusM),
        ),
      });
    }));
  }

  protected createBlackHoleRenderState(
    result: BlackHoleKernelAdvanceResult,
    parameters: Readonly<Parameters>,
    _bodyStates: readonly Readonly<BlackHoleBodySnapshot>[],
  ): Readonly<BlackHoleRenderState> {
    void _bodyStates;
    const state = result.state;
    const offset = state.blackHoleIndex * 3;
    const massKg = state.massesKg[state.blackHoleIndex] ??
      parameters.blackHole.massSolarMasses * SOLAR_MASS_KG;
    const radiusM = schwarzschildRadiusM(massKg);
    return Object.freeze({
      massKg,
      massSolarMasses: massKg / SOLAR_MASS_KG,
      schwarzschildRadiusM: radiusM,
      captureRadiusM: radiusM * parameters.blackHole.captureRadiusMultiple,
      positionLocalM: vectorAt(state.positionsM, offset),
      velocityLocalMps: vectorAt(state.velocitiesMps, offset),
      spinVisualization: parameters.blackHole.spinVisualization,
      accretionDiskEnabled: parameters.blackHole.accretionDiskEnabled,
    });
  }

  protected requiredResult(): BlackHoleKernelAdvanceResult {
    if (this.#result === null) throw new Error(`${this.title} has no physics state.`);
    return this.#result;
  }

  protected requiredParameters(): Readonly<Parameters> {
    return this.#requiredParameters();
  }

  protected currentDiagnostics(): ReturnType<typeof computeBlackHoleDiagnostics> {
    return computeBlackHoleDiagnostics(this.requiredResult().state);
  }

  private kernelConfiguration(parameters: Readonly<Parameters>): BlackHoleKernelConfiguration {
    return {
      accuracy: parameters.accuracy,
      ejectionRadiusM: parameters.ejectionRadiusM,
      captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
      physicsSecondsPerScenarioSecond:
        parameters.physicsSecondsPerScenarioSecond,
      cinematicInfall: cinematicInfallFor(parameters),
    };
  }

  #totalTicks(): number {
    const parameters = this.#parameters;
    return parameters === null
      ? 0
      : Math.max(
          1,
          Math.ceil(parameters.durationSeconds / BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS),
        );
  }

  #requiredParameters(): Readonly<Parameters> {
    if (this.#parameters === null) {
      throw new Error(`${this.title} has no prepared run.`);
    }
    return this.#parameters;
  }

  #disposeRunner(): void {
    this.#runner?.dispose();
    this.#runner = null;
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener(this.#snapshot);
  }

  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error(`${this.title} scenario has been disposed.`);
  }
}

export function vectorAt(values: Float64Array, offset: number): BlackHoleVector3 {
  return [values[offset] ?? 0, values[offset + 1] ?? 0, values[offset + 2] ?? 0];
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function isPromise<Value>(
  value: Value | Promise<Value>,
): value is Promise<Value> {
  return typeof (value as Promise<Value>).then === 'function';
}

function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>).every(Number.isFinite);
  }
  if (Array.isArray(value)) return value.every(allNumbersFinite);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(allNumbersFinite);
  }
  return true;
}

function cinematicInfallFor(
  parameters: Readonly<SupportedParameters>,
): Readonly<CompleteConsumptionParameters['infall']> | null {
  return 'infall' in parameters
    ? (parameters as Readonly<CompleteConsumptionParameters>).infall
    : null;
}
