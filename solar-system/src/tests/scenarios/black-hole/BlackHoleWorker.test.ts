import {
  ASTRONOMICAL_UNIT_M,
} from '../../../simulation/core/Units';
import {
  CinematicInfallForceProvider,
  createBlackHolePhysicsRunner,
  createDefaultPhysicsFlybyParameters,
  type BlackHoleKernelConfiguration,
} from '../../../simulation/scenarios/black-hole';
import {
  BLACK_HOLE_WORKER_ADVANCE,
  BLACK_HOLE_WORKER_FAILURE,
  BLACK_HOLE_WORKER_INITIALIZE,
  BLACK_HOLE_WORKER_RESET,
  BLACK_HOLE_WORKER_RESET_COMPLETE,
  BLACK_HOLE_WORKER_RESULT,
  blackHoleResponseTransferables,
  isBlackHoleWorkerRequest,
} from '../../../workers/black-hole/BlackHoleWorkerProtocol';
import { BlackHoleWorkerClient } from '../../../workers/black-hole/BlackHoleWorkerClient';
import { BlackHoleWorkerRuntime } from '../../../workers/black-hole/BlackHoleWorkerRuntime';
import { solarSystemInitialState } from './BlackHoleTestFixtures';

class FakeBlackHoleWorker extends EventTarget {
  readonly runtime = new BlackHoleWorkerRuntime();
  terminated = false;
  postCount = 0;

  postMessage(message: unknown): void {
    this.postCount += 1;
    const response = this.runtime.handle(message);
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent('message', { data: response }));
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  fail(message: string): void {
    this.dispatchEvent(new ErrorEvent('error', { message }));
  }
}

