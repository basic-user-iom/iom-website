import type {
  BlackHoleKernelAdvanceResult,
  BlackHoleKernelConfiguration,
} from '../../simulation/scenarios/black-hole/BlackHolePhysicsKernel';
import type {
  BlackHoleCapturedInitialState,
  ExternalBlackHoleInitialConditions,
} from '../../simulation/scenarios/black-hole/BlackHoleTypes';
import {
  BLACK_HOLE_WORKER_ADVANCE,
  BLACK_HOLE_WORKER_FAILURE,
  BLACK_HOLE_WORKER_INITIALIZE,
  BLACK_HOLE_WORKER_RESET,
  BLACK_HOLE_WORKER_RESET_COMPLETE,
  BLACK_HOLE_WORKER_RESULT,
  blackHoleInitializeTransferables,
  type BlackHoleWorkerInitializeRequest,
  type BlackHoleWorkerRequest,
  type BlackHoleWorkerResponse,
} from './BlackHoleWorkerProtocol';

interface PendingResult {
  readonly resolve: (result: BlackHoleKernelAdvanceResult | undefined) => void;
  readonly reject: (error: Error) => void;
}

export function createBlackHolePhysicsWorker(): Worker {
  return new Worker(new URL('./blackHolePhysics.worker.ts', import.meta.url), {
    type: 'module',
    name: 'iom-black-hole-physics',
  });
}

/** One-request-at-a-time client; scenarios enforce deterministic queue order. */
export class BlackHoleWorkerClient {
  readonly #worker: Worker;
  readonly #pending = new Map<string, PendingResult>();
  #nextRequestNumber = 1;
  #disposed = false;
  #terminalError: Error | null = null;

  public constructor(worker: Worker = createBlackHolePhysicsWorker()) {
    this.#worker = worker;
    this.#worker.addEventListener('message', this.#onMessage);
    this.#worker.addEventListener('error', this.#onWorkerError);
    this.#worker.addEventListener('messageerror', this.#onMessageError);
  }

  public initialize(
    runId: string,
    initialState: BlackHoleCapturedInitialState,
    blackHole: ExternalBlackHoleInitialConditions,
    configuration: BlackHoleKernelConfiguration,
  ): Promise<BlackHoleKernelAdvanceResult> {
    const request: BlackHoleWorkerInitializeRequest = {
      type: BLACK_HOLE_WORKER_INITIALIZE,
      requestId: this.#nextRequestId(),
      runId,
      initialState: {
        bodyIds: [...initialState.bodyIds],
        positionsM: initialState.positionsM.slice(),
        velocitiesMps: initialState.velocitiesMps.slice(),
        massesKg: initialState.massesKg.slice(),
        radiiM: initialState.radiiM.slice(),
      },
      blackHole,
      configuration,
    };
    return this.#postResult(request, blackHoleInitializeTransferables(request));
  }

  public advance(
    runId: string,
    physicalTickSeconds: number,
    tickCount: number,
  ): Promise<BlackHoleKernelAdvanceResult> {
    return this.#postResult({
      type: BLACK_HOLE_WORKER_ADVANCE,
      requestId: this.#nextRequestId(),
      runId,
      physicalTickSeconds,
      tickCount,
    });
  }

  public async reset(runId: string): Promise<void> {
    await this.#post({
      type: BLACK_HOLE_WORKER_RESET,
      requestId: this.#nextRequestId(),
      runId,
    });
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#terminate(new Error('Black-hole worker client was disposed.'));
  }

  #postResult(
    message: BlackHoleWorkerRequest,
    transfer?: readonly Transferable[],
  ): Promise<BlackHoleKernelAdvanceResult> {
    return this.#post(message, transfer).then((result) => {
      if (result === undefined) throw new Error('Black-hole worker returned no result.');
      return result;
    });
  }

  #post(
    message: BlackHoleWorkerRequest,
    transfer?: readonly Transferable[],
  ): Promise<BlackHoleKernelAdvanceResult | undefined> {
    if (this.#terminalError !== null) {
      return Promise.reject(this.#terminalError);
    }
    if (this.#disposed) {
      return Promise.reject(new Error('Black-hole worker client is disposed.'));
    }
    return new Promise((resolve, reject) => {
      this.#pending.set(message.requestId, { resolve, reject });
      try {
        this.#worker.postMessage(message, transfer === undefined ? [] : [...transfer]);
      } catch (error) {
        this.#pending.delete(message.requestId);
        reject(asError(error));
      }
    });
  }

  #nextRequestId(): string {
    const requestId = `black-hole-${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return requestId;
  }

  readonly #onMessage = (event: MessageEvent<unknown>): void => {
    if (!isResponse(event.data)) return;
    const pending = this.#pending.get(event.data.requestId);
    if (pending === undefined) return;
    this.#pending.delete(event.data.requestId);
    if (event.data.type === BLACK_HOLE_WORKER_FAILURE) {
      const error = new Error(event.data.error.message);
      error.name = event.data.error.name;
      pending.reject(error);
      return;
    }
    pending.resolve(
      event.data.type === BLACK_HOLE_WORKER_RESULT ? event.data.result : undefined,
    );
  };

  readonly #onWorkerError = (event: ErrorEvent): void => {
    this.#failTerminally(
      new Error(event.message || 'Black-hole physics worker failed.'),
    );
  };

  readonly #onMessageError = (): void => {
    this.#failTerminally(
      new Error('Black-hole physics worker returned an unreadable message.'),
    );
  };

  #failTerminally(error: Error): void {
    if (this.#terminalError !== null) return;
    this.#disposed = true;
    this.#terminate(error);
  }

  #terminate(error: Error): void {
    this.#terminalError = error;
    this.#worker.removeEventListener('message', this.#onMessage);
    this.#worker.removeEventListener('error', this.#onWorkerError);
    this.#worker.removeEventListener('messageerror', this.#onMessageError);
    this.#worker.terminate();
    this.#rejectAll(error);
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}

function isResponse(value: unknown): value is BlackHoleWorkerResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BlackHoleWorkerResponse>;
  return typeof candidate.requestId === 'string' &&
    typeof candidate.runId === 'string' &&
    (candidate.type === BLACK_HOLE_WORKER_RESULT ||
      candidate.type === BLACK_HOLE_WORKER_RESET_COMPLETE ||
      candidate.type === BLACK_HOLE_WORKER_FAILURE);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
