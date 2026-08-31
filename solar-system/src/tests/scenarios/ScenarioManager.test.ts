import type { RenderContext } from '../../rendering/RenderContext';
import { FloatingOrigin } from '../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import { SimulationContext } from '../../simulation/core/SimulationContext';
import { ScenarioManager } from '../../simulation/scenarios/ScenarioManager';
import type {
  ScenarioModule,
  ScenarioPlaybackState,
  ScenarioUnsubscribe,
} from '../../simulation/scenarios/ScenarioModule';

interface FakeParameters {
  readonly value: string;
}

interface FakeSnapshot {
  readonly state: ScenarioPlaybackState;
  readonly value: string | null;
}

class FakeScenario implements ScenarioModule<FakeParameters, FakeSnapshot> {
  public readonly classification = 'cinematic' as const;
  public readonly destructive = true;
  public state: ScenarioPlaybackState = 'idle';
  public initCount = 0;
  public startCount = 0;
  public resetCount = 0;
  public disposeCount = 0;
  public throwOnStart = false;
  public initBarrier: Promise<void> | null = null;
  public startBarrier: Promise<void> | null = null;
  #value: string | null = null;

  public constructor(public readonly id: string) {}

  public async init(_context: SimulationContext): Promise<void> {
    void _context;
    this.initCount += 1;
    await this.initBarrier;
  }

  public onTick(_context: SimulationContext, _dtSimSeconds: number): void {
    void _context;
    void _dtSimSeconds;
  }

  public onRender(_context: RenderContext, _dtRealSeconds: number): void {
    void _context;
    void _dtRealSeconds;
  }

  public async start(parameters: Readonly<FakeParameters>): Promise<void> {
    this.startCount += 1;
    if (this.throwOnStart) throw new Error('start failed');
    await this.startBarrier;
    this.#value = parameters.value;
    this.state = 'running';
  }

  public advance(_realDeltaSeconds: number): void {
    void _realDeltaSeconds;
  }

  public pause(): void {
    if (this.state === 'running') this.state = 'paused';
  }

  public resume(): void {
    if (this.state === 'paused') this.state = 'running';
  }

  public frameStep(_stepSeconds?: number): void {
    void _stepSeconds;
  }

