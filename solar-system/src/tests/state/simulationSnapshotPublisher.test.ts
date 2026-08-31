import { createSimulationSnapshotPublisher } from '../../state/simulationSnapshotPublisher';
import type { SimulationUiSnapshot } from '../../state/useAppStore';

const SNAPSHOT_DRAFT = {
  currentJdTdb: 2_451_545,
  currentUtcIso: '2000-01-01T12:00:00.000Z',
  paused: false,
  direction: 1 as const,
  timeScale: 60,
  dtRealSeconds: 0.016,
  dtSimSeconds: 0.96,
  originRevision: 0,
  focusedBodyId: 'sun',
  originBodyId: 'sun',
  renderFps: 60,
  documentVisible: true,
};

describe('createSimulationSnapshotPublisher', () => {
  it('publishes immutable snapshots at no more than the configured cadence', () => {
    let nowMs = 0;
    const published: Readonly<SimulationUiSnapshot>[] = [];
    const publisher = createSimulationSnapshotPublisher({
      intervalMs: 100,
      now: () => nowMs,
      publish: (snapshot) => published.push(snapshot),
    });

    expect(publisher.publish(SNAPSHOT_DRAFT)).toBe(true);
    nowMs = 99;
    expect(publisher.publish({ ...SNAPSHOT_DRAFT, currentJdTdb: 2_451_546 })).toBe(false);
    nowMs = 100;
    expect(publisher.publish({ ...SNAPSHOT_DRAFT, currentJdTdb: 2_451_547 })).toBe(true);

    expect(published).toHaveLength(2);
    expect(published[0]?.sequence).toBe(1);
    expect(published[1]?.sequence).toBe(2);
    expect(published[1]?.currentJdTdb).toBe(2_451_547);
    expect(Object.isFrozen(published[0])).toBe(true);
  });

  it('supports forced publication and a deterministic reset', () => {
    let nowMs = 5;
    const published: Readonly<SimulationUiSnapshot>[] = [];
    const publisher = createSimulationSnapshotPublisher({
      now: () => nowMs,
      publish: (snapshot) => published.push(snapshot),
    });

    publisher.publish(SNAPSHOT_DRAFT);
    publisher.publish(SNAPSHOT_DRAFT, true);
    publisher.reset();
    nowMs = 6;
    publisher.publish(SNAPSHOT_DRAFT);

    expect(published.map((snapshot) => snapshot.sequence)).toEqual([1, 2, 1]);
  });

  it('rejects a non-positive publication interval', () => {
    expect(() =>
      createSimulationSnapshotPublisher({ intervalMs: 0, publish: () => undefined }),
    ).toThrow(RangeError);
  });
});
