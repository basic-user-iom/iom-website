import { dateUtcToApproximateTdb } from '../simulation/core/JulianDate';
import type { RendererCameraSnapshot } from '../rendering/impact';
import { CAMERA_MODES } from '../rendering/camera/CameraTypes';
import { CAMERA_CLOSE_UP_PRESET_IDS } from '../rendering/camera/CameraCloseUpPresets';
import { isObservatoryBodyId } from '../simulation/bodies/ObservatoryBodyCatalog';

export const SHARED_LAYER_KEYS = ['orbitLinesVisible', 'bodyLabelsVisible', 'skyBackgroundVisible', 'brightStarsVisible', 'cometsVisible', 'asteroidBeltVisible', 'kuiperBeltVisible'] as const;
export interface SharedView {
  readonly version: 1;
  readonly utc: string;
  /** Preserve the existing simulation epoch without a millisecond UTC round-trip. */
  readonly jdTdb: number;
  readonly scale: 'true' | 'presentation';
  readonly camera: RendererCameraSnapshot;
  readonly origin: readonly [number, number, number];
  readonly originBodyId: string;
  readonly layers: Record<typeof SHARED_LAYER_KEYS[number], boolean>;
  readonly venus: 'clouds' | 'radar';
  readonly auxiliary: { readonly moonId: string | null; readonly spaceObjectId: string | null };
}
export type SharedViewResult = { view: SharedView | null; error: string | null };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const tuple = (value: unknown, limit: number): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit);
const id = (value: unknown) => value === null || (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value));

/** Public URL input is validated before touching the simulation or WebGL. */
export function parseSharedView(hash: string): SharedViewResult {
  if (!hash.startsWith('#view=')) return { view: null, error: null };
  try {
    if (hash.length > 12000) throw new Error('oversize');
    const v: unknown = JSON.parse(decodeURIComponent(hash.slice(6)));
    if (!record(v) || v.version !== 1 || typeof v.utc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.utc) || !Number.isFinite(Date.parse(v.utc))) throw new Error('date');
    if (new Date(v.utc).toISOString() !== v.utc || (v.scale !== 'true' && v.scale !== 'presentation')) throw new Error('scale');
    if (typeof v.jdTdb !== 'number' || !Number.isFinite(v.jdTdb) || Math.abs(v.jdTdb - dateUtcToApproximateTdb(new Date(v.utc))) > 2 / 86400000) throw new Error('epoch');
    const c = v.camera;
    if (!record(c) || (typeof c.selectedBodyId !== 'string' || !isObservatoryBodyId(c.selectedBodyId)) || !CAMERA_MODES.includes(c.mode as never) || !(c.closeUpPresetId === null || CAMERA_CLOSE_UP_PRESET_IDS.includes(c.closeUpPresetId as never))) throw new Error('camera');
    if (!tuple(c.position, 1e6) || !tuple(c.target, 1e6) || !tuple(c.up, 1) || Math.hypot(...c.up) < 0.5 || Math.hypot(...c.position.map((x, i) => x - (c.target as number[])[i]!)) < 1e-14) throw new Error('pose');
    if (!tuple(v.origin, 1e16) || (typeof v.originBodyId !== 'string' || !isObservatoryBodyId(v.originBodyId))) throw new Error('origin');
    const layers = v.layers;
    if (!record(layers) || !SHARED_LAYER_KEYS.every(key => typeof layers[key] === 'boolean')) throw new Error('layers');
    if (v.venus !== 'clouds' && v.venus !== 'radar') throw new Error('venus');
    if (!record(v.auxiliary) || !id(v.auxiliary.moonId) || !id(v.auxiliary.spaceObjectId) || (v.auxiliary.moonId && v.auxiliary.spaceObjectId)) throw new Error('target');
    return { view: v as unknown as SharedView, error: null };
  } catch {
    return { view: null, error: 'This shared view is invalid or from an unsupported version. The observatory opened normally.' };
  }
}
export function sharedViewUrl(base: string, view: SharedView): string {
  const url = new URL(base);
  // A share URL carries only the documented view, never debug flags or unrelated query values.
  url.search = '';
  url.hash = `view=${encodeURIComponent(JSON.stringify(view))}`;
  return url.href;
}
