import type { BodyRuntimeState } from '../../../simulation/bodies/BodyRuntimeState';
import { FloatingOrigin } from '../../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../../simulation/core/SimulationClock';
import { SimulationContext } from '../../../simulation/core/SimulationContext';
import { createVec3d } from '../../../simulation/core/Vec3d';
import {
  DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS,
  SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT,
  ScientificSolarEvolutionScenario,
} from '../../../simulation/scenarios/solar-fate/ScientificSolarEvolutionScenario';
import { SOLAR_FATE_FIXED_STEP_SECONDS } from '../../../simulation/scenarios/solar-fate/SolarFateTypes';

describe('ScientificSolarEvolutionScenario', () => {
  it('is fixed-step deterministic across real-frame partitioning', () => {
    const whole = createStartedScenario();
    const partitioned = createStartedScenario();
    whole.advance(1);
    for (let index = 0; index < 10; index += 1) partitioned.advance(0.1);
    expect(partitioned.getSnapshot()).toEqual(whole.getSnapshot());
  });

  it('supports pause, frame-step, phase skips, completion, replay, and reset', () => {
    const scenario = createStartedScenario();
    expect(scenario.getSnapshot()).toMatchObject({
      classification: 'educational-approximation',
      title: 'Scientific Solar Evolution',
      stage: 'present',
      scenarioTimeSeconds: 0,
    });
    scenario.pause();
    scenario.advance(10);
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBe(0);
    scenario.frameStep();
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBe(
      SOLAR_FATE_FIXED_STEP_SECONDS,
    );
    scenario.skipToNextPhase();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'paused',
      stage: 'red-giant',
      scenarioTimeSeconds: 4,
    });
    scenario.skipToPhase('white-dwarf');
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'paused',
      stage: 'white-dwarf',
      scenarioTimeSeconds: 28,
      compactRemnantSizeExaggerationRequired: true,
    });
    expect(scenario.getSnapshot().nebulaDisplayRadiusM).toBeGreaterThan(0);
    expect(scenario.getSnapshot().heatingByBody.mercury).toBeGreaterThan(
      scenario.getSnapshot().heatingByBody.earth,
    );
    expect(scenario.getSnapshot().engulfmentByBody.earth).toBe(0);
    scenario.resume();
    scenario.skipToEnd();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'complete',
      stage: 'complete',
      scenarioTimeSeconds: 42,
      progress: 1,
    });
    const signature = scenario.getSnapshot().runSignature;
    scenario.replay();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'running',
      stage: 'present',
      scenarioTimeSeconds: 0,
      runSignature: signature,
    });
    scenario.reset();
    expect(scenario.getSnapshot()).toBe(SCIENTIFIC_SOLAR_EVOLUTION_IDLE_SNAPSHOT);
    scenario.reset();
  });

  it('keeps serialized runs stable, changes the signature with seed, and stays finite', () => {
    const first = createStartedScenario();
    const second = createStartedScenario();
    const changed = new ScientificSolarEvolutionScenario();
    changed.start({
      ...DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS,
      seed: DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS.seed + 1,
    });
    expect(first.serializeParameters()).toBe(second.serializeParameters());
    expect(first.getSnapshot().runSignature).toBe(second.getSnapshot().runSignature);
    expect(changed.getSnapshot().runSignature).not.toBe(first.getSnapshot().runSignature);
    for (let index = 0; index < 50; index += 1) {
      first.advance(0.23);
      expect(allNumbersAreFinite(first.getSnapshot())).toBe(true);
      expect(Object.isFrozen(first.getSnapshot())).toBe(true);
    }
  });

  it('does not mutate observatory body or clock state', () => {
    const context = createContext();
    const before = contextSnapshot(context);
    const scenario = new ScientificSolarEvolutionScenario();
    scenario.init(context);
    scenario.start(DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS);
    scenario.advance(11);
    scenario.skipToPhase('mass-loss-nebular');
    scenario.reset(context);
    expect(contextSnapshot(context)).toEqual(before);
  });

  it('publishes immutable states, rejects invalid lifecycle calls, and disposes safely', () => {
    const scenario = new ScientificSolarEvolutionScenario();
    const states: string[] = [];
    scenario.subscribe((snapshot) => states.push(snapshot.state));
    expect(() => scenario.replay()).toThrow(/no prepared run/);
    expect(() => scenario.advance(-1)).toThrow(/delta/);
    scenario.start(DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS);
    expect(() => scenario.start(DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS)).toThrow(
      /Reset/,
    );
    expect(() => scenario.frameStep()).toThrow(/paused/);
    scenario.pause();
    expect(() => scenario.frameStep(0)).toThrow(/positive/);
    scenario.reset();
    expect(states).toEqual(['idle', 'running', 'paused', 'idle']);
    scenario.dispose();
    scenario.dispose();
    expect(() => scenario.start(DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS)).toThrow(
      /disposed/,
    );
  });
});

function createStartedScenario(): ScientificSolarEvolutionScenario {
  const scenario = new ScientificSolarEvolutionScenario();
  scenario.init(createContext());
  scenario.start(DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS);
  return scenario;
}

function createContext(): SimulationContext {
  const bodies = [bodyState('sun', 0), bodyState('earth', 149_597_870_700)];
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
    positionM: createVec3d(x, 2, 3),
    velocityMps: createVec3d(4, 5, 6),
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

function allNumbersAreFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersAreFinite);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(allNumbersAreFinite);
  }
  return true;
}
