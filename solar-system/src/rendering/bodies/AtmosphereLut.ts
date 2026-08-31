import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

export type AtmosphereRgb = readonly [red: number, green: number, blue: number];

export interface AtmospherePhysicalParameters {
  readonly planetRadiusM: number;
  readonly atmosphereRadiusM: number;
  readonly sunAngularRadiusRad: number;
  readonly solarIrradianceRgb: AtmosphereRgb;
  readonly rayleighScaleHeightM: number;
  readonly rayleighScatteringRgbPerM: AtmosphereRgb;
  readonly mieScaleHeightM: number;
  readonly mieScatteringRgbPerM: AtmosphereRgb;
  readonly mieExtinctionRgbPerM: AtmosphereRgb;
  readonly miePhaseFunctionG: number;
  readonly ozoneLayerCenterM: number;
  readonly ozoneLayerHalfWidthM: number;
  readonly ozoneAbsorptionRgbPerM: AtmosphereRgb;
  readonly groundAlbedoRgb: AtmosphereRgb;
}

export interface AtmosphereLutDimensions {
  readonly transmittanceWidth: number;
  readonly transmittanceHeight: number;
  readonly multiScatteringWidth: number;
  readonly multiScatteringHeight: number;
  readonly skyViewWidth: number;
  readonly skyViewHeight: number;
}

export interface AtmosphereLutPrecomputeOptions {
  readonly parameters?: AtmospherePhysicalParameters;
  readonly dimensions?: Partial<AtmosphereLutDimensions>;
  readonly opticalDepthSamples?: number;
  readonly singleScatteringSamples?: number;
  readonly irradianceDirectionSamples?: number;
  readonly skyAzimuthSamples?: number;
  /** Representative observer altitude used by the compact 2D sky-view table. */
  readonly skyViewObserverAltitudeM?: number;
}

export interface AtmosphereLutAxis {
  readonly semantic: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly mapping: 'linear' | 'square-altitude';
}

export interface AtmosphereLutChannelEncoding {
  readonly semantic: string;
  readonly kind: 'linear-unit' | 'one-minus-exponential';
  /** `encoded = 1 - exp(-physical * scale)` for one-minus-exponential channels. */
  readonly scale: number;
}

export interface AtmosphereLutTexture {
  readonly texture: DataTexture;
  readonly width: number;
  readonly height: number;
  readonly xAxis: AtmosphereLutAxis;
  readonly yAxis: AtmosphereLutAxis;
  readonly rgbEncoding: AtmosphereLutChannelEncoding;
  readonly alphaEncoding: AtmosphereLutChannelEncoding;
}

export interface AtmosphereLutBundle {
  readonly parameters: AtmospherePhysicalParameters;
  readonly transmittance: AtmosphereLutTexture;
  readonly multiScattering: AtmosphereLutTexture;
  readonly skyView: AtmosphereLutTexture;
  readonly limitations: readonly string[];
  dispose(): void;
}

/**
 * Compact Phase 4 Earth atmosphere parameters.
 *
 * The density profiles and coefficients follow the Earth example from Eric
 * Bruneton's reference implementation of Bruneton & Neyret (2008):
 * https://ebruneton.github.io/precomputed_atmospheric_scattering/
 *
 * RGB samples are evaluated at 680, 550, and 440 nm. Solar irradiance is
 * normalized because exposure is owned by the renderer; all extinction and
 * scattering coefficients retain SI units.
 */
export const EARTH_ATMOSPHERE_PARAMETERS: AtmospherePhysicalParameters =
  freezeParameters({
    planetRadiusM: 6_360_000,
    atmosphereRadiusM: 6_420_000,
    sunAngularRadiusRad: 0.00935 / 2,
    solarIrradianceRgb: [1, 1, 1],
    rayleighScaleHeightM: 8_000,
    rayleighScatteringRgbPerM: [5.802e-6, 13.558e-6, 33.1e-6],
    mieScaleHeightM: 1_200,
    mieScatteringRgbPerM: [3.996e-6, 3.996e-6, 3.996e-6],
    mieExtinctionRgbPerM: [4.44e-6, 4.44e-6, 4.44e-6],
    miePhaseFunctionG: 0.8,
    ozoneLayerCenterM: 25_000,
    ozoneLayerHalfWidthM: 15_000,
    ozoneAbsorptionRgbPerM: [0.65e-6, 1.881e-6, 0.085e-6],
    groundAlbedoRgb: [0.1, 0.1, 0.1],
  });

export const DEFAULT_ATMOSPHERE_LUT_DIMENSIONS: AtmosphereLutDimensions =
  Object.freeze({
    transmittanceWidth: 96,
    transmittanceHeight: 32,
    multiScatteringWidth: 32,
    multiScatteringHeight: 16,
    skyViewWidth: 96,
    skyViewHeight: 48,
  });

export const ATMOSPHERE_LUT_LIMITATIONS: readonly string[] = Object.freeze([
  'Three RGB wavelengths approximate a spectral atmosphere and are not a CIE spectral integration.',
  'The multi-scattering texture uses an energy-conserving escape-probability closure, not the full iterative 4D scattering solution.',
  'The sky-view texture is azimuth-averaged at one representative altitude and cannot reproduce every camera altitude or relative azimuth.',
  'The model is spherical, clear-sky, static, and omits refraction, polarization, terrain, weather, and local aerosol variation.',
  'Unsigned-byte encoding trades radiometric range and precision for portable WebGL filtering.',
]);

