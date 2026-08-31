import {
  SPACE_OBJECT_WORKER_FAILURE,
  isSpaceObjectWorkerResponse,
  type SpaceObjectWorkerRequest,
  type SpaceObjectWorkerResultResponse,
} from './SpaceObjectWorkerProtocol';

interface PendingSample {
  readonly resolve: (value: SpaceObjectWorkerResultResponse) => void;
  readonly reject: (reason: Error) => void;
}

export function createSpaceObjectPropagationWorker(): Worker {
  return new Worker(new URL('./spaceObjectPropagation.worker.ts', import.meta.url), {
    type: 'module',
    name: 'iom-space-object-propagation',
  });
}

/** One-request-at-a-time client for deterministic render-frame sampling. */
export class SpaceObjectWorkerClient {
  readonly #worker: Worker;
  readonly #pending = new Map<string, PendingSample>();
  #nextRequestNumber = 1;
  #disposed = false;
  #terminalError: Error | null = null;

  public constructor(worker: Worker = createSpaceObjectPropagationWorker()) {
    this.#worker = worker;
    this.#worker.addEventListener('message', this.#onMessage);
    this.#worker.addEventListener('error', this.#onError);
    this.#worker.addEventListener('messageerror', this.#onMessageError);
  }

  public sample(
    jdTdb: number,
    options: Pick<SpaceObjectWorkerRequest, 'earthSatelliteIds' | 'spacecraftIds'> = {},
  ): Promise<SpaceObjectWorkerResultResponse> {
    if (!Number.isFinite(jdTdb)) return Promise.reject(new RangeError('Space-object epoch must be finite.'));
    if (this.#terminalError !== null) return Promise.reject(this.#terminalError);
    if (this.#disposed) return Promise.reject(new Error('Space-object worker client is disposed.'));
    const request: SpaceObjectWorkerRequest = {
      type: 'space-objects/sample',
      requestId: `space-objects-${this.#nextRequestNumber++}`,
      jdTdb,
      ...options,
    };
    return new Promise((resolve, reject) => {
      this.#pending.set(request.requestId, { resolve, reject });
      try {
        this.#worker.postMessage(request);
      } catch (error) {
        this.#pending.delete(request.requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#terminate(new Error('Space-object worker client was disposed.'));
  }

  readonly #onMessage = (event: MessageEvent<unknown>): void => {
    if (!isSpaceObjectWorkerResponse(event.data)) return;
    const pending = this.#pending.get(event.data.requestId);
    if (pending === undefined) return;
    this.#pending.delete(event.data.requestId);
    if (event.data.type === SPACE_OBJECT_WORKER_FAILURE) {
      pending.reject(Object.assign(new Error(event.data.error.message), { name: event.data.error.name }));
      return;
    }
    pending.resolve(event.data);
  };

  readonly #onError = (event: ErrorEvent): void => this.#terminate(new Error(event.message || 'Space-object worker failed.'));
  readonly #onMessageError = (): void => this.#terminate(new Error('Space-object worker returned an unreadable message.'));

  #terminate(error: Error): void {
    if (this.#terminalError !== null) return;
    this.#terminalError = error;
    this.#worker.removeEventListener('message', this.#onMessage);
    this.#worker.removeEventListener('error', this.#onError);
    this.#worker.removeEventListener('messageerror', this.#onMessageError);
    this.#worker.terminate();
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
