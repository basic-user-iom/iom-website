import { downloadBinary, StartupProgressTracker, type StartupProgress } from '../../app/StartupProgress';

describe('startup progress', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('counts streamed bytes and reconstructs the exact payload for hash validation', async () => {
    const updates: number[] = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(c) {
      c.enqueue(new Uint8Array([1, 2])); c.enqueue(new Uint8Array([3, 4, 5])); c.close();
    } }), { headers: { 'content-length': '5' } })));
    const result = await downloadBinary('/orbits.bin', new AbortController().signal, p => updates.push(p.loaded));
    expect([...new Uint8Array(result)]).toEqual([1, 2, 3, 4, 5]);
    expect(updates).toEqual([0, 2, 5, 5]);
  });
  it('does not confuse compressed and decoded byte counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(10), {
      headers: { 'content-length': '2', 'content-encoding': 'gzip' },
    })));
    const updates: Array<{total: number | null; complete: boolean}> = [];
    await downloadBinary('/orbits.bin', new AbortController().signal, p => updates.push(p));
    expect(updates.slice(0, -1).every(p => p.total === null)).toBe(true);
    expect(updates.at(-1)).toMatchObject({ total: 10, complete: true });
  });
  it('rejects unsuccessful responses without reporting completion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const report = vi.fn();
    await expect(downloadBinary('/orbits.bin', new AbortController().signal, report)).rejects.toThrow('503');
    expect(report).not.toHaveBeenCalled();
  });
  it('honors cancellation without reporting completion', async () => {
    const abort = new AbortController(); abort.abort();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]))));
    const report = vi.fn();
    await expect(downloadBinary('/orbits.bin', abort.signal, report)).rejects.toThrow();
    expect(report.mock.calls.every(([p]) => !p.complete)).toBe(true);
  });
  it('stays monotonic with interleaved validation, reserving 100 percent for the first view', () => {
    const states: StartupProgress[] = [];
    const tracker = new StartupProgressTracker(p => states.push(p));
    tracker.download(0, { loaded: 10, total: 10, complete: true }); tracker.checkpoint('Verified');
    tracker.download(1, { loaded: 5, total: 10, complete: false }); tracker.checkpoint('Decoded');
    tracker.download(1, { loaded: 10, total: 10, complete: true });
    tracker.checkpoint('Verified'); tracker.checkpoint('Decoded');
    expect(states.every((p, i) => i === 0 || p.percent >= states[i - 1]!.percent)).toBe(true);
    expect(states.at(-1)).toMatchObject({ percent: 95, loadedBytes: 20 });
  });
});
