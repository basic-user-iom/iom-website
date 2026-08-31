import type { RenderContext } from '../../rendering/RenderContext';
import { createDebugBodyRuntimeStates } from '../../simulation/bodies/DebugBodyCatalog';
import { FloatingOrigin } from '../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import { SimulationContext } from '../../simulation/core/SimulationContext';
import {
  SimulationEngine,
  type AnimationScheduler,
  type SimulationFrame,
} from '../../simulation/core/SimulationEngine';
import type { SimulationModule } from '../../simulation/modules/SimulationModule';

class TestAnimationScheduler implements AnimationScheduler {
  public nowMs = 1_000;
  public readonly requested: number[] = [];
  public readonly cancelled: number[] = [];
  private nextHandle = 1;
  private readonly callbacks = new Map<number, (nowMs: number) => void>();

  public now(): number {
    return this.nowMs;
  }

  public request(callback: (nowMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.requested.push(handle);
    this.callbacks.set(handle, callback);
    return handle;
  }

  public cancel(handle: number): void {
    this.cancelled.push(handle);
    this.callbacks.delete(handle);
  }

  public fire(handle: number, nowMs: number): void {
    const callback = this.callbacks.get(handle);
    if (callback === undefined) {
      throw new Error(`No pending animation callback for handle ${handle}.`);
    }
    this.callbacks.delete(handle);
    this.nowMs = nowMs;
    callback(nowMs);
  }

  public pendingHandles(): number[] {
    return [...this.callbacks.keys()];
  }
}

function createContext(options: { paused?: boolean; timeScale?: number } = {}): SimulationContext {
  const clock = new SimulationClock({
    initialJdTdb: 2_451_545,
    paused: options.paused ?? false,
    timeScale: options.timeScale ?? 1,
    maximumRealDeltaSeconds: 1,
  });
  return new SimulationContext({
    clock,
    floatingOrigin: new FloatingOrigin(),
    bodies: createDebugBodyRuntimeStates(clock.currentJdTdb),
  });
}

function createRenderContext(
  frame: Readonly<SimulationFrame>,
  context: SimulationContext,
): RenderContext {
  const origin = context.floatingOrigin.snapshot();
  return {
    realDeltaSeconds: frame.dtRealSeconds,
    frame: {
      currentJdTdb: frame.currentJdTdb,
      originM: origin.originM,
      originRevision: origin.revision,
      bodies: [],
      trails: [],
    },
  };
}

function createModule(id: string): SimulationModule {
  return {
    id,
    init: vi.fn(),
    onTick: vi.fn(),
    onRender: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('SimulationEngine animation scheduling', () => {
  it('owns exactly one animation request across repeated starts and stops', () => {
    const scheduler = new TestAnimationScheduler();
    const engine = new SimulationEngine(createContext(), { scheduler });

    engine.start();
    engine.start();
    expect(engine.running).toBe(true);
    expect(scheduler.requested).toEqual([1]);
    expect(scheduler.pendingHandles()).toEqual([1]);

    scheduler.fire(1, 1_016);
    expect(engine.frameNumber).toBe(1);
    expect(scheduler.requested).toEqual([1, 2]);
    expect(scheduler.pendingHandles()).toEqual([2]);

    engine.stop();
    engine.stop();
    expect(engine.running).toBe(false);
    expect(scheduler.cancelled).toEqual([2]);
    expect(scheduler.pendingHandles()).toEqual([]);

    scheduler.nowMs = 2_000;
    engine.start();
    expect(scheduler.requested).toEqual([1, 2, 3]);
    expect(scheduler.pendingHandles()).toEqual([3]);
  });

  it('does not queue another animation request when stopped from a frame listener', () => {
    const scheduler = new TestAnimationScheduler();
    const engine = new SimulationEngine(createContext(), { scheduler });
    engine.onFrame(() => engine.stop());

    engine.start();
    scheduler.fire(1, 1_016);

    expect(engine.running).toBe(false);
    expect(scheduler.pendingHandles()).toEqual([]);
    expect(scheduler.requested).toEqual([1]);
  });
});

describe('SimulationEngine deterministic frames', () => {
  it('numbers and freezes frames, synchronizes bodies, and supports listener removal', () => {
    const context = createContext({ timeScale: 10 });
    const engine = new SimulationEngine(context);
    const frames: Readonly<SimulationFrame>[] = [];
    const contexts: SimulationContext[] = [];
    const unsubscribe = engine.onFrame((frame, receivedContext) => {
      frames.push(frame);
      contexts.push(receivedContext);
    });

    const first = engine.stepFrame(1_000);
    const second = engine.stepFrame(1_100);
    unsubscribe();
    engine.stepFrame(1_200);

    expect(first.frameNumber).toBe(1);
    expect(second.frameNumber).toBe(2);
    expect(second.dtRealSeconds).toBe(0.1);
    expect(second.dtSimSeconds).toBe(1);
    expect(Object.isFrozen(first)).toBe(true);
    expect(frames).toEqual([first, second]);
    expect(contexts).toEqual([context, context]);
    expect(engine.frameNumber).toBe(3);
    expect([...context.bodies.values()].every((body) => body.jdTdb === context.clock.currentJdTdb)).toBe(
      true,
    );
  });

  it('ticks modules only for simulated time but renders every factory-backed frame', async () => {
    const context = createContext({ timeScale: 10 });
    const renderContextFactory = vi.fn(createRenderContext);
    const engine = new SimulationEngine(context, { renderContextFactory });
    const module = createModule('probe');
    await engine.registerModule(module);

    engine.stepFrame(1_000);
    engine.stepFrame(1_100);
    context.clock.setPaused(true);
    engine.stepFrame(1_200);

    expect(module.init).toHaveBeenCalledOnce();
    expect(module.init).toHaveBeenCalledWith(context);
    expect(module.onTick).toHaveBeenCalledOnce();
    expect(module.onTick).toHaveBeenCalledWith(context, 1);
    expect(renderContextFactory).toHaveBeenCalledTimes(3);
    expect(module.onRender).toHaveBeenCalledTimes(3);
    expect(vi.mocked(module.onRender).mock.calls.map((call) => call[1])).toEqual([0, 0.1, 0.1]);
    expect(vi.mocked(module.onRender).mock.calls[1]?.[0].frame.currentJdTdb).toBe(
      context.clock.currentJdTdb,
    );
  });

  it('skips module rendering when no render-context factory is configured', async () => {
    const engine = new SimulationEngine(createContext());
    const module = createModule('headless');
    await engine.registerModule(module);

    engine.stepFrame(1_000);
    engine.stepFrame(1_100);

    expect(module.onTick).toHaveBeenCalledOnce();
    expect(module.onRender).not.toHaveBeenCalled();
  });
});

describe('SimulationEngine module lifecycle', () => {
  it('initializes, resets, unregisters, and disposes a module exactly once', async () => {
    const context = createContext();
    const engine = new SimulationEngine(context);
    const module = createModule('lifecycle');

    await engine.registerModule(module);
    engine.resetModules();
    expect(module.reset).toHaveBeenCalledOnce();
    expect(module.reset).toHaveBeenCalledWith(context);
    expect(engine.unregisterModule('lifecycle')).toBe(true);
    expect(module.dispose).toHaveBeenCalledOnce();
    expect(engine.unregisterModule('lifecycle')).toBe(false);

    engine.dispose();
    expect(module.dispose).toHaveBeenCalledOnce();
  });

  it('rejects duplicate module ids without initializing the duplicate', async () => {
    const engine = new SimulationEngine(createContext());
    const first = createModule('duplicate');
    const second = createModule('duplicate');
    await engine.registerModule(first);

    await expect(engine.registerModule(second)).rejects.toThrow(
      'Simulation module "duplicate" is already registered.',
    );
    expect(second.init).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('disposes a module whose asynchronous init resolves after engine disposal', async () => {
    const engine = new SimulationEngine(createContext());
    let resolveInitialization: (() => void) | undefined;
    const module = createModule('slow');
    module.init = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInitialization = resolve;
        }),
    );

    const registration = engine.registerModule(module);
    engine.dispose();
    expect(resolveInitialization).toBeDefined();
    resolveInitialization?.();
    await registration;

    expect(module.dispose).toHaveBeenCalledOnce();
    expect(engine.unregisterModule('slow')).toBe(false);
  });

  it('cancels scheduling, clears events/listeners, and disposes registered modules idempotently', async () => {
    const scheduler = new TestAnimationScheduler();
    const context = createContext();
    const engine = new SimulationEngine(context, { scheduler });
    const first = createModule('first');
    const second = createModule('second');
    await engine.registerModule(first);
    await engine.registerModule(second);
    const frameListener = vi.fn();
    engine.onFrame(frameListener);
    context.events.on('bodyVisibilityChanged', vi.fn());
    engine.start();

    engine.dispose();
    engine.dispose();

    expect(engine.running).toBe(false);
    expect(scheduler.cancelled).toEqual([1]);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(context.events.listenerCount('bodyVisibilityChanged')).toBe(0);
    expect(() => engine.start()).toThrow('SimulationEngine has been disposed.');
    expect(() => engine.stepFrame(2_000)).toThrow('SimulationEngine has been disposed.');
    expect(() => engine.onFrame(vi.fn())).toThrow('SimulationEngine has been disposed.');
    expect(() => engine.resetModules()).toThrow('SimulationEngine has been disposed.');
    await expect(engine.registerModule(createModule('late'))).rejects.toThrow(
      'SimulationEngine has been disposed.',
    );
    expect(frameListener).not.toHaveBeenCalled();
  });
});
