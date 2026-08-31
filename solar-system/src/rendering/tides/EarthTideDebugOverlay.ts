import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

export const EARTH_TIDE_DEBUG_MODES = [
  'off',
  'lunar',
  'solar',
  'both',
] as const;

export type EarthTideDebugMode = (typeof EARTH_TIDE_DEBUG_MODES)[number];

export interface EarthTideDebugDirection {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Renderer-facing state produced by a tide module. Amplitudes are normalized
 * display weights, not ocean-height predictions.
 */
export interface EarthTideDebugRenderSample {
  readonly jdTdb: number;
  readonly mode: EarthTideDebugMode;
  readonly moonDirectionEarthFixed: Readonly<EarthTideDebugDirection>;
  readonly sunDirectionEarthFixed: Readonly<EarthTideDebugDirection>;
  readonly lunarAmplitude: number;
  readonly solarAmplitude: number;
}

export interface EarthTideDebugDiagnostics {
  readonly active: boolean;
  readonly hasValidSample: boolean;
  readonly mode: EarthTideDebugMode;
  readonly jdTdb: number | null;
  readonly lunarVisible: boolean;
  readonly solarVisible: boolean;
  readonly lunarAmplitude: number;
  readonly solarAmplitude: number;
  readonly lunarVisualX: number;
  readonly lunarVisualY: number;
  readonly lunarVisualZ: number;
  readonly solarVisualX: number;
  readonly solarVisualY: number;
  readonly solarVisualZ: number;
  readonly boundingRadiusMultiplier: number;
}

type MutableDiagnostics = {
  -readonly [Key in keyof EarthTideDebugDiagnostics]: EarthTideDebugDiagnostics[Key];
};

const LUNAR_COLOR = 0x55d9ff;
const SOLAR_COLOR = 0xffb247;
const LUNAR_SHELL_BASE_RADIUS = 1.047;
const LUNAR_SHELL_MAX_DISPLACEMENT = 0.018;
const SOLAR_SHELL_BASE_RADIUS = 1.069;
const SOLAR_SHELL_MAX_DISPLACEMENT = 0.014;
const MARKER_SURFACE_RADIUS = 1.084;
const MARKER_RADIUS = 0.012;

/** Includes both shells and the complete marker geometry. */
export const EARTH_TIDE_DEBUG_BOUNDING_RADIUS_MULTIPLIER = 1.1;

const SHELL_VERTEX_SHADER = /* glsl */ `
  uniform vec3 uDirection;
  uniform float uStrength;
  uniform float uBaseRadius;
  uniform float uMaxDisplacement;

  varying float vP2;

  void main() {
    vec3 unitPosition = normalize(position);
    float cosine = dot(unitPosition, normalize(uDirection));
    vP2 = 0.5 * (3.0 * cosine * cosine - 1.0);
    float radius = uBaseRadius + uMaxDisplacement * uStrength * vP2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(unitPosition * radius, 1.0);
  }
`;

const SHELL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vP2;

