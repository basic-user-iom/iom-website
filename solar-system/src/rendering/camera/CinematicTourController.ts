import type { CameraCloseUpPresetId } from './CameraCloseUpPresets';
import type { CameraMode } from './CameraTypes';

export const CINEMATIC_TOUR_WAYPOINT_IDS = [
  'opening-overview',
  'earth-follow',
  'jupiter-great-red-spot',
  'saturn-rings',
  'neptune-chase',
  'final-overview',
] as const;

export type CinematicTourWaypointId = (typeof CINEMATIC_TOUR_WAYPOINT_IDS)[number];
export type CinematicTourState = 'idle' | 'running' | 'paused' | 'complete' | 'cancelled';
export type CinematicTourTransitionReason =
  | 'started'
  | 'waypoint-changed'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'cancelled';

export interface CinematicTourWaypoint {
  readonly id: CinematicTourWaypointId;
  readonly label: string;
  readonly cameraMode: CameraMode;
  readonly bodyId: 'earth' | 'jupiter' | 'saturn' | 'neptune' | null;
  readonly closeUpPresetId: CameraCloseUpPresetId | null;
  /** Static hold duration after the camera has reached this waypoint. */
  readonly durationSeconds: number;
  /** Reduced-motion uses immediate camera cuts and a separate, calmer hold cadence. */
  readonly reducedMotionDurationSeconds: number;
}

export interface CinematicTourTransitionSummary {
  readonly sequence: number;
  readonly reason: CinematicTourTransitionReason;
  readonly state: CinematicTourState;
  readonly previousWaypointId: CinematicTourWaypointId | null;
  readonly waypoint: Readonly<CinematicTourWaypoint> | null;
  /** Waypoints bypassed because their target body was unavailable. */
  readonly skippedWaypointIds: readonly CinematicTourWaypointId[];
}

export interface CinematicTourControllerOptions {
  readonly reducedMotion?: boolean;
  /** Called at evaluation time so late-loading or lost targets can be skipped safely. */
  readonly isBodyAvailable?: (bodyId: NonNullable<CinematicTourWaypoint['bodyId']>) => boolean;
  /** Receives at most one immutable summary per public controller call. */
  readonly onTransition?: (summary: Readonly<CinematicTourTransitionSummary>) => void;
}

const waypoint = (
  value: CinematicTourWaypoint,
): Readonly<CinematicTourWaypoint> => Object.freeze(value);

/**
 * The fixed, restrained observatory tour. Durations use real display time;
 * simulation time remains entirely independent.
 */
export const CINEMATIC_TOUR_ROUTE: readonly Readonly<CinematicTourWaypoint>[] =
  Object.freeze([
    waypoint({
      id: 'opening-overview',
      label: 'Solar System overview',
      cameraMode: 'overview',
      bodyId: null,
      closeUpPresetId: null,
      durationSeconds: 4,
      reducedMotionDurationSeconds: 5,
    }),
    waypoint({
      id: 'earth-follow',
      label: 'Earth in sunlight',
      cameraMode: 'body-follow',
      bodyId: 'earth',
      closeUpPresetId: null,
      durationSeconds: 5,
      reducedMotionDurationSeconds: 6,
    }),
    waypoint({
      id: 'jupiter-great-red-spot',
      label: 'Jupiter Great Red Spot',
      cameraMode: 'body-follow',
      bodyId: 'jupiter',
      closeUpPresetId: 'jupiter-great-red-spot',
      durationSeconds: 6,
      reducedMotionDurationSeconds: 7,
    }),
    waypoint({
      id: 'saturn-rings',
      label: 'Saturn ring plane',
      cameraMode: 'body-follow',
      bodyId: 'saturn',
      closeUpPresetId: 'saturn-rings',
      durationSeconds: 6,
      reducedMotionDurationSeconds: 7,
    }),
    waypoint({
      id: 'neptune-chase',
      label: 'Neptune velocity chase',
      cameraMode: 'chase',
      bodyId: 'neptune',
      closeUpPresetId: null,
      durationSeconds: 5,
      reducedMotionDurationSeconds: 6,
    }),
    waypoint({
      id: 'final-overview',
      label: 'Return to overview',
      cameraMode: 'overview',
      bodyId: null,
      closeUpPresetId: null,
      durationSeconds: 4,
      reducedMotionDurationSeconds: 5,
    }),
  ]);

