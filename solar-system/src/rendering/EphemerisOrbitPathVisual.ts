import {
  type Color,
  Group,
  NormalBlending,
  type Vector2,
} from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { PrecisionPath, registerPrecisionPath } from './PrecisionPath';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import type { EphemerisPathKind } from './EphemerisOrbitGeometry';
import type { LinearRgb } from './EphemerisPathMapping';

export type EphemerisOrbitPathEmphasis = 'selected' | 'system' | 'background';

export interface EphemerisOrbitPathRole {
  readonly emphasis: EphemerisOrbitPathEmphasis;
  readonly kind: EphemerisPathKind;
}

export interface EphemerisOrbitPathPresentation {
  readonly opacity: number;
  readonly widthPx: number;
  readonly intensity: number;
}

export interface EphemerisOrbitPathResources {
  readonly root: Group;
  readonly core: LineSegments2;
  readonly kind: EphemerisPathKind;
  readonly bodyId: string;
  readonly centerBodyId: string | null;
  readonly source: Float64Array;
  readonly spinePointCount: number;
  readonly mappedPositions: Float64Array;
  readonly precision: PrecisionPath;
  readonly anchoredPositionsM: Float64Array;
  activePointCount: number;
  readonly mappedColors: Float32Array;
  readonly uploadPositions: Float32Array;
  readonly uploadColors: Float32Array;
  readonly color: Color;
  readonly baseColor: LinearRgb;
}

/**
 * Single fat LineSegments2 stroke per ephemeris path. Replaces 1px LineBasicMaterial
 * so orbits stay readable without a doubled glow rail.
 */
export function createEphemerisOrbitPath(
  path: {
    readonly bodyId: string;
    readonly centerBodyId?: string | null;
    readonly kind?: EphemerisPathKind;
    readonly positionsM: Float64Array;
  },
  baseColor: Color,
  viewportCssPixels: Readonly<Vector2>,
): EphemerisOrbitPathResources {
  if (path.positionsM.length < 6 || path.positionsM.length % 3 !== 0) {
    throw new RangeError(`Ephemeris path "${path.bodyId}" requires at least two xyz samples.`);
  }

  const kind = path.kind ?? 'orbit';
  const spinePointCount = path.positionsM.length / 3;
  const precision = new PrecisionPath(spinePointCount + 1);
  precision.pointCount = spinePointCount;
  const mappedPositions = precision.positions;
  const mappedColors = precision.colors;
  const uploadPositions = precision.segments;
  const uploadColors = precision.segmentColors;

  const coreGeometry = new LineSegmentsGeometry();
  coreGeometry.setPositions(uploadPositions);
  coreGeometry.setColors(uploadColors);
  const coreMaterial = createLineMaterial(kind, viewportCssPixels);
  const core = new LineSegments2(coreGeometry, coreMaterial);
  coreMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('modelViewMatrix * vec4( instanceStart, 1.0 )', 'vec4( instanceStart, 1.0 )')
      .replace('modelViewMatrix * vec4( instanceEnd, 1.0 )', 'vec4( instanceEnd, 1.0 )');
  };
  coreMaterial.customProgramCacheKey = () => 'precision-fat-path-view-space-v1';
  registerPrecisionPath(core, (camera) => {
    coreGeometry.instanceCount = precision.prepare(camera);
    // Interleaved buffers already reference the reusable output arrays.
    coreGeometry.getAttribute('instanceStart').needsUpdate = true;
    coreGeometry.getAttribute('instanceColorStart').needsUpdate = true;
  });
  core.name = `ephemeris-${kind}-${path.bodyId}`;
  core.frustumCulled = false;
  core.computeLineDistances();

  const root = new Group();
  root.name = `ephemeris-${kind}-${path.bodyId}-root`;
  root.frustumCulled = false;
  root.add(core);

  return {
    root,
    core,
    kind,
    bodyId: path.bodyId,
    centerBodyId: path.centerBodyId ?? null,
    source: path.positionsM,
    spinePointCount,
    precision,
    anchoredPositionsM: new Float64Array(path.positionsM.length + 3),
    activePointCount: spinePointCount,
    mappedPositions,
    mappedColors,
    uploadPositions,
    uploadColors,
    color: baseColor,
    baseColor: {
      r: baseColor.r,
      g: baseColor.g,
      b: baseColor.b,
    },
  };
}

export function syncEphemerisOrbitPathGeometry(
  resources: EphemerisOrbitPathResources,
): void {
  resources.precision.pointCount = resources.activePointCount;
}

export function applyEphemerisOrbitPathRole(
  resources: EphemerisOrbitPathResources,
  role: EphemerisOrbitPathRole,
): void {
  const presentation = calculateEphemerisOrbitPathPresentation(role);
  const coreMaterial = resources.core.material as LineMaterial;
  coreMaterial.opacity = presentation.opacity;
  coreMaterial.linewidth = presentation.widthPx;
  coreMaterial.color.setScalar(presentation.intensity);
  const baseOrder = role.kind === 'trail' ? 2 : 1;
  const boost =
    role.emphasis === 'selected' ? 3 : role.emphasis === 'system' ? 1 : 0;
  resources.core.renderOrder = baseOrder + boost;
}

export function setEphemerisOrbitPathResolution(
  resources: EphemerisOrbitPathResources,
  widthCssPixels: number,
  heightCssPixels: number,
): void {
  (resources.core.material as LineMaterial).resolution.set(
    Math.max(1, widthCssPixels),
    Math.max(1, heightCssPixels),
  );
}

export function disposeEphemerisOrbitPath(resources: EphemerisOrbitPathResources): void {
  resources.core.geometry.dispose();
  (resources.core.material as LineMaterial).dispose();
}

export function calculateEphemerisOrbitPathPresentation(
  role: EphemerisOrbitPathRole,
): EphemerisOrbitPathPresentation {
  if (role.kind === 'trail') {
    if (role.emphasis === 'selected') {
      return { opacity: 0.82, widthPx: 2.8, intensity: 1.2 };
    }
    return { opacity: 0.32, widthPx: 1.5, intensity: 0.88 };
  }

  if (role.emphasis === 'selected') {
    return { opacity: 0.72, widthPx: 2.55, intensity: 1.14 };
  }
  if (role.emphasis === 'system') {
    return { opacity: 0.42, widthPx: 1.85, intensity: 1.0 };
  }
  return { opacity: 0.24, widthPx: 1.35, intensity: 0.86 };
}

const SYSTEM_EMPHASIS_BODY_IDS = new Set([
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]);

export function resolveEphemerisOrbitPathEmphasis(
  pathBodyId: string,
  selectedBodyId: string,
  kind: EphemerisPathKind,
): EphemerisOrbitPathEmphasis {
  if (pathBodyId === selectedBodyId) return 'selected';
  if (
    selectedBodyId === 'sun' &&
    kind === 'orbit' &&
    SYSTEM_EMPHASIS_BODY_IDS.has(pathBodyId)
  ) {
    return 'system';
  }
  return 'background';
}

function createLineMaterial(
  kind: EphemerisPathKind,
  viewportCssPixels: Readonly<Vector2>,
): LineMaterial {
  const presentation = calculateEphemerisOrbitPathPresentation({
    kind,
    emphasis: 'background',
  });
  const material = new LineMaterial({
    color: 0xffffff,
    linewidth: presentation.widthPx,
    transparent: true,
    opacity: presentation.opacity,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    toneMapped: false,
    blending: NormalBlending,
    dashed: false,
  });
  material.resolution.set(
    Math.max(1, viewportCssPixels.x),
    Math.max(1, viewportCssPixels.y),
  );
  return material;
}