  void main() {
    float lobe = smoothstep(-0.5, 1.0, vP2);
    vec3 shadedColor = uColor * mix(0.62, 1.22, lobe);
    float alpha = uOpacity * mix(0.28, 1.0, lobe);
    gl_FragColor = vec4(shadedColor, alpha);
  }
`;

/**
 * Earth-local developer overlay. The caller owns where `root` is attached.
 * Update and reset paths do not allocate or dispose render resources.
 */
export class EarthTideDebugOverlay {
  public readonly root = new Group();

  private readonly lunarGroup = new Group();
  private readonly solarGroup = new Group();
  private readonly shellGeometry = new SphereGeometry(1, 48, 32);
  private readonly markerGeometry = new SphereGeometry(MARKER_RADIUS, 16, 12);
  private readonly lunarVisualDirection = new Vector3(1, 0, 0);
  private readonly solarVisualDirection = new Vector3(1, 0, 0);
  private readonly lunarStrengthUniform = { value: 0 };
  private readonly solarStrengthUniform = { value: 0 };
  private readonly lunarShellMaterial: ShaderMaterial;
  private readonly solarShellMaterial: ShaderMaterial;
  private readonly lunarMarkerMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: LUNAR_COLOR,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
    opacity: 0.95,
  });
  private readonly solarMarkerMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: SOLAR_COLOR,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
    opacity: 0.95,
  });
  private readonly lunarShell: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly solarShell: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly sublunarMarker: Mesh<SphereGeometry, MeshBasicMaterial>;
  private readonly subsolarMarker: Mesh<SphereGeometry, MeshBasicMaterial>;
  private readonly diagnostics: MutableDiagnostics = {
    active: false,
    hasValidSample: false,
    mode: 'off',
    jdTdb: null,
    lunarVisible: false,
    solarVisible: false,
    lunarAmplitude: 0,
    solarAmplitude: 0,
    lunarVisualX: 1,
    lunarVisualY: 0,
    lunarVisualZ: 0,
    solarVisualX: 1,
    solarVisualY: 0,
    solarVisualZ: 0,
    boundingRadiusMultiplier: 1,
  };
  private disposed = false;

  public constructor() {
    this.root.name = 'earth-tide-debug-overlay';
    this.lunarGroup.name = 'earth-tide-lunar-component';
    this.solarGroup.name = 'earth-tide-solar-component';

    this.lunarShellMaterial = createShellMaterial(
      LUNAR_COLOR,
      LUNAR_SHELL_BASE_RADIUS,
      LUNAR_SHELL_MAX_DISPLACEMENT,
      this.lunarVisualDirection,
      this.lunarStrengthUniform,
    );
    this.solarShellMaterial = createShellMaterial(
      SOLAR_COLOR,
      SOLAR_SHELL_BASE_RADIUS,
      SOLAR_SHELL_MAX_DISPLACEMENT,
      this.solarVisualDirection,
      this.solarStrengthUniform,
    );
    this.lunarShell = new Mesh(this.shellGeometry, this.lunarShellMaterial);
    this.solarShell = new Mesh(this.shellGeometry, this.solarShellMaterial);
    this.sublunarMarker = new Mesh(this.markerGeometry, this.lunarMarkerMaterial);
    this.subsolarMarker = new Mesh(this.markerGeometry, this.solarMarkerMaterial);

    this.lunarShell.name = 'earth-tide-lunar-p2-shell';
    this.solarShell.name = 'earth-tide-solar-p2-shell';
    this.sublunarMarker.name = 'earth-tide-sublunar-marker';
    this.subsolarMarker.name = 'earth-tide-subsolar-marker';
    this.lunarShell.renderOrder = 6;
    this.solarShell.renderOrder = 7;
    this.sublunarMarker.renderOrder = 8;
    this.subsolarMarker.renderOrder = 8;
    this.lunarShell.frustumCulled = false;
    this.solarShell.frustumCulled = false;
    this.sublunarMarker.frustumCulled = false;
    this.subsolarMarker.frustumCulled = false;

    this.lunarGroup.add(this.lunarShell, this.sublunarMarker);
    this.solarGroup.add(this.solarShell, this.subsolarMarker);
    this.root.add(this.lunarGroup, this.solarGroup);
    this.clear();
  }

  public update(sample: Readonly<EarthTideDebugRenderSample>): void {
    this.assertNotDisposed();
    validateSample(sample);

    mapValidatedDirection(
      this.lunarVisualDirection,
      sample.moonDirectionEarthFixed,
    );
    mapValidatedDirection(
      this.solarVisualDirection,
      sample.sunDirectionEarthFixed,
    );
    this.lunarStrengthUniform.value = sample.lunarAmplitude;
    this.solarStrengthUniform.value = sample.solarAmplitude;
    this.sublunarMarker.position
      .copy(this.lunarVisualDirection)
      .multiplyScalar(MARKER_SURFACE_RADIUS);
    this.subsolarMarker.position
      .copy(this.solarVisualDirection)
      .multiplyScalar(MARKER_SURFACE_RADIUS);

    const lunarVisible = sample.mode === 'lunar' || sample.mode === 'both';
    const solarVisible = sample.mode === 'solar' || sample.mode === 'both';
    const active = lunarVisible || solarVisible;
    this.root.visible = active;
    this.lunarGroup.visible = lunarVisible;
    this.solarGroup.visible = solarVisible;

    this.diagnostics.active = active;
    this.diagnostics.hasValidSample = true;
    this.diagnostics.mode = sample.mode;
    this.diagnostics.jdTdb = sample.jdTdb;
    this.diagnostics.lunarVisible = lunarVisible;
    this.diagnostics.solarVisible = solarVisible;
    this.diagnostics.lunarAmplitude = sample.lunarAmplitude;
    this.diagnostics.solarAmplitude = sample.solarAmplitude;
    this.diagnostics.lunarVisualX = this.lunarVisualDirection.x;
    this.diagnostics.lunarVisualY = this.lunarVisualDirection.y;
    this.diagnostics.lunarVisualZ = this.lunarVisualDirection.z;
    this.diagnostics.solarVisualX = this.solarVisualDirection.x;
    this.diagnostics.solarVisualY = this.solarVisualDirection.y;
    this.diagnostics.solarVisualZ = this.solarVisualDirection.z;
    this.diagnostics.boundingRadiusMultiplier = active
      ? EARTH_TIDE_DEBUG_BOUNDING_RADIUS_MULTIPLIER
      : 1;
  }

  public clear(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.lunarGroup.visible = false;
    this.solarGroup.visible = false;
    this.lunarStrengthUniform.value = 0;
    this.solarStrengthUniform.value = 0;
    this.lunarVisualDirection.set(1, 0, 0);
    this.solarVisualDirection.set(1, 0, 0);
    this.sublunarMarker.position.set(MARKER_SURFACE_RADIUS, 0, 0);
    this.subsolarMarker.position.set(MARKER_SURFACE_RADIUS, 0, 0);
    this.resetDiagnostics();
  }

  public reset(): void {
    this.clear();
  }

  public getDiagnostics(): Readonly<EarthTideDebugDiagnostics> {
    return this.diagnostics;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.root.removeFromParent();
    this.clear();
    this.shellGeometry.dispose();
    this.markerGeometry.dispose();
    this.lunarShellMaterial.dispose();
    this.solarShellMaterial.dispose();
    this.lunarMarkerMaterial.dispose();
    this.solarMarkerMaterial.dispose();
    this.lunarGroup.clear();
    this.solarGroup.clear();
    this.root.clear();
    this.disposed = true;
  }

  private resetDiagnostics(): void {
    this.diagnostics.active = false;
    this.diagnostics.hasValidSample = false;
    this.diagnostics.mode = 'off';
    this.diagnostics.jdTdb = null;
    this.diagnostics.lunarVisible = false;
    this.diagnostics.solarVisible = false;
    this.diagnostics.lunarAmplitude = 0;
    this.diagnostics.solarAmplitude = 0;
    this.diagnostics.lunarVisualX = 1;
    this.diagnostics.lunarVisualY = 0;
    this.diagnostics.lunarVisualZ = 0;
    this.diagnostics.solarVisualX = 1;
    this.diagnostics.solarVisualY = 0;
    this.diagnostics.solarVisualZ = 0;
    this.diagnostics.boundingRadiusMultiplier = 1;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Earth tide debug overlay is disposed.');
  }
}

/** Maps Earth-fixed +Z-north coordinates into the Earth visual's +Y-north frame. */
export function mapEarthFixedDirectionToEarthVisual(
  target: Vector3,
  direction: Readonly<EarthTideDebugDirection>,
): Vector3 {
  validateDirection(direction, 'Earth-fixed direction');
  mapValidatedDirection(target, direction);
  return target;
}

export function evaluateEquilibriumTideP2(cosine: number): number {
  if (!Number.isFinite(cosine) || cosine < -1 || cosine > 1) {
    throw new RangeError('Equilibrium-tide cosine must be finite and in [-1, 1].');
  }
  return 0.5 * (3 * cosine * cosine - 1);
}

function createShellMaterial(
  color: number,
  baseRadius: number,
  maximumDisplacement: number,
  direction: Vector3,
  strengthUniform: { value: number },
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uDirection: { value: direction },
      uStrength: strengthUniform,
      uBaseRadius: { value: baseRadius },
      uMaxDisplacement: { value: maximumDisplacement },
      uColor: { value: new Color(color) },
      uOpacity: { value: 0.25 },
    },
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
  });
}

function validateSample(sample: Readonly<EarthTideDebugRenderSample>): void {
  if (!Number.isFinite(sample.jdTdb)) {
    throw new RangeError('Earth tide debug Julian date must be finite.');
  }
  if (
    sample.mode !== 'off'
    && sample.mode !== 'lunar'
    && sample.mode !== 'solar'
    && sample.mode !== 'both'
  ) {
    throw new RangeError(`Unsupported Earth tide debug mode "${String(sample.mode)}".`);
  }
  validateDirection(sample.moonDirectionEarthFixed, 'Moon Earth-fixed direction');
  validateDirection(sample.sunDirectionEarthFixed, 'Sun Earth-fixed direction');
  validateAmplitude(sample.lunarAmplitude, 'lunar');
  validateAmplitude(sample.solarAmplitude, 'solar');
}

function validateDirection(
  direction: Readonly<EarthTideDebugDirection>,
  label: string,
): void {
  const { x, y, z } = direction;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError(`${label} must contain finite components.`);
  }
  if (x * x + y * y + z * z < 1e-12) {
    throw new RangeError(`${label} must be non-zero.`);
  }
}

function validateAmplitude(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `Earth tide debug ${label} amplitude must be finite and in [0, 1].`,
    );
  }
}

function mapValidatedDirection(
  target: Vector3,
  direction: Readonly<EarthTideDebugDirection>,
): void {
  const inverseLength = 1 / Math.sqrt(
    direction.x * direction.x
      + direction.y * direction.y
      + direction.z * direction.z,
  );
  target.set(
    direction.x === 0 ? 0 : direction.x * inverseLength,
    direction.z === 0 ? 0 : direction.z * inverseLength,
    direction.y === 0 ? 0 : -direction.y * inverseLength,
  );
}