/**
 * Deterministic real-time route sequencer. Per-frame elapsed time and route
 * position never enter React state; consumers are notified only when the
 * public tour state or active waypoint changes.
 */
export class CinematicTourController {
  #isBodyAvailable: NonNullable<CinematicTourControllerOptions['isBodyAvailable']>;
  readonly #onTransition: CinematicTourControllerOptions['onTransition'];
  #state: CinematicTourState = 'idle';
  #waypointIndex = -1;
  #elapsedSeconds = 0;
  #reducedMotion: boolean;
  #transitionSequence = 0;

  public constructor(options: CinematicTourControllerOptions = {}) {
    this.#reducedMotion = options.reducedMotion ?? false;
    this.#isBodyAvailable = options.isBodyAvailable ?? (() => true);
    this.#onTransition = options.onTransition;
  }

  public get state(): CinematicTourState {
    return this.#state;
  }

  public get currentWaypoint(): Readonly<CinematicTourWaypoint> | null {
    return this.#waypointIndex < 0
      ? null
      : (CINEMATIC_TOUR_ROUTE[this.#waypointIndex] ?? null);
  }

  public get reducedMotion(): boolean {
    return this.#reducedMotion;
  }

  public get active(): boolean {
    return this.#state === 'running' || this.#state === 'paused';
  }

  /** Starts from the opening overview, restarting any previous run. */
  public start(): Readonly<CinematicTourTransitionSummary> {
    const previousWaypointId = this.currentWaypoint?.id ?? null;
    this.#state = 'running';
    this.#waypointIndex = 0;
    this.#elapsedSeconds = 0;
    return this.#publish('started', previousWaypointId, []);
  }

  public pause(): Readonly<CinematicTourTransitionSummary> | null {
    if (this.#state !== 'running') return null;
    const previousWaypointId = this.currentWaypoint?.id ?? null;
    this.#state = 'paused';
    return this.#publish('paused', previousWaypointId, []);
  }

  public resume(): Readonly<CinematicTourTransitionSummary> | null {
    if (this.#state !== 'paused') return null;
    const previousWaypointId = this.currentWaypoint?.id ?? null;
    this.#state = 'running';
    return this.#publish('resumed', previousWaypointId, []);
  }

  public cancel(): Readonly<CinematicTourTransitionSummary> | null {
    if (!this.active) return null;
    const previousWaypointId = this.currentWaypoint?.id ?? null;
    this.#state = 'cancelled';
    this.#waypointIndex = -1;
    this.#elapsedSeconds = 0;
    return this.#publish('cancelled', previousWaypointId, []);
  }

  /**
   * Advances with real display seconds. A large finite delta may cross the
   * complete route, but still emits no more than one aggregate notification.
   */
  public advance(
    realDeltaSeconds: number,
  ): Readonly<CinematicTourTransitionSummary> | null {
    assertValidDelta(realDeltaSeconds);
    if (this.#state !== 'running') return null;

    const previousWaypointId = this.currentWaypoint?.id ?? null;
    const skippedWaypointIds: CinematicTourWaypointId[] = [];
    let waypointChanged = this.#skipUnavailableCurrent(skippedWaypointIds);

    if (this.#waypointIndex >= CINEMATIC_TOUR_ROUTE.length) {
      this.#state = 'complete';
      this.#waypointIndex = CINEMATIC_TOUR_ROUTE.length - 1;
      this.#elapsedSeconds = 0;
      return this.#publish('completed', previousWaypointId, skippedWaypointIds);
    }

    this.#elapsedSeconds += realDeltaSeconds;
    while (this.#state === 'running') {
      const current = this.#requiredCurrentWaypoint();
      const durationSeconds = this.#durationFor(current);
      if (this.#elapsedSeconds < durationSeconds) break;

      this.#elapsedSeconds -= durationSeconds;
      let nextIndex = this.#waypointIndex + 1;
      while (nextIndex < CINEMATIC_TOUR_ROUTE.length) {
        const candidate = requiredWaypoint(nextIndex);
        if (this.#isAvailable(candidate)) break;
        skippedWaypointIds.push(candidate.id);
        nextIndex += 1;
      }

      if (nextIndex >= CINEMATIC_TOUR_ROUTE.length) {
        this.#state = 'complete';
        this.#elapsedSeconds = 0;
        break;
      }

      this.#waypointIndex = nextIndex;
      waypointChanged = true;
    }

    if (this.#state === 'complete') {
      return this.#publish('completed', previousWaypointId, skippedWaypointIds);
    }
    if (!waypointChanged) return null;
    return this.#publish('waypoint-changed', previousWaypointId, skippedWaypointIds);
  }

  /** Preserves fractional progress through the current static hold. */
  public setReducedMotion(reducedMotion: boolean): void {
    if (reducedMotion === this.#reducedMotion) return;
    const current = this.currentWaypoint;
    if (current === null) {
      this.#reducedMotion = reducedMotion;
      return;
    }
    const previousDuration = this.#durationFor(current);
    const progress = Math.min(this.#elapsedSeconds / previousDuration, 1);
    this.#reducedMotion = reducedMotion;
    this.#elapsedSeconds = progress * this.#durationFor(current);
  }

  public setBodyAvailabilityResolver(
    resolver: NonNullable<CinematicTourControllerOptions['isBodyAvailable']>,
  ): void {
    this.#isBodyAvailable = resolver;
  }

  #skipUnavailableCurrent(skippedWaypointIds: CinematicTourWaypointId[]): boolean {
    let changed = false;
    while (this.#waypointIndex < CINEMATIC_TOUR_ROUTE.length) {
      const current = requiredWaypoint(this.#waypointIndex);
      if (this.#isAvailable(current)) break;
      skippedWaypointIds.push(current.id);
      this.#waypointIndex += 1;
      this.#elapsedSeconds = 0;
      changed = true;
    }
    return changed;
  }

  #isAvailable(waypointValue: Readonly<CinematicTourWaypoint>): boolean {
    return waypointValue.bodyId === null || this.#isBodyAvailable(waypointValue.bodyId);
  }

  #durationFor(waypointValue: Readonly<CinematicTourWaypoint>): number {
    return this.#reducedMotion
      ? waypointValue.reducedMotionDurationSeconds
      : waypointValue.durationSeconds;
  }

  #requiredCurrentWaypoint(): Readonly<CinematicTourWaypoint> {
    return requiredWaypoint(this.#waypointIndex);
  }

  #publish(
    reason: CinematicTourTransitionReason,
    previousWaypointId: CinematicTourWaypointId | null,
    skippedWaypointIds: readonly CinematicTourWaypointId[],
  ): Readonly<CinematicTourTransitionSummary> {
    this.#transitionSequence += 1;
    const summary = Object.freeze({
      sequence: this.#transitionSequence,
      reason,
      state: this.#state,
      previousWaypointId,
      waypoint: this.currentWaypoint,
      skippedWaypointIds: Object.freeze([...skippedWaypointIds]),
    });
    this.#onTransition?.(summary);
    return summary;
  }
}

function requiredWaypoint(index: number): Readonly<CinematicTourWaypoint> {
  const waypointValue = CINEMATIC_TOUR_ROUTE[index];
  if (waypointValue === undefined) {
    throw new RangeError(`Cinematic tour waypoint index ${index} is out of range.`);
  }
  return waypointValue;
}

function assertValidDelta(realDeltaSeconds: number): void {
  if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
    throw new RangeError('Cinematic tour delta must be finite and non-negative.');
  }
}
