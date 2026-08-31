import {
  BlackHolePhysicsFlybyScenario,
  BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS,
  BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT,
  COMPLETE_CONSUMPTION_IDLE_SNAPSHOT,
  COMPLETE_CONSUMPTION_WARNING,
  CompleteConsumptionCinematicScenario,
  createDefaultCompleteConsumptionParameters,
} from '../../../simulation/scenarios/black-hole';
import {
  BLACK_HOLE_WORKER_ADVANCE,
} from '../../../workers/black-hole/BlackHoleWorkerProtocol';
import { BlackHoleWorkerRuntime } from '../../../workers/black-hole/BlackHoleWorkerRuntime';
import {
  fastCinematicParameters,
  fastPhysicsParameters,
  solarSystemInitialState,
} from './BlackHoleTestFixtures';

class DeferredAdvanceBlackHoleWorker extends EventTarget {
  public static latest: DeferredAdvanceBlackHoleWorker | null = null;

  readonly #runtime = new BlackHoleWorkerRuntime();
  readonly #advanceRequests: unknown[] = [];
  public terminated = false;

  public constructor() {
    super();
    DeferredAdvanceBlackHoleWorker.latest = this;
  }

  public get pendingAdvanceCount(): number {
    return this.#advanceRequests.length;
  }

  public get nextAdvanceTickCount(): number | null {
    const request = this.#advanceRequests[0] as { tickCount?: unknown } | undefined;
    return typeof request?.tickCount === 'number' ? request.tickCount : null;
  }

  public postMessage(message: unknown): void {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === BLACK_HOLE_WORKER_ADVANCE
    ) {
      this.#advanceRequests.push(message);
      return;
    }
    this.#respond(message);
  }

  public releaseNextAdvance(): void {
    const message = this.#advanceRequests.shift();
    if (message === undefined) throw new Error('No deferred black-hole advance exists.');
    this.#respond(message);
  }

  public terminate(): void {
    this.terminated = true;
  }

  #respond(message: unknown): void {
    const response = this.#runtime.handle(message);
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent('message', { data: response }));
    });
  }
}

