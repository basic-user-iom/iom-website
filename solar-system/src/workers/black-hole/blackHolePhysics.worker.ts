import {
  blackHoleResponseTransferables,
} from './BlackHoleWorkerProtocol';
import { BlackHoleWorkerRuntime } from './BlackHoleWorkerRuntime';

interface BlackHoleWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  postMessage(message: unknown, transfer: readonly Transferable[]): void;
}

const workerScope = globalThis as unknown as BlackHoleWorkerScope;
const runtime = new BlackHoleWorkerRuntime();

workerScope.addEventListener('message', (event) => {
  const response = runtime.handle(event.data);
  workerScope.postMessage(response, blackHoleResponseTransferables(response));
});
