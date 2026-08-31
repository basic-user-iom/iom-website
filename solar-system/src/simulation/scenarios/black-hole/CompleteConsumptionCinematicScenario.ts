import {
  SOLAR_MASS_KG,
  validateCompleteConsumptionParameters,
} from './BlackHoleConfiguration';
import {
  BlackHoleScenarioBase,
  clamp01,
} from './BlackHoleScenarioBase';
import { schwarzschildRadiusM, type BlackHoleKernelAdvanceResult } from './BlackHolePhysicsKernel';
import { serializeBlackHoleEncounterParameters } from './BlackHoleSerialization';
import {
  COMPLETE_CONSUMPTION_WARNING,
  type BlackHoleBodyOutcome,
  type BlackHoleBodySnapshot,
  type BlackHoleRenderState,
  type CompleteConsumptionParameters,
  type CompleteConsumptionSnapshot,
  type CompleteConsumptionStage,
} from './BlackHoleTypes';

const ZERO_VECTOR = Object.freeze([0, 0, 0] as const);
const EMPTY_BODIES = Object.freeze([]);

export const COMPLETE_CONSUMPTION_IDLE_SNAPSHOT: Readonly<CompleteConsumptionSnapshot> =
  Object.freeze({
    state: 'idle',
    mode: 'complete-consumption-cinematic',
    classification: 'cinematic',
    title: 'Complete Consumption — Cinematic',
    warning: COMPLETE_CONSUMPTION_WARNING,
    stage: 'idle',
    scenarioTimeSeconds: 0,
    totalDurationSeconds: 0,
    progress: 0,
    playbackRate: 1,
    parameters: null,
    bodyStates: EMPTY_BODIES,
    blackHole: null,
    diagnostics: null,
    scenarioOriginM: ZERO_VECTOR,
    scenarioOriginVelocityMps: ZERO_VECTOR,
    runSignature: null,
    captureCount: 0,
    ejectionCount: 0,
    survivorCount: 0,
    allBodiesCaptured: false,
  });

/** Guaranteed narrative; the isolated artificial force and staging are cinematic only. */
export class CompleteConsumptionCinematicScenario extends BlackHoleScenarioBase<
  CompleteConsumptionParameters,
  CompleteConsumptionSnapshot
