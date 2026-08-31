import type { RenderContext } from '../../../rendering/RenderContext';
import type { SimulationContext } from '../../core/SimulationContext';
import type { Vec3d } from '../../core/Vec3d';
import type {
  ScenarioModule,
  ScenarioPlaybackState,
  ScenarioUnsubscribe,
} from '../ScenarioModule';
import {
  IMPACT_FIXED_STEP_SECONDS,
  IMPACT_PARAMETER_LIMITS,
  impactRunSignature,
  serializeImpactParameters,
  validateImpactParameters,
} from './ImpactConfiguration';
import {
  deriveImpactVisualProfile,
  sampleImpactTrajectory,
  simulateImpactEntry,
} from './ImpactPhysics';
import {
  getImpactAtmosphereProfile,
  getImpactTargetProfile,
} from './ImpactTargetProfiles';
import type {
  ImpactParameters,
  ImpactScenarioSnapshot,
  ImpactSimulationResult,
  ImpactStage,
  ImpactTrajectorySample,
  ImpactVisualProfile,
} from './ImpactTypes';

const MAX_TRAIL_POSITIONS = 128;
const EMPTY_POSITIONS: readonly Readonly<Vec3d>[] = Object.freeze([]);

const IDLE_SNAPSHOT: Readonly<ImpactScenarioSnapshot> = Object.freeze({
  state: 'idle',
  stage: 'idle',
  scenarioTimeSeconds: 0,
  totalDurationSeconds: 0,
  progress: 0,
  playbackRate: 1,
  parameters: null,
  physicalSummary: null,
  visualProfile: null,
  impactFrame: null,
  impactorPosition: null,
  impactorVelocity: null,
  normalizedHeating: 0,
  normalizedDynamicPressure: 0,
  remainingMassFraction: 1,
  eventElapsedSeconds: null,
  craterFormationProgress: 0,
  surfaceScorchOpacity: 0,
  trailPositions: EMPTY_POSITIONS,
  fragmentPositions: EMPTY_POSITIONS,
  flashIntensity: 0,
  ejectaRadiusM: 0,
  ejectaHeightM: 0,
  ejectaOpacity: 0,
  shockwaveRadiusM: 0,
  groundShockwaveAngularRadiusRad: 0,
  groundShockwaveOpacity: 0,
  atmosphericShockwaveAngularRadiusRad: 0,
  atmosphericShockwaveOpacity: 0,
  plumeHeightM: 0,
  plumeRadiusM: 0,
  plumeOpacity: 0,
  plumeCoolingProgress: 0,
  hazeOpacity: 0,
  cloudScarGrowthProgress: 0,
  cloudScarOpacity: 0,
  cloudScarAdvectionRad: 0,
  runSignature: null,
  fragmentCount: 0,
});

