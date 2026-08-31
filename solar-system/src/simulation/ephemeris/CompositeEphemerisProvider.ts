import type { DataProvenance } from '../bodies/DataProvenance';
import { EphemerisBodyNotFoundError } from './EphemerisErrors';
import type { EphemerisProvider } from './EphemerisProvider';
import type { EphemerisCoverage, EphemerisStateVector } from './EphemerisTypes';

/** Routes disjoint body catalogs without weakening either provider's validation. */
export class CompositeEphemerisProvider implements EphemerisProvider {
  public readonly id: string;
  public readonly bodyIds: readonly string[];
  readonly #providerByBody = new Map<string, EphemerisProvider>();

  public constructor(public readonly providers: readonly EphemerisProvider[]) {
    if (providers.length === 0) throw new Error('Composite ephemeris requires a provider.');
    for (const provider of providers) {
      for (const bodyId of provider.bodyIds) {
        const existing = this.#providerByBody.get(bodyId);
        if (existing !== undefined) {
          throw new Error(
            `Ephemeris body "${bodyId}" is supplied by both "${existing.id}" and "${provider.id}".`,
          );
        }
        this.#providerByBody.set(bodyId, provider);
      }
    }
    this.bodyIds = Object.freeze([...this.#providerByBody.keys()]);
    this.id = `composite:${providers.map((provider) => provider.id).join('+')}`;
  }

  public hasBody(bodyId: string): boolean {
    return this.#providerByBody.has(bodyId);
  }

  public getCoverage(bodyId: string): EphemerisCoverage | undefined {
    return this.#providerByBody.get(bodyId)?.getCoverage(bodyId);
  }

  public getProvenance(bodyId: string): DataProvenance | undefined {
    return this.#providerByBody.get(bodyId)?.getProvenance(bodyId);
  }

  public sample(
    bodyId: string,
    jdTdb: number,
    out: EphemerisStateVector,
  ): EphemerisStateVector {
    const provider = this.#providerByBody.get(bodyId);
    if (provider === undefined) throw new EphemerisBodyNotFoundError(bodyId);
    return provider.sample(bodyId, jdTdb, out);
  }
}