> {
  public readonly id = 'black-hole-complete-consumption';
  public readonly classification = 'cinematic' as const;
  protected readonly mode = 'complete-consumption-cinematic' as const;
  protected readonly title = 'Complete Consumption — Cinematic';
  protected readonly warning = COMPLETE_CONSUMPTION_WARNING;

  public constructor() {
    super(COMPLETE_CONSUMPTION_IDLE_SNAPSHOT);
  }

  public skipToNextStage(): void {
    const parameters = this.requiredParameters();
    const { stagingStartSeconds, stagingIntervalSeconds } = parameters.infall;
    const finalCaptureSeconds = stagingStartSeconds +
      (parameters.initialState.bodyIds.length - 1) * stagingIntervalSeconds +
      stagingIntervalSeconds * 0.8;
    const targets: Readonly<Record<CompleteConsumptionStage, number>> = {
      idle: 0,
      approach: stagingStartSeconds,
      disruption: stagingStartSeconds + stagingIntervalSeconds * 2,
      accretion: stagingStartSeconds + stagingIntervalSeconds * 4.5,
      consumption: finalCaptureSeconds,
      remnant: parameters.durationSeconds,
      complete: parameters.durationSeconds,
    };
    this.skipToScenarioTime(targets[this.getSnapshot().stage]);
  }

  public skipToEnd(): void {
    this.skipToScenarioTime(this.requiredParameters().durationSeconds);
  }

  protected validateParameters(
    parameters: Readonly<CompleteConsumptionParameters>,
  ): Readonly<CompleteConsumptionParameters> {
    return validateCompleteConsumptionParameters(parameters);
  }

  protected serializeValidatedParameters(
    parameters: Readonly<CompleteConsumptionParameters>,
  ): string {
    return serializeBlackHoleEncounterParameters(parameters);
  }

  protected idleSnapshot(): Readonly<CompleteConsumptionSnapshot> {
    return COMPLETE_CONSUMPTION_IDLE_SNAPSHOT;
  }

  protected stageAtTime(
    scenarioTimeSeconds: number,
    complete: boolean,
    parameters: Readonly<CompleteConsumptionParameters>,
  ): CompleteConsumptionStage {
    if (complete) return 'complete';
    const { stagingStartSeconds, stagingIntervalSeconds } = parameters.infall;
    const bodyCount = parameters.initialState.bodyIds.length;
    const finalCaptureSeconds = stagingStartSeconds +
      (bodyCount - 1) * stagingIntervalSeconds + stagingIntervalSeconds * 0.8;
    if (scenarioTimeSeconds < stagingStartSeconds) return 'approach';
    if (scenarioTimeSeconds < stagingStartSeconds + stagingIntervalSeconds * 2) {
      return 'disruption';
    }
    if (scenarioTimeSeconds < stagingStartSeconds + stagingIntervalSeconds * 4.5) {
      return 'accretion';
    }
    if (scenarioTimeSeconds < finalCaptureSeconds) return 'consumption';
    return 'remnant';
  }

  protected override createBodySnapshots(
    result: BlackHoleKernelAdvanceResult,
    parameters: Readonly<CompleteConsumptionParameters>,
    scenarioTimeSeconds: number,
  ): readonly Readonly<BlackHoleBodySnapshot>[] {
    const physical = super.createBodySnapshots(result, parameters, scenarioTimeSeconds);
    const order = stagedBodyOrder(parameters.initialState.bodyIds);
    const rankById = new Map(order.map((bodyId, rank) => [bodyId, rank] as const));
    const blackHoleOffset = result.state.blackHoleIndex * 3;
    const blackHolePosition = [
      result.state.positionsM[blackHoleOffset] ?? 0,
      result.state.positionsM[blackHoleOffset + 1] ?? 0,
      result.state.positionsM[blackHoleOffset + 2] ?? 0,
    ] as const;
    const blackHoleVelocity = [
      result.state.velocitiesMps[blackHoleOffset] ?? 0,
      result.state.velocitiesMps[blackHoleOffset + 1] ?? 0,
      result.state.velocitiesMps[blackHoleOffset + 2] ?? 0,
    ] as const;
    return Object.freeze(physical.map((body) => {
      const rank = rankById.get(body.bodyId) ?? 0;
      const startSeconds = parameters.infall.stagingStartSeconds +
        rank * parameters.infall.stagingIntervalSeconds;
      const progress = clamp01(
        (scenarioTimeSeconds - startSeconds) /
          parameters.infall.stagingIntervalSeconds,
      );
      const outcome = cinematicOutcome(progress);
      const captured = outcome === 'captured';
      return Object.freeze({
        ...body,
        positionLocalM: captured ? blackHolePosition : body.positionLocalM,
        velocityLocalMps: captured ? blackHoleVelocity : body.velocityLocalMps,
        outcome,
        tidalStress: Math.max(body.tidalStress, clamp01(progress / 0.5)),
        streamProgress: clamp01((progress - 0.48) / 0.32),
        captureProgress: progress,
      });
    }));
  }

  protected override createBlackHoleRenderState(
    result: BlackHoleKernelAdvanceResult,
    parameters: Readonly<CompleteConsumptionParameters>,
    bodyStates: readonly Readonly<BlackHoleBodySnapshot>[],
  ): Readonly<BlackHoleRenderState> {
    const state = result.state;
    const offset = state.blackHoleIndex * 3;
    let massKg = parameters.blackHole.massSolarMasses * SOLAR_MASS_KG;
    for (const body of bodyStates) {
      if (body.outcome === 'captured') massKg += body.massKg;
    }
    const radiusM = schwarzschildRadiusM(massKg);
    return Object.freeze({
      massKg,
      massSolarMasses: massKg / SOLAR_MASS_KG,
      schwarzschildRadiusM: radiusM,
      captureRadiusM: radiusM * parameters.blackHole.captureRadiusMultiple,
      positionLocalM: [
        state.positionsM[offset] ?? 0,
        state.positionsM[offset + 1] ?? 0,
        state.positionsM[offset + 2] ?? 0,
      ] as const,
      velocityLocalMps: [
        state.velocitiesMps[offset] ?? 0,
        state.velocitiesMps[offset + 1] ?? 0,
        state.velocitiesMps[offset + 2] ?? 0,
      ] as const,
      spinVisualization: parameters.blackHole.spinVisualization,
      accretionDiskEnabled: parameters.blackHole.accretionDiskEnabled,
    });
  }
}

function stagedBodyOrder(bodyIds: readonly string[]): readonly string[] {
  return Object.freeze([
    ...bodyIds.filter((bodyId) => bodyId !== 'sun'),
    ...bodyIds.filter((bodyId) => bodyId === 'sun'),
  ]);
}

function cinematicOutcome(progress: number): BlackHoleBodyOutcome {
  if (progress >= 0.8) return 'captured';
  if (progress >= 0.5) return 'accretion-stream';
  if (progress >= 0.28) return 'disrupted';
  if (progress > 0) return 'tidally-stressed';
  return 'intact';
}
