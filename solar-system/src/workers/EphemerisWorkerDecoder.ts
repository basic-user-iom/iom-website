import { decodeEphemerisBinary } from '../simulation/ephemeris/EphemerisBinary';
import {
  EPHEMERIS_DECODE_FAILURE,
  EPHEMERIS_DECODE_SUCCESS,
  isEphemerisDecodeRequest,
  type EphemerisDecodeResponse,
} from './EphemerisWorkerProtocol';

/** Pure message handler, kept independently testable from the Worker global. */
export function decodeEphemerisWorkerMessage(message: unknown): EphemerisDecodeResponse {
  if (!isEphemerisDecodeRequest(message)) {
    return {
      type: EPHEMERIS_DECODE_FAILURE,
      requestId: readRequestId(message),
      error: {
        name: 'TypeError',
        message: 'Invalid ephemeris decode worker request.',
      },
    };
  }

  try {
    return {
      type: EPHEMERIS_DECODE_SUCCESS,
      requestId: message.requestId,
      dataset: decodeEphemerisBinary(message.buffer),
    };
  } catch (error) {
    return {
      type: EPHEMERIS_DECODE_FAILURE,
      requestId: message.requestId,
      error: serializeError(error),
    };
  }
}

/** Returns each backing buffer once so a worker can transfer rather than copy it. */
export function ephemerisResponseTransferables(
  response: EphemerisDecodeResponse,
): readonly ArrayBuffer[] {
  if (response.type !== EPHEMERIS_DECODE_SUCCESS) {
    return [];
  }
  const buffers = new Set<ArrayBuffer>();
  for (const body of response.dataset.bodies) {
    if (body.samples.buffer instanceof ArrayBuffer) {
      buffers.add(body.samples.buffer);
    }
  }
  return [...buffers];
}

function readRequestId(message: unknown): string {
  if (typeof message !== 'object' || message === null || !('requestId' in message)) {
    return 'invalid-request';
  }
  const requestId = (message as { readonly requestId?: unknown }).requestId;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : 'invalid-request';
}

function serializeError(error: unknown): { readonly name: string; readonly message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Error', message: String(error) };
}
