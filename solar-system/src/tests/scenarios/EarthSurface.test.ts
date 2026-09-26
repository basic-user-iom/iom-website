import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeEarthSurface } from '../../simulation/scenarios/impact/EarthSurface';
import { DEFAULT_IMPACT_PARAMETERS } from '../../simulation/scenarios/impact/ImpactConfiguration';
import { simulateImpactEntry, deriveImpactVisualProfile } from '../../simulation/scenarios/impact/ImpactPhysics';
const bytes = gunzipSync(readFileSync('public/assets/impact/earth-etopo1-5min.bin.gz'));
const sample = decodeEarthSurface(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
describe('measured Earth terrain and ocean impacts', () => {
  it('matches the recorded terrain asset checksum', () => {
    const metadata = JSON.parse(readFileSync('public/assets/impact/earth-etopo1-5min.json', 'utf8'));
    expect(createHash('sha256').update(readFileSync('public/assets/impact/earth-etopo1-5min.bin.gz')).digest('hex')).toBe(metadata.sha256);
  });
  it('distinguishes deep ocean, mountains, and enclosed below-sea-level land', () => {
    expect(sample(20, -30)).toMatchObject({ kind: 'ocean', surfaceAltitudeM: 0 });
    expect(sample(20, -30).waterDepthM).toBeGreaterThan(3000);
    expect(sample(30, 90).surfaceAltitudeM).toBeGreaterThan(3000);
    expect(sample(30, 90).kind).toBe('land');
    expect(sample(36.25, -116.8).kind).toBe('land');
  });
  it('wraps longitude and samples poles without gaps or NaNs', () => {
    expect(sample(0, 180)).toEqual(sample(0, -180));
    expect(sample(0, 540)).toEqual(sample(0, -180));
    for (const lat of [-90, 90]) for (const lon of [-180, 0, 180]) expect(Number.isFinite(sample(lat, lon).elevationM)).toBe(true);
    expect(() => sample(NaN, 0)).toThrow();
  });
  it('stops at mountain elevation, before the sea-level sphere', () => {
    const params = { ...DEFAULT_IMPACT_PARAMETERS, diameterM: 140, entryAngleDeg: 90, impactLatitudeDeg: 30, impactLongitudeDeg: 90 };
    const terrain = simulateImpactEntry(params, sample), flat = simulateImpactEntry(params, null);
    expect(terrain.physicalSummary.outcomeKind).toBe('solid-surface-impact');
    expect(terrain.terminalEventTimeSeconds).toBeLessThan(flat.terminalEventTimeSeconds);
    expect(terrain.samples.at(-1)!.altitudeM).toBeCloseTo(terrain.physicalSummary.earthSurface!.surfaceAltitudeM, 3);
    expect(terrain.samples.at(-1)!.positionEnuM.z).toBeCloseTo(terrain.physicalSummary.earthSurface!.surfaceAltitudeM, 3);
  });
  it('uses water entry with no crater, scorch, rock ejecta, or ground shockwave', () => {
    const result = simulateImpactEntry({ ...DEFAULT_IMPACT_PARAMETERS, diameterM: 140, entryAngleDeg: 90, impactLatitudeDeg: 20, impactLongitudeDeg: -30 }, sample);
    expect(result.physicalSummary.outcomeKind).toBe('ocean-surface-impact');
    expect(result.physicalSummary.impactEnergyJ).toBeGreaterThan(0);
    expect(result.samples.at(-1)!.altitudeM).toBeCloseTo(0, 3);
    const visual = deriveImpactVisualProfile(result.physicalSummary);
    for (const key of ['craterRadiusM', 'craterDepthM', 'scorchRadiusM', 'ejectaRadiusM', 'groundShockwaveSpeedMps'] as const) expect(visual[key]).toBe(0);
    expect(visual.plumeHeightM).toBeGreaterThan(0);
  });
  it('keeps an airburst above water airborne and leaves other planets unchanged', () => {
    const air = simulateImpactEntry({ ...DEFAULT_IMPACT_PARAMETERS, diameterM: 20, impactLatitudeDeg: 20, impactLongitudeDeg: -30 }, sample);
    expect(air.physicalSummary.outcomeKind).toBe('airburst');
    expect(air.physicalSummary.earthSurface?.kind).toBe('ocean');
    const moon = { ...DEFAULT_IMPACT_PARAMETERS, targetBodyId: 'moon' as const };
    expect(simulateImpactEntry(moon, sample)).toEqual(simulateImpactEntry(moon, null));
  });
});
