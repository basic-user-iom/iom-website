import { encodeEphemerisBinary } from '../../simulation/ephemeris/EphemerisBinary';
import {
  EphemerisWorkerClient,
  createEphemerisDecoder,
} from '../../workers/EphemerisWorkerClient';
import {
  decodeEphemerisWorkerMessage,
  ephemerisResponseTransferables,
} from '../../workers/EphemerisWorkerDecoder';
import {
  EPHEMERIS_DECODE_FAILURE,
  EPHEMERIS_DECODE_REQUEST,
  EPHEMERIS_DECODE_SUCCESS,
  createEphemerisDecodeRequest,
  isEphemerisDecodeRequest,
  type EphemerisDecodeRequest,
} from '../../workers/EphemerisWorkerProtocol';

function binaryFixture(): ArrayBuffer {
  return encodeEphemerisBinary([
    {
      bodyId: 'earth',
      startJdTdb: 2_451_545,
      stepSeconds: 60,
      samples: new Float64Array([
        1, 2, 3, 4, 5, 6,
        7, 8, 9, 10, 11, 12,
      ]),
    },
    {
      bodyId: 'moon',
      startJdTdb: 2_451_545,
      stepSeconds: 30,
      samples: new Float64Array([
        -1, -2, -3, -4, -5, -6,
        -7, -8, -9, -10, -11, -12,
      ]),
    },
  ]);
}

class FakeEphemerisWorker extends EventTarget {
  readonly posted: Array<{
    readonly message: unknown;
    readonly transfer: readonly Transferable[] | undefined;
  }> = [];
  terminated = false;
  autoRespond = true;

  postMessage(message: unknown, transfer?: readonly Transferable[]): void {
    this.posted.push({ message, transfer });
    if (!this.autoRespond) {
      return;
    }
    const response = decodeEphemerisWorkerMessage(message);
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent('message', { data: response }));
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  fail(message: string): void {
    this.dispatchEvent(new ErrorEvent('error', { message }));
  }
}

