import { FloatingOrigin } from '../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import { SimulationContext } from '../../simulation/core/SimulationContext';
import { AsteroidImpactScenario } from '../../simulation/scenarios/impact/AsteroidImpactScenario';
import {
  DEFAULT_IMPACT_PARAMETERS,
  IMPACT_FIXED_STEP_SECONDS,
} from '../../simulation/scenarios/impact/ImpactConfiguration';
import { simulateImpactEntry } from '../../simulation/scenarios/impact/ImpactPhysics';

function createContext(): SimulationContext {
  return new SimulationContext({
    clock: new SimulationClock(),
    floatingOrigin: new FloatingOrigin(),
  });
}

function createStartedScenario(): AsteroidImpactScenario {
  const scenario = new AsteroidImpactScenario();
  scenario.init(createContext());
  scenario.start(DEFAULT_IMPACT_PARAMETERS);
  return scenario;
}

describe('AsteroidImpactScenario deterministic playback', () => {
  it('keeps every surface-event channel dormant before the terminal event', () => {
    const snapshot = createStartedScenario().getSnapshot();

    expect(snapshot.eventElapsedSeconds).toBeNull();
    expect(snapshot.flashIntensity).toBe(0);
    expect(snapshot.craterFormationProgress).toBe(0);
    expect(snapshot.surfaceScorchOpacity).toBe(0);
    expect(snapshot.ejectaOpacity).toBe(0);
    expect(snapshot.ejectaHeightM).toBe(0);
    expect(snapshot.groundShockwaveOpacity).toBe(0);
    expect(snapshot.atmosphericShockwaveOpacity).toBe(0);
    expect(snapshot.plumeOpacity).toBe(0);
    expect(snapshot.hazeOpacity).toBe(0);
    expect(snapshot.cloudScarOpacity).toBe(0);
  });

  it('is invariant to real-frame partitioning at the fixed-step boundary', () => {
    const whole = createStartedScenario();
    const partitioned = createStartedScenario();

    whole.advance(1);
    for (let index = 0; index < 10; index += 1) partitioned.advance(0.1);

    expect(partitioned.getSnapshot()).toEqual(whole.getSnapshot());
  });

  it('replays identical parameters, signature, and initial state', () => {
    const scenario = createStartedScenario();
    const initial = scenario.getSnapshot();
    scenario.advance(5);
    const advanced = scenario.getSnapshot();
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBeGreaterThan(0);

    scenario.replay();
    const replayed = scenario.getSnapshot();
    expect(replayed.scenarioTimeSeconds).toBe(0);
    expect(replayed.runSignature).toBe(initial.runSignature);
    expect(replayed.impactorPosition).toEqual(initial.impactorPosition);
    expect(replayed.impactorVelocity).toEqual(initial.impactorVelocity);
    expect(replayed.normalizedHeating).toBe(initial.normalizedHeating);
    expect(replayed.normalizedDynamicPressure).toBe(
      initial.normalizedDynamicPressure,
    );
    expect(replayed.remainingMassFraction).toBe(initial.remainingMassFraction);
    scenario.advance(5);
    expect(scenario.getSnapshot()).toEqual(advanced);
    expect(scenario.serializeParameters()).not.toBeNull();
  });

  it('publishes bounded atmospheric entry telemetry and zero vacuum telemetry', () => {
    const atmospheric = createStartedScenario();
    atmospheric.advance(5);
    const atmosphericSnapshot = atmospheric.getSnapshot();
    expect(atmosphericSnapshot.impactorVelocity).not.toBeNull();
    expect(atmosphericSnapshot.normalizedHeating).toBeGreaterThan(0);
    expect(atmosphericSnapshot.normalizedHeating).toBeLessThanOrEqual(1);
    expect(atmosphericSnapshot.normalizedDynamicPressure).toBeGreaterThan(0);
    expect(atmosphericSnapshot.normalizedDynamicPressure).toBeLessThanOrEqual(1);
    expect(atmosphericSnapshot.remainingMassFraction).toBeGreaterThanOrEqual(0);
    expect(atmosphericSnapshot.remainingMassFraction).toBeLessThan(1);

    const vacuum = new AsteroidImpactScenario();
    vacuum.start({ ...DEFAULT_IMPACT_PARAMETERS, atmosphereEnabled: false });
    vacuum.advance(5);
    expect(vacuum.getSnapshot()).toEqual(expect.objectContaining({
      normalizedHeating: 0,
      normalizedDynamicPressure: 0,
      remainingMassFraction: 1,
    }));

    const airless = new AsteroidImpactScenario();
    airless.start({
      ...DEFAULT_IMPACT_PARAMETERS,
      targetBodyId: 'moon',
      atmosphereEnabled: true,
    });
    airless.advance(5);
    expect(airless.getSnapshot()).toEqual(expect.objectContaining({
      normalizedHeating: 0,
      normalizedDynamicPressure: 0,
      remainingMassFraction: 1,
    }));
  });
});

