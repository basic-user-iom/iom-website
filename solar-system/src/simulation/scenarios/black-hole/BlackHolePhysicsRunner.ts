import {
  advanceBlackHoleKernel,
  initializeBlackHoleKernel,
  type BlackHoleKernelAdvanceResult,
  type BlackHoleKernelConfiguration,
} from './BlackHolePhysicsKernel';
import type {
  BlackHoleCapturedInitialState,
  ExternalBlackHoleInitialConditions,
} from './BlackHoleTypes';
import { BlackHoleWorkerClient } from '../../../workers/black-hole/BlackHoleWorkerClient';

export interface BlackHolePhysicsRunner {
  readonly execution: 'module-worker' | 'direct-kernel-fallback';
  initialize(
    initialState: BlackHoleCapturedInitialState,
    blackHole: ExternalBlackHoleInitialConditions,
    configuration: BlackHoleKernelConfiguration,
  ): BlackHoleKernelAdvanceResult | Promise<BlackHoleKernelAdvanceResult>;
  advance(
    physicalTickSeconds: number,
    tickCount: number,
  ): BlackHoleKernelAdvanceResult | Promise<BlackHoleKernelAdvanceResult>;
  reset(): void | Promise<void>;
  dispose(): void;
}

export function createBlackHolePhysicsRunner(runId: string): BlackHolePhysicsRunner {
  if (typeof Worker === 'function') {
    try {
      return new ModuleWorkerBlackHolePhysicsRunner(runId);
    } catch {
      // A Worker global can exist even when the browser, CSP, or embedding host
      // refuses this particular module worker. Keep the scenario operational
      // and expose the actual execution path through `execution`.
      return new DirectBlackHolePhysicsRunner();
    }
  }
  return new DirectBlackHolePhysicsRunner();
}

class DirectBlackHolePhysicsRunner implements BlackHolePhysicsRunner {
  public readonly execution = 'direct-kernel-fallback' as const;
  #configuration: BlackHoleKernelConfiguration | null = null;
  #result: BlackHoleKernelAdvanceResult | null = null;

  public initialize(
    initialState: BlackHoleCapturedInitialState,
    blackHole: ExternalBlackHoleInitialConditions,
    configuration: BlackHoleKernelConfiguration,
  ): BlackHoleKernelAdvanceResult {
    this.#configuration = configuration;
    this.#result = initializeBlackHoleKernel(initialState, blackHole);
    return this.#result;
  }

  public advance(
    physicalTickSeconds: number,
    tickCount: number,
  ): BlackHoleKernelAdvanceResult {
    if (this.#result === null || this.#configuration === null) {
      throw new Error('Direct black-hole kernel is not initialized.');
    }
    for (let tick = 0; tick < tickCount; tick += 1) {
      this.#result = advanceBlackHoleKernel(
        this.#result.state,
        this.#configuration,
        physicalTickSeconds,
      );
    }
    return this.#result;
  }

  public reset(): void {
    this.#configuration = null;
    this.#result = null;
  }

  public dispose(): void {
    this.reset();
  }
}

class ModuleWorkerBlackHolePhysicsRunner implements BlackHolePhysicsRunner {
  public readonly execution = 'module-worker' as const;
  readonly #runId: string;
  readonly #client = new BlackHoleWorkerClient();

  public constructor(runId: string) {
    this.#runId = runId;
  }

  public initialize(
    initialState: BlackHoleCapturedInitialState,
    blackHole: ExternalBlackHoleInitialConditions,
    configuration: BlackHoleKernelConfiguration,
  ): Promise<BlackHoleKernelAdvanceResult> {
    return this.#client.initialize(
      this.#runId,
      initialState,
      blackHole,
      configuration,
    );
  }

  public advance(
    physicalTickSeconds: number,
    tickCount: number,
  ): Promise<BlackHoleKernelAdvanceResult> {
    return this.#client.advance(this.#runId, physicalTickSeconds, tickCount);
  }

  public reset(): Promise<void> {
    return this.#client.reset(this.#runId);
  }

  public dispose(): void {
    this.#client.dispose();
  }
}
