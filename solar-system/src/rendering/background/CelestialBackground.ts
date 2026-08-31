import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type Vector3,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';

export type SkyTextureTier = '4k' | '8k';
export type SkyAssetState = 'loading' | 'ready' | 'fallback';

export interface BrightStarRecord {
  readonly hr: number;
  readonly rightAscensionRad: number;
  readonly declinationRad: number;
  readonly visualMagnitude: number;
  readonly bvColor: number | null;
}

export interface Bsc5pCatalogPayload {
  readonly schema_version: 1;
  readonly stars: readonly (readonly [number, number, number, number, number | null])[];
}

export interface CelestialBackgroundOptions {
  readonly stars: readonly Readonly<BrightStarRecord>[];
  readonly texture4kUrl: string;
  readonly texture8kUrl: string;
  readonly initialQuality?: VisualQuality;
  readonly maximumTextureSize?: number;
  readonly maximumAnisotropy?: number;
  readonly textureLoader?: TextureLoader;
}

export interface CelestialBackgroundDiagnostics {
  readonly assetState: SkyAssetState;
  readonly textureTier: SkyTextureTier;
  readonly starCount: number;
  readonly backgroundCenter: Readonly<Vector3>;
  readonly exposureCompensation: number;
  readonly coordinateFrame: 'ICRF/J2000';
  readonly sourceLabel: 'NASA SVS Deep Star Maps 2020 + HEASARC BSC5P';
}

const SKY_RADIUS = 720;
const STAR_RADIUS = 700;
const MEAN_OBLIQUITY_J2000_RAD = 23.439_291_111 * Math.PI / 180;

/** Camera-centered ICRF/J2000 sky with an independent bright-star layer. */
export class CelestialBackground {
  public readonly root = new Group();
  public readonly celestialOrientation = new Group();
  public readonly skyMesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  public readonly starPoints: Points<BufferGeometry, ShaderMaterial>;

  private readonly textureUrls: Readonly<Record<SkyTextureTier, string>>;
  private readonly textureLoader: TextureLoader;
  private readonly maximumTextureSize: number;
  private readonly maximumAnisotropy: number;
  private activeTexture: Texture | null = null;
  private requestedTier: SkyTextureTier;
  private requestRevision = 0;
  private assetState: SkyAssetState = 'loading';
  private disposed = false;

  public constructor(options: CelestialBackgroundOptions) {
    if (options.stars.length === 0) {
      throw new Error('Celestial background requires a non-empty bright-star catalog.');
    }
    this.textureUrls = Object.freeze({
      '4k': requireAssetUrl(options.texture4kUrl, '4K sky'),
      '8k': requireAssetUrl(options.texture8kUrl, '8K sky'),
    });
    this.textureLoader = options.textureLoader ?? new TextureLoader();
    this.maximumTextureSize = Math.max(1, options.maximumTextureSize ?? 8_192);
    this.maximumAnisotropy = Math.max(1, options.maximumAnisotropy ?? 1);
    this.requestedTier = tierForQuality(options.initialQuality ?? 'high', this.maximumTextureSize);

    this.root.name = 'camera-fixed-celestial-background';
    this.celestialOrientation.name = 'icrf-to-ecliptic-orientation';
    // Convert equatorial ICRF/J2000 directions to the scene's ecliptic-up
    // convention. Texture U is horizontally mirrored because NASA's plate
    // carrée map has right ascension increasing to the left.
    this.celestialOrientation.rotation.x = -MEAN_OBLIQUITY_J2000_RAD;
    this.root.add(this.celestialOrientation);

    const skyGeometry = new SphereGeometry(SKY_RADIUS, 64, 32);
    skyGeometry.name = 'nasa-svs-milky-way-sphere';
    const skyMaterial = new MeshBasicMaterial({
      color: new Color(0x162235),
      depthTest: false,
      depthWrite: false,
      opacity: 0.72,
      side: BackSide,
      toneMapped: false,
      transparent: false,
    });
    skyMaterial.name = 'nasa-svs-milky-way-stable-exposure';
    this.skyMesh = new Mesh(skyGeometry, skyMaterial);
    this.skyMesh.name = 'milky-way-deep-star-map';
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1_000;
    this.celestialOrientation.add(this.skyMesh);

    const starLayer = createBrightStarLayer(options.stars);
    this.starPoints = starLayer;
    this.celestialOrientation.add(starLayer);
    this.loadTier(this.requestedTier);
  }