const TRANSMITTANCE_X_AXIS: AtmosphereLutAxis = Object.freeze({
  semantic: 'view zenith cosine; -1 points toward the planet and +1 points outward',
  minimum: -1,
  maximum: 1,
  mapping: 'linear',
});
const ALTITUDE_Y_AXIS: AtmosphereLutAxis = Object.freeze({
  semantic: 'normalized altitude; physical altitude is y^2 times atmosphere thickness',
  minimum: 0,
  maximum: 1,
  mapping: 'square-altitude',
});
const SOLAR_X_AXIS: AtmosphereLutAxis = Object.freeze({
  semantic: 'solar zenith cosine',
  minimum: -1,
  maximum: 1,
  mapping: 'linear',
});
const SKY_VIEW_X_AXIS: AtmosphereLutAxis = Object.freeze({
  semantic: 'view zenith cosine; 0 is the horizon and 1 is zenith',
  minimum: 0,
  maximum: 1,
  mapping: 'linear',
});
const SKY_VIEW_Y_AXIS: AtmosphereLutAxis = Object.freeze({
  semantic: 'solar zenith cosine',
  minimum: -1,
  maximum: 1,
  mapping: 'linear',
});

const LINEAR_TRANSMITTANCE_RGB: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'RGB transmittance to the nearest atmosphere or ground boundary',
  kind: 'linear-unit',
  scale: 1,
});
const OPTICAL_DEPTH_ALPHA: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'mean RGB optical depth',
  kind: 'one-minus-exponential',
  scale: 1 / 8,
});
const MULTI_SCATTERING_RGB: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'relative RGB irradiance from approximate second and higher scattering orders',
  kind: 'one-minus-exponential',
  scale: 12,
});
const DIRECT_SUN_ALPHA: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'mean direct-solar transmittance including finite solar-disc visibility',
  kind: 'linear-unit',
  scale: 1,
});
const SKY_RADIANCE_RGB: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'relative RGB sky radiance from single plus approximate multiple scattering',
  kind: 'one-minus-exponential',
  scale: 12,
});
const SKY_OPACITY_ALPHA: AtmosphereLutChannelEncoding = Object.freeze({
  semantic: 'one minus mean view-path transmittance',
  kind: 'linear-unit',
  scale: 1,
});

const DEFAULT_OPTICAL_DEPTH_SAMPLES = 24;
const DEFAULT_SINGLE_SCATTERING_SAMPLES = 18;
const DEFAULT_IRRADIANCE_DIRECTION_SAMPLES = 8;
const DEFAULT_SKY_AZIMUTH_SAMPLES = 3;
const DEFAULT_SKY_VIEW_OBSERVER_ALTITUDE_M = 2_000;
const TWO_PI = Math.PI * 2;
const GOLDEN_RATIO_CONJUGATE = 0.618_033_988_749_894_9;

interface ResolvedAtmosphereLutConfig {
  readonly parameters: AtmospherePhysicalParameters;
  readonly dimensions: AtmosphereLutDimensions;
  readonly opticalDepthSamples: number;
  readonly singleScatteringSamples: number;
  readonly irradianceDirectionSamples: number;
  readonly skyAzimuthSamples: number;
  readonly skyViewObserverAltitudeM: number;
}

interface OpticalDepthSample {
  red: number;
  green: number;
  blue: number;
  hitsGround: boolean;
}

interface TransmittanceSample {
  red: number;
  green: number;
  blue: number;
}

interface SingleScatteringSample {
  red: number;
  green: number;
  blue: number;
  viewTransmittanceRed: number;
  viewTransmittanceGreen: number;
  viewTransmittanceBlue: number;
}

interface MultiScatteringField {
  readonly data: Uint8Array;
  readonly physicalIrradiance: Float64Array;
}

interface TransmittanceField {
  readonly data: Uint8Array;
  readonly physicalTransmittance: Float64Array;
}

interface PrecomputedAtmosphereFields {
  readonly transmittance: Uint8Array;
  readonly multiScattering: Uint8Array;
  readonly skyView: Uint8Array;
}

/**
 * Precomputes a compact, portable atmosphere bundle on the CPU. This follows
 * the same physical decomposition as full precomputed-scattering models
 * (transmittance, higher-order irradiance, and sky radiance), while using a
 * deliberately smaller 2D approximation suitable for the Phase 4 body shell.
 */
export function createAtmosphereLutBundle(
  options: AtmosphereLutPrecomputeOptions = {},
): AtmosphereLutBundle {
  const config = resolveConfig(options);
  const fields = precomputeAtmosphereFields(config);
  const transmittance = createLutTexture(
    fields.transmittance,
    config.dimensions.transmittanceWidth,
    config.dimensions.transmittanceHeight,
    'phase-4-atmosphere-transmittance-lut',
    TRANSMITTANCE_X_AXIS,
    ALTITUDE_Y_AXIS,
    LINEAR_TRANSMITTANCE_RGB,
    OPTICAL_DEPTH_ALPHA,
  );
  const multiScattering = createLutTexture(
    fields.multiScattering,
    config.dimensions.multiScatteringWidth,
    config.dimensions.multiScatteringHeight,
    'phase-4-atmosphere-multi-scattering-lut',
    SOLAR_X_AXIS,
    ALTITUDE_Y_AXIS,
    MULTI_SCATTERING_RGB,
    DIRECT_SUN_ALPHA,
  );
  const skyView = createLutTexture(
    fields.skyView,
    config.dimensions.skyViewWidth,
    config.dimensions.skyViewHeight,
    'phase-4-atmosphere-sky-view-lut',
    SKY_VIEW_X_AXIS,
    SKY_VIEW_Y_AXIS,
    SKY_RADIANCE_RGB,
    SKY_OPACITY_ALPHA,
  );

  let disposed = false;
  return Object.freeze({
    parameters: config.parameters,
    transmittance,
    multiScattering,
    skyView,
    limitations: ATMOSPHERE_LUT_LIMITATIONS,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      transmittance.texture.dispose();
      multiScattering.texture.dispose();
      skyView.texture.dispose();
    },
  });
}

