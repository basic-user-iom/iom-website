import {
  validatePhysicsFlybyParameters,
} from './BlackHoleConfiguration';
import { BlackHoleScenarioBase } from './BlackHoleScenarioBase';
import { serializeBlackHoleEncounterParameters } from './BlackHoleSerialization';
import {
  PHYSICS_FLYBY_WARNING,
  type BlackHoleEncounterParameters,
  type PhysicsFlybySnapshot,
  type PhysicsFlybyStage,
} from './BlackHoleTypes';

const ZERO_VECTOR = Object.freeze([0, 0, 0] as const);
const EMPTY_BODIES = Object.freeze([]);

export const BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT: Readonly<PhysicsFlybySnapshot> =
  Object.freeze({
    state: 'idle',
    mode: 'physics-flyby',
    classification: 'educational-approximation',
    title: 'Physics Flyby',
    warning: PHYSICS_FLYBY_WARNING,
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

/**
 * External Newtonian encounter. It deliberately makes no promise that a body
 * will be captured; survival, perturbation, capture, and ejection are outcomes.
 */
export class BlackHolePhysicsFlybyScenario extends BlackHoleScenarioBase<
  BlackHoleEncounterParameters,
  PhysicsFlybySnapshot
> {
  public readonly id = 'black-hole-physics-flyby';
  public readonly classification = 'educational-approximation' as const;
  protected readonly mode = 'physics-flyby' as const;
  protected readonly title = 'Physics Flyby';
  protected readonly warning = PHYSICS_FLYBY_WARNING;

  public constructor() {
    super(BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT);
  }

  public skipToNextStage(): void {
    const parameters = this.requiredParameters();
    const closest = Math.min(
      parameters.durationSeconds * 0.8,
      parameters.blackHole.closestApproachTimeSeconds /
        parameters.physicsSecondsPerScenarioSecond,
    );
    const targets: Readonly<Record<PhysicsFlybyStage, number>> = {
      idle: 0,
      approach: closest * 0.82,
      'closest-approach': closest * 1.2,
      aftermath: parameters.durationSeconds,
      complete: parameters.durationSeconds,
    };
    this.skipToScenarioTime(targets[this.getSnapshot().stage]);
  }

  public skipToEnd(): void {
    this.skipToScenarioTime(this.requiredParameters().durationSeconds);
  }

  protected validateParameters(
    parameters: Readonly<BlackHoleEncounterParameters>,
  ): Readonly<BlackHoleEncounterParameters> {
    return validatePhysicsFlybyParameters(parameters);
  }

  protected serializeValidatedParameters(
    parameters: Readonly<BlackHoleEncounterParameters>,
  ): string {
    return serializeBlackHoleEncounterParameters(parameters);
  }

  protected idleSnapshot(): Readonly<PhysicsFlybySnapshot> {
    return BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT;
  }

  protected stageAtTime(
    scenarioTimeSeconds: number,
    complete: boolean,
    parameters: Readonly<BlackHoleEncounterParameters>,
  ): PhysicsFlybyStage {
    if (complete) return 'complete';
    const closestApproachScenarioSeconds = Math.min(
      parameters.durationSeconds * 0.8,
      parameters.blackHole.closestApproachTimeSeconds /
        parameters.physicsSecondsPerScenarioSecond,
    );
    if (scenarioTimeSeconds < closestApproachScenarioSeconds * 0.82) return 'approach';
    if (scenarioTimeSeconds < closestApproachScenarioSeconds * 1.2) {
      return 'closest-approach';
    }
    return 'aftermath';
  }
}