/** Deterministic, observatory-clock-independent Impact Lab scenario. */
export class AsteroidImpactScenario
  implements ScenarioModule<ImpactParameters, ImpactScenarioSnapshot>
{
  public readonly id = 'asteroid-impact';
  public readonly classification = 'educational-approximation' as const;
  public readonly destructive = true;

  readonly #listeners = new Set<
    (snapshot: Readonly<ImpactScenarioSnapshot>) => void
  >();
  #playbackState: ScenarioPlaybackState = 'idle';
  #parameters: Readonly<ImpactParameters> | null = null;
  #simulation: Readonly<ImpactSimulationResult> | null = null;
  #visualProfile: Readonly<ImpactVisualProfile> | null = null;
  #snapshot = IDLE_SNAPSHOT;
  #signature: string | null = null;
  #playbackRate = 1;
  #playbackRemainderSeconds = 0;
  #cursorTicks = 0;
  #totalTicks = 0;
  #peakHeatingPowerW = 0;
  #peakDynamicPressurePa = 0;
  #disposed = false;

  public get state(): ScenarioPlaybackState {
    return this.#playbackState;
  }

  public init(_context: SimulationContext): void {
    void _context;
    this.#assertNotDisposed();
  }

  /** Astronomical time never advances this scenario. */
  public onTick(_context: SimulationContext, _dtSimSeconds: number): void {
    void _context;
    void _dtSimSeconds;
  }

  /** Real display time is the scenario clock when driven through SimulationEngine. */
  public onRender(_context: RenderContext, dtRealSeconds: number): void {
    this.advance(dtRealSeconds);
  }

  public start(parameters: Readonly<ImpactParameters>): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'idle') {
      throw new Error('Reset the active Impact Lab run before starting another one.');
    }
    const normalized = validateImpactParameters(parameters);
    const simulation = simulateImpactEntry(normalized);
    const visualProfile = deriveImpactVisualProfile(simulation.physicalSummary);
    const totalDurationSeconds = roundDurationToFixedStep(
      simulation.terminalEventTimeSeconds + maximumTransientDuration(visualProfile),
    );

    this.#parameters = normalized;
    this.#simulation = simulation;
    this.#visualProfile = visualProfile;
    this.#signature = impactRunSignature(normalized);
    this.#playbackRate = normalized.cameraMode === 'slow-motion-replay' ? 0.25 : 1;
    this.#playbackRemainderSeconds = 0;
    this.#cursorTicks = 0;
    this.#totalTicks = Math.max(1, Math.round(totalDurationSeconds / IMPACT_FIXED_STEP_SECONDS));
    const normalizationPeaks = deriveEntryNormalizationPeaks(simulation);
    this.#peakHeatingPowerW = normalizationPeaks.heatingPowerW;
    this.#peakDynamicPressurePa = normalizationPeaks.dynamicPressurePa;
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public advance(realDeltaSeconds: number): void {
    this.#assertNotDisposed();
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Impact scenario delta must be finite and non-negative.');
    }
    if (this.#playbackState !== 'running' || realDeltaSeconds === 0) return;

    const accumulated =
      this.#playbackRemainderSeconds + realDeltaSeconds * this.#playbackRate;
    const ticks = Math.floor(
      (accumulated + IMPACT_FIXED_STEP_SECONDS * 1e-9) /
        IMPACT_FIXED_STEP_SECONDS,
    );
    this.#playbackRemainderSeconds =
      accumulated - ticks * IMPACT_FIXED_STEP_SECONDS;
    if (Math.abs(this.#playbackRemainderSeconds) < 1e-12) {
      this.#playbackRemainderSeconds = 0;
    }
    if (ticks === 0) return;
    this.#advanceTicks(ticks);
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

  public frameStep(stepSeconds = IMPACT_FIXED_STEP_SECONDS): void {
    this.#assertNotDisposed();
    if (this.#playbackState !== 'paused') {
      throw new Error('Impact frame-step is available only while the scenario is paused.');
    }
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError('Impact frame-step duration must be finite and positive.');
    }
    const ticks = Math.max(1, Math.round(stepSeconds / IMPACT_FIXED_STEP_SECONDS));
    this.#advanceTicks(ticks);
  }

  public replay(): void {
    this.#assertNotDisposed();
    if (
      this.#parameters === null ||
      this.#simulation === null ||
      this.#visualProfile === null
    ) {
      throw new Error('Impact Lab has no prepared run to replay.');
    }
    this.#cursorTicks = 0;
    this.#playbackRemainderSeconds = 0;
    this.#playbackState = 'running';
    this.#publishSnapshot();
  }

  public setPlaybackRate(playbackRate: number): void {
    this.#assertNotDisposed();
    const limits = IMPACT_PARAMETER_LIMITS.playbackRate;
    if (
      !Number.isFinite(playbackRate) ||
      playbackRate < limits.minimum ||
      playbackRate > limits.maximum
    ) {
      throw new RangeError(
        `Impact playback rate must be between ${limits.minimum} and ${limits.maximum}.`,
      );
    }
    if (this.#playbackRate === playbackRate) return;
    this.#playbackRate = playbackRate;
    this.#publishSnapshot();
  }

  public getSnapshot(): Readonly<ImpactScenarioSnapshot> {
    return this.#snapshot;
  }

  public serializeParameters(): string | null {
    return this.#parameters === null
      ? null
      : serializeImpactParameters(this.#parameters);
  }

  public subscribe(
    listener: (snapshot: Readonly<ImpactScenarioSnapshot>) => void,
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
    this.#simulation = null;
    this.#visualProfile = null;
    this.#signature = null;
    this.#playbackRate = 1;
    this.#playbackRemainderSeconds = 0;
    this.#cursorTicks = 0;
    this.#totalTicks = 0;
    this.#peakHeatingPowerW = 0;
    this.#peakDynamicPressurePa = 0;
    this.#playbackState = 'idle';
    this.#snapshot = IDLE_SNAPSHOT;
    this.#notify();
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.reset();
    this.#listeners.clear();
    this.#disposed = true;
  }

  #advanceTicks(ticks: number): void {
    if (!Number.isSafeInteger(ticks) || ticks < 0) {
      throw new RangeError('Impact scenario tick count must be a non-negative integer.');
    }
    this.#cursorTicks = Math.min(this.#cursorTicks + ticks, this.#totalTicks);
    if (this.#cursorTicks >= this.#totalTicks) {
      this.#cursorTicks = this.#totalTicks;
      this.#playbackRemainderSeconds = 0;
      this.#playbackState = 'complete';
    }
    this.#publishSnapshot();
  }

  #publishSnapshot(): void {
    const simulation = this.#simulation;
    const parameters = this.#parameters;
    const visualProfile = this.#visualProfile;
    if (simulation === null || parameters === null || visualProfile === null) {
      this.#snapshot = IDLE_SNAPSHOT;
      this.#notify();
      return;
    }

    const scenarioTimeSeconds = this.#cursorTicks * IMPACT_FIXED_STEP_SECONDS;
    const totalDurationSeconds = this.#totalTicks * IMPACT_FIXED_STEP_SECONDS;
    const trajectoryTimeSeconds = Math.min(
      scenarioTimeSeconds,
      simulation.terminalEventTimeSeconds,
    );
    const currentSample = sampleImpactTrajectory(simulation, trajectoryTimeSeconds);
    const eventElapsedSeconds = scenarioTimeSeconds <
        simulation.terminalEventTimeSeconds
      ? null
      : scenarioTimeSeconds - simulation.terminalEventTimeSeconds;
    const eventChannels = deriveSurfaceEventChannels(
      simulation,
      parameters,
      visualProfile,
      eventElapsedSeconds,
    );
    const stage = stageAtTime(
      this.#playbackState,
      scenarioTimeSeconds,
      currentSample,
      simulation,
      parameters,
      visualProfile,
      eventChannels,
    );

    this.#snapshot = Object.freeze({
      state: this.#playbackState,
      stage,
      scenarioTimeSeconds,
      totalDurationSeconds,
      progress:
        this.#totalTicks === 0 ? 0 : clamp(this.#cursorTicks / this.#totalTicks, 0, 1),
      playbackRate: this.#playbackRate,
      parameters,
      physicalSummary: simulation.physicalSummary,
      visualProfile,
      impactFrame: simulation.impactFrame,
      impactorPosition: currentSample.positionEnuM,
      impactorVelocity: currentSample.velocityEnuMps,
      normalizedHeating: normalizedByPeak(
        currentSample.heatingPowerW,
        this.#peakHeatingPowerW,
      ),
      normalizedDynamicPressure: normalizedByPeak(
        currentSample.dynamicPressurePa,
        this.#peakDynamicPressurePa,
      ),
      remainingMassFraction: clamp(
        currentSample.massKg / simulation.physicalSummary.massKg,
        0,
        1,
      ),
      eventElapsedSeconds,
      craterFormationProgress: eventChannels.craterFormationProgress,
      surfaceScorchOpacity: eventChannels.surfaceScorchOpacity,
      trailPositions: createTrailPositions(simulation, trajectoryTimeSeconds),
      fragmentPositions: createFragmentPositions(
        simulation,
        currentSample,
        scenarioTimeSeconds,
      ),
      flashIntensity: eventChannels.flashIntensity,
      ejectaRadiusM: eventChannels.ejectaRadiusM,
      ejectaHeightM: eventChannels.ejectaHeightM,
      ejectaOpacity: eventChannels.ejectaOpacity,
      shockwaveRadiusM: eventChannels.shockwaveRadiusM,
      groundShockwaveAngularRadiusRad:
        eventChannels.groundShockwaveAngularRadiusRad,
      groundShockwaveOpacity: eventChannels.groundShockwaveOpacity,
      atmosphericShockwaveAngularRadiusRad:
        eventChannels.atmosphericShockwaveAngularRadiusRad,
      atmosphericShockwaveOpacity:
        eventChannels.atmosphericShockwaveOpacity,
      plumeHeightM: eventChannels.plumeHeightM,
      plumeRadiusM: eventChannels.plumeRadiusM,
      plumeOpacity: eventChannels.plumeOpacity,
      plumeCoolingProgress: eventChannels.plumeCoolingProgress,
      hazeOpacity: eventChannels.hazeOpacity,
      cloudScarGrowthProgress: eventChannels.cloudScarGrowthProgress,
      cloudScarOpacity: eventChannels.cloudScarOpacity,
      cloudScarAdvectionRad: eventChannels.cloudScarAdvectionRad,
      runSignature: this.#signature,
      fragmentCount: simulation.fragmentation.count,
    });
    this.#notify();
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener(this.#snapshot);
  }

  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error('AsteroidImpactScenario has been disposed.');
  }
}

