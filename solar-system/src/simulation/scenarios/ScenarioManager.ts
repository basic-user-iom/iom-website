import type { SimulationContext } from '../core/SimulationContext';
import type {
  ScenarioModule,
  ScenarioRuntimeControl,
} from './ScenarioModule';

export interface ScenarioEnvironmentPort<EnvironmentSnapshot> {
  /** Return an owned snapshot; the manager retains it until reset. */
  capture(): EnvironmentSnapshot;
  /** Optional hook for pausing clocks and enabling scenario presentation. */
  prepare?(scenarioId: string): Promise<void> | void;
  /** Restore clocks, bodies, renderer, camera, exposure, and UI state. */
  restore(snapshot: EnvironmentSnapshot): Promise<void> | void;
}

export interface ScenarioManagerOptions<EnvironmentSnapshot> {
  readonly context: SimulationContext;
  readonly environment: ScenarioEnvironmentPort<EnvironmentSnapshot>;
}

interface ActiveScenario<EnvironmentSnapshot> {
  readonly module: ScenarioRuntimeControl;
  readonly environmentSnapshot: EnvironmentSnapshot;
}

class ScenarioStartCancelledError extends Error {
  public constructor(scenarioId: string) {
    super(`Scenario "${scenarioId}" start was cancelled by a newer lifecycle request.`);
    this.name = 'ScenarioStartCancelledError';
  }
}

/**
 * Owns scenario lifecycles and guarantees that only one destructive scenario
 * can control the observatory at a time. The current product has no scenario
 * composition model, so it conservatively allows only one active scenario of
 * any classification.
 */
export class ScenarioManager<EnvironmentSnapshot> {
  readonly #context: SimulationContext;
  readonly #environment: ScenarioEnvironmentPort<EnvironmentSnapshot>;
  readonly #registeredModules = new Set<ScenarioRuntimeControl>();
  #active: ActiveScenario<EnvironmentSnapshot> | null = null;
  #transitionTail: Promise<void> = Promise.resolve();
  #transitionGeneration = 0;
  #startScheduled = false;
  #startingScenarioId: string | null = null;
  #lifecycleFailure: unknown = null;
  #deferredCleanupErrors: unknown[] = [];
  #disposed = false;
  #disposePromise: Promise<void> | null = null;

  public constructor(options: ScenarioManagerOptions<EnvironmentSnapshot>) {
    this.#context = options.context;
    this.#environment = options.environment;
  }

  public get activeScenarioId(): string | null {
    return this.#active?.module.id ?? null;
  }

  public get activeScenario(): ScenarioRuntimeControl | null {
    return this.#active?.module ?? null;
  }

  public get disposed(): boolean {
    return this.#disposed;
  }

  public async register<Parameters, Snapshot>(
    module: ScenarioModule<Parameters, Snapshot>,
  ): Promise<void> {
    this.#assertActive();
    await this.#enqueueTransition(() => this.#registerInternal(module));
  }