  /** Copies the camera position exactly, eliminating translation parallax. */
  public updateCameraPosition(cameraPosition: Readonly<Vector3>): void {
    this.assertNotDisposed();
    if (![cameraPosition.x, cameraPosition.y, cameraPosition.z].every(Number.isFinite)) {
      throw new RangeError('Celestial-background camera position must be finite.');
    }
    this.root.position.copy(cameraPosition);
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    const tier = tierForQuality(quality, this.maximumTextureSize);
    if (tier !== this.requestedTier) this.loadTier(tier);
  }

  public setVisible(visible: boolean): void {
    this.assertNotDisposed();
    this.root.visible = visible;
  }

  public setBrightStarsVisible(visible: boolean): void {
    this.assertNotDisposed();
    this.starPoints.visible = visible;
  }

  public getDiagnostics(): Readonly<CelestialBackgroundDiagnostics> {
    return Object.freeze({
      assetState: this.assetState,
      textureTier: this.requestedTier,
      starCount: this.starPoints.geometry.getAttribute('position').count,
      backgroundCenter: Object.freeze(this.root.position.clone()),
      // The sky uses an un-tonemapped pass, so global solar exposure cannot
      // wash it out or make it pump during a close approach.
      exposureCompensation: 1,
      coordinateFrame: 'ICRF/J2000',
      sourceLabel: 'NASA SVS Deep Star Maps 2020 + HEASARC BSC5P',
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestRevision += 1;
    this.activeTexture?.dispose();
    this.activeTexture = null;
    this.skyMesh.geometry.dispose();
    this.skyMesh.material.dispose();
    this.starPoints.geometry.dispose();
    this.starPoints.material.dispose();
    this.root.clear();
  }

  private loadTier(tier: SkyTextureTier): void {
    this.requestedTier = tier;
    this.assetState = 'loading';
    const revision = ++this.requestRevision;
    this.textureLoader.load(
      this.textureUrls[tier],
      (texture) => {
        if (this.disposed || revision !== this.requestRevision) {
          texture.dispose();
          return;
        }
        texture.name = `nasa-svs-milky-way-${tier}`;
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = RepeatWrapping;
        texture.repeat.x = -1;
        texture.offset.x = 1;
        texture.anisotropy = Math.min(this.maximumAnisotropy, tier === '8k' ? 8 : 4);
        texture.needsUpdate = true;
        this.activeTexture?.dispose();
        this.activeTexture = texture;
        this.skyMesh.material.map = texture;
        this.skyMesh.material.color.setRGB(0.72, 0.72, 0.72);
        this.skyMesh.material.needsUpdate = true;
        this.assetState = 'ready';
      },
      undefined,
      () => {
        if (this.disposed || revision !== this.requestRevision) return;
        this.activeTexture?.dispose();
        this.activeTexture = null;
        this.skyMesh.material.map = null;
        this.skyMesh.material.color.set(0x101a2a);
        this.skyMesh.material.needsUpdate = true;
        this.assetState = 'fallback';
      },
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Celestial background is disposed.');
  }
}

export function parseBsc5pCatalog(payload: unknown): readonly BrightStarRecord[] {
  if (!isUnknownRecord(payload) || payload.schema_version !== 1 || !Array.isArray(payload.stars)) {
    throw new Error('Unsupported HEASARC BSC5P catalog schema.');
  }
  const rows: unknown[] = payload.stars;
  const records = rows.map((candidate, index) => {
    if (!Array.isArray(candidate) || candidate.length !== 5) {
      throw new Error(`Invalid BSC5P row ${index}.`);
    }
    const row: unknown[] = candidate;
    const [hr, rightAscensionRad, declinationRad, visualMagnitude, bvColor] = row;
    if (
      typeof hr !== 'number' ||
      typeof rightAscensionRad !== 'number' ||
      typeof declinationRad !== 'number' ||
      typeof visualMagnitude !== 'number' ||
      !Number.isInteger(hr) ||
      !Number.isFinite(rightAscensionRad) ||
      !Number.isFinite(declinationRad) ||
      !Number.isFinite(visualMagnitude) ||
      (bvColor !== null && (typeof bvColor !== 'number' || !Number.isFinite(bvColor)))
    ) {
      throw new Error(`Non-finite BSC5P row ${index}.`);
    }
    return Object.freeze({ hr, rightAscensionRad, declinationRad, visualMagnitude, bvColor });
  });
  if (records.length === 0) throw new Error('HEASARC BSC5P catalog is empty.');
  return Object.freeze(records);
}

export function tierForQuality(
  quality: VisualQuality,
  maximumTextureSize: number,
): SkyTextureTier {
  return quality === 'ultra' && maximumTextureSize >= 8_192 ? '8k' : '4k';
}

export function brightStarDisplayProperties(
  visualMagnitude: number,
  bvColor: number | null,
): Readonly<{ sizePx: number; intensity: number; color: Readonly<Color> }> {
  if (!Number.isFinite(visualMagnitude)) {
    throw new RangeError('Bright-star visual magnitude must be finite.');
  }
  const flux = 10 ** (-0.4 * visualMagnitude);
  const intensity = Math.min(Math.max(flux / 3.9, 0.035), 1.35);
  const sizePx = Math.min(Math.max(1.15 + Math.sqrt(flux) * 1.28, 1.2), 8.5);
  return Object.freeze({
    sizePx,
    intensity,
    color: Object.freeze(starColorFromBv(bvColor)),
  });
}

function createBrightStarLayer(
  stars: readonly Readonly<BrightStarRecord>[],
): Points<BufferGeometry, ShaderMaterial> {
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const sizes = new Float32Array(stars.length);
  const intensities = new Float32Array(stars.length);
  stars.forEach((star, index) => {
    const cosDeclination = Math.cos(star.declinationRad);
    const offset = index * 3;
    // ICRF equatorial mapped to the panorama's RA-left plate carrée axes.
    positions[offset] = STAR_RADIUS * cosDeclination * Math.cos(star.rightAscensionRad);
    positions[offset + 1] = STAR_RADIUS * Math.sin(star.declinationRad);
    positions[offset + 2] = -STAR_RADIUS * cosDeclination * Math.sin(star.rightAscensionRad);
    const display = brightStarDisplayProperties(star.visualMagnitude, star.bvColor);
    colors[offset] = display.color.r;
    colors[offset + 1] = display.color.g;
    colors[offset + 2] = display.color.b;
    sizes[index] = display.sizePx;
    intensities[index] = display.intensity;
  });

  const geometry = new BufferGeometry();
  geometry.name = 'heasarc-bsc5p-bright-stars';
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aIntensity', new Float32BufferAttribute(intensities, 1));
  const material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    fragmentShader: `
      varying vec3 vColor;
      varying float vIntensity;
      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radius2 = dot(centered, centered);
        if (radius2 > 1.0) discard;
        float core = exp(-radius2 * 3.8);
        float halo = max(0.0, 1.0 - radius2) * 0.34;
        gl_FragColor = vec4(vColor * (core + halo) * vIntensity, (core + halo) * vIntensity);
      }
    `,
    transparent: true,
    toneMapped: false,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aIntensity;
      varying vec3 vColor;
      varying float vIntensity;
      void main() {
        vColor = aColor;
        vIntensity = aIntensity;
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  material.name = 'magnitude-scaled-heasarc-bright-stars';
  const points = new Points(geometry, material);
  points.name = 'bright-star-point-catalog-layer';
  points.frustumCulled = false;
  points.renderOrder = -999;
  return points;
}

function starColorFromBv(bvColor: number | null): Color {
  if (bvColor === null) return new Color(0xdce9ff);
  const bounded = Math.min(Math.max(bvColor, -0.4), 2);
  const temperatureK =
    4_600 * (1 / (0.92 * bounded + 1.7) + 1 / (0.92 * bounded + 0.62));
  return blackBodyApproximation(temperatureK);
}

function blackBodyApproximation(temperatureK: number): Color {
  const temperature = Math.min(Math.max(temperatureK / 100, 10), 400);
  let red: number;
  let green: number;
  let blue: number;
  if (temperature <= 66) {
    red = 255;
    green = 99.470_802_586_1 * Math.log(temperature) - 161.119_568_166_1;
    blue = temperature <= 19
      ? 0
      : 138.517_731_223_1 * Math.log(temperature - 10) - 305.044_792_730_7;
  } else {
    red = 329.698_727_446 * (temperature - 60) ** -0.133_204_759_2;
    green = 288.122_169_528_3 * (temperature - 60) ** -0.075_514_849_2;
    blue = 255;
  }
  return new Color(clamp255(red) / 255, clamp255(green) / 255, clamp255(blue) / 255);
}

function requireAssetUrl(value: string, label: string): string {
  if (value.trim().length === 0) throw new Error(`${label} URL cannot be empty.`);
  return value;
}

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

const clamp255 = (value: number): number => Math.min(Math.max(value, 0), 255);