/**
 * Transitional Phase 3/early-Phase 4 compatibility entry point.
 *
 * @deprecated Integrate `createAtmosphereLutBundle` and bind all three tables.
 * This now returns the physically precomputed sky-view texture rather than the
 * removed heuristic optical-depth texture.
 */
export function createAtmosphereOpticalDepthLut(): DataTexture {
  const config = resolveConfig({});
  const fields = precomputeAtmosphereFields(config);
  return createLutTexture(
    fields.skyView,
    config.dimensions.skyViewWidth,
    config.dimensions.skyViewHeight,
    'phase-4-atmosphere-sky-view-compatibility-lut',
    SKY_VIEW_X_AXIS,
    SKY_VIEW_Y_AXIS,
    SKY_RADIANCE_RGB,
    SKY_OPACITY_ALPHA,
  ).texture;
}

function resolveConfig(options: AtmosphereLutPrecomputeOptions): ResolvedAtmosphereLutConfig {
  const parameters = freezeParameters(options.parameters ?? EARTH_ATMOSPHERE_PARAMETERS);
  validateParameters(parameters);
  const dimensions = Object.freeze({
    ...DEFAULT_ATMOSPHERE_LUT_DIMENSIONS,
    ...options.dimensions,
  });
  validateInteger(dimensions.transmittanceWidth, 'transmittanceWidth', 4);
  validateInteger(dimensions.transmittanceHeight, 'transmittanceHeight', 2);
  validateInteger(dimensions.multiScatteringWidth, 'multiScatteringWidth', 4);
  validateInteger(dimensions.multiScatteringHeight, 'multiScatteringHeight', 2);
  validateInteger(dimensions.skyViewWidth, 'skyViewWidth', 4);
  validateInteger(dimensions.skyViewHeight, 'skyViewHeight', 2);

  const opticalDepthSamples = options.opticalDepthSamples ?? DEFAULT_OPTICAL_DEPTH_SAMPLES;
  const singleScatteringSamples =
    options.singleScatteringSamples ?? DEFAULT_SINGLE_SCATTERING_SAMPLES;
  const irradianceDirectionSamples =
    options.irradianceDirectionSamples ?? DEFAULT_IRRADIANCE_DIRECTION_SAMPLES;
  const skyAzimuthSamples = options.skyAzimuthSamples ?? DEFAULT_SKY_AZIMUTH_SAMPLES;
  validateInteger(opticalDepthSamples, 'opticalDepthSamples', 4);
  validateInteger(singleScatteringSamples, 'singleScatteringSamples', 4);
  validateInteger(irradianceDirectionSamples, 'irradianceDirectionSamples', 4);
  validateInteger(skyAzimuthSamples, 'skyAzimuthSamples', 1);

  const atmosphereThicknessM = parameters.atmosphereRadiusM - parameters.planetRadiusM;
  const skyViewObserverAltitudeM =
    options.skyViewObserverAltitudeM ?? DEFAULT_SKY_VIEW_OBSERVER_ALTITUDE_M;
  if (
    !Number.isFinite(skyViewObserverAltitudeM) ||
    skyViewObserverAltitudeM < 0 ||
    skyViewObserverAltitudeM >= atmosphereThicknessM
  ) {
    throw new RangeError('skyViewObserverAltitudeM must be inside the atmosphere.');
  }

  return Object.freeze({
    parameters,
    dimensions,
    opticalDepthSamples,
    singleScatteringSamples,
    irradianceDirectionSamples,
    skyAzimuthSamples,
    skyViewObserverAltitudeM,
  });
}

function precomputeAtmosphereFields(
  config: ResolvedAtmosphereLutConfig,
): PrecomputedAtmosphereFields {
  const transmittance = precomputeTransmittance(config);
  const multiScattering = precomputeMultiScattering(
    config,
    transmittance.physicalTransmittance,
  );
  const skyView = precomputeSkyView(
    config,
    transmittance.physicalTransmittance,
    multiScattering.physicalIrradiance,
  );
  return {
    transmittance: transmittance.data,
    multiScattering: multiScattering.data,
    skyView,
  };
}

function precomputeTransmittance(config: ResolvedAtmosphereLutConfig): TransmittanceField {
  const { parameters, dimensions, opticalDepthSamples } = config;
  const width = dimensions.transmittanceWidth;
  const height = dimensions.transmittanceHeight;
  const data = new Uint8Array(width * height * 4);
  const physicalTransmittance = new Float64Array(width * height * 3);
  const opticalDepth = createOpticalDepthSample();
  const thicknessM = parameters.atmosphereRadiusM - parameters.planetRadiusM;

  for (let y = 0; y < height; y += 1) {
    const altitudeCoordinate = y / (height - 1);
    const altitudeM = altitudeCoordinate * altitudeCoordinate * thicknessM;
    const radiusM = parameters.planetRadiusM + altitudeM;
    for (let x = 0; x < width; x += 1) {
      const viewCosine = x / (width - 1) * 2 - 1;
      const horizontal = Math.sqrt(Math.max(0, 1 - viewCosine * viewCosine));
      integrateOpticalDepth(
        opticalDepth,
        0,
        radiusM,
        0,
        horizontal,
        viewCosine,
        0,
        parameters,
        opticalDepthSamples,
      );
      const transmittanceRed = Math.exp(-opticalDepth.red);
      const transmittanceGreen = Math.exp(-opticalDepth.green);
      const transmittanceBlue = Math.exp(-opticalDepth.blue);
      const physicalOffset = (y * width + x) * 3;
      physicalTransmittance[physicalOffset] = transmittanceRed;
      physicalTransmittance[physicalOffset + 1] = transmittanceGreen;
      physicalTransmittance[physicalOffset + 2] = transmittanceBlue;
      const meanOpticalDepth =
        (opticalDepth.red + opticalDepth.green + opticalDepth.blue) / 3;
      writePixel(
        data,
        (y * width + x) * 4,
        transmittanceRed,
        transmittanceGreen,
        transmittanceBlue,
        encodeExponential(meanOpticalDepth, OPTICAL_DEPTH_ALPHA.scale),
      );
    }
  }
  return { data, physicalTransmittance };
}

