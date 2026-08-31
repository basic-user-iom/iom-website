import type { BodyRuntimeState } from '../../../simulation/bodies/BodyRuntimeState';
import { FloatingOrigin } from '../../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../../simulation/core/SimulationClock';
import { SimulationContext } from '../../../simulation/core/SimulationContext';
import { ASTRONOMICAL_UNIT_M } from '../../../simulation/core/Units';
import { createVec3d } from '../../../simulation/core/Vec3d';
import {
  DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS,
  FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT,
  FictionalSolarSupernovaScenario,
} from '../../../simulation/scenarios/solar-fate/FictionalSolarSupernovaScenario';
import { FICTIONAL_SOLAR_SUPERNOVA_WARNING } from '../../../simulation/scenarios/solar-fate/FictionalSolarSupernovaTypes';

const SUN_OFFSET_M = 10 * ASTRONOMICAL_UNIT_M;
const DISTANCE_AU = Object.freeze({
  mercury: 4,
  venus: 1,
  earth: 2,
  mars: 3,
  jupiter: 5,
  saturn: 10,
  uranus: 20,
  neptune: 30,
});

describe('FictionalSolarSupernovaScenario', () => {
  it('orders captured planet distances and compresses arrivals monotonically into 6-18 s', () => {
    const context = createContext();
    const before = contextSnapshot(context);
    const scenario = createStartedScenario(context);
    const snapshot = scenario.getSnapshot();
    expect(snapshot.radiationArrivals.map((arrival) => arrival.bodyId)).toEqual([
      'venus',
      'earth',
      'mars',
      'mercury',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);
    expect(snapshot.radiationArrivals[0]?.arrivalTimeSeconds).toBe(6);
    expect(snapshot.radiationArrivals.at(-1)?.arrivalTimeSeconds).toBe(18);
    for (let index = 1; index < snapshot.radiationArrivals.length; index += 1) {
      const previous = required(snapshot.radiationArrivals[index - 1]);
      const current = required(snapshot.radiationArrivals[index]);
      expect(current.distanceM).toBeGreaterThanOrEqual(previous.distanceM);
      expect(current.arrivalTimeSeconds).toBeGreaterThanOrEqual(
        previous.arrivalTimeSeconds,
      );
    }
    scenario.advance(18);
    expect(scenario.getSnapshot().radiationArrivals.every((arrival) => arrival.reached))
      .toBe(true);
    scenario.reset(context);
    expect(contextSnapshot(context)).toEqual(before);
  });

  it('keeps the exact warning in idle, active, paused, complete, and reset states', () => {
    const scenario = new FictionalSolarSupernovaScenario();
    const warnings: string[] = [];
    scenario.subscribe((snapshot) => warnings.push(snapshot.warning));
    scenario.start(DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS);
    scenario.pause();
    scenario.skipToStage('complete');
    scenario.reset();
    expect(warnings).toEqual(Array.from({ length: 5 }, () =>
      FICTIONAL_SOLAR_SUPERNOVA_WARNING,
    ));
    expect(scenario.getSnapshot()).toBe(FICTIONAL_SOLAR_SUPERNOVA_IDLE_SNAPSHOT);
  });

  it('is fixed-step deterministic across real-frame partitioning', () => {
    const context = createContext();
    const whole = createStartedScenario(context);
    const partitioned = createStartedScenario(context);
    whole.advance(1);
    for (let index = 0; index < 10; index += 1) partitioned.advance(0.1);
    expect(partitioned.getSnapshot()).toEqual(whole.getSnapshot());
  });

  it('supports all authored stage skips while preserving pause state', () => {
    const scenario = createStartedScenario(createContext());
    expect(scenario.getSnapshot().stage).toBe('surface-pulse');
    scenario.pause();
    scenario.skipToNextStage();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'paused',
      stage: 'core-flash',
      scenarioTimeSeconds: 2,
    });
    scenario.skipToNextStage();
    expect(scenario.getSnapshot()).toMatchObject({
      stage: 'shock-breakout',
      scenarioTimeSeconds: 4,
    });
    scenario.skipToNextStage();
    expect(scenario.getSnapshot()).toMatchObject({
      stage: 'radiation-front',
      scenarioTimeSeconds: 6,
    });
    scenario.skipToNextStage();
    expect(scenario.getSnapshot()).toMatchObject({
      stage: 'debris-nebula',
      scenarioTimeSeconds: 10,
    });
    scenario.skipToRemnant();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'paused',
      stage: 'fictional-remnant',
      scenarioTimeSeconds: 25,
    });
    scenario.resume();
    scenario.advance(100);
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'complete',
      stage: 'complete',
      scenarioTimeSeconds: 40,
      progress: 1,
    });
  });

  it('replays the same captured run and changes signatures with seed or distances', () => {
    const first = createStartedScenario(createContext());
    const second = createStartedScenario(createContext());
    expect(first.getSnapshot().runSignature).toBe(second.getSnapshot().runSignature);
    expect(first.serializeParameters()).toBe(second.serializeParameters());
    const initialSignature = first.getSnapshot().runSignature;
    first.advance(7);
    first.replay();
    expect(first.getSnapshot()).toMatchObject({
      state: 'running',
      stage: 'surface-pulse',
      scenarioTimeSeconds: 0,
      runSignature: initialSignature,
    });

    const changedSeed = new FictionalSolarSupernovaScenario();
    changedSeed.init(createContext());
    changedSeed.start({
      ...DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS,
      seed: DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS.seed + 1,
    });
    expect(changedSeed.getSnapshot().runSignature).not.toBe(initialSignature);

    const changedDistanceContext = createContext();
    const earth = required(changedDistanceContext.getBody('earth'));
    earth.positionM.x += ASTRONOMICAL_UNIT_M;
    const changedDistance = createStartedScenario(changedDistanceContext);
    expect(changedDistance.getSnapshot().runSignature).not.toBe(initialSignature);
  });

  it('keeps every timeline snapshot finite and rejects invalid lifecycle calls', () => {
    const scenario = createStartedScenario(createContext());
    for (let index = 0; index < 170; index += 1) {
      scenario.advance(0.25);
      expect(allNumbersAreFinite(scenario.getSnapshot())).toBe(true);
      expect(Object.isFrozen(scenario.getSnapshot())).toBe(true);
    }
    scenario.reset();
    expect(() => scenario.replay()).toThrow(/no prepared run/);
    expect(() => scenario.advance(-1)).toThrow(/delta/);
    scenario.start(DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS);
    expect(() => scenario.start(DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS)).toThrow(
      /Reset/,
    );
    expect(() => scenario.frameStep()).toThrow(/paused/);
    scenario.pause();
    expect(() => scenario.frameStep(0)).toThrow(/positive/);
    scenario.dispose();
    scenario.dispose();
    expect(() => scenario.start(DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS)).toThrow(
      /disposed/,
    );
  });
});

