import type { DecodedEphemerisBinary } from '../simulation/ephemeris/EphemerisBinary';
import { decodeEphemerisBinary } from '../simulation/ephemeris/EphemerisBinary';
import {
  EPHEMERIS_DECODE_FAILURE,
  EPHEMERIS_DECODE_SUCCESS,
  createEphemerisDecodeRequest,
  type EphemerisDecodeResponse,
} from './EphemerisWorkerProtocol';

export interface EphemerisWorkerDecodeOptions {
  /** Defaults to true. The supplied buffer becomes detached while decoding. */
  readonly transferOwnership?: boolean;
}

export type EphemerisDecoderExecution = 'module-worker' | 'direct-kernel-fallback';

export interface EphemerisDecoder {
  readonly execution: EphemerisDecoderExecution;
  decode(
    buffer: ArrayBuffer,
    options?: EphemerisWorkerDecodeOptions,
  ): Promise<DecodedEphemerisBinary>;
  dispose(): void;
}

interface PendingDecode {
  readonly resolve: (dataset: DecodedEphemerisBinary) => void;
  readonly reject: (reason: Error) => void;
}

export function createEphemerisDecoderWorker(): Worker {
  return new Worker(new URL('./ephemerisDecoder.worker.ts', import.meta.url), {
    type: 'module',
    name: 'iom-ephemeris-decoder',
  });
}

/** Selects a deterministic direct decoder when module workers are unavailable or refused. */
export function createEphemerisDecoder(): EphemerisDecoder {
  if (typeof Worker === 'function') {
    try {
      return new EphemerisWorkerClient();
    } catch {
      return new DirectEphemerisDecoder();
    }
  }
  return new DirectEphemerisDecoder();
}

/** Concurrent request client for the module worker. */
export class EphemerisWorkerClient implements EphemerisDecoder {
  public readonly execution = 'module-worker' as const;
  readonly #worker: Worker;
  readonly #pending = new Map<string, PendingDecode>();
  #nextRequestNumber = 1;
  #disposed = false;
  #terminalError: Error | null = null;

  constructor(worker: Worker = createEphemerisDecoderWorker()) {
    this.#worker = worker;
    this.#worker.addEventListener('message', this.#onMessage);
    this.#worker.addEventListener('error', this.#onWorkerError);
    this.#worker.addEventListener('messageerror', this.#onMessageError);
  }

  decode(
    buffer: ArrayBuffer,
    options: EphemerisWorkerDecodeOptions = {},
  ): Promise<DecodedEphemerisBinary> {
    if (this.#terminalError !== null) {
      return Promise.reject(this.#terminalError);
    }
    if (this.#disposed) {
      return Promise.reject(new Error('Ephemeris worker client is disposed.'));
    }
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
      return Promise.reject(new TypeError('Ephemeris worker input must be a non-empty ArrayBuffer.'));
    }

    const requestId = `ephemeris-${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    const request = createEphemerisDecodeRequest(requestId, buffer);

    return new Promise<DecodedEphemerisBinary>((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      try {
        if (options.transferOwnership ?? true) {
          this.#worker.postMessage(request, [buffer]);
        } else {
          this.#worker.postMessage(request);
        }
      } catch (error) {
        this.#pending.delete(requestId);
        reject(asError(error));
      }
    });
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#terminate(
      new Error('Ephemeris worker client was disposed before decoding completed.'),
    );
  }

  #terminate(error: Error): void {
    this.#terminalError = error;
    this.#worker.removeEventListener('message', this.#onMessage);
    this.#worker.removeEventListener('error', this.#onWorkerError);
    this.#worker.removeEventListener('messageerror', this.#onMessageError);
    this.#worker.terminate();
    this.#rejectAll(error);
  }

  readonly #onMessage = (event: MessageEvent<unknown>): void => {
    if (!isDecodeResponse(event.data)) {
      return;
    }
    const pending = this.#pending.get(event.data.requestId);
    if (pending === undefined) {
      return;
    }
    this.#pending.delete(event.data.requestId);
    if (event.data.type === EPHEMERIS_DECODE_SUCCESS) {
      pending.resolve(event.data.dataset);
      return;
    }
    const error = new Error(event.data.error.message);
    error.name = event.data.error.name;
    pending.reject(error);
  };

  readonly #onWorkerError = (event: ErrorEvent): void => {
    this.#failTerminally(new Error(event.message || 'Ephemeris worker failed.'));
  };

  readonly #onMessageError = (): void => {
    this.#failTerminally(new Error('Ephemeris worker returned an unreadable message.'));
  };

  #failTerminally(error: Error): void {
    if (this.#terminalError !== null) return;
    this.#disposed = true;
    this.#terminate(error);
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      pending.reject(error);
    }
    this.#pending.clear();
  }
}

export class DirectEphemerisDecoder implements EphemerisDecoder {
  public readonly execution = 'direct-kernel-fallback' as const;
  private disposed = false;

  public decode(buffer: ArrayBuffer): Promise<DecodedEphemerisBinary> {
    if (this.disposed) {
      return Promise.reject(new Error('Direct ephemeris decoder is disposed.'));
    }
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
      return Promise.reject(
        new TypeError('Ephemeris decoder input must be a non-empty ArrayBuffer.'),
      );
    }
    return Promise.resolve().then(() => {
      if (this.disposed) throw new Error('Direct ephemeris decoder is disposed.');
      return decodeEphemerisBinary(buffer);
    });
  }

  public dispose(): void {
    this.disposed = true;
  }
}

function isDecodeResponse(value: unknown): value is EphemerisDecodeResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<EphemerisDecodeResponse>;
  return (
    typeof candidate.requestId === 'string' &&
    (candidate.type === EPHEMERIS_DECODE_SUCCESS || candidate.type === EPHEMERIS_DECODE_FAILURE)
  );
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