describe('ephemeris worker protocol and decoder', () => {
  it('creates and recognizes explicit decode requests', () => {
    const buffer = binaryFixture();
    const request = createEphemerisDecodeRequest('request-1', buffer);

    expect(request).toEqual({
      type: EPHEMERIS_DECODE_REQUEST,
      requestId: 'request-1',
      buffer,
    });
    expect(isEphemerisDecodeRequest(request)).toBe(true);
    expect(isEphemerisDecodeRequest({ ...request, requestId: '' })).toBe(false);
    expect(isEphemerisDecodeRequest({ ...request, buffer: new Uint8Array(buffer) })).toBe(false);
    expect(() => createEphemerisDecodeRequest('', buffer)).toThrow(/requestId/);
  });

  it('decodes and validates a binary into a transferable success response', () => {
    const buffer = binaryFixture();
    const response = decodeEphemerisWorkerMessage(
      createEphemerisDecodeRequest('request-2', buffer),
    );

    expect(response.type).toBe(EPHEMERIS_DECODE_SUCCESS);
    if (response.type !== EPHEMERIS_DECODE_SUCCESS) {
      throw new Error(response.error.message);
    }
    expect(response.requestId).toBe('request-2');
    expect(response.dataset.bodies.map((body) => body.bodyId)).toEqual(['earth', 'moon']);
    expect([...response.dataset.bodies[0]!.samples]).toEqual([
      1, 2, 3, 4, 5, 6,
      7, 8, 9, 10, 11, 12,
    ]);
    expect(ephemerisResponseTransferables(response)).toEqual([buffer]);
  });

  it('returns serializable failures for invalid messages and corrupt binaries', () => {
    const invalidMessage = decodeEphemerisWorkerMessage({
      type: 'different-message',
      requestId: 'bad-message',
    });
    expect(invalidMessage).toEqual({
      type: EPHEMERIS_DECODE_FAILURE,
      requestId: 'bad-message',
      error: {
        name: 'TypeError',
        message: 'Invalid ephemeris decode worker request.',
      },
    });
    expect(ephemerisResponseTransferables(invalidMessage)).toEqual([]);

    const corrupt = binaryFixture();
    new Uint8Array(corrupt)[0] = 0;
    const corruptResponse = decodeEphemerisWorkerMessage({
      type: EPHEMERIS_DECODE_REQUEST,
      requestId: 'bad-binary',
      buffer: corrupt,
    });
    expect(corruptResponse.type).toBe(EPHEMERIS_DECODE_FAILURE);
    if (corruptResponse.type !== EPHEMERIS_DECODE_FAILURE) {
      throw new Error('Expected a decode failure.');
    }
    expect(corruptResponse.error.name).toBe('EphemerisFormatError');
    expect(corruptResponse.error.message).toMatch(/magic/);
  });
});
describe('EphemerisWorkerClient', () => {
  it('loads a binary through the worker API and transfers ownership by default', async () => {
    const worker = new FakeEphemerisWorker();
    const client = new EphemerisWorkerClient(worker as unknown as Worker);
    const buffer = binaryFixture();

    const decoded = await client.decode(buffer);

    expect(decoded.bodies.map((body) => body.bodyId)).toEqual(['earth', 'moon']);
    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0]?.transfer).toEqual([buffer]);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('can retain input ownership and propagates worker decode failures', async () => {
    const worker = new FakeEphemerisWorker();
    const client = new EphemerisWorkerClient(worker as unknown as Worker);
    const corrupt = binaryFixture();
    new Uint8Array(corrupt)[0] = 0;

    await expect(client.decode(corrupt, { transferOwnership: false })).rejects.toMatchObject({
      name: 'EphemerisFormatError',
      message: expect.stringMatching(/magic/),
    });
    expect(worker.posted[0]?.transfer).toBeUndefined();
    client.dispose();
  });

  it('rejects pending and future requests after disposal', async () => {
    const worker = new FakeEphemerisWorker();
    worker.autoRespond = false;
    const client = new EphemerisWorkerClient(worker as unknown as Worker);
    const pending = client.decode(binaryFixture());

    client.dispose();

    await expect(pending).rejects.toThrow(/disposed before decoding/);
    await expect(client.decode(binaryFixture())).rejects.toThrow(/disposed/);
  });

  it('keeps independent concurrent requests correlated by requestId', async () => {
    const worker = new FakeEphemerisWorker();
    const client = new EphemerisWorkerClient(worker as unknown as Worker);

    const [first, second] = await Promise.all([
      client.decode(binaryFixture(), { transferOwnership: false }),
      client.decode(binaryFixture(), { transferOwnership: false }),
    ]);

    const requests = worker.posted.map((entry) => entry.message as EphemerisDecodeRequest);
    expect(requests.map((request) => request.requestId)).toEqual([
      'ephemeris-1',
      'ephemeris-2',
    ]);
    expect(first.bodies[0]?.bodyId).toBe('earth');
    expect(second.bodies[1]?.bodyId).toBe('moon');
    client.dispose();
  });

  it('uses the direct deterministic decoder when module-worker construction is refused', async () => {
    class RefusedEphemerisWorker {
      public constructor() {
        throw new Error('module workers blocked by policy');
      }
    }
    vi.stubGlobal('Worker', RefusedEphemerisWorker);

    const decoder = createEphemerisDecoder();
    expect(decoder.execution).toBe('direct-kernel-fallback');
    await expect(decoder.decode(binaryFixture())).resolves.toMatchObject({
      bodies: [
        { bodyId: 'earth' },
        { bodyId: 'moon' },
      ],
    });
    decoder.dispose();
    vi.unstubAllGlobals();
  });

  it('retires a fatally failed worker and rejects later requests without posting', async () => {
    const worker = new FakeEphemerisWorker();
    worker.autoRespond = false;
    const client = new EphemerisWorkerClient(worker as unknown as Worker);
    const pending = client.decode(binaryFixture(), { transferOwnership: false });
    const pendingRejection = expect(pending).rejects.toThrow('decoder crashed');

    worker.fail('decoder crashed');

    await pendingRejection;
    expect(worker.terminated).toBe(true);
    expect(worker.posted).toHaveLength(1);
    await expect(client.decode(binaryFixture())).rejects.toThrow('decoder crashed');
    expect(worker.posted).toHaveLength(1);
  });
});