  async #registerInternal<Parameters, Snapshot>(
    module: ScenarioModule<Parameters, Snapshot>,
  ): Promise<void> {
    this.#assertActive();
    if (this.#registeredModules.has(module)) return;
    for (const registered of this.#registeredModules) {
      if (registered.id === module.id) {
        throw new Error(`Scenario module "${module.id}" is already registered.`);
      }
    }
    await module.init(this.#context);
    this.#registeredModules.add(module);
    // Disposal may have been requested while an asynchronous init was in
    // flight. Keep the module in the owned set so the queued disposer releases
    // it exactly once, but do not let the interrupted registration succeed.
    this.#assertActive();
  }

  public async start<Parameters, Snapshot>(
    module: ScenarioModule<Parameters, Snapshot>,
    parameters: Readonly<Parameters>,
  ): Promise<void> {
    this.#assertActive();
    if (this.#startScheduled || this.#active !== null) {
      const activeId =
        this.#active?.module.id ?? this.#startingScenarioId ?? 'another scenario';
      throw new Error(
        `Cannot start "${module.id}" while "${activeId}" is active. Reset the active scenario first.`,
      );
    }

    const generation = this.#transitionGeneration;
    this.#startScheduled = true;
    this.#startingScenarioId = module.id;
    await this.#enqueueTransition(async () => {
      try {
        await this.#startInternal(module, parameters, generation);
      } finally {
        this.#startScheduled = false;
        this.#startingScenarioId = null;
      }
    });
  }

  public advance(realDeltaSeconds: number): void {
    this.#assertActive();
    this.#active?.module.advance(realDeltaSeconds);
  }

  public pause(): void {
    this.#assertActive();
    this.#active?.module.pause();
  }

  public resume(): void {
    this.#assertActive();
    this.#active?.module.resume();
  }

  public frameStep(stepSeconds?: number): void {
    this.#assertActive();
    this.#active?.module.frameStep(stepSeconds);
  }

  public replay(): void {
    this.#assertActive();
    this.#active?.module.replay();
  }

  public async reset(): Promise<boolean> {
    this.#assertActive();
    const hadLifecycle = this.#startScheduled || this.#active !== null;
    // Invalidate a pending start immediately. Its queued transition remains
    // responsible for undoing any prepare/start work before reset resolves.
    this.#transitionGeneration += 1;
    return this.#enqueueTransition(async () => {
      const errors = this.#takeDeferredCleanupErrors();
      let reset = false;
      try {
        reset = await this.#resetActive();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length > 0) {
        const failure = errors.length === 1
          ? errors[0]
          : new AggregateError(errors, 'Scenario reset cleanup failed.');
        this.#lifecycleFailure = failure;
        if (this.#disposed) this.#deferredCleanupErrors.push(failure);
        throw failure;
      }
      return hadLifecycle || reset;
    });
  }

  public dispose(): Promise<void> {
    if (this.#disposePromise !== null) return this.#disposePromise;
    this.#disposed = true;
    this.#transitionGeneration += 1;
    this.#disposePromise = this.#enqueueTransition(() => this.#disposeInternal());
    return this.#disposePromise;
  }

  async #startInternal<Parameters, Snapshot>(
    module: ScenarioModule<Parameters, Snapshot>,
    parameters: Readonly<Parameters>,
    generation: number,
  ): Promise<void> {
    let transaction: ActiveScenario<EnvironmentSnapshot> | null = null;
    try {
      this.#assertStartCurrent(generation, module.id);
      this.#assertLifecycleHealthy(module.id);
      await this.#registerInternal(module);
      this.#assertStartCurrent(generation, module.id);

      const environmentSnapshot = this.#environment.capture();
      transaction = { module, environmentSnapshot };
      await this.#environment.prepare?.(module.id);
      this.#assertStartCurrent(generation, module.id);
      await module.start(parameters);
      this.#assertStartCurrent(generation, module.id);

      this.#active = transaction;
      transaction = null;
    } catch (error) {
      const interrupted = !this.#isStartCurrent(generation);
      let cleanupError: unknown;
      if (transaction !== null) {
        try {
          await this.#cleanupScenario(transaction);
        } catch (caughtCleanupError) {
          cleanupError = caughtCleanupError;
          this.#lifecycleFailure = caughtCleanupError;
          if (interrupted) this.#deferredCleanupErrors.push(caughtCleanupError);
        }
      }
      if (cleanupError !== undefined) {
        throw new AggregateError(
          [error, cleanupError],
          `Scenario "${module.id}" failed to start and could not be fully cleaned up.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  async #disposeInternal(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.#resetActive();
    } catch (error) {
      errors.push(error);
    }
    for (const module of this.#registeredModules) {
      try {
        module.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.#registeredModules.clear();
    for (const error of this.#takeDeferredCleanupErrors()) {
      if (!errors.includes(error)) errors.push(error);
    }
    if (this.#lifecycleFailure !== null && !errors.includes(this.#lifecycleFailure)) {
      errors.push(this.#lifecycleFailure);
    }
    this.#throwCollectedErrors(errors, 'ScenarioManager disposal failed.');
  }

  async #resetActive(): Promise<boolean> {
    const active = this.#active;
    if (active === null) return false;
    this.#active = null;
    await this.#cleanupScenario(active);
    return true;
  }

  async #cleanupScenario(active: ActiveScenario<EnvironmentSnapshot>): Promise<void> {
    const errors: unknown[] = [];
    try {
      active.module.reset(this.#context);
    } catch (error) {
      errors.push(error);
    }
    try {
      await this.#environment.restore(active.environmentSnapshot);
    } catch (restoreError) {
      errors.push(restoreError);
    }
    this.#throwCollectedErrors(
      errors,
      `Scenario "${active.module.id}" reset and environment restore both failed.`,
    );
  }

  #enqueueTransition<Result>(operation: () => Promise<Result> | Result): Promise<Result> {
    const scheduled = this.#transitionTail.then(operation);
    this.#transitionTail = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }

  #isStartCurrent(generation: number): boolean {
    return !this.#disposed && generation === this.#transitionGeneration;
  }

  #assertStartCurrent(generation: number, scenarioId: string): void {
    if (this.#disposed) throw new Error('ScenarioManager has been disposed.');
    if (generation !== this.#transitionGeneration) {
      throw new ScenarioStartCancelledError(scenarioId);
    }
  }

  #assertLifecycleHealthy(scenarioId: string): void {
    if (this.#lifecycleFailure === null) return;
    throw new AggregateError(
      [this.#lifecycleFailure],
      `Cannot start "${scenarioId}" because the previous scenario environment was not cleanly restored.`,
      { cause: this.#lifecycleFailure },
    );
  }

  #takeDeferredCleanupErrors(): unknown[] {
    if (this.#deferredCleanupErrors.length === 0) return [];
    const errors = this.#deferredCleanupErrors;
    this.#deferredCleanupErrors = [];
    return errors;
  }

  #throwCollectedErrors(errors: readonly unknown[], message: string): void {
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, message);
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('ScenarioManager has been disposed.');
  }
}
