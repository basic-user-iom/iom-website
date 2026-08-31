import {
  decodeEphemerisWorkerMessage,
  ephemerisResponseTransferables,
} from './EphemerisWorkerDecoder';

interface EphemerisWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  postMessage(message: unknown, transfer: readonly Transferable[]): void;
}

const workerScope = globalThis as unknown as EphemerisWorkerScope;

workerScope.addEventListener('message', (event) => {
  const response = decodeEphemerisWorkerMessage(event.data);
  workerScope.postMessage(response, ephemerisResponseTransferables(response));
});