describe('AsteroidImpactScenario lifecycle', () => {
  it('publishes target-relative curved waves and persistent Earth aftermath', () => {
    const simulation = simulateImpactEntry(DEFAULT_IMPACT_PARAMETERS);
    const scenario = createStartedScenario();
    scenario.advance(simulation.terminalEventTimeSeconds + 1);
    const event = scenario.getSnapshot();

    expect(event.physicalSummary?.outcomeKind).toBe('solid-surface-impact');
    expect(event.eventElapsedSeconds).not.toBeNull();
    expect(event.flashIntensity).toBeGreaterThan(0);
    expect(event.craterFormationProgress).toBeGreaterThan(0);
    expect(event.surfaceScorchOpacity).toBeGreaterThan(0);
    expect(event.ejectaHeightM).toBeGreaterThan(0);
    expect(event.groundShockwaveOpacity).toBeGreaterThan(0);
    expect(event.atmosphericShockwaveOpacity).toBeGreaterThan(0);
    const elapsed = event.eventElapsedSeconds ?? 0;
    const speed = event.visualProfile?.groundShockwaveSpeedMps ?? 0;
    const radius = event.physicalSummary?.targetRadiusM ?? 1;
    expect(event.groundShockwaveAngularRadiusRad).toBeCloseTo(
      speed * elapsed / radius,
      12,
    );

    scenario.advance(event.totalDurationSeconds * 2);
    const complete = scenario.getSnapshot();
    expect(complete.state).toBe('complete');
    expect(complete.stage).toBe('aftermath');
    expect(complete.craterFormationProgress).toBe(1);
    expect(complete.surfaceScorchOpacity).toBe(1);
    expect(complete.flashIntensity).toBe(0);
    expect(complete.ejectaOpacity).toBe(0);
    expect(complete.ejectaHeightM).toBe(0);
    expect(complete.shockwaveRadiusM).toBe(0);
    expect(complete.plumeHeightM).toBe(0);
    expect(complete.plumeOpacity).toBe(0);
    expect(complete.hazeOpacity).toBe(0);
  });

  it('uses ground-only aftermath and a longer ballistic envelope on the Moon', () => {
    const moonParameters = {
      ...DEFAULT_IMPACT_PARAMETERS,
      targetBodyId: 'moon' as const,
      atmosphereEnabled: true,
      fragmentationEnabled: false,
    };
    const moonSimulation = simulateImpactEntry(moonParameters);
    const moon = new AsteroidImpactScenario();
    moon.start(moonParameters);
    moon.advance(moonSimulation.terminalEventTimeSeconds + 1);
    const snapshot = moon.getSnapshot();

    expect(snapshot.physicalSummary?.outcomeKind).toBe('solid-surface-impact');
    expect(snapshot.craterFormationProgress).toBeGreaterThan(0);
    expect(snapshot.ejectaHeightM).toBeGreaterThan(0);
    expect(snapshot.groundShockwaveOpacity).toBeGreaterThan(0);
    expect(snapshot.atmosphericShockwaveAngularRadiusRad).toBe(0);
    expect(snapshot.atmosphericShockwaveOpacity).toBe(0);
    expect(snapshot.hazeOpacity).toBe(0);
    expect(snapshot.cloudScarOpacity).toBe(0);
  });

  it('emits a cloud scar without solid-surface channels on Jupiter', () => {
    const parameters = {
      ...DEFAULT_IMPACT_PARAMETERS,
      targetBodyId: 'jupiter' as const,
      fragmentationEnabled: false,
    };
    const simulation = simulateImpactEntry(parameters);
    const scenario = new AsteroidImpactScenario();
    scenario.start(parameters);
    scenario.advance(simulation.terminalEventTimeSeconds + 1);
    const snapshot = scenario.getSnapshot();

    expect(snapshot.physicalSummary?.outcomeKind).toBe(
      'deep-atmosphere-breakup',
    );
    expect(snapshot.craterFormationProgress).toBe(0);
    expect(snapshot.surfaceScorchOpacity).toBe(0);
    expect(snapshot.ejectaRadiusM).toBe(0);
    expect(snapshot.ejectaOpacity).toBe(0);
    expect(snapshot.groundShockwaveAngularRadiusRad).toBe(0);
    expect(snapshot.groundShockwaveOpacity).toBe(0);
    expect(snapshot.atmosphericShockwaveOpacity).toBeGreaterThan(0);
    expect(snapshot.plumeOpacity).toBeGreaterThan(0);
    expect(snapshot.cloudScarGrowthProgress).toBeGreaterThan(0);
    expect(snapshot.cloudScarOpacity).toBeGreaterThan(0);
    expect(snapshot.cloudScarAdvectionRad).not.toBe(0);

    scenario.advance(snapshot.totalDurationSeconds * 2);
    const complete = scenario.getSnapshot();
    expect(complete.stage).toBe('complete');
    expect(complete.atmosphericShockwaveOpacity).toBe(0);
    expect(complete.plumeOpacity).toBe(0);
    expect(complete.hazeOpacity).toBe(0);
    expect(complete.cloudScarOpacity).toBe(0);
    expect(complete.cloudScarAdvectionRad).toBe(0);
  });

  it('keeps every solid-surface channel off for a Venus airburst', () => {
    const parameters = {
      ...DEFAULT_IMPACT_PARAMETERS,
      targetBodyId: 'venus' as const,
      diameterM: 1,
      material: 'porous-rock' as const,
    };
    const simulation = simulateImpactEntry(parameters);
    const scenario = new AsteroidImpactScenario();
    scenario.start(parameters);
    scenario.advance(simulation.terminalEventTimeSeconds + 0.5);
    const snapshot = scenario.getSnapshot();

    expect(snapshot.physicalSummary?.outcomeKind).toBe('airburst');
    expect(snapshot.stage).toBe('airburst');
    expect(snapshot.flashIntensity).toBeGreaterThan(0);
    expect(snapshot.craterFormationProgress).toBe(0);
    expect(snapshot.surfaceScorchOpacity).toBe(0);
    expect(snapshot.ejectaOpacity).toBe(0);
    expect(snapshot.groundShockwaveOpacity).toBe(0);
    expect(snapshot.atmosphericShockwaveOpacity).toBeGreaterThan(0);
  });

  it('suppresses atmospheric staging in vacuum and skips giant-planet ejecta', () => {
    const vacuum = new AsteroidImpactScenario();
    vacuum.start({ ...DEFAULT_IMPACT_PARAMETERS, atmosphereEnabled: false });
    vacuum.advance(5);
    expect(vacuum.getSnapshot().stage).toBe('approach');

    const jupiterParameters = {
      ...DEFAULT_IMPACT_PARAMETERS,
      targetBodyId: 'jupiter' as const,
      atmosphereEnabled: false,
      fragmentationEnabled: false,
    };
    const jupiterSimulation = simulateImpactEntry(jupiterParameters);
    const jupiter = new AsteroidImpactScenario();
    jupiter.start(jupiterParameters);
    jupiter.advance(jupiterSimulation.terminalEventTimeSeconds + 2);
    expect(jupiter.getSnapshot().stage).toBe('plume');
    expect(jupiter.getSnapshot().visualProfile?.craterRadiusM).toBe(0);
    expect(jupiter.getSnapshot().ejectaRadiusM).toBe(0);
  });

  it('pauses, frame-steps, resumes, completes, and resets without residual state', () => {
    const scenario = createStartedScenario();
    expect(scenario.state).toBe('running');
    scenario.pause();
    const pausedAt = scenario.getSnapshot().scenarioTimeSeconds;
    scenario.advance(10);
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBe(pausedAt);

    scenario.frameStep();
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBe(
      pausedAt + IMPACT_FIXED_STEP_SECONDS,
    );
    expect(scenario.state).toBe('paused');
    scenario.resume();
    scenario.advance(scenario.getSnapshot().totalDurationSeconds * 2);
    expect(scenario.state).toBe('complete');
    expect(scenario.getSnapshot().progress).toBe(1);
    expect(scenario.getSnapshot().stage).toBe('aftermath');

    scenario.reset();
    const reset = scenario.getSnapshot();
    expect(reset).toEqual(expect.objectContaining({
      state: 'idle',
      stage: 'idle',
      parameters: null,
      physicalSummary: null,
      visualProfile: null,
      impactorPosition: null,
      impactorVelocity: null,
      normalizedHeating: 0,
      normalizedDynamicPressure: 0,
      remainingMassFraction: 1,
      eventElapsedSeconds: null,
      craterFormationProgress: 0,
      surfaceScorchOpacity: 0,
      ejectaHeightM: 0,
      ejectaOpacity: 0,
      groundShockwaveAngularRadiusRad: 0,
      groundShockwaveOpacity: 0,
      atmosphericShockwaveAngularRadiusRad: 0,
      atmosphericShockwaveOpacity: 0,
      plumeRadiusM: 0,
      plumeOpacity: 0,
      plumeCoolingProgress: 0,
      cloudScarGrowthProgress: 0,
      cloudScarOpacity: 0,
      cloudScarAdvectionRad: 0,
      runSignature: null,
      fragmentCount: 0,
    }));
    expect(reset.trailPositions).toEqual([]);
    expect(reset.fragmentPositions).toEqual([]);
    scenario.reset();
  });

  it('uses quarter-speed playback for the slow-motion camera preset', () => {
    const scenario = new AsteroidImpactScenario();
    scenario.start({ ...DEFAULT_IMPACT_PARAMETERS, cameraMode: 'slow-motion-replay' });
    scenario.advance(1);
    expect(scenario.getSnapshot().playbackRate).toBe(0.25);
    expect(scenario.getSnapshot().scenarioTimeSeconds).toBe(0.25);
    scenario.setPlaybackRate(2);
    expect(scenario.getSnapshot().playbackRate).toBe(2);
    expect(() => scenario.setPlaybackRate(10)).toThrow(/playback rate/);
  });

  it('publishes immutable lifecycle snapshots and disposes idempotently', () => {
    const scenario = new AsteroidImpactScenario();
    const states: string[] = [];
    const unsubscribe = scenario.subscribe((snapshot) => {
      states.push(snapshot.state);
      expect(Object.isFrozen(snapshot)).toBe(true);
    });
    scenario.start(DEFAULT_IMPACT_PARAMETERS);
    scenario.pause();
    scenario.resume();
    scenario.reset();
    unsubscribe();

    expect(states).toEqual(['idle', 'running', 'paused', 'running', 'idle']);
    scenario.dispose();
    scenario.dispose();
    expect(() => scenario.start(DEFAULT_IMPACT_PARAMETERS)).toThrow(/disposed/);
  });

  it('rejects invalid delta, invalid frame-step state, replay-before-start, and double start', () => {
    const idle = new AsteroidImpactScenario();
    expect(() => idle.replay()).toThrow(/no prepared run/);
    expect(() => idle.advance(-1)).toThrow(/delta/);
    idle.start(DEFAULT_IMPACT_PARAMETERS);
    expect(() => idle.start(DEFAULT_IMPACT_PARAMETERS)).toThrow(/Reset/);
    expect(() => idle.frameStep()).toThrow(/paused/);
    idle.pause();
    expect(() => idle.frameStep(0)).toThrow(/positive/);
  });
});