async function flushDeferredWorker(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('Phase 10 black-hole scenarios', () => {
  it('keeps physics outcomes contingent and can report both ejections and survivors', async () => {
    const scenario = new BlackHolePhysicsFlybyScenario();
    const parameters = fastPhysicsParameters();
    const neptuneIndex = parameters.initialState.bodyIds.indexOf('neptune');
    parameters.initialState.velocitiesMps[neptuneIndex * 3] = -10_000_000;
    await scenario.start({
      ...parameters,
      ejectionRadiusM: 1_000_000,
    });
    scenario.advance(1 / 30);
    const snapshot = scenario.getSnapshot();
    expect(snapshot.allBodiesCaptured).toBe(false);
    expect(snapshot.ejectionCount).toBeGreaterThan(0);
    expect(snapshot.survivorCount).toBeGreaterThan(0);
    expect(snapshot.diagnostics?.finite).toBe(true);
    expect(snapshot.blackHole?.schwarzschildRadiusM).toBeGreaterThan(0);
  });

  it('is deterministic across frame partitioning and supports pause/frame-step/replay/reset', async () => {
    const whole = new BlackHolePhysicsFlybyScenario();
    const partitioned = new BlackHolePhysicsFlybyScenario();
    const parameters = fastPhysicsParameters();
    await whole.start(parameters);
    await partitioned.start(parameters);
    whole.advance(1);
    for (let index = 0; index < 10; index += 1) partitioned.advance(0.1);
    expect(partitioned.getSnapshot()).toEqual(whole.getSnapshot());
    const deterministicAfterOneSecond = whole.getSnapshot();
    const signature = whole.getSnapshot().runSignature;
    whole.pause();
    const beforeStep = whole.getSnapshot().scenarioTimeSeconds;
    whole.frameStep();
    expect(whole.getSnapshot().scenarioTimeSeconds).toBeGreaterThan(beforeStep);
    whole.replay();
    expect(whole.getSnapshot()).toMatchObject({
      state: 'running',
      scenarioTimeSeconds: 0,
      runSignature: signature,
    });
    whole.advance(1);
    expect(whole.getSnapshot()).toEqual(deterministicAfterOneSecond);
    whole.pause();
    whole.skipToNextStage();
    expect(whole.getSnapshot().stage).toBe('closest-approach');
    whole.skipToEnd();
    expect(whole.getSnapshot().state).toBe('complete');
    whole.reset();
    expect(whole.getSnapshot()).toBe(BLACK_HOLE_PHYSICS_FLYBY_IDLE_SNAPSHOT);
  });

  it('does not drain queued worker ticks while paused, even with a slow worker backlog', async () => {
    vi.stubGlobal('Worker', DeferredAdvanceBlackHoleWorker);
    const scenario = new BlackHolePhysicsFlybyScenario();
    try {
      await scenario.start(fastPhysicsParameters());
      const worker = DeferredAdvanceBlackHoleWorker.latest;
      if (worker === null) throw new Error('Deferred worker was not constructed.');

      scenario.advance(BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS);
      scenario.advance(0.5);
      expect(worker.pendingAdvanceCount).toBe(1);
      expect(worker.nextAdvanceTickCount).toBe(1);

      scenario.pause();
      worker.releaseNextAdvance();
      await flushDeferredWorker();
      expect(scenario.getSnapshot()).toMatchObject({
        state: 'paused',
        scenarioTimeSeconds: BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS,
      });
      expect(worker.pendingAdvanceCount).toBe(0);

      scenario.frameStep();
      expect(worker.nextAdvanceTickCount).toBe(1);
      worker.releaseNextAdvance();
      await flushDeferredWorker();
      expect(scenario.getSnapshot().scenarioTimeSeconds).toBeCloseTo(
        BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS * 2,
        12,
      );
      expect(worker.pendingAdvanceCount).toBe(0);

      scenario.skipToNextStage();
      expect(worker.pendingAdvanceCount).toBe(1);
      expect(worker.nextAdvanceTickCount).toBeGreaterThan(1);
      worker.releaseNextAdvance();
      await flushDeferredWorker();
      expect(scenario.getSnapshot()).toMatchObject({
        state: 'paused',
        stage: 'closest-approach',
      });
      expect(worker.pendingAdvanceCount).toBe(0);

      scenario.resume();
      expect(worker.pendingAdvanceCount).toBe(0);
      scenario.advance(BLACK_HOLE_SCENARIO_FIXED_STEP_SECONDS);
      expect(worker.nextAdvanceTickCount).toBe(1);
    } finally {
      scenario.dispose();
      vi.unstubAllGlobals();
      DeferredAdvanceBlackHoleWorker.latest = null;
    }
  });

  it('stages every body through the isolated cinematic path and guarantees capture', async () => {
    const scenario = new CompleteConsumptionCinematicScenario();
    const parameters = fastCinematicParameters();
    const warnings: string[] = [];
    scenario.subscribe((snapshot) => warnings.push(snapshot.warning));
    await scenario.start(parameters);
    scenario.advance(0.5);
    expect(scenario.getSnapshot().bodyStates.some(
      (body) => body.outcome !== 'intact',
    )).toBe(true);
    scenario.advance(parameters.durationSeconds);
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'complete',
      stage: 'complete',
      allBodiesCaptured: true,
      captureCount: 9,
      ejectionCount: 0,
    });
    expect(scenario.getSnapshot().bodyStates.every(
      (body) => body.outcome === 'captured' && body.captureProgress === 1,
    )).toBe(true);
    expect(warnings.every((warning) => warning === COMPLETE_CONSUMPTION_WARNING)).toBe(true);
    scenario.replay();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'running',
      stage: 'approach',
      captureCount: 0,
    });
    scenario.pause();
    scenario.skipToNextStage();
    expect(scenario.getSnapshot().stage).toBe('disruption');
    scenario.skipToEnd();
    expect(scenario.getSnapshot().allBodiesCaptured).toBe(true);
    scenario.reset();
    expect(scenario.getSnapshot()).toBe(COMPLETE_CONSUMPTION_IDLE_SNAPSHOT);
    expect(scenario.getSnapshot().warning).toBe(COMPLETE_CONSUMPTION_WARNING);
  });

  it('rejects invalid lifecycle calls and serializes artificial-force parameters', async () => {
    const scenario = new CompleteConsumptionCinematicScenario();
    expect(() => scenario.replay()).toThrow(/no prepared run/);
    await scenario.start(fastCinematicParameters());
    expect(scenario.serializeParameters()).toContain(
      'angularMomentumDampingPerPhysicalSecond',
    );
    expect(() => scenario.advance(-1)).toThrow(/delta/);
    expect(() => scenario.frameStep()).toThrow(/paused/);
    scenario.dispose();
    expect(() => scenario.start(fastCinematicParameters())).toThrow(/disposed/);
  });

  it('completes the production cinematic defaults without non-finite close-encounter state', async () => {
    const scenario = new CompleteConsumptionCinematicScenario();
    await scenario.start(
      createDefaultCompleteConsumptionParameters(solarSystemInitialState()),
    );
    scenario.skipToEnd();
    expect(scenario.getSnapshot()).toMatchObject({
      state: 'complete',
      allBodiesCaptured: true,
      captureCount: 9,
    });
    expect(scenario.getSnapshot().diagnostics?.finite).toBe(true);
  });
});