interface ImpactSurfaceEventChannels {
  readonly flashIntensity: number;
  readonly craterFormationProgress: number;
  readonly surfaceScorchOpacity: number;
  readonly ejectaRadiusM: number;
  readonly ejectaHeightM: number;
  readonly ejectaOpacity: number;
  readonly shockwaveRadiusM: number;
  readonly groundShockwaveAngularRadiusRad: number;
  readonly groundShockwaveOpacity: number;
  readonly atmosphericShockwaveAngularRadiusRad: number;
  readonly atmosphericShockwaveOpacity: number;
  readonly plumeHeightM: number;
  readonly plumeRadiusM: number;
  readonly plumeOpacity: number;
  readonly plumeCoolingProgress: number;
  readonly hazeOpacity: number;
  readonly cloudScarGrowthProgress: number;
  readonly cloudScarOpacity: number;
  readonly cloudScarAdvectionRad: number;
}

const EMPTY_SURFACE_EVENT_CHANNELS: Readonly<ImpactSurfaceEventChannels> =
  Object.freeze({
    flashIntensity: 0,
    craterFormationProgress: 0,
    surfaceScorchOpacity: 0,
    ejectaRadiusM: 0,
    ejectaHeightM: 0,
    ejectaOpacity: 0,
    shockwaveRadiusM: 0,
    groundShockwaveAngularRadiusRad: 0,
    groundShockwaveOpacity: 0,
    atmosphericShockwaveAngularRadiusRad: 0,
    atmosphericShockwaveOpacity: 0,
    plumeHeightM: 0,
    plumeRadiusM: 0,
    plumeOpacity: 0,
    plumeCoolingProgress: 0,
    hazeOpacity: 0,
    cloudScarGrowthProgress: 0,
    cloudScarOpacity: 0,
    cloudScarAdvectionRad: 0,
  });

