import type { DecodedEphemerisBinary } from '../simulation/ephemeris/EphemerisBinary';

export const EPHEMERIS_DECODE_REQUEST = 'ephemeris/decode' as const;
export const EPHEMERIS_DECODE_SUCCESS = 'ephemeris/decoded' as const;
export const EPHEMERIS_DECODE_FAILURE = 'ephemeris/decode-failed' as const;

export interface EphemerisDecodeRequest {
  readonly type: typeof EPHEMERIS_DECODE_REQUEST;
  readonly requestId: string;
  readonly buffer: ArrayBuffer;
}

export interface EphemerisDecodeSuccess {
  readonly type: typeof EPHEMERIS_DECODE_SUCCESS;
  readonly requestId: string;
  readonly dataset: DecodedEphemerisBinary;
}

export interface EphemerisDecodeFailure {
  readonly type: typeof EPHEMERIS_DECODE_FAILURE;
  readonly requestId: string;
  readonly error: {
    readonly name: string;
    readonly message: string;
  };
}

export type EphemerisDecodeResponse = EphemerisDecodeSuccess | EphemerisDecodeFailure;

export function createEphemerisDecodeRequest(
  requestId: string,
  buffer: ArrayBuffer,
): EphemerisDecodeRequest {
  if (requestId.length === 0) {
    throw new TypeError('Ephemeris worker requestId must not be empty.');
  }
  return { type: EPHEMERIS_DECODE_REQUEST, requestId, buffer };
}

export function isEphemerisDecodeRequest(value: unknown): value is EphemerisDecodeRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<EphemerisDecodeRequest>;
  return (
    candidate.type === EPHEMERIS_DECODE_REQUEST &&
    typeof candidate.requestId === 'string' &&
    candidate.requestId.length > 0 &&
    candidate.buffer instanceof ArrayBuffer
  );
}
