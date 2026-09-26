import {
  Color,
  Group,
  NormalBlending,
  Vector2,
} from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
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
  readonly core: Line2;
  readonly kind: EphemerisPathKind;
  readonly bodyId: string;
  readonly centerBodyId: string | null;
  readonly source: Float64Array;
  readonly spinePointCount: number;
  readonly mappedPositions: Float32Array;
  readonly mappedColors: Float32Array;
  readonly uploadPositions: Float32Array;
  readonly uploadColors: Float32Array;
  readonly color: Color;
  readonly baseColor: LinearRgb;
}

/**
 * Single fat Line2 stroke per ephemeris path. Replaces 1px LineBasicMaterial
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
  const mappedPositions = new Float32Array(path.positionsM.length);
  const mappedColors = new Float32Array(path.positionsM.length);
  const uploadPositions = new Float32Array(path.positionsM.length);
  const uploadColors = new Float32Array(path.positionsM.length);

  const coreGeometry = new LineGeometry();
  coreGeometry.setPositions(mappedPositions);
  coreGeometry.setColors(mappedColors);
  const coreMaterial = createLineMaterial(kind, viewportCssPixels);
  const core = new Line2(coreGeometry, coreMaterial);
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
  resources.uploadPositions.set(resources.mappedPositions);
  resources.uploadColors.set(resources.mappedColors);

  const coreGeometry = resources.core.geometry as LineGeometry;
  coreGeometry.setPositions(resources.uploadPositions);
  coreGeometry.setColors(resources.uploadColors);
  resources.core.computeLineDistances();
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
