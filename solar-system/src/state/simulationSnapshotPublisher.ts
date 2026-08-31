import type { SimulationUiSnapshot } from './useAppStore';

export type SimulationSnapshotDraft = Omit<
  SimulationUiSnapshot,
  'sequence' | 'publishedAtMs'
>;

export interface SimulationSnapshotPublisher {
  publish(snapshot: SimulationSnapshotDraft, force?: boolean): boolean;
  reset(): void;
}
export interface SimulationSnapshotPublisherOptions {
  readonly publish: (snapshot: Readonly<SimulationUiSnapshot>) => void;
  readonly intervalMs?: number;
  readonly now?: () => number;
}

/**
 * Bridges the high-frequency engine loop to React state at a bounded cadence.
 * Body transforms deliberately do not cross this bridge.
 */
export function createSimulationSnapshotPublisher({
  publish,
  intervalMs = 100,
  now = () => performance.now(),
}: SimulationSnapshotPublisherOptions): SimulationSnapshotPublisher {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new RangeError('Snapshot interval must be a finite positive number.');
  }

  let lastPublishedAtMs = Number.NEGATIVE_INFINITY;
  let sequence = 0;

  return {
    publish(snapshot, force = false): boolean {
      const publishedAtMs = now();
      if (!force && publishedAtMs - lastPublishedAtMs < intervalMs) {
        return false;
      }

      lastPublishedAtMs = publishedAtMs;
      sequence += 1;
      publish(
        Object.freeze({
          ...snapshot,
          sequence,
          publishedAtMs,
        }),
      );
      return true;
    },

    reset(): void {
      lastPublishedAtMs = Number.NEGATIVE_INFINITY;
      sequence = 0;
    },
  };
}