function precomputeMultiScattering(
  config: ResolvedAtmosphereLutConfig,
  physicalTransmittance: Float64Array,
): MultiScatteringField {
  const { parameters, dimensions } = config;
  const width = dimensions.multiScatteringWidth;
  const height = dimensions.multiScatteringHeight;
  const data = new Uint8Array(width * height * 4);
  const physicalIrradiance = new Float64Array(width * height * 3);
  const singleScattering = createSingleScatteringSample();
  const directSun = createTransmittanceSample();
  const thicknessM = parameters.atmosphereRadiusM - parameters.planetRadiusM;
  const groundAlbedoMean = meanRgb(parameters.groundAlbedoRgb);

  for (let y = 0; y < height; y += 1) {
    const altitudeCoordinate = y / (height - 1);
    const altitudeFraction = altitudeCoordinate * altitudeCoordinate;
    const altitudeM = altitudeFraction * thicknessM;
    const radiusM = parameters.planetRadiusM + altitudeM;
    const rayleighDensity = densityAtAltitude(altitudeM, parameters.rayleighScaleHeightM);
    const mieDensity = densityAtAltitude(altitudeM, parameters.mieScaleHeightM);
    const ozoneDensity = ozoneDensityAtAltitude(altitudeM, parameters);

    for (let x = 0; x < width; x += 1) {
      const solarCosine = x / (width - 1) * 2 - 1;
      const solarHorizontal = Math.sqrt(Math.max(0, 1 - solarCosine * solarCosine));
      sampleDirectSunTransmittanceFromField(
        directSun,
        physicalTransmittance,
        dimensions.transmittanceWidth,
        dimensions.transmittanceHeight,
        0,
        radiusM,
        0,
        solarHorizontal,
        solarCosine,
        0,
        parameters,
      );

      let singleIrradianceRed = 0;
      let singleIrradianceGreen = 0;
      let singleIrradianceBlue = 0;
      for (
        let directionIndex = 0;
        directionIndex < config.irradianceDirectionSamples;
        directionIndex += 1
      ) {
        const viewCosine =
          (directionIndex + 0.5) / config.irradianceDirectionSamples;
        const azimuth =
          TWO_PI * fractionalPart(directionIndex * GOLDEN_RATIO_CONJUGATE);
        const horizontal = Math.sqrt(Math.max(0, 1 - viewCosine * viewCosine));
        const viewX = horizontal * Math.cos(azimuth);
        const viewZ = horizontal * Math.sin(azimuth);
        integrateSingleScattering(
          singleScattering,
          physicalTransmittance,
          dimensions.transmittanceWidth,
          dimensions.transmittanceHeight,
          0,
          radiusM,
          0,
          viewX,
          viewCosine,
          viewZ,
          solarHorizontal,
          solarCosine,
          0,
          parameters,
          config.singleScatteringSamples,
        );
        const solidAngleWeight =
          TWO_PI / config.irradianceDirectionSamples * viewCosine;
        singleIrradianceRed += singleScattering.red * solidAngleWeight;
        singleIrradianceGreen += singleScattering.green * solidAngleWeight;
        singleIrradianceBlue += singleScattering.blue * solidAngleWeight;
      }

      const directMean = mean3(directSun.red, directSun.green, directSun.blue);
      const pathOpacity = 1 - directMean;
      const returnProbability = clamp(
        0.12 + pathOpacity * 0.42 + (1 - altitudeFraction) * groundAlbedoMean * 0.12,
        0,
        0.72,
      );
      const albedoRed = localSingleScatteringAlbedo(
        0,
        rayleighDensity,
        mieDensity,
        ozoneDensity,
        parameters,
      );
      const albedoGreen = localSingleScatteringAlbedo(
        1,
        rayleighDensity,
        mieDensity,
        ozoneDensity,
        parameters,
      );
      const albedoBlue = localSingleScatteringAlbedo(
        2,
        rayleighDensity,
        mieDensity,
        ozoneDensity,
        parameters,
      );
      const groundIllumination = Math.max(solarCosine, 0) * (1 - altitudeFraction);
      const higherOrderRed =
        singleIrradianceRed * multipleScatteringGain(albedoRed, returnProbability) +
        directSun.red * groundIllumination * parameters.groundAlbedoRgb[0] * pathOpacity * 0.06;
      const higherOrderGreen =
        singleIrradianceGreen * multipleScatteringGain(albedoGreen, returnProbability) +
        directSun.green * groundIllumination * parameters.groundAlbedoRgb[1] * pathOpacity * 0.06;
      const higherOrderBlue =
        singleIrradianceBlue * multipleScatteringGain(albedoBlue, returnProbability) +
        directSun.blue * groundIllumination * parameters.groundAlbedoRgb[2] * pathOpacity * 0.06;
      const physicalOffset = (y * width + x) * 3;
      physicalIrradiance[physicalOffset] = higherOrderRed;
      physicalIrradiance[physicalOffset + 1] = higherOrderGreen;
      physicalIrradiance[physicalOffset + 2] = higherOrderBlue;
      writePixel(
        data,
        (y * width + x) * 4,
        encodeExponential(higherOrderRed, MULTI_SCATTERING_RGB.scale),
        encodeExponential(higherOrderGreen, MULTI_SCATTERING_RGB.scale),
        encodeExponential(higherOrderBlue, MULTI_SCATTERING_RGB.scale),
        directMean,
      );
    }
  }
  return { data, physicalIrradiance };
}

