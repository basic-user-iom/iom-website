import type { GeneratedEphemerisManifest } from './EphemerisTypes';

export interface SmallBodyValidationIdentity {
  readonly schemaVersion: 1;
  readonly passed: true;
  readonly structuralPassed: true;
  readonly independentValidationPerformed: true;
  readonly datasetId: string;
  readonly binarySha256: string;
  readonly routingSha256: string;
}

/**
 * Integrity-binds the independently fetched comet manifest, binary validation
 * report, and logical-to-physical segment routing before runtime composition.
 */
export async function verifySmallBodyBundleIntegrity(
  manifest: Pick<GeneratedEphemerisManifest, 'datasetId' | 'binarySha256'>,
  validationValue: unknown,
  routingValue: unknown,
): Promise<Readonly<SmallBodyValidationIdentity>> {
  const validation = parseSmallBodyValidationIdentity(validationValue);
  if (validation.datasetId !== manifest.datasetId) {
    throw new Error('Small-body validation datasetId does not match its manifest.');
  }
  if (validation.binarySha256 !== manifest.binarySha256) {
    throw new Error('Small-body validation binary SHA-256 does not match its manifest.');
  }
  const actualRoutingSha256 = await canonicalJsonSha256(routingValue);
  if (actualRoutingSha256 !== validation.routingSha256) {
    throw new Error('Small-body segment routing does not match its validation SHA-256.');
  }
  return validation;
}

export function parseSmallBodyValidationIdentity(
  value: unknown,
): Readonly<SmallBodyValidationIdentity> {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error('Small-body validation must use schemaVersion 1.');
  }
  if (
    value.passed !== true ||
    value.structuralPassed !== true ||
    value.independentValidationPerformed !== true
  ) {
    throw new Error(
      'Small-body validation must pass structural and independent checks.',
    );
  }
  if (
    typeof value.datasetId !== 'string' ||
    value.datasetId.length === 0 ||
    !isSha256(value.binarySha256) ||
    !isSha256(value.routingSha256)
  ) {
    throw new Error('Small-body validation identity fields are invalid.');
  }
  return Object.freeze({
    schemaVersion: 1,
    passed: true,
    structuralPassed: true,
    independentValidationPerformed: true,
    datasetId: value.datasetId,
    binarySha256: value.binarySha256,
    routingSha256: value.routingSha256,
  });
}

/** Hashes the exact compact JSON encoding used by the offline generator. */
export async function canonicalJsonSha256(value: unknown): Promise<string> {
  const canonicalJson = JSON.stringify(value);
  if (canonicalJson === undefined) {
    throw new Error('Small-body segment routing is not JSON-serializable.');
  }
  if (globalThis.crypto?.subtle === undefined) {
    throw new Error('This browser cannot verify the small-body routing SHA-256 digest.');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}