function deriveSurfaceEventChannels(
  simulation: Readonly<ImpactSimulationResult>,
  parameters: Readonly<ImpactParameters>,
  profile: Readonly<ImpactVisualProfile>,
  eventElapsedSeconds: number | null,
): Readonly<ImpactSurfaceEventChannels> {
  if (eventElapsedSeconds === null) return EMPTY_SURFACE_EVENT_CHANNELS;
  const elapsed = eventElapsedSeconds;
  const target = getImpactTargetProfile(simulation.physicalSummary.targetBodyId);
  const targetRadiusM = simulation.physicalSummary.targetRadiusM;
  const isSolidSurfaceImpact =
    simulation.physicalSummary.outcomeKind === 'solid-surface-impact';
  const hasAtmosphericEvent =
    parameters.atmosphereEnabled &&
    getImpactAtmosphereProfile(target) !== null &&
    simulation.physicalSummary.atmosphericEnergyLossJ > 0;

  const flashActive = elapsed < profile.flashDurationSeconds;
  const flashIntensity = flashActive
    ? profile.flashIntensity * Math.exp(
        -elapsed / Math.max(profile.flashDecaySeconds, 1e-6),
      )
    : 0;

  const craterFormationProgress =
    isSolidSurfaceImpact && profile.craterRadiusM > 0
      ? easeOutCubic(progressOverDuration(elapsed, profile.craterFormationSeconds))
      : 0;
  const surfaceScorchOpacity =
    isSolidSurfaceImpact && profile.scorchRadiusM > 0
      ? craterFormationProgress
      : 0;

  const ejectaActive =
    isSolidSurfaceImpact &&
    profile.ejectaLifetimeSeconds > 0 &&
    elapsed < profile.ejectaLifetimeSeconds;
  const ejectaProgress = ejectaActive
    ? progressOverDuration(elapsed, profile.ejectaLifetimeSeconds)
    : 1;
  const ejectaOpacity = ejectaActive
    ? 1 - smoothstep(0.58, 1, ejectaProgress)
    : 0;
  const ejectaPeakHeightM = profile.ejectaLaunchSpeedMps > 0
    ? profile.ejectaLaunchSpeedMps ** 2 /
      (2 * target.surfaceGravityMps2)
    : 0;
  const ejectaHeightM = ejectaActive
    ? 4 * ejectaPeakHeightM * ejectaProgress * (1 - ejectaProgress)
    : 0;
  const ejectaRadiusM = ejectaActive
    ? profile.ejectaRadiusM * easeOutCubic(ejectaProgress) * ejectaOpacity
    : 0;

  const groundShockwaveActive =
    profile.groundShockwaveLifetimeSeconds > 0 &&
    elapsed < profile.groundShockwaveLifetimeSeconds;
  const groundShockwaveProgress = groundShockwaveActive
    ? progressOverDuration(elapsed, profile.groundShockwaveLifetimeSeconds)
    : 1;
  const groundShockwaveAngularRadiusRad = groundShockwaveActive
    ? clamp(
        profile.groundShockwaveSpeedMps * elapsed / targetRadiusM,
        0,
        Math.PI,
      )
    : 0;
  const groundShockwaveOpacity = groundShockwaveActive
    ? 1 - smoothstep(0.55, 1, groundShockwaveProgress)
    : 0;

  const atmosphericShockwaveActive =
    hasAtmosphericEvent &&
    profile.atmosphericShockwaveLifetimeSeconds > 0 &&
    elapsed < profile.atmosphericShockwaveLifetimeSeconds;
  const atmosphericShockwaveProgress = atmosphericShockwaveActive
    ? progressOverDuration(
        elapsed,
        profile.atmosphericShockwaveLifetimeSeconds,
      )
    : 1;
  const atmosphericShockwaveAngularRadiusRad = atmosphericShockwaveActive
    ? clamp(
        profile.atmosphericShockwaveSpeedMps * elapsed / targetRadiusM,
        0,
        Math.PI,
      )
    : 0;
  const atmosphericShockwaveOpacity = atmosphericShockwaveActive
    ? 1 - smoothstep(0.48, 1, atmosphericShockwaveProgress)
    : 0;
  const shockwaveRadiusM = Math.max(
    groundShockwaveAngularRadiusRad,
    atmosphericShockwaveAngularRadiusRad,
  ) * targetRadiusM;

  const plumeActive =
    profile.plumeLifetimeSeconds > 0 && elapsed < profile.plumeLifetimeSeconds;
  const plumeLifetimeProgress = plumeActive
    ? progressOverDuration(elapsed, profile.plumeLifetimeSeconds)
    : 1;
  const plumeRise = plumeActive
    ? 1 - Math.exp(-elapsed / Math.max(profile.plumeRiseSeconds, 1e-6))
    : 0;
  const plumeDecay = plumeActive
    ? 1 - smoothstep(0.62, 1, plumeLifetimeProgress)
    : 0;
  const plumeOpacity = clamp(plumeRise * plumeDecay, 0, 1);
  const plumeHeightM = profile.plumeHeightM * plumeRise * plumeDecay;
  const plumeRadiusM = plumeActive
    ? profile.plumeRadiusM *
      easeOutCubic(progressOverDuration(elapsed, profile.plumeRiseSeconds * 2)) *
      plumeDecay
    : 0;
  const plumeCoolingProgress = plumeActive
    ? plumeLifetimeProgress
    : elapsed >= profile.plumeLifetimeSeconds
      ? 1
      : 0;

  const hazeActive =
    hasAtmosphericEvent &&
    profile.dustLifetimeSeconds > 0 &&
    elapsed < profile.dustLifetimeSeconds;
  const hazeProgress = hazeActive
    ? progressOverDuration(elapsed, profile.dustLifetimeSeconds)
    : 1;
  const hazeOpacity = hazeActive
    ? clamp(
        0.72 *
          (1 - Math.exp(-elapsed / 6)) *
          (1 - smoothstep(0.55, 1, hazeProgress)),
        0,
        0.72,
      )
    : 0;

  const cloudScarExists = profile.cloudScarRadiusM > 0;
  const cloudScarGrowthProgress = cloudScarExists
    ? easeOutCubic(progressOverDuration(elapsed, profile.cloudScarGrowthSeconds))
    : 0;
  const cloudScarActive =
    cloudScarExists &&
    profile.cloudScarLifetimeSeconds > 0 &&
    elapsed < profile.cloudScarLifetimeSeconds;
  const cloudScarLifetimeProgress = cloudScarActive
    ? progressOverDuration(elapsed, profile.cloudScarLifetimeSeconds)
    : 1;
  const cloudScarOpacity = cloudScarActive
    ? cloudScarGrowthProgress *
      (1 - smoothstep(0.52, 1, cloudScarLifetimeProgress))
    : 0;
  const cloudScarAdvectionRad = cloudScarActive
    ? profile.cloudScarAdvectionRateRadPerSecond * elapsed
    : 0;

  return Object.freeze({
    flashIntensity,
    craterFormationProgress,
    surfaceScorchOpacity,
    ejectaRadiusM,
    ejectaHeightM,
    ejectaOpacity,
    shockwaveRadiusM,
    groundShockwaveAngularRadiusRad,
    groundShockwaveOpacity,
    atmosphericShockwaveAngularRadiusRad,
    atmosphericShockwaveOpacity,
    plumeHeightM,
    plumeRadiusM,
    plumeOpacity,
    plumeCoolingProgress,
    hazeOpacity,
    cloudScarGrowthProgress,
    cloudScarOpacity,
    cloudScarAdvectionRad,
  });
}

