import type { EphemerisCoverage } from './EphemerisTypes';

export class EphemerisFormatError extends Error {
  override readonly name = 'EphemerisFormatError';

  constructor(message: string) {
    super(message);
  }
}
export class EphemerisBodyNotFoundError extends Error {
  override readonly name = 'EphemerisBodyNotFoundError';
  readonly bodyId: string;

  constructor(bodyId: string) {
    super(`No ephemeris series is available for body "${bodyId}".`);
    this.bodyId = bodyId;
  }
}

export class EphemerisOutOfRangeError extends RangeError {
  override readonly name = 'EphemerisOutOfRangeError';
  readonly bodyId: string;
  readonly requestedJdTdb: number;
  readonly coverage: EphemerisCoverage;

  constructor(bodyId: string, requestedJdTdb: number, coverage: EphemerisCoverage) {
    super(
      `Requested JD TDB ${requestedJdTdb} for "${bodyId}" is outside ` +
        `[${coverage.startJdTdb}, ${coverage.endJdTdb}].`,
    );
    this.bodyId = bodyId;
    this.requestedJdTdb = requestedJdTdb;
    this.coverage = coverage;
  }
}
