import type { DataProvenance } from '../bodies/DataProvenance';
import type { EphemerisProvider } from './EphemerisProvider';
import type { EphemerisCoverage, EphemerisStateVector } from './EphemerisTypes';

/**
 * Explicit extension point for a future, separately sourced analytical model.
 * A generated provider never invokes this interface implicitly.
 */
export interface KeplerFallbackProvider extends EphemerisProvider {
  readonly providerKind: 'KEPLER_FALLBACK';
}

export class KeplerFallbackUnavailableError extends Error {
  override readonly name = 'KeplerFallbackUnavailableError';

  constructor(bodyId: string) {
    super(
      `No validated Kepler fallback elements are configured for body "${bodyId}". ` +
        'Generated ephemeris coverage was not replaced with synthetic data.',
    );
  }
}

/** Safe default stub: it advertises no bodies and cannot manufacture states. */
export class DisabledKeplerFallbackProvider implements KeplerFallbackProvider {
  readonly id = 'kepler-fallback-disabled';
  readonly providerKind = 'KEPLER_FALLBACK' as const;
  readonly bodyIds: readonly string[] = Object.freeze([]);

  hasBody(bodyId: string): boolean {
    void bodyId;
    return false;
  }

  getCoverage(bodyId: string): EphemerisCoverage | undefined {
    void bodyId;
    return undefined;
  }

  getProvenance(bodyId: string): DataProvenance | undefined {
    void bodyId;
    return undefined;
  }

  sample(bodyId: string, jdTdb: number, out: EphemerisStateVector): EphemerisStateVector {
    void jdTdb;
    void out;
    throw new KeplerFallbackUnavailableError(bodyId);
  }
}