function stageAtTime(
  state: ScenarioPlaybackState,
  scenarioTimeSeconds: number,
  sample: Readonly<ImpactTrajectorySample>,
  simulation: Readonly<ImpactSimulationResult>,
  parameters: Readonly<ImpactParameters>,
  profile: Readonly<ImpactVisualProfile>,
  channels: Readonly<ImpactSurfaceEventChannels>,
): ImpactStage {
  const fragmentTime = simulation.fragmentation.eventTimeSeconds;
  if (scenarioTimeSeconds < simulation.terminalEventTimeSeconds) {
    const atmosphereCutoffAltitudeM = parameters.atmosphereEnabled
      ? getImpactAtmosphereProfile(simulation.physicalSummary.targetBodyId)
        ?.cutoffAltitudeM ?? 0
      : 0;
    if (sample.altitudeM > atmosphereCutoffAltitudeM) {
      return 'approach';
    }
    if (
      fragmentTime !== null &&
      scenarioTimeSeconds >= fragmentTime &&
      scenarioTimeSeconds < fragmentTime + 0.75
    ) {
      return 'fragmentation';
    }
    return 'atmospheric-entry';
  }

  const afterEventSeconds = scenarioTimeSeconds - simulation.terminalEventTimeSeconds;
  const hasPersistentSurfaceAftermath =
    channels.craterFormationProgress > 0 || channels.surfaceScorchOpacity > 0;
  if (state === 'complete') {
    return hasPersistentSurfaceAftermath ? 'aftermath' : 'complete';
  }
  if (
    simulation.physicalSummary.outcomeKind !== 'solid-surface-impact' &&
    afterEventSeconds < profile.flashDurationSeconds
  ) {
    return 'airburst';
  }
  if (channels.flashIntensity > 0) return 'impact-flash';
  if (channels.ejectaOpacity > 0) return 'ejecta';
  if (channels.plumeOpacity > 0) return 'plume';
  if (channels.hazeOpacity > 0) return 'haze';
  if (
    hasPersistentSurfaceAftermath ||
    channels.cloudScarOpacity > 0
  ) return 'aftermath';
  return 'complete';
}