describe('black-hole module-worker protocol and pure runtime', () => {
  it('initializes and advances Float64 state deterministically through worker messages', () => {
    const parameters = createDefaultPhysicsFlybyParameters(solarSystemInitialState());
    const configuration: BlackHoleKernelConfiguration = {
      accuracy: 'high',
      ejectionRadiusM: 100 * ASTRONOMICAL_UNIT_M,
      captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
      physicsSecondsPerScenarioSecond:
        parameters.physicsSecondsPerScenarioSecond,
      cinematicInfall: null,
    };
    const initialize = {
      type: BLACK_HOLE_WORKER_INITIALIZE,
      requestId: 'init-1',
      runId: 'run-1',
      initialState: parameters.initialState,
      blackHole: parameters.blackHole,
      configuration,
    } as const;
    expect(isBlackHoleWorkerRequest(initialize)).toBe(true);
    const firstRuntime = new BlackHoleWorkerRuntime();
    const secondRuntime = new BlackHoleWorkerRuntime();
    const firstInitial = firstRuntime.handle(initialize);
    const secondInitial = secondRuntime.handle({ ...initialize, requestId: 'init-2' });
    expect(firstInitial.type).toBe(BLACK_HOLE_WORKER_RESULT);
    expect(secondInitial.type).toBe(BLACK_HOLE_WORKER_RESULT);
    if (firstInitial.type !== BLACK_HOLE_WORKER_RESULT) throw new Error('init failed');
    expect(firstInitial.result.state.positionsM).toBeInstanceOf(Float64Array);
    expect(blackHoleResponseTransferables(firstInitial).length).toBeGreaterThan(0);

    const firstAdvanced = firstRuntime.handle({
      type: BLACK_HOLE_WORKER_ADVANCE,
      requestId: 'advance-1',
      runId: 'run-1',
      physicalTickSeconds: 3_600,
      tickCount: 1,
    });
    const secondAdvanced = secondRuntime.handle({
      type: BLACK_HOLE_WORKER_ADVANCE,
      requestId: 'advance-2',
      runId: 'run-1',
      physicalTickSeconds: 3_600,
      tickCount: 1,
    });
    expect(firstAdvanced.type).toBe(BLACK_HOLE_WORKER_RESULT);
    expect(secondAdvanced.type).toBe(BLACK_HOLE_WORKER_RESULT);
    if (
      firstAdvanced.type !== BLACK_HOLE_WORKER_RESULT ||
      secondAdvanced.type !== BLACK_HOLE_WORKER_RESULT
    ) throw new Error('advance failed');
    expect(firstAdvanced.result.state.positionsM).toEqual(
      secondAdvanced.result.state.positionsM,
    );
    expect(firstAdvanced.result.diagnostics.finite).toBe(true);
  });

  it('resets worker-owned state and returns serializable failures', () => {
    const runtime = new BlackHoleWorkerRuntime();
    const invalid = runtime.handle({ type: 'wrong', requestId: 'bad', runId: 'run' });
    expect(invalid.type).toBe(BLACK_HOLE_WORKER_FAILURE);
    const reset = runtime.handle({
      type: BLACK_HOLE_WORKER_RESET,
      requestId: 'reset-1',
      runId: 'missing-run',
    });
    expect(reset.type).toBe(BLACK_HOLE_WORKER_RESET_COMPLETE);
    const advance = runtime.handle({
      type: BLACK_HOLE_WORKER_ADVANCE,
      requestId: 'advance-missing',
      runId: 'missing-run',
      physicalTickSeconds: 10,
      tickCount: 1,
    });
    expect(advance.type).toBe(BLACK_HOLE_WORKER_FAILURE);
  });

  it('drives initialize, fixed-tick advance, and reset through the worker client', async () => {
    const fakeWorker = new FakeBlackHoleWorker();
    const client = new BlackHoleWorkerClient(fakeWorker as unknown as Worker);
    const parameters = createDefaultPhysicsFlybyParameters(solarSystemInitialState());
    const configuration: BlackHoleKernelConfiguration = {
      accuracy: 'high',
      ejectionRadiusM: parameters.ejectionRadiusM,
      captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
      physicsSecondsPerScenarioSecond:
        parameters.physicsSecondsPerScenarioSecond,
      cinematicInfall: null,
    };
    const initialized = await client.initialize(
      'client-run',
      parameters.initialState,
      parameters.blackHole,
      configuration,
    );
    const advanced = await client.advance('client-run', 300, 4);
    expect(initialized.state.integratedPhysicalTimeSeconds).toBe(0);
    expect(advanced.state.integratedPhysicalTimeSeconds).toBe(1_200);
    expect(advanced.diagnostics.finite).toBe(true);
    await client.reset('client-run');
    await expect(client.advance('client-run', 300, 1)).rejects.toThrow(/not initialized/);
    client.dispose();
    expect(fakeWorker.terminated).toBe(true);
  });

  it('falls back to the deterministic direct kernel when module-worker construction fails', () => {
    class RefusedModuleWorker {
      public constructor() {
        throw new Error('module workers blocked by policy');
      }
    }
    vi.stubGlobal('Worker', RefusedModuleWorker);
    const parameters = createDefaultPhysicsFlybyParameters(solarSystemInitialState());
    const configuration: BlackHoleKernelConfiguration = {
      accuracy: 'high',
      ejectionRadiusM: parameters.ejectionRadiusM,
      captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
      physicsSecondsPerScenarioSecond:
        parameters.physicsSecondsPerScenarioSecond,
      cinematicInfall: null,
    };

    const runner = createBlackHolePhysicsRunner('constructor-fallback');
    expect(runner.execution).toBe('direct-kernel-fallback');
    const initialized = runner.initialize(
      parameters.initialState,
      parameters.blackHole,
      configuration,
    );
    expect(initialized).not.toBeInstanceOf(Promise);
    expect(initialized).toMatchObject({
      diagnostics: { finite: true },
      state: { integratedPhysicalTimeSeconds: 0 },
    });
    runner.dispose();
  });

  it('retires the client after a fatal worker error and rejects later requests immediately', async () => {
    const fakeWorker = new FakeBlackHoleWorker();
    const client = new BlackHoleWorkerClient(fakeWorker as unknown as Worker);
    const pending = client.advance('fatal-run', 300, 1);
    const pendingRejection = expect(pending).rejects.toThrow('worker crashed');

    fakeWorker.fail('worker crashed');

    await pendingRejection;
    expect(fakeWorker.terminated).toBe(true);
    expect(fakeWorker.postCount).toBe(1);
    await expect(client.advance('fatal-run', 300, 1)).rejects.toThrow(
      'worker crashed',
    );
    expect(fakeWorker.postCount).toBe(1);
  });

  it('keeps cinematic damping isolated and serializable', () => {
    const provider = new CinematicInfallForceProvider({
      angularMomentumDampingPerPhysicalSecond: 1e-4,
      inwardBiasMps2: 0.1,
      stagingStartSeconds: 1,
      stagingIntervalSeconds: 2,
    });
    expect(provider.serialize()).toBe(
      '{"angularMomentumDampingPerPhysicalSecond":0.0001,"inwardBiasMps2":0.1,"stagingStartSeconds":1,"stagingIntervalSeconds":2}',
    );
    const accelerations = new Float64Array(6);
    provider.addAccelerations({
      bodyCount: 1,
      blackHoleIndex: 1,
      positionsM: new Float64Array([1_000, 0, 0, 0, 0, 0]),
      velocitiesMps: new Float64Array([0, 10, 0, 0, 0, 0]),
      outcomeCodes: new Uint8Array([0]),
    }, accelerations);
    expect(accelerations[0]).toBeLessThan(0);
    expect(accelerations[1]).toBeLessThan(0);
  });
});