function precomputeSkyView(
  config: ResolvedAtmosphereLutConfig,
  physicalTransmittance: Float64Array,
  physicalMultiScattering: Float64Array,
): Uint8Array {
  const { parameters, dimensions } = config;
  const width = dimensions.skyViewWidth;
  const height = dimensions.skyViewHeight;
  const data = new Uint8Array(width * height * 4);
  const observerRadiusM = parameters.planetRadiusM + config.skyViewObserverAltitudeM;
  const singleScattering = createSingleScatteringSample();
  const multiScattering = createTransmittanceSample();

  for (let y = 0; y < height; y += 1) {
    const solarCosine = y / (height - 1) * 2 - 1;
    const solarHorizontal = Math.sqrt(Math.max(0, 1 - solarCosine * solarCosine));
    samplePhysicalMultiScattering(
      multiScattering,
      physicalMultiScattering,
      dimensions.multiScatteringWidth,
      dimensions.multiScatteringHeight,
      solarCosine,
      config.skyViewObserverAltitudeM,
      parameters,
    );

    for (let x = 0; x < width; x += 1) {
      const viewCosine = x / (width - 1);
      const horizontal = Math.sqrt(Math.max(0, 1 - viewCosine * viewCosine));
      let radianceRed = 0;
      let radianceGreen = 0;
      let radianceBlue = 0;
      let viewOpacity = 0;
      for (let azimuthIndex = 0; azimuthIndex < config.skyAzimuthSamples; azimuthIndex += 1) {
        const azimuth = TWO_PI * azimuthIndex / config.skyAzimuthSamples;
        integrateSingleScattering(
          singleScattering,
          physicalTransmittance,
          dimensions.transmittanceWidth,
          dimensions.transmittanceHeight,
          0,
          observerRadiusM,
          0,
          horizontal * Math.cos(azimuth),
          viewCosine,
          horizontal * Math.sin(azimuth),
          solarHorizontal,
          solarCosine,
          0,
          parameters,
          config.singleScatteringSamples,
        );
        radianceRed += singleScattering.red;
        radianceGreen += singleScattering.green;
        radianceBlue += singleScattering.blue;
        viewOpacity +=
          1 -
          mean3(
            singleScattering.viewTransmittanceRed,
            singleScattering.viewTransmittanceGreen,
            singleScattering.viewTransmittanceBlue,
          );
      }
      const inverseAzimuthSamples = 1 / config.skyAzimuthSamples;
      radianceRed *= inverseAzimuthSamples;
      radianceGreen *= inverseAzimuthSamples;
      radianceBlue *= inverseAzimuthSamples;
      viewOpacity *= inverseAzimuthSamples;
      radianceRed += multiScattering.red / Math.PI * viewOpacity;
      radianceGreen += multiScattering.green / Math.PI * viewOpacity;
      radianceBlue += multiScattering.blue / Math.PI * viewOpacity;
      writePixel(
        data,
        (y * width + x) * 4,
        encodeExponential(radianceRed, SKY_RADIANCE_RGB.scale),
        encodeExponential(radianceGreen, SKY_RADIANCE_RGB.scale),
        encodeExponential(radianceBlue, SKY_RADIANCE_RGB.scale),
        viewOpacity,
      );
    }
  }
  return data;
}

function integrateSingleScattering(
  out: SingleScatteringSample,
  physicalTransmittance: Float64Array,
  transmittanceWidth: number,
  transmittanceHeight: number,
  originX: number,
  originY: number,
  originZ: number,
  viewX: number,
  viewY: number,
  viewZ: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  parameters: AtmospherePhysicalParameters,
  viewSamples: number,
): void {
  const distanceM = distanceToTopAtmosphereBoundary(
    originX,
    originY,
    originZ,
    viewX,
    viewY,
    viewZ,
    parameters.atmosphereRadiusM,
  );
  const stepM = distanceM / viewSamples;
  const sunTransmittance = createTransmittanceSample();
  let viewOpticalDepthRed = 0;
  let viewOpticalDepthGreen = 0;
  let viewOpticalDepthBlue = 0;
  let radianceRed = 0;
  let radianceGreen = 0;
  let radianceBlue = 0;
  const phaseCosine = clamp(viewX * sunX + viewY * sunY + viewZ * sunZ, -1, 1);
  const rayleighPhase = rayleighPhaseFunction(phaseCosine);
  const miePhase = cornetteShanksPhaseFunction(phaseCosine, parameters.miePhaseFunctionG);

  for (let sampleIndex = 0; sampleIndex < viewSamples; sampleIndex += 1) {
    const distanceAlongRayM = (sampleIndex + 0.5) * stepM;
    const sampleX = originX + viewX * distanceAlongRayM;
    const sampleY = originY + viewY * distanceAlongRayM;
    const sampleZ = originZ + viewZ * distanceAlongRayM;
    const radiusM = Math.hypot(sampleX, sampleY, sampleZ);
    const altitudeM = Math.max(0, radiusM - parameters.planetRadiusM);
    const rayleighDensity = densityAtAltitude(altitudeM, parameters.rayleighScaleHeightM);
    const mieDensity = densityAtAltitude(altitudeM, parameters.mieScaleHeightM);
    const ozoneDensity = ozoneDensityAtAltitude(altitudeM, parameters);
    const segmentExtinctionRed = extinctionAtAltitude(
      0,
      rayleighDensity,
      mieDensity,
      ozoneDensity,
      parameters,
    ) * stepM;
    const segmentExtinctionGreen = extinctionAtAltitude(
      1,
      rayleighDensity,
      mieDensity,
      ozoneDensity,
      parameters,
    ) * stepM;
    const segmentExtinctionBlue = extinctionAtAltitude(
      2,
      rayleighDensity,
      mieDensity,
      ozoneDensity,
      parameters,
    ) * stepM;
    const viewTransmittanceRed =
      Math.exp(-(viewOpticalDepthRed + segmentExtinctionRed * 0.5));
    const viewTransmittanceGreen =
      Math.exp(-(viewOpticalDepthGreen + segmentExtinctionGreen * 0.5));
    const viewTransmittanceBlue =
      Math.exp(-(viewOpticalDepthBlue + segmentExtinctionBlue * 0.5));
    sampleDirectSunTransmittanceFromField(
      sunTransmittance,
      physicalTransmittance,
      transmittanceWidth,
      transmittanceHeight,
      sampleX,
      sampleY,
      sampleZ,
      sunX,
      sunY,
      sunZ,
      parameters,
    );

    const rayleighRed = parameters.rayleighScatteringRgbPerM[0] * rayleighDensity;
    const rayleighGreen = parameters.rayleighScatteringRgbPerM[1] * rayleighDensity;
    const rayleighBlue = parameters.rayleighScatteringRgbPerM[2] * rayleighDensity;
    const mieRed = parameters.mieScatteringRgbPerM[0] * mieDensity;
    const mieGreen = parameters.mieScatteringRgbPerM[1] * mieDensity;
    const mieBlue = parameters.mieScatteringRgbPerM[2] * mieDensity;
    radianceRed +=
      viewTransmittanceRed *
      sunTransmittance.red *
      (rayleighRed * rayleighPhase + mieRed * miePhase) *
      parameters.solarIrradianceRgb[0] *
      stepM;
    radianceGreen +=
      viewTransmittanceGreen *
      sunTransmittance.green *
      (rayleighGreen * rayleighPhase + mieGreen * miePhase) *
      parameters.solarIrradianceRgb[1] *
      stepM;
    radianceBlue +=
      viewTransmittanceBlue *
      sunTransmittance.blue *
      (rayleighBlue * rayleighPhase + mieBlue * miePhase) *
      parameters.solarIrradianceRgb[2] *
      stepM;
    viewOpticalDepthRed += segmentExtinctionRed;
    viewOpticalDepthGreen += segmentExtinctionGreen;
    viewOpticalDepthBlue += segmentExtinctionBlue;
  }

  out.red = radianceRed;
  out.green = radianceGreen;
  out.blue = radianceBlue;
  out.viewTransmittanceRed = Math.exp(-viewOpticalDepthRed);
  out.viewTransmittanceGreen = Math.exp(-viewOpticalDepthGreen);
  out.viewTransmittanceBlue = Math.exp(-viewOpticalDepthBlue);
}

