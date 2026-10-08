import type { EphemerisProvider } from '../simulation/ephemeris/EphemerisProvider';
import type { EphemerisStateVector } from '../simulation/ephemeris/EphemerisTypes';

/** Wider coverage for orbit lines only. Live positions always use the original
 * provider, including every sample inside its existing coverage. */
export class OrbitDisplayProvider implements EphemerisProvider {
  readonly id: string;
  readonly bodyIds: readonly string[];
  constructor(private readonly live: EphemerisProvider, private readonly extension: EphemerisProvider) {
    this.id = `orbit-display:${live.id}+${extension.id}`;
    this.bodyIds = live.bodyIds;
  }
  hasBody(id: string): boolean { return this.live.hasBody(id); }
  getCoverage(id: string) { return this.extension.getCoverage(id) ?? this.live.getCoverage(id); }
  getProvenance(id: string) { return this.extension.getProvenance(id) ?? this.live.getProvenance(id); }
  sample(id: string, jd: number, out: EphemerisStateVector): EphemerisStateVector {
    const coverage = this.live.getCoverage(id);
    if (coverage && jd >= coverage.startJdTdb && jd <= coverage.endJdTdb) {
      return this.live.sample(id, jd, out);
    }
    return (this.extension.hasBody(id) ? this.extension : this.live).sample(id, jd, out);
  }
}