function createStartedScenario(
  context: SimulationContext,
): FictionalSolarSupernovaScenario {
  const scenario = new FictionalSolarSupernovaScenario();
  scenario.init(context);
  scenario.start(DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS);
  return scenario;
}

function createContext(): SimulationContext {
  const bodies: BodyRuntimeState[] = [bodyState('sun', SUN_OFFSET_M)];
  for (const [bodyId, distanceAu] of Object.entries(DISTANCE_AU)) {
    bodies.push(bodyState(bodyId, SUN_OFFSET_M + distanceAu * ASTRONOMICAL_UNIT_M));
  }
  return new SimulationContext({
    clock: new SimulationClock({ initialJdTdb: 2_451_545, paused: false }),
    floatingOrigin: new FloatingOrigin(),
    bodies: bodies.map((body) => [body.bodyId, body] as const),
  });
}

function bodyState(bodyId: string, x: number): BodyRuntimeState {
  return {
    bodyId,
    jdTdb: 2_451_545,
    positionM: createVec3d(x, 0, 0),
    velocityMps: createVec3d(1, 2, 3),
    orientation: [0, 0, 0, 1],
    visible: true,
  };
}

function contextSnapshot(context: SimulationContext): unknown {
  return {
    clock: context.clock.snapshot(),
    bodies: [...context.bodies.values()].map((body) => ({
      bodyId: body.bodyId,
      jdTdb: body.jdTdb,
      positionM: { ...body.positionM },
      velocityMps: { ...body.velocityMps },
      orientation: [...body.orientation],
      visible: body.visible,
    })),
  };
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Test fixture entry is missing.');
  return value;
}

function allNumbersAreFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersAreFinite);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(allNumbersAreFinite);
  }
  return true;
}