function sampleDirectSunTransmittanceFromField(
  out: TransmittanceSample,
  physicalTransmittance: Float64Array,
  transmittanceWidth: number,
  transmittanceHeight: number,
  originX: number,
  originY: number,
  originZ: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  parameters: AtmospherePhysicalParameters,
): void {
  const radiusM = Math.hypot(originX, originY, originZ);
  const normalX = originX / radiusM;
  const normalY = originY / radiusM;
  const normalZ = originZ / radiusM;
  const solarCosine = clamp(normalX * sunX + normalY * sunY + normalZ * sunZ, -1, 1);
  const horizonCosine = -Math.sqrt(
    Math.max(0, 1 - square(parameters.planetRadiusM / radiusM)),
  );
  const solarElevation = Math.asin(solarCosine);
  const horizonElevation = Math.asin(horizonCosine);
  const discVisibility = smoothstep(
    -parameters.sunAngularRadiusRad,
    parameters.sunAngularRadiusRad,
    solarElevation - horizonElevation,
  );
  if (discVisibility <= 0) {
    out.red = 0;
    out.green = 0;
    out.blue = 0;
    return;
  }

  samplePhysicalTransmittance(
    out,
    physicalTransmittance,
    transmittanceWidth,
    transmittanceHeight,
    Math.max(0, radiusM - parameters.planetRadiusM),
    Math.max(solarCosine, horizonCosine + 1e-6),
    parameters,
  );
  out.red *= discVisibility;
  out.green *= discVisibility;
  out.blue *= discVisibility;
}

function integrateOpticalDepth(
  out: OpticalDepthSample,
  originX: number,
  originY: number,
  originZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  parameters: AtmospherePhysicalParameters,
  sampleCount: number,
): void {
  const radiusSquared =
    originX * originX + originY * originY + originZ * originZ;
  const radialDirection =
    originX * directionX + originY * directionY + originZ * directionZ;
  const topDiscriminant = Math.max(
    0,
    radialDirection * radialDirection -
      radiusSquared +
      parameters.atmosphereRadiusM * parameters.atmosphereRadiusM,
  );
  let distanceM = -radialDirection + Math.sqrt(topDiscriminant);
  let hitsGround = false;
  const groundDiscriminant =
    radialDirection * radialDirection -
    radiusSquared +
    parameters.planetRadiusM * parameters.planetRadiusM;
  if (groundDiscriminant >= 0) {
    const groundDistanceM = -radialDirection - Math.sqrt(groundDiscriminant);
    if (groundDistanceM >= -1e-6 && groundDistanceM <= distanceM) {
      distanceM = Math.max(0, groundDistanceM);
      hitsGround = true;
    }
  }

  let opticalDepthRed = 0;
  let opticalDepthGreen = 0;
  let opticalDepthBlue = 0;
  if (distanceM > 0) {
    const stepM = distanceM / sampleCount;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const distanceAlongRayM = (sampleIndex + 0.5) * stepM;
      const sampleRadiusM = Math.hypot(
        originX + directionX * distanceAlongRayM,
        originY + directionY * distanceAlongRayM,
        originZ + directionZ * distanceAlongRayM,
      );
      const altitudeM = Math.max(0, sampleRadiusM - parameters.planetRadiusM);
      const rayleighDensity = densityAtAltitude(altitudeM, parameters.rayleighScaleHeightM);
      const mieDensity = densityAtAltitude(altitudeM, parameters.mieScaleHeightM);
      const ozoneDensity = ozoneDensityAtAltitude(altitudeM, parameters);
      opticalDepthRed +=
        extinctionAtAltitude(0, rayleighDensity, mieDensity, ozoneDensity, parameters) *
        stepM;
      opticalDepthGreen +=
        extinctionAtAltitude(1, rayleighDensity, mieDensity, ozoneDensity, parameters) *
        stepM;
      opticalDepthBlue +=
        extinctionAtAltitude(2, rayleighDensity, mieDensity, ozoneDensity, parameters) *
        stepM;
    }
  }
  out.red = opticalDepthRed;
  out.green = opticalDepthGreen;
  out.blue = opticalDepthBlue;
  out.hitsGround = hitsGround;
}