function createTrailPositions(
  simulation: Readonly<ImpactSimulationResult>,
  timeSeconds: number,
): readonly Readonly<Vec3d>[] {
  const eligible = simulation.samples.filter((sample) => sample.timeSeconds <= timeSeconds);
  if (eligible.length === 0) return EMPTY_POSITIONS;
  const stride = Math.max(1, Math.ceil(eligible.length / MAX_TRAIL_POSITIONS));
  const positions: Readonly<Vec3d>[] = [];
  for (let index = 0; index < eligible.length; index += stride) {
    const sample = eligible[index];
    if (sample !== undefined) positions.push(sample.positionEnuM);
  }
  const last = eligible.at(-1)?.positionEnuM;
  if (last !== undefined && positions.at(-1) !== last) positions.push(last);
  return Object.freeze(positions);
}

/**
 * Computes immutable normalization bounds once per prepared run. Airbursts can
 * end before the integrator's last stored sample, so only the playable entry
 * segment and an exact interpolated terminal sample participate.
 */
function deriveEntryNormalizationPeaks(
  simulation: Readonly<ImpactSimulationResult>,
): Readonly<{ heatingPowerW: number; dynamicPressurePa: number }> {
  let heatingPowerW = 0;
  let dynamicPressurePa = 0;
  for (const sample of simulation.samples) {
    if (sample.timeSeconds > simulation.terminalEventTimeSeconds) break;
    heatingPowerW = Math.max(heatingPowerW, sample.heatingPowerW);
    dynamicPressurePa = Math.max(dynamicPressurePa, sample.dynamicPressurePa);
  }
  const terminalSample = sampleImpactTrajectory(
    simulation,
    simulation.terminalEventTimeSeconds,
  );
  return Object.freeze({
    heatingPowerW: Math.max(heatingPowerW, terminalSample.heatingPowerW),
    dynamicPressurePa: Math.max(
      dynamicPressurePa,
      terminalSample.dynamicPressurePa,
    ),
  });
}

