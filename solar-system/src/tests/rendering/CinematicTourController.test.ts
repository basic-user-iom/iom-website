import {
  CINEMATIC_TOUR_ROUTE,
  CINEMATIC_TOUR_WAYPOINT_IDS,
  CinematicTourController,
  type CinematicTourTransitionSummary,
} from '../../rendering/camera/CinematicTourController';

describe('CinematicTourController', () => {
  it('publishes the fixed observatory route in the required order', () => {
    expect(CINEMATIC_TOUR_ROUTE.map(({ id }) => id)).toEqual(
      CINEMATIC_TOUR_WAYPOINT_IDS,
    );
    expect(CINEMATIC_TOUR_ROUTE.map(({ cameraMode }) => cameraMode)).toEqual([
      'overview',
      'body-follow',
      'body-follow',
      'body-follow',
      'chase',
      'overview',
    ]);
    expect(CINEMATIC_TOUR_ROUTE.map(({ bodyId }) => bodyId)).toEqual([
      null,
      'earth',
      'jupiter',
      'saturn',
      'neptune',
      null,
    ]);
    expect(CINEMATIC_TOUR_ROUTE[2]?.closeUpPresetId).toBe('jupiter-great-red-spot');
    expect(CINEMATIC_TOUR_ROUTE[3]?.closeUpPresetId).toBe('saturn-rings');
    expect(Object.isFrozen(CINEMATIC_TOUR_ROUTE)).toBe(true);
    expect(CINEMATIC_TOUR_ROUTE.every(Object.isFrozen)).toBe(true);
  });

  it('starts, pauses, resumes, and cancels without per-frame notifications', () => {
    const notifications: CinematicTourTransitionSummary[] = [];
    const controller = new CinematicTourController({
      onTransition: (summary) => notifications.push(summary),
    });

    expect(controller.state).toBe('idle');
    expect(controller.currentWaypoint).toBeNull();
    expect(controller.pause()).toBeNull();
    expect(controller.resume()).toBeNull();
    expect(controller.cancel()).toBeNull();

    const started = controller.start();
    expect(started).toMatchObject({
      sequence: 1,
      reason: 'started',
      state: 'running',
      previousWaypointId: null,
    });
    expect(started.waypoint?.id).toBe('opening-overview');
    expect(controller.active).toBe(true);

    expect(controller.advance(CINEMATIC_TOUR_ROUTE[0]!.durationSeconds / 2)).toBeNull();
    expect(notifications).toHaveLength(1);

    expect(controller.pause()).toMatchObject({ reason: 'paused', state: 'paused' });
    expect(controller.advance(100)).toBeNull();
    expect(controller.currentWaypoint?.id).toBe('opening-overview');
    expect(controller.resume()).toMatchObject({ reason: 'resumed', state: 'running' });
    expect(controller.cancel()).toMatchObject({ reason: 'cancelled', state: 'cancelled' });
    expect(controller.active).toBe(false);
    expect(controller.currentWaypoint).toBeNull();
    expect(notifications.map(({ reason }) => reason)).toEqual([
      'started',
      'paused',
      'resumed',
      'cancelled',
    ]);
  });

  it('advances deterministically through every waypoint and completes after the final hold', () => {
    const controller = new CinematicTourController();
    controller.start();

    for (let index = 0; index < CINEMATIC_TOUR_ROUTE.length - 1; index += 1) {
      const current = CINEMATIC_TOUR_ROUTE[index]!;
      const transition = controller.advance(current.durationSeconds);
      expect(transition?.reason).toBe('waypoint-changed');
      expect(transition?.previousWaypointId).toBe(current.id);
      expect(transition?.waypoint?.id).toBe(CINEMATIC_TOUR_ROUTE[index + 1]?.id);
      expect(transition?.skippedWaypointIds).toEqual([]);
    }

    const finalWaypoint = CINEMATIC_TOUR_ROUTE.at(-1)!;
    const completed = controller.advance(finalWaypoint.durationSeconds);
    expect(completed).toMatchObject({
      reason: 'completed',
      state: 'complete',
      previousWaypointId: 'final-overview',
    });
    expect(completed?.waypoint?.id).toBe('final-overview');
    expect(controller.active).toBe(false);
    expect(controller.advance(1)).toBeNull();
  });

  it('skips unavailable targets and aggregates their IDs in one transition', () => {
    const unavailable = new Set(['jupiter', 'saturn']);
    const controller = new CinematicTourController({
      isBodyAvailable: (bodyId) => !unavailable.has(bodyId),
    });
    controller.start();

    controller.advance(CINEMATIC_TOUR_ROUTE[0]!.durationSeconds);
    expect(controller.currentWaypoint?.id).toBe('earth-follow');

    const transition = controller.advance(CINEMATIC_TOUR_ROUTE[1]!.durationSeconds);
    expect(transition).toMatchObject({
      reason: 'waypoint-changed',
      previousWaypointId: 'earth-follow',
    });
    expect(transition?.waypoint?.id).toBe('neptune-chase');
    expect(transition?.skippedWaypointIds).toEqual([
      'jupiter-great-red-spot',
      'saturn-rings',
    ]);

    unavailable.add('neptune');
    const dynamicSkip = controller.advance(0);
    expect(dynamicSkip?.waypoint?.id).toBe('final-overview');
    expect(dynamicSkip?.skippedWaypointIds).toEqual(['neptune-chase']);
  });

  it('uses reduced-motion holds and preserves fractional progress when the setting changes', () => {
    const opening = CINEMATIC_TOUR_ROUTE[0]!;
    expect(opening.reducedMotionDurationSeconds).toBeGreaterThan(opening.durationSeconds);

    const reducedController = new CinematicTourController({ reducedMotion: true });
    reducedController.start();
    expect(
      reducedController.advance(opening.reducedMotionDurationSeconds - 0.001),
    ).toBeNull();
    expect(reducedController.advance(0.001)?.waypoint?.id).toBe('earth-follow');

    const switchedController = new CinematicTourController();
    switchedController.start();
    switchedController.advance(opening.durationSeconds / 2);
    switchedController.setReducedMotion(true);
    expect(switchedController.reducedMotion).toBe(true);
    expect(
      switchedController.advance(opening.reducedMotionDurationSeconds / 2 - 0.001),
    ).toBeNull();
    expect(switchedController.advance(0.001)?.waypoint?.id).toBe('earth-follow');
  });

  it('rejects invalid deltas and bounds a catch-up update to one notification', () => {
    const notifications: CinematicTourTransitionSummary[] = [];
    const controller = new CinematicTourController({
      onTransition: (summary) => notifications.push(summary),
    });
    controller.start();

    for (const invalidDelta of [Number.NaN, Number.POSITIVE_INFINITY, -0.001]) {
      expect(() => controller.advance(invalidDelta)).toThrow(
        /finite and non-negative/,
      );
    }
    expect(controller.advance(0)).toBeNull();
    expect(notifications).toHaveLength(1);

    const entireRouteDuration = CINEMATIC_TOUR_ROUTE.reduce(
      (total, routeWaypoint) => total + routeWaypoint.durationSeconds,
      0,
    );
    const completed = controller.advance(entireRouteDuration + 1_000);
    expect(completed?.reason).toBe('completed');
    expect(completed?.waypoint?.id).toBe('final-overview');
    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toBe(completed);
  });

  it('can restart a completed or cancelled tour with a monotonic transition sequence', () => {
    const controller = new CinematicTourController();
    expect(controller.start().sequence).toBe(1);
    expect(controller.cancel()?.sequence).toBe(2);
    expect(controller.start()).toMatchObject({
      sequence: 3,
      reason: 'started',
      previousWaypointId: null,
    });
  });
});