function distanceToTopAtmosphereBoundary(
  originX: number,
  originY: number,
  originZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  atmosphereRadiusM: number,
): number {
  const radiusSquared =
    originX * originX + originY * originY + originZ * originZ;
  const radialDirection =
    originX * directionX + originY * directionY + originZ * directionZ;
  const discriminant = Math.max(
    0,
    radialDirection * radialDirection - radiusSquared + atmosphereRadiusM * atmosphereRadiusM,
  );
  return Math.max(0, -radialDirection + Math.sqrt(discriminant));
}

function samplePhysicalMultiScattering(
  out: TransmittanceSample,
  data: Float64Array,
  width: number,
  height: number,
  solarCosine: number,
  altitudeM: number,
  parameters: AtmospherePhysicalParameters,
): void {
  const thicknessM = parameters.atmosphereRadiusM - parameters.planetRadiusM;
  const x = clamp(solarCosine * 0.5 + 0.5, 0, 1) * (width - 1);
  const y = Math.sqrt(clamp(altitudeM / thicknessM, 0, 1)) * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const mixX = x - x0;
  const mixY = y - y0;
  out.red = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 0);
  out.green = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 1);
  out.blue = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 2);
}

function samplePhysicalTransmittance(
  out: TransmittanceSample,
  data: Float64Array,
  width: number,
  height: number,
  altitudeM: number,
  viewCosine: number,
  parameters: AtmospherePhysicalParameters,
): void {
  const thicknessM = parameters.atmosphereRadiusM - parameters.planetRadiusM;
  const x = clamp(viewCosine * 0.5 + 0.5, 0, 1) * (width - 1);
  const y = Math.sqrt(clamp(altitudeM / thicknessM, 0, 1)) * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const mixX = x - x0;
  const mixY = y - y0;
  out.red = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 0);
  out.green = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 1);
  out.blue = bilinearField(data, width, x0, y0, x1, y1, mixX, mixY, 2);
}

function bilinearField(
  data: Float64Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mixX: number,
  mixY: number,
  channel: number,
): number {
  const topLeft = data[(y0 * width + x0) * 3 + channel] ?? 0;
  const topRight = data[(y0 * width + x1) * 3 + channel] ?? 0;
  const bottomLeft = data[(y1 * width + x0) * 3 + channel] ?? 0;
  const bottomRight = data[(y1 * width + x1) * 3 + channel] ?? 0;
  return mix(
    mix(topLeft, topRight, mixX),
    mix(bottomLeft, bottomRight, mixX),
    mixY,
  );
}

function extinctionAtAltitude(
  channel: 0 | 1 | 2,
  rayleighDensity: number,
  mieDensity: number,
  ozoneDensity: number,
  parameters: AtmospherePhysicalParameters,
): number {
  return (
    parameters.rayleighScatteringRgbPerM[channel] * rayleighDensity +
    parameters.mieExtinctionRgbPerM[channel] * mieDensity +
    parameters.ozoneAbsorptionRgbPerM[channel] * ozoneDensity
  );
}

function localSingleScatteringAlbedo(
  channel: 0 | 1 | 2,
  rayleighDensity: number,
  mieDensity: number,
  ozoneDensity: number,
  parameters: AtmospherePhysicalParameters,
): number {
  const scattering =
    parameters.rayleighScatteringRgbPerM[channel] * rayleighDensity +
    parameters.mieScatteringRgbPerM[channel] * mieDensity;
  const extinction = extinctionAtAltitude(
    channel,
    rayleighDensity,
    mieDensity,
    ozoneDensity,
    parameters,
  );
  return extinction > 0 ? clamp(scattering / extinction, 0, 1) : 0;
}

function densityAtAltitude(altitudeM: number, scaleHeightM: number): number {
  return Math.exp(-Math.max(0, altitudeM) / scaleHeightM);
}

function ozoneDensityAtAltitude(
  altitudeM: number,
  parameters: AtmospherePhysicalParameters,
): number {
  return clamp(
    1 - Math.abs(altitudeM - parameters.ozoneLayerCenterM) / parameters.ozoneLayerHalfWidthM,
    0,
    1,
  );
}

function rayleighPhaseFunction(cosine: number): number {
  return 3 / (16 * Math.PI) * (1 + cosine * cosine);
}

function cornetteShanksPhaseFunction(cosine: number, asymmetry: number): number {
  const asymmetrySquared = asymmetry * asymmetry;
  const denominator = Math.pow(
    Math.max(1 + asymmetrySquared - 2 * asymmetry * cosine, 1e-6),
    1.5,
  );
  return (
    3 / (8 * Math.PI) *
    (1 - asymmetrySquared) *
    (1 + cosine * cosine) /
    ((2 + asymmetrySquared) * denominator)
  );
}

function multipleScatteringGain(singleScatteringAlbedo: number, returnProbability: number): number {
  const retainedEnergy = clamp(singleScatteringAlbedo * returnProbability, 0, 0.85);
  return 1 / (1 - retainedEnergy) - 1;
}