function normalizedByPeak(value: number, peak: number): number {
  return peak > 0 ? clamp(value / peak, 0, 1) : 0;
}

function createFragmentPositions(
  simulation: Readonly<ImpactSimulationResult>,
  sample: Readonly<ImpactTrajectorySample>,
  scenarioTimeSeconds: number,
): readonly Readonly<Vec3d>[] {
  const fragmentTime = simulation.fragmentation.eventTimeSeconds;
  if (
    fragmentTime === null ||
    scenarioTimeSeconds < fragmentTime ||
    scenarioTimeSeconds > simulation.terminalEventTimeSeconds + 2
  ) {
    return EMPTY_POSITIONS;
  }
  const separationTimeSeconds = Math.max(
    0,
    Math.min(scenarioTimeSeconds, simulation.terminalEventTimeSeconds) - fragmentTime,
  );
  return Object.freeze(
    simulation.fragmentation.separationVelocitiesEnuMps.map((velocity) =>
      Object.freeze({
        x: sample.positionEnuM.x + velocity.x * separationTimeSeconds,
        y: sample.positionEnuM.y + velocity.y * separationTimeSeconds,
        z: Math.max(0, sample.positionEnuM.z + velocity.z * separationTimeSeconds),
      }),
    ),
  );
}

function roundDurationToFixedStep(durationSeconds: number): number {
  return Math.ceil(durationSeconds / IMPACT_FIXED_STEP_SECONDS) *
    IMPACT_FIXED_STEP_SECONDS;
}

function maximumTransientDuration(
  profile: Readonly<ImpactVisualProfile>,
): number {
  return Math.max(
    profile.flashDurationSeconds,
    profile.ejectaLifetimeSeconds,
    profile.groundShockwaveLifetimeSeconds,
    profile.atmosphericShockwaveLifetimeSeconds,
    profile.plumeLifetimeSeconds,
    profile.dustLifetimeSeconds,
    profile.cloudScarLifetimeSeconds,
  );
}

function progressOverDuration(value: number, duration: number): number {
  if (duration <= 0) return value >= 0 ? 1 : 0;
  return clamp(value / duration, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
