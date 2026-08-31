import type { RenderContext } from '../../rendering/RenderContext';
import type { SimulationModule } from '../modules/SimulationModule';
import type { SimulationContext } from './SimulationContext';
import type { SimulationClockTick } from './SimulationClock';

export interface AnimationScheduler {
  now(): number;
  request(callback: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

export interface SimulationFrame extends SimulationClockTick {
  readonly frameNumber: number;
  readonly nowMs: number;
}

export type SimulationFrameListener = (
  frame: Readonly<SimulationFrame>,
  context: SimulationContext,
) => void;

export interface SimulationEngineOptions {
  readonly scheduler?: AnimationScheduler;
  readonly renderContextFactory?: (
    frame: Readonly<SimulationFrame>,
    context: SimulationContext,
  ) => RenderContext;
}

export class SimulationEngine {
  private readonly scheduler: AnimationScheduler;
  private readonly renderContextFactory: SimulationEngineOptions['renderContextFactory'];
  private readonly modules = new Map<string, SimulationModule>();
  private readonly frameListeners = new Set<SimulationFrameListener>();
  private animationHandle: number | null = null;
  private frameCount = 0;
  private disposed = false;

  public constructor(
    public readonly context: SimulationContext,
    options: SimulationEngineOptions = {},
  ) {
    this.scheduler = options.scheduler ?? createBrowserAnimationScheduler();
    this.renderContextFactory = options.renderContextFactory;
  }

  public get running(): boolean {
    return this.animationHandle !== null;
  }

  public get frameNumber(): number {
    return this.frameCount;
  }

  public async registerModule(module: SimulationModule): Promise<void> {
    this.assertActive();
    if (this.modules.has(module.id)) {
      throw new Error(`Simulation module "${module.id}" is already registered.`);
    }
    await module.init(this.context);
    if (this.disposed) {
      module.dispose();
      return;
    }
    this.modules.set(module.id, module);
  }

  public unregisterModule(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module === undefined) {
      return false;
    }
    this.modules.delete(moduleId);
    module.dispose();
    return true;
  }

  public onFrame(listener: SimulationFrameListener): () => void {
    this.assertActive();
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  public start(): void {
    this.assertActive();
    if (this.animationHandle !== null) {
      return;
    }
    this.context.clock.resetRealTimeAnchor(this.scheduler.now());
    this.animationHandle = this.scheduler.request(this.handleAnimationFrame);
  }

  public stop(): void {
    if (this.animationHandle !== null) {
      this.scheduler.cancel(this.animationHandle);
      this.animationHandle = null;
    }
    this.context.clock.resetRealTimeAnchor();
  }

  /** Public deterministic stepping seam used by tests and future frame-step UI. */
  public stepFrame(nowMs: number): Readonly<SimulationFrame> {
    this.assertActive();
    const tick = this.context.clock.tick(nowMs);
    this.context.synchronizeBodyTimes();
    this.frameCount += 1;
    const frame: Readonly<SimulationFrame> = Object.freeze({
      ...tick,
      frameNumber: this.frameCount,
      nowMs,
    });

    if (tick.dtSimSeconds !== 0) {
      for (const module of this.modules.values()) {
        module.onTick(this.context, tick.dtSimSeconds);
      }
    }

    for (const listener of [...this.frameListeners]) {
      listener(frame, this.context);
    }

    if (this.renderContextFactory !== undefined) {
      const renderContext = this.renderContextFactory(frame, this.context);
      for (const module of this.modules.values()) {
        module.onRender(renderContext, tick.dtRealSeconds);
      }
    }
    return frame;
  }

  public resetModules(): void {
    this.assertActive();
    for (const module of this.modules.values()) {
      module.reset?.(this.context);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.stop();
    this.disposed = true;
    this.frameListeners.clear();
    for (const module of this.modules.values()) {
      module.dispose();
    }
    this.modules.clear();
    this.context.events.clear();
  }

  private readonly handleAnimationFrame = (nowMs: number): void => {
    if (this.disposed || this.animationHandle === null) {
      return;
    }
    this.stepFrame(nowMs);
    if (this.disposed || this.animationHandle === null) {
      return;
    }
    this.animationHandle = this.scheduler.request(this.handleAnimationFrame);
  };

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('SimulationEngine has been disposed.');
    }
  }
}

function createBrowserAnimationScheduler(): AnimationScheduler {
  if (
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function' ||
    typeof window.cancelAnimationFrame !== 'function'
  ) {
    throw new Error('SimulationEngine requires an animation scheduler outside a browser.');
  }
  return {
    now: () => performance.now(),
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}
