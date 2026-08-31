import type { BodyRuntimeState } from '../bodies/BodyRuntimeState';
import { EventBus } from './EventBus';
import type { FloatingOrigin } from './FloatingOrigin';
import type { SimulationClock } from './SimulationClock';
import { createVec3d, type Vec3d } from './Vec3d';

export interface SimulationEvents {
  readonly originRebased: {
    readonly originM: Readonly<Vec3d>;
    readonly revision: number;
  };
  readonly bodyVisibilityChanged: {
    readonly bodyId: string;
    readonly visible: boolean;
  };
}

export interface SimulationContextOptions {
  readonly clock: SimulationClock;
  readonly floatingOrigin: FloatingOrigin;
  readonly bodies?: Iterable<readonly [string, BodyRuntimeState]>;
  readonly events?: EventBus<SimulationEvents>;
}

/** Explicit dependency container; no simulation subsystem reads hidden globals. */
export class SimulationContext {
  public readonly clock: SimulationClock;
  public readonly floatingOrigin: FloatingOrigin;
  public readonly bodies: Map<string, BodyRuntimeState>;
  public readonly events: EventBus<SimulationEvents>;
  private readonly rebaseDeltaM = createVec3d();

  public constructor(options: SimulationContextOptions) {
    this.clock = options.clock;
    this.floatingOrigin = options.floatingOrigin;
    this.bodies = new Map(options.bodies);
    this.events = options.events ?? new EventBus<SimulationEvents>();
  }

  public getBody(bodyId: string): BodyRuntimeState | undefined {
    return this.bodies.get(bodyId);
  }

  public setBodyVisible(bodyId: string, visible: boolean): boolean {
    const body = this.bodies.get(bodyId);
    if (body === undefined || body.visible === visible) {
      return false;
    }
    body.visible = visible;
    this.events.emit('bodyVisibilityChanged', { bodyId, visible });
    return true;
  }

  public rebaseOriginTo(positionM: Readonly<Vec3d>): boolean {
    const changed = this.floatingOrigin.rebaseTo(positionM, this.rebaseDeltaM);
    if (!changed) {
      return false;
    }
    const snapshot = this.floatingOrigin.snapshot();
    this.events.emit('originRebased', snapshot);
    return true;
  }

  public synchronizeBodyTimes(): void {
    for (const body of this.bodies.values()) {
      body.jdTdb = this.clock.currentJdTdb;
    }
  }
}
