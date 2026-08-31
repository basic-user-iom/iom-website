import type { SimulationContext } from '../core/SimulationContext';
import type { SimulationModule } from '../modules/SimulationModule';

export type ScenarioPlaybackState = 'idle' | 'running' | 'paused' | 'complete';

export type ScenarioClassification =
  | 'scientific'
  | 'educational-approximation'
  | 'cinematic';

export type ScenarioUnsubscribe = () => void;

/**
 * Non-generic controls retained by ScenarioManager after a typed scenario has
 * been started. Scenario time is deliberately driven by real display time,
 * never by the observatory ephemeris clock.
 */
export interface ScenarioRuntimeControl extends SimulationModule {
  readonly classification: ScenarioClassification;
  readonly destructive: boolean;
  readonly state: ScenarioPlaybackState;
  advance(realDeltaSeconds: number): void;
  pause(): void;
  resume(): void;
  frameStep(stepSeconds?: number): void;
  replay(): void;
  reset(context?: SimulationContext): void;
}

/** Typed scenario contract. High-frequency state remains inside the module. */
export interface ScenarioModule<Parameters, Snapshot>
  extends ScenarioRuntimeControl {
  start(parameters: Readonly<Parameters>): Promise<void> | void;
  getSnapshot(): Readonly<Snapshot>;
  serializeParameters(): string | null;
  subscribe(listener: (snapshot: Readonly<Snapshot>) => void): ScenarioUnsubscribe;
}