function createLutTexture(
  data: Uint8Array,
  width: number,
  height: number,
  name: string,
  xAxis: AtmosphereLutAxis,
  yAxis: AtmosphereLutAxis,
  rgbEncoding: AtmosphereLutChannelEncoding,
  alphaEncoding: AtmosphereLutChannelEncoding,
): AtmosphereLutTexture {
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.name = name;
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return Object.freeze({
    texture,
    width,
    height,
    xAxis,
    yAxis,
    rgbEncoding,
    alphaEncoding,
  });
}

function writePixel(
  data: Uint8Array,
  offset: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  data[offset] = toByte(red);
  data[offset + 1] = toByte(green);
  data[offset + 2] = toByte(blue);
  data[offset + 3] = toByte(alpha);
}

function createOpticalDepthSample(): OpticalDepthSample {
  return { red: 0, green: 0, blue: 0, hitsGround: false };
}

function createTransmittanceSample(): TransmittanceSample {
  return { red: 0, green: 0, blue: 0 };
}

function createSingleScatteringSample(): SingleScatteringSample {
  return {
    red: 0,
    green: 0,
    blue: 0,
    viewTransmittanceRed: 1,
    viewTransmittanceGreen: 1,
    viewTransmittanceBlue: 1,
  };
}

function freezeParameters(
  parameters: AtmospherePhysicalParameters,
): AtmospherePhysicalParameters {
  return Object.freeze({
    ...parameters,
    solarIrradianceRgb: freezeRgb(parameters.solarIrradianceRgb),
    rayleighScatteringRgbPerM: freezeRgb(parameters.rayleighScatteringRgbPerM),
    mieScatteringRgbPerM: freezeRgb(parameters.mieScatteringRgbPerM),
    mieExtinctionRgbPerM: freezeRgb(parameters.mieExtinctionRgbPerM),
    ozoneAbsorptionRgbPerM: freezeRgb(parameters.ozoneAbsorptionRgbPerM),
    groundAlbedoRgb: freezeRgb(parameters.groundAlbedoRgb),
  });
}

function freezeRgb(rgb: AtmosphereRgb): AtmosphereRgb {
  return Object.freeze([rgb[0], rgb[1], rgb[2]]) as AtmosphereRgb;
}

function validateParameters(parameters: AtmospherePhysicalParameters): void {
  validatePositiveFinite(parameters.planetRadiusM, 'planetRadiusM');
  validatePositiveFinite(parameters.atmosphereRadiusM, 'atmosphereRadiusM');
  if (parameters.atmosphereRadiusM <= parameters.planetRadiusM) {
    throw new RangeError('atmosphereRadiusM must exceed planetRadiusM.');
  }
  validatePositiveFinite(parameters.sunAngularRadiusRad, 'sunAngularRadiusRad');
  if (parameters.sunAngularRadiusRad >= 0.1) {
    throw new RangeError('sunAngularRadiusRad must be below 0.1 radians.');
  }
  validatePositiveFinite(parameters.rayleighScaleHeightM, 'rayleighScaleHeightM');
  validatePositiveFinite(parameters.mieScaleHeightM, 'mieScaleHeightM');
  validatePositiveFinite(parameters.ozoneLayerHalfWidthM, 'ozoneLayerHalfWidthM');
  if (!Number.isFinite(parameters.ozoneLayerCenterM) || parameters.ozoneLayerCenterM < 0) {
    throw new RangeError('ozoneLayerCenterM must be finite and non-negative.');
  }
  if (
    !Number.isFinite(parameters.miePhaseFunctionG) ||
    parameters.miePhaseFunctionG <= -0.99 ||
    parameters.miePhaseFunctionG >= 0.99
  ) {
    throw new RangeError('miePhaseFunctionG must be finite and in (-0.99, 0.99).');
  }
  validateRgb(parameters.solarIrradianceRgb, 'solarIrradianceRgb', false);
  validateRgb(parameters.rayleighScatteringRgbPerM, 'rayleighScatteringRgbPerM', true);
  validateRgb(parameters.mieScatteringRgbPerM, 'mieScatteringRgbPerM', true);
  validateRgb(parameters.mieExtinctionRgbPerM, 'mieExtinctionRgbPerM', true);
  validateRgb(parameters.ozoneAbsorptionRgbPerM, 'ozoneAbsorptionRgbPerM', true);
  validateRgb(parameters.groundAlbedoRgb, 'groundAlbedoRgb', true, 1);
  for (let channel = 0; channel < 3; channel += 1) {
    const typedChannel = channel as 0 | 1 | 2;
    if (
      parameters.mieScatteringRgbPerM[typedChannel] >
      parameters.mieExtinctionRgbPerM[typedChannel]
    ) {
      throw new RangeError('Mie scattering cannot exceed Mie extinction.');
    }
  }
}

function validateRgb(
  value: AtmosphereRgb,
  label: string,
  allowZero: boolean,
  maximum = Number.POSITIVE_INFINITY,
): void {
  for (const component of value) {
    if (
      !Number.isFinite(component) ||
      component < 0 ||
      (!allowZero && component === 0) ||
      component > maximum
    ) {
      throw new RangeError(`${label} contains an invalid component.`);
    }
  }
}

function validatePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}

function validateInteger(value: number, label: string, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
}

function encodeExponential(value: number, scale: number): number {
  return 1 - Math.exp(-Math.max(0, value) * scale);
}

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

function meanRgb(rgb: AtmosphereRgb): number {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}

function mean3(first: number, second: number, third: number): number {
  return (first + second + third) / 3;
}

function square(value: number): number {
  return value * value;
}

function fractionalPart(value: number): number {
  return value - Math.floor(value);
}

function mix(first: number, second: number, amount: number): number {
  return first + (second - first) * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
