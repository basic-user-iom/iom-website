import { SpaceObjectWorkerRuntime } from './SpaceObjectWorkerRuntime';
import type { SpaceObjectWorkerResponse } from './SpaceObjectWorkerProtocol';

interface SpaceObjectWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: SpaceObjectWorkerResponse): void;
}

const scope = globalThis as unknown as SpaceObjectWorkerScope;
const runtime = new SpaceObjectWorkerRuntime();
scope.addEventListener('message', (event) => scope.postMessage(runtime.handle(event.data)));
