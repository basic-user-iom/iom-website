import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

import {
  ATMOSPHERE_LUT_LIMITATIONS,
  DEFAULT_ATMOSPHERE_LUT_DIMENSIONS,
  EARTH_ATMOSPHERE_PARAMETERS,
  createAtmosphereLutBundle,
  type AtmosphereLutBundle,
  type AtmosphereLutTexture,
} from '../../rendering/bodies/AtmosphereLut';

const TEST_OPTIONS = Object.freeze({
  dimensions: Object.freeze({
    transmittanceWidth: 20,
    transmittanceHeight: 8,
    multiScatteringWidth: 12,
    multiScatteringHeight: 6,
    skyViewWidth: 20,
    skyViewHeight: 10,
  }),
  opticalDepthSamples: 8,
  singleScatteringSamples: 8,
  irradianceDirectionSamples: 4,
  skyAzimuthSamples: 2,
});

describe('Phase 4 physically based atmosphere LUT bundle', () => {
  let bundle: AtmosphereLutBundle;

  beforeAll(() => {
    bundle = createAtmosphereLutBundle(TEST_OPTIONS);
  });

  afterAll(() => {
    bundle.dispose();
  });

  it('publishes the SI Earth atmosphere contract and its scientific limits', () => {
    expect(EARTH_ATMOSPHERE_PARAMETERS.planetRadiusM).toBe(6_360_000);
    expect(EARTH_ATMOSPHERE_PARAMETERS.atmosphereRadiusM).toBe(6_420_000);
    expect(EARTH_ATMOSPHERE_PARAMETERS.sunAngularRadiusRad).toBeCloseTo(0.004675, 8);
    expect(EARTH_ATMOSPHERE_PARAMETERS.rayleighScaleHeightM).toBe(8_000);
    expect(EARTH_ATMOSPHERE_PARAMETERS.mieScaleHeightM).toBe(1_200);
    expect(EARTH_ATMOSPHERE_PARAMETERS.rayleighScatteringRgbPerM[2]).toBeGreaterThan(
      EARTH_ATMOSPHERE_PARAMETERS.rayleighScatteringRgbPerM[0],
    );
    expect(EARTH_ATMOSPHERE_PARAMETERS.mieExtinctionRgbPerM[0]).toBeGreaterThan(
      EARTH_ATMOSPHERE_PARAMETERS.mieScatteringRgbPerM[0],
    );
    expect(EARTH_ATMOSPHERE_PARAMETERS.ozoneAbsorptionRgbPerM[1]).toBeGreaterThan(
      EARTH_ATMOSPHERE_PARAMETERS.ozoneAbsorptionRgbPerM[0],
    );
    expect(ATMOSPHERE_LUT_LIMITATIONS).toEqual(
      expect.arrayContaining([
        expect.stringContaining('not the full iterative 4D scattering solution'),
        expect.stringContaining('Unsigned-byte encoding'),
      ]),
    );
  });

  it('uses portable byte textures and filterable WebGL baseline state', () => {
    expect(DEFAULT_ATMOSPHERE_LUT_DIMENSIONS).toEqual({
      transmittanceWidth: 96,
      transmittanceHeight: 32,
      multiScatteringWidth: 32,
      multiScatteringHeight: 16,
      skyViewWidth: 96,
      skyViewHeight: 48,
    });

    for (const entry of [bundle.transmittance, bundle.multiScattering, bundle.skyView]) {
      const image = textureImage(entry);
      expect(image.data).toBeInstanceOf(Uint8Array);
      expect(image.data).toHaveLength(entry.width * entry.height * 4);
      expect(entry.texture.type).toBe(UnsignedByteType);
      expect(entry.texture.format).toBe(RGBAFormat);
      expect(entry.texture.colorSpace).toBe(NoColorSpace);
      expect(entry.texture.minFilter).toBe(LinearFilter);
      expect(entry.texture.magFilter).toBe(LinearFilter);
      expect(entry.texture.wrapS).toBe(ClampToEdgeWrapping);
      expect(entry.texture.wrapT).toBe(ClampToEdgeWrapping);
      expect(entry.texture.generateMipmaps).toBe(false);
      expect(entry.texture.unpackAlignment).toBe(1);
    }
  });

  it('precomputes the production-resolution bundle without alternate GPU formats', () => {
    const production = createAtmosphereLutBundle();
    try {
      expect(production.transmittance.width).toBe(
        DEFAULT_ATMOSPHERE_LUT_DIMENSIONS.transmittanceWidth,
      );
      expect(production.multiScattering.width).toBe(
        DEFAULT_ATMOSPHERE_LUT_DIMENSIONS.multiScatteringWidth,
      );
      expect(production.skyView.height).toBe(
        DEFAULT_ATMOSPHERE_LUT_DIMENSIONS.skyViewHeight,
      );
      expect(production.skyView.texture.type).toBe(UnsignedByteType);
    } finally {
      production.dispose();
    }
  });

  it('precomputes wavelength-dependent spherical transmittance', () => {
    const groundY = 0;
    const horizonX = Math.ceil((bundle.transmittance.width - 1) / 2);
    const zenithX = bundle.transmittance.width - 1;
    const horizon = pixel(bundle.transmittance, horizonX, groundY);
    const zenith = pixel(bundle.transmittance, zenithX, groundY);
    const topZenith = pixel(
      bundle.transmittance,
      zenithX,
      bundle.transmittance.height - 1,
    );

    expect(zenith[0]).toBeGreaterThan(horizon[0]);
    expect(zenith[1]).toBeGreaterThan(horizon[1]);
    expect(zenith[2]).toBeGreaterThan(horizon[2]);
    expect(horizon[0]).toBeGreaterThan(horizon[2]);
    expect(zenith[0]).toBeGreaterThan(zenith[2]);
    expect(topZenith.slice(0, 3)).toEqual([255, 255, 255]);
    expect(bundle.transmittance.rgbEncoding.kind).toBe('linear-unit');
    expect(bundle.transmittance.alphaEncoding.semantic).toContain('optical depth');
  });

  it('applies the ozone absorption profile to the green optical channel', () => {
    const withoutOzone = createAtmosphereLutBundle({
      ...TEST_OPTIONS,
      parameters: {
        ...EARTH_ATMOSPHERE_PARAMETERS,
        ozoneAbsorptionRgbPerM: [0, 0, 0],
      },
    });
    try {
      const horizonX = Math.ceil((bundle.transmittance.width - 1) / 2);
      const withOzonePixel = pixel(bundle.transmittance, horizonX, 0);
      const withoutOzonePixel = pixel(withoutOzone.transmittance, horizonX, 0);
      expect(withOzonePixel[1]).toBeLessThan(withoutOzonePixel[1]);
    } finally {
      withoutOzone.dispose();
    }
  });

  it('separates approximate higher-order irradiance from direct-solar visibility', () => {
    const groundY = 0;
    const night = pixel(bundle.multiScattering, 0, groundY);
    const day = pixel(bundle.multiScattering, bundle.multiScattering.width - 1, groundY);
    const nightIrradiance = night[0] + night[1] + night[2];
    const dayIrradiance = day[0] + day[1] + day[2];

    expect(dayIrradiance).toBeGreaterThan(nightIrradiance);
    expect(day[3]).toBeGreaterThan(night[3]);
    expect(bundle.multiScattering.rgbEncoding.semantic).toContain(
      'second and higher scattering orders',
    );
    expect(bundle.multiScattering.alphaEncoding.semantic).toContain(
      'finite solar-disc visibility',
    );
  });

  it('encodes blue daylight and greater optical depth toward the horizon', () => {
    const daylightY = bundle.skyView.height - 1;
    const horizon = pixel(bundle.skyView, 0, daylightY);
    const zenith = pixel(bundle.skyView, bundle.skyView.width - 1, daylightY);

    expect(zenith[2]).toBeGreaterThan(zenith[0]);
    expect(horizon[3]).toBeGreaterThan(zenith[3]);
    expect(bundle.skyView.xAxis.semantic).toContain('horizon');
    expect(bundle.skyView.yAxis.semantic).toContain('solar zenith cosine');
    expect(bundle.skyView.rgbEncoding.kind).toBe('one-minus-exponential');
  });

  it('is deterministic for identical physical and sampling inputs', () => {
    const second = createAtmosphereLutBundle(TEST_OPTIONS);
    try {
      expect(textureImage(second.transmittance).data).toEqual(
        textureImage(bundle.transmittance).data,
      );
      expect(textureImage(second.multiScattering).data).toEqual(
        textureImage(bundle.multiScattering).data,
      );
      expect(textureImage(second.skyView).data).toEqual(textureImage(bundle.skyView).data);
    } finally {
      second.dispose();
    }
  });

  it('disposes all three textures exactly once', () => {
    const disposable = createAtmosphereLutBundle({
      ...TEST_OPTIONS,
      dimensions: {
        transmittanceWidth: 4,
        transmittanceHeight: 2,
        multiScatteringWidth: 4,
        multiScatteringHeight: 2,
        skyViewWidth: 4,
        skyViewHeight: 2,
      },
    });
    const disposeCounts = [0, 0, 0];
    [disposable.transmittance, disposable.multiScattering, disposable.skyView].forEach(
      (entry, index) => {
        entry.texture.addEventListener('dispose', () => {
          disposeCounts[index] = (disposeCounts[index] ?? 0) + 1;
        });
      },
    );

    disposable.dispose();
    disposable.dispose();
    expect(disposeCounts).toEqual([1, 1, 1]);
  });

  it('rejects non-physical parameter and table configurations', () => {
    expect(() =>
      createAtmosphereLutBundle({
        ...TEST_OPTIONS,
        parameters: {
          ...EARTH_ATMOSPHERE_PARAMETERS,
          atmosphereRadiusM: EARTH_ATMOSPHERE_PARAMETERS.planetRadiusM,
        },
      }),
    ).toThrow(/must exceed/);
    expect(() =>
      createAtmosphereLutBundle({
        ...TEST_OPTIONS,
        dimensions: { transmittanceWidth: 3 },
      }),
    ).toThrow(/transmittanceWidth/);
  });
});

interface TextureImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

function textureImage(entry: AtmosphereLutTexture): TextureImage {
  return entry.texture.image as TextureImage;
}

function pixel(
  entry: AtmosphereLutTexture,
  x: number,
  y: number,
): readonly [number, number, number, number] {
  const data = textureImage(entry).data;
  const offset = (y * entry.width + x) * 4;
  return [
    data[offset] ?? -1,
    data[offset + 1] ?? -1,
    data[offset + 2] ?? -1,
    data[offset + 3] ?? -1,
  ];
}
