import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';
import { EventBus } from '../../simulation/core/EventBus';
import { FloatingOrigin } from '../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import {
  SimulationContext,
  type SimulationEvents,
} from '../../simulation/core/SimulationContext';
import { createVec3d, type Vec3d } from '../../simulation/core/Vec3d';
import {
  DEBUG_BODY_DEFINITIONS,
  createDebugBodyRuntimeStates,
  getDebugBodyDefinition,
} from '../../simulation/bodies/DebugBodyCatalog';

function components(value: Readonly<Vec3d>): readonly number[] {
  return [value.x, value.y, value.z];
}

describe('FloatingOrigin', () => {
  it('does not rebase at the threshold and rebases immediately beyond it', () => {
    const origin = new FloatingOrigin(100);
    const shift = createVec3d(9, 9, 9);

    expect(origin.rebaseIfNeeded(createVec3d(100, 0, 0), shift)).toBe(false);
    expect(origin.revision).toBe(0);
    expect(components(shift)).toEqual([9, 9, 9]);

    expect(origin.rebaseIfNeeded(createVec3d(100.001, 0, 0), shift)).toBe(true);
    expect(origin.revision).toBe(1);
    expect(components(shift)).toEqual([-100.001, 0, 0]);
    expect(components(origin.getOrigin(createVec3d()))).toEqual([100.001, 0, 0]);
  });

  it('reports old-origin minus new-origin and ignores an identical target', () => {
    const origin = new FloatingOrigin();
    const shift = createVec3d();
    origin.rebaseTo(createVec3d(10, -20, 30), shift);
    expect(components(shift)).toEqual([-10, 20, -30]);

    expect(origin.rebaseTo(createVec3d(40, 5, -10), shift)).toBe(true);
    expect(components(shift)).toEqual([-30, -25, 40]);
    expect(origin.revision).toBe(2);

    expect(origin.rebaseTo(createVec3d(40, 5, -10), shift)).toBe(false);
    expect(origin.revision).toBe(2);
  });

  it('preserves physical positions when local coordinates receive the rebase shift', () => {
    const origin = new FloatingOrigin();
    const physical = createVec3d(1_000, -400, 50);
    const localBefore = origin.physicalToLocalMeters(createVec3d(), physical);
    const shift = createVec3d();
    origin.rebaseTo(createVec3d(900, -500, 25), shift);
    const shiftedExistingLocal = createVec3d(
      localBefore.x + shift.x,
      localBefore.y + shift.y,
      localBefore.z + shift.z,
    );
    const localAfter = origin.physicalToLocalMeters(createVec3d(), physical);

    expect(components(shiftedExistingLocal)).toEqual(components(localAfter));
    expect(components(localAfter)).toEqual([100, 100, 25]);
    expect(
      components(origin.localToPhysicalMeters(createVec3d(), localAfter)),
    ).toEqual(components(physical));
  });

  it('writes through caller-owned outputs and returns detached frozen snapshots', () => {
    const origin = new FloatingOrigin();
    const output = createVec3d();
    origin.rebaseTo(createVec3d(1, 2, 3), createVec3d());

    expect(origin.getOrigin(output)).toBe(output);
    expect(origin.physicalToLocalMeters(output, createVec3d(4, 6, 8))).toBe(output);
    expect(components(output)).toEqual([3, 4, 5]);
    expect(origin.localToPhysicalMeters(output, createVec3d(3, 4, 5))).toBe(output);
    expect(components(output)).toEqual([4, 6, 8]);

    const snapshot = origin.snapshot();
    expect(snapshot).toEqual({ originM: { x: 1, y: 2, z: 3 }, revision: 1 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.originM)).toBe(true);
    origin.rebaseTo(createVec3d(9, 9, 9), createVec3d());
    expect(snapshot.originM).toEqual({ x: 1, y: 2, z: 3 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid threshold %s',
    (threshold) => {
      expect(() => new FloatingOrigin(threshold)).toThrow(RangeError);
    },
  );
});

describe('Phase 1 fixed body fixture', () => {
  it('creates only fixed Sun and Earth states in SI units', () => {
    const jdTdb = 2_451_545;
    const bodies = createDebugBodyRuntimeStates(jdTdb);
    const sun = bodies.get('sun');
    const earth = bodies.get('earth');

    expect([...bodies.keys()]).toEqual(['sun', 'earth']);
    expect(sun).toMatchObject({ bodyId: 'sun', jdTdb, visible: true });
    expect(earth).toMatchObject({ bodyId: 'earth', jdTdb, visible: true });
    expect(components(sun?.positionM ?? createVec3d())).toEqual([0, 0, 0]);
    expect(components(earth?.positionM ?? createVec3d())).toEqual([
      ASTRONOMICAL_UNIT_M,
      0,
      0,
    ]);
    expect(components(sun?.velocityMps ?? createVec3d())).toEqual([0, 0, 0]);
    expect(components(earth?.velocityMps ?? createVec3d())).toEqual([0, 0, 0]);
    expect(sun?.orientation).toEqual([0, 0, 0, 1]);
    expect(earth?.orientation).toEqual([0, 0, 0, 1]);
  });

  it('labels definitions and provenance as a generated, non-ephemeris fixture', () => {
    expect(DEBUG_BODY_DEFINITIONS.map((definition) => definition.id)).toEqual(['sun', 'earth']);
    expect(Object.isFrozen(DEBUG_BODY_DEFINITIONS)).toBe(true);
    expect(getDebugBodyDefinition('sun')?.kind).toBe('star');
    expect(getDebugBodyDefinition('earth')?.parentId).toBe('sun');
    expect(getDebugBodyDefinition('missing')).toBeUndefined();

    for (const definition of DEBUG_BODY_DEFINITIONS) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(definition.provenance[0]).toMatchObject({
        provider: 'GENERATED',
        centerId: 'debug-sun-origin',
        referenceFrame: 'arbitrary Phase 1 Cartesian debug frame',
      });
      expect(definition.provenance[0]?.notes).toContain('Not an ephemeris or observation.');
    }
  });

  it('rejects a non-finite fixture date', () => {
    expect(() => createDebugBodyRuntimeStates(Number.NaN)).toThrow(RangeError);
    expect(() => createDebugBodyRuntimeStates(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('SimulationContext', () => {
  it('uses injected dependencies and synchronizes every fixed body time', () => {
    const clock = new SimulationClock({ initialJdTdb: 100 });
    const floatingOrigin = new FloatingOrigin();
    const events = new EventBus<SimulationEvents>();
    const bodies = createDebugBodyRuntimeStates(1);
    const context = new SimulationContext({ clock, floatingOrigin, bodies, events });

    expect(context.clock).toBe(clock);
    expect(context.floatingOrigin).toBe(floatingOrigin);
    expect(context.events).toBe(events);
    expect(context.getBody('sun')).toBe(bodies.get('sun'));
    expect(context.getBody('missing')).toBeUndefined();

    clock.setCurrentJdTdb(200);
    context.synchronizeBodyTimes();
    expect([...context.bodies.values()].map((body) => body.jdTdb)).toEqual([200, 200]);
  });

  it('emits visibility changes only when a known body actually changes', () => {
    const context = new SimulationContext({
      clock: new SimulationClock(),
      floatingOrigin: new FloatingOrigin(),
      bodies: createDebugBodyRuntimeStates(2_451_545),
    });
    const changes: Array<{ bodyId: string; visible: boolean }> = [];
    context.events.on('bodyVisibilityChanged', (change) => changes.push({ ...change }));

    expect(context.setBodyVisible('earth', false)).toBe(true);
    expect(context.getBody('earth')?.visible).toBe(false);
    expect(context.setBodyVisible('earth', false)).toBe(false);
    expect(context.setBodyVisible('missing', false)).toBe(false);
    expect(context.setBodyVisible('earth', true)).toBe(true);

    expect(changes).toEqual([
      { bodyId: 'earth', visible: false },
      { bodyId: 'earth', visible: true },
    ]);
  });
});