  public replay(): void {
    if (this.#value !== null) this.state = 'running';
  }

  public reset(_context?: SimulationContext): void {
    void _context;
    this.resetCount += 1;
    this.#value = null;
    this.state = 'idle';
  }

  public dispose(): void {
    this.disposeCount += 1;
  }

  public getSnapshot(): Readonly<FakeSnapshot> {
    return Object.freeze({ state: this.state, value: this.#value });
  }

  public serializeParameters(): string | null {
    return this.#value;
  }

  public subscribe(_listener: (snapshot: Readonly<FakeSnapshot>) => void): ScenarioUnsubscribe {
    void _listener;
    return () => undefined;
  }
}

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason?: unknown) => void;
}

function deferred<Value = void>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createContext(): SimulationContext {
  return new SimulationContext({
    clock: new SimulationClock(),
    floatingOrigin: new FloatingOrigin(),
  });
}

describe('ScenarioManager', () => {
  it('captures/prepares once, rejects concurrency, and restores idempotently', async () => {
    const captured = Object.freeze({ clock: 'normal', camera: 'overview' });
    const prepare = vi.fn();
    const restore = vi.fn();
    const manager = new ScenarioManager({
      context: createContext(),
      environment: {
        capture: vi.fn(() => captured),
        prepare,
        restore,
      },
    });
    const impact = new FakeScenario('impact');
    const solar = new FakeScenario('solar');

    await manager.start(impact, { value: 'first' });
    expect(manager.activeScenarioId).toBe('impact');
    expect(prepare).toHaveBeenCalledWith('impact');
    await expect(manager.start(solar, { value: 'second' })).rejects.toThrow(
      /while "impact" is active/,
    );
    expect(solar.initCount).toBe(0);

    expect(await manager.reset()).toBe(true);
    expect(await manager.reset()).toBe(false);
    expect(impact.resetCount).toBe(1);
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(captured);
    expect(manager.activeScenarioId).toBeNull();
  });

  it('restores the environment when scenario start fails', async () => {
    const snapshot = { clock: 'saved' };
    const restore = vi.fn();
    const scenario = new FakeScenario('broken');
    scenario.throwOnStart = true;
    const manager = new ScenarioManager({
      context: createContext(),
      environment: {
        capture: () => snapshot,
        restore,
      },
    });

    await expect(manager.start(scenario, { value: 'x' })).rejects.toThrow('start failed');
    expect(scenario.resetCount).toBe(1);
    expect(restore).toHaveBeenCalledWith(snapshot);
    expect(manager.activeScenarioId).toBeNull();
  });

  it('registers once, disposes all owned modules once, and rejects later work', async () => {
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => 1, restore: vi.fn() },
    });
    const scenario = new FakeScenario('impact');
    await manager.register(scenario);
    await manager.register(scenario);
    expect(scenario.initCount).toBe(1);

    await manager.start(scenario, { value: 'active' });
    await manager.dispose();
    await manager.dispose();
    expect(scenario.resetCount).toBe(1);
    expect(scenario.disposeCount).toBe(1);
    expect(manager.disposed).toBe(true);
    expect(() => manager.advance(1)).toThrow(/disposed/);
    await expect(manager.start(scenario, { value: 'late' })).rejects.toThrow(/disposed/);
  });

  it('rejects duplicate IDs from distinct modules', async () => {
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => 1, restore: vi.fn() },
    });
    await manager.register(new FakeScenario('duplicate'));
    await expect(manager.register(new FakeScenario('duplicate'))).rejects.toThrow(
      /already registered/,
    );
  });

  it('cancels and cleans a pending start when reset is requested during prepare', async () => {
    const prepareBarrier = deferred();
    const restore = vi.fn();
    const prepare = vi.fn(() => prepareBarrier.promise);
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => ({ clock: 'saved' }), prepare, restore },
    });
    const scenario = new FakeScenario('slow-prepare');

    const startPromise = manager.start(scenario, { value: 'pending' });
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    const resetPromise = manager.reset();
    prepareBarrier.resolve(undefined);

    await expect(startPromise).rejects.toThrow(/cancelled/);
    await expect(resetPromise).resolves.toBe(true);
    expect(scenario.startCount).toBe(0);
    expect(scenario.resetCount).toBe(1);
    expect(restore).toHaveBeenCalledOnce();
    expect(manager.activeScenarioId).toBeNull();
  });

  it('cancels and cleans a pending start when reset is requested during module start', async () => {
    const startBarrier = deferred();
    const restore = vi.fn();
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => ({ clock: 'saved' }), restore },
    });
    const scenario = new FakeScenario('slow-start');
    scenario.startBarrier = startBarrier.promise;

    const startPromise = manager.start(scenario, { value: 'pending' });
    await vi.waitFor(() => expect(scenario.startCount).toBe(1));
    const resetPromise = manager.reset();
    startBarrier.resolve(undefined);

    await expect(startPromise).rejects.toThrow(/cancelled/);
    await expect(resetPromise).resolves.toBe(true);
    expect(scenario.state).toBe('idle');
    expect(scenario.resetCount).toBe(1);
    expect(restore).toHaveBeenCalledOnce();
    expect(manager.activeScenarioId).toBeNull();
  });

  it('waits for an in-flight start cleanup before disposing each module once', async () => {
    const startBarrier = deferred();
    const restore = vi.fn();
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => ({ clock: 'saved' }), restore },
    });
    const scenario = new FakeScenario('dispose-during-start');
    scenario.startBarrier = startBarrier.promise;

    const startPromise = manager.start(scenario, { value: 'pending' });
    await vi.waitFor(() => expect(scenario.startCount).toBe(1));
    const disposePromise = manager.dispose();
    startBarrier.resolve(undefined);

    await expect(startPromise).rejects.toThrow(/disposed/);
    await expect(disposePromise).resolves.toBeUndefined();
    expect(scenario.state).toBe('idle');
    expect(scenario.resetCount).toBe(1);
    expect(scenario.disposeCount).toBe(1);
    expect(restore).toHaveBeenCalledOnce();
    expect(manager.activeScenarioId).toBeNull();
  });

  it('queues a new start behind environment restoration', async () => {
    const restoreBarrier = deferred();
    const restore = vi.fn(() => restoreBarrier.promise);
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => ({ clock: 'saved' }), restore },
    });
    const first = new FakeScenario('first');
    const second = new FakeScenario('second');
    await manager.start(first, { value: 'active' });

    const resetPromise = manager.reset();
    await vi.waitFor(() => expect(restore).toHaveBeenCalledOnce());
    expect(manager.activeScenarioId).toBeNull();
    const secondStartPromise = manager.start(second, { value: 'next' });
    await Promise.resolve();
    expect(second.initCount).toBe(0);
    expect(second.startCount).toBe(0);

    restoreBarrier.resolve(undefined);
    await expect(resetPromise).resolves.toBe(true);
    await expect(secondStartPromise).resolves.toBeUndefined();
    expect(first.resetCount).toBe(1);
    expect(second.startCount).toBe(1);
    expect(manager.activeScenarioId).toBe('second');
  });

  it('retains ownership of a module initialized while disposal is requested', async () => {
    const initBarrier = deferred();
    const manager = new ScenarioManager({
      context: createContext(),
      environment: { capture: () => 1, restore: vi.fn() },
    });
    const scenario = new FakeScenario('dispose-during-init');
    scenario.initBarrier = initBarrier.promise;

    const registerPromise = manager.register(scenario);
    await vi.waitFor(() => expect(scenario.initCount).toBe(1));
    const disposePromise = manager.dispose();
    initBarrier.resolve(undefined);

    await expect(registerPromise).rejects.toThrow(/disposed/);
    await expect(disposePromise).resolves.toBeUndefined();
    expect(scenario.disposeCount).toBe(1);
  });
});
