import {
  createJetProfileTexture,
  createRingProfileTexture,
} from '../../rendering/bodies/GiantPlanetMaterials';
import {
  GIANT_PLANET_IDS,
  GIANT_PLANET_VISUAL_CATALOG,
  getGiantAtmosphereProfile,
  getRingSystemProfile,
  sampleDatedStormState,
  sampleGreatRedSpotState,
  sampleJetSpeedMps,
  sampleRingProfile,
} from '../../rendering/bodies/GiantPlanetProfiles';

interface ByteTextureImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

describe('Phase 5 giant-planet scientific profiles', () => {
  it('exposes a frozen, versioned profile for every giant planet', () => {
    expect(GIANT_PLANET_VISUAL_CATALOG.schemaVersion).toBe(1);
    expect(GIANT_PLANET_VISUAL_CATALOG.profileVersion).toMatch(/^2026-08-30\.phase5\./);
    expect(GIANT_PLANET_VISUAL_CATALOG.classification).toContain('not a live-weather');
    expect(Object.isFrozen(GIANT_PLANET_VISUAL_CATALOG)).toBe(true);

    for (const bodyId of GIANT_PLANET_IDS) {
      const profile = getGiantAtmosphereProfile(bodyId);
      expect(profile.bodyId).toBe(bodyId);
      expect(profile.jetSamples.at(0)?.latitudeDeg).toBe(-90);
      expect(profile.jetSamples.at(-1)?.latitudeDeg).toBe(90);
      expect(profile.jetProfileRef).toMatch(/^https:\/\//);
      expect(Object.isFrozen(profile)).toBe(true);

      const ringProfile = getRingSystemProfile(bodyId);
      if (bodyId === 'jupiter') {
        expect(ringProfile).toBeNull();
      } else {
        expect(ringProfile?.bodyId).toBe(bodyId);
        expect(ringProfile?.sourceRef).toMatch(/^https:\/\//);
        expect(ringProfile?.outerRadiusKm).toBeGreaterThan(
          ringProfile?.innerRadiusKm ?? Number.POSITIVE_INFINITY,
        );
      }
    }
  });

  it('samples the cited Jupiter and Saturn wind tables, including documented interpolation', () => {
    const jupiter = getGiantAtmosphereProfile('jupiter');
    const saturn = getGiantAtmosphereProfile('saturn');

    expect(sampleJetSpeedMps(jupiter, -6)).toBeCloseTo(134.04, 8);
    expect(sampleJetSpeedMps(jupiter, -5.5)).toBeCloseTo((134.04 + 120.63) / 2, 8);
    expect(sampleJetSpeedMps(jupiter, -100)).toBe(0);
    expect(sampleJetSpeedMps(jupiter, 100)).toBe(0);

    expect(saturn.jetInterpolationNotes).toContain('+5.5 to -6.5');
    expect(sampleJetSpeedMps(saturn, -6.5)).toBeCloseTo(371.185, 8);
    expect(sampleJetSpeedMps(saturn, 0)).toBeCloseTo(382.6325833333, 8);
    expect(sampleJetSpeedMps(saturn, 5.5)).toBeCloseTo(392.319, 8);
  });

  it('retains Saturn’s measured 1-bar oblateness without presentation exaggeration', () => {
    const saturn = getGiantAtmosphereProfile('saturn');
    expect(saturn.equatorialRadiusKm).toBe(60_268);
    expect(saturn.polarRadiusKm).toBe(54_364);
    expect(saturn.meanRadiusKm).toBe(58_232);
    expect(saturn.polarRadiusKm / saturn.equatorialRadiusKm).toBeCloseTo(
      0.90204,
      4,
    );
  });

  it('uses the analytic Uranus and Neptune wind models instead of fallback display knots', () => {
    const uranus = getGiantAtmosphereProfile('uranus');
    const neptune = getGiantAtmosphereProfile('neptune');

    expect(uranus.jetModel?.type).toBe('uranus-legendre-westward');
    expect(uranus.jetModel?.sourceRef).toBe('https://arxiv.org/pdf/1503.00592');
    const uranusEquatorMps = sampleJetSpeedMps(uranus, 0);
    expect(uranusEquatorMps).toBeGreaterThan(50);
    expect(uranusEquatorMps).toBeLessThan(65);
    expect(uranusEquatorMps).not.toBe(uranus.jetSamples.find(
      (sample) => sample.latitudeDeg === 0,
    )?.zonalWindMps);
    expect(Number.isFinite(sampleJetSpeedMps(uranus, -75))).toBe(true);
    expect(Number.isFinite(sampleJetSpeedMps(uranus, 75))).toBe(true);

    expect(neptune.jetModel?.type).toBe('neptune-voyager-polynomial-eastward');
    expect(sampleJetSpeedMps(neptune, 0)).toBeCloseTo(-389, 8);
    expect(sampleJetSpeedMps(neptune, 30)).toBeCloseTo(-229.52, 8);
    expect(sampleJetSpeedMps(neptune, -30)).toBeCloseTo(-229.52, 8);
    expect(sampleJetSpeedMps(neptune, 75)).toBeCloseTo(288.8125, 8);
    expect(sampleJetSpeedMps(neptune, 90)).toBeCloseTo(0, 8);
  });

  it('animates the GRS deterministically from its dated epoch', () => {
    const profile = getGiantAtmosphereProfile('jupiter').greatRedSpot;
    expect(profile).toBeDefined();
    if (profile === undefined) return;

    expect(profile.category).toBe('animated-visualization');
    expect(profile.centerLatitudeDeg).toBe(-22);
    expect(profile.centerLongitudeAtEpochDeg).toBe(142);
    const atEpoch = sampleGreatRedSpotState(profile, profile.epochJdTdb);
    expect(atEpoch.centerLongitudeRad).toBeCloseTo(142 * Math.PI / 180, 14);
    expect(atEpoch.vortexPhaseRad).toBe(0);
    expect(atEpoch.pulsationScale).toBe(1);

    const quarterPeriodDays = profile.pulsationPeriodDays / 4;
    const quarterEpoch = profile.epochJdTdb + quarterPeriodDays;
    const firstSample = sampleGreatRedSpotState(profile, quarterEpoch);
    const repeatedSample = sampleGreatRedSpotState(profile, quarterEpoch);
    const expectedLongitudeDeg =
      profile.centerLongitudeAtEpochDeg +
      profile.longitudinalDriftDegPerDay * quarterPeriodDays +
      profile.longitudeOscillationAmplitudeDeg;
    expect(firstSample).toEqual(repeatedSample);
    expect(firstSample.centerLongitudeRad).toBeCloseTo(
      expectedLongitudeDeg * Math.PI / 180,
      12,
    );
    expect(firstSample.pulsationScale).toBeCloseTo(1.05, 12);
    expect(firstSample.vortexPhaseRad).not.toBe(0);
    expect(Math.abs(firstSample.vortexPhaseRad)).toBeLessThanOrEqual(Math.PI);
    expect(() => sampleGreatRedSpotState(profile, Number.NaN)).toThrow(RangeError);
  });

  it('samples optical-depth regions and lets narrow gaps override broad Saturn rings', () => {
    const saturn = getRingSystemProfile('saturn');
    const uranus = getRingSystemProfile('uranus');
    const neptune = getRingSystemProfile('neptune');
    expect(saturn).not.toBeNull();
    expect(uranus).not.toBeNull();
    expect(neptune).not.toBeNull();
    if (saturn === null || uranus === null || neptune === null) return;

    expect(sampleRingProfile(saturn, 100_000)).toEqual({
      opticalDepth: 1.65,
      color: '#ddd0ae',
      featureId: 'b-ring',
    });
    expect(sampleRingProfile(saturn, 120_000).featureId).toBe('cassini-division');
    expect(sampleRingProfile(saturn, 120_000).opticalDepth).toBeCloseTo(0.055, 8);
    expect(sampleRingProfile(saturn, 133_500)).toMatchObject({
      featureId: 'encke-gap',
      opticalDepth: 0.001,
    });
    expect(sampleRingProfile(saturn, 136_500)).toMatchObject({
      featureId: 'keeler-gap',
      opticalDepth: 0.001,
    });
    expect(sampleRingProfile(saturn, 139_500)).toMatchObject({
      featureId: null,
      opticalDepth: 0,
    });

    expect(sampleRingProfile(uranus, 51_140)).toMatchObject({
      featureId: 'epsilon',
      opticalDepth: 1.2,
    });
    expect(sampleRingProfile(neptune, 62_930)).toMatchObject({
      featureId: 'adams',
      opticalDepth: 0.012,
    });
    expect(neptune.arcs).toMatchObject({
      ringId: 'adams',
      category: 'localized-ring-arc-visualization',
    });
  });

  it('encodes dense, divided, and very faint Saturn rings into the optical-depth texture', () => {
    const saturn = getRingSystemProfile('saturn');
    expect(saturn).not.toBeNull();
    if (saturn === null) return;

    const texture = createRingProfileTexture(saturn);
    const image = texture.image as ByteTextureImage;
    expect(image).toMatchObject({ width: 4_096, height: 1 });
    expect(image.data).toBeInstanceOf(Uint8Array);

    const dRingAlpha = alphaAtRadius(image, saturn.innerRadiusKm, saturn.outerRadiusKm, 70_000);
    const bRingAlpha = alphaAtRadius(image, saturn.innerRadiusKm, saturn.outerRadiusKm, 100_000);
    const cassiniAlpha = alphaAtRadius(image, saturn.innerRadiusKm, saturn.outerRadiusKm, 120_000);
    const aRingAlpha = alphaAtRadius(image, saturn.innerRadiusKm, saturn.outerRadiusKm, 130_000);
    const enckeAlpha = alphaAtRadius(image, saturn.innerRadiusKm, saturn.outerRadiusKm, 133_500);

    expect(dRingAlpha).toBeGreaterThan(0);
    expect(enckeAlpha).toBeGreaterThan(dRingAlpha);
    expect(cassiniAlpha).toBeGreaterThan(enckeAlpha);
    expect(aRingAlpha).toBeGreaterThan(cassiniAlpha);
    expect(bRingAlpha).toBeGreaterThan(aRingAlpha);
    texture.dispose();
  });

  it('dates Neptune storm visibility and clamps lifecycle progress outside its interval', () => {
    const storm = getGiantAtmosphereProfile('neptune').datedStorms?.[0];
    expect(storm).toBeDefined();
    if (storm === undefined) return;

    expect(storm.category).toBe('dated-nonpermanent-visualization');
    expect(sampleDatedStormState(storm, 2_458_000).active).toBe(false);
    expect(sampleDatedStormState(storm, 2_458_000).lifetimeProgress).toBe(0);
    expect(sampleDatedStormState(storm, 2_459_000).active).toBe(true);
    expect(sampleDatedStormState(storm, 2_461_041.5).active).toBe(false);
    expect(sampleDatedStormState(storm, 2_461_041.5).lifetimeProgress).toBe(1);

    const midpoint = (storm.activeStartJdTdb + storm.activeEndJdTdb) / 2;
    expect(sampleDatedStormState(storm, midpoint)).toMatchObject({
      active: true,
      lifetimeProgress: 0.5,
    });
    expect(sampleDatedStormState(storm, midpoint)).toEqual(
      sampleDatedStormState(storm, midpoint),
    );
  });

  it('encodes analytic wind direction and magnitude in a fixed-width jet texture', () => {
    const neptune = getGiantAtmosphereProfile('neptune');
    const texture = createJetProfileTexture(neptune);
    const image = texture.image as ByteTextureImage;
    expect(image).toMatchObject({ width: 256, height: 1 });
    expect(image.data).toHaveLength(256 * 4);

    const equatorOffset = Math.round((256 - 1) / 2) * 4;
    expect(image.data[equatorOffset]).toBeLessThan(128);
    expect(image.data[equatorOffset + 2]).toBe(0);
    expect(image.data[equatorOffset + 3]).toBe(255);
    texture.dispose();
  });
});

function alphaAtRadius(
  image: ByteTextureImage,
  innerRadiusKm: number,
  outerRadiusKm: number,
  radiusKm: number,
): number {
  const normalizedRadius = (radiusKm - innerRadiusKm) / (outerRadiusKm - innerRadiusKm);
  const pixelIndex = Math.max(
    0,
    Math.min(image.width - 1, Math.floor(normalizedRadius * image.width)),
  );
  return image.data[pixelIndex * 4 + 3] ?? 0;
}
