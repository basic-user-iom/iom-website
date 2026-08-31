import type { PersistStorage, StorageValue } from 'zustand/middleware';

import type { RenderScaleMode } from '../rendering/RenderScaleModel';
import type {
  VenusSurfaceMode,
  VisualQuality,
} from '../rendering/bodies/VisualQuality';
import { CAMERA_MODES, type CameraMode } from '../rendering/camera';
import {
  isObservatoryBodyId,
  type ObservatoryBodyId,
} from '../simulation/bodies/ObservatoryBodyCatalog';

export const APP_PREFERENCES_STORAGE_KEY = 'iom.solar-system.preferences';
export const APP_PREFERENCES_VERSION = 1;

export const MOTION_PREFERENCES = ['system', 'reduce', 'full'] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

export type PersistedTrailInterval = 'previous' | 'next';

/**
 * Deliberately narrow durable state. Simulation snapshots, WebGL/error state,
 * telemetry, and transient tour state must never be added to this interface.
 */
export interface PersistedAppPreferencesV1 {
  readonly selectedBodyId: ObservatoryBodyId;
  readonly cameraMode: CameraMode;
  readonly renderScaleMode: RenderScaleMode;
  readonly visualQuality: VisualQuality;
  readonly venusSurfaceMode: VenusSurfaceMode;
  readonly orbitLinesVisible: boolean;
  readonly bodyLabelsVisible: boolean;
  readonly skyBackgroundVisible: boolean;
  readonly brightStarsVisible: boolean;
  readonly cometsVisible: boolean;
  readonly asteroidBeltVisible: boolean;
  readonly kuiperBeltVisible: boolean;
  readonly selectedTrailInterval: PersistedTrailInterval;
  readonly motionPreference: MotionPreference;
  readonly reduceFlashes: boolean;
}

export type AppPreferenceSource = PersistedAppPreferencesV1;

export interface PreferenceStorageBackend {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export const DEFAULT_APP_PREFERENCES: Readonly<PersistedAppPreferencesV1> =
  Object.freeze({
    selectedBodyId: 'earth',
    cameraMode: 'overview',
    renderScaleMode: 'presentation',
    visualQuality: 'high',
    venusSurfaceMode: 'clouds',
    orbitLinesVisible: true,
    bodyLabelsVisible: true,
    skyBackgroundVisible: true,
    brightStarsVisible: true,
    cometsVisible: true,
    asteroidBeltVisible: true,
    kuiperBeltVisible: false,
    selectedTrailInterval: 'previous',
    motionPreference: 'system',
    reduceFlashes: true,
  });

const RENDER_SCALE_MODES: readonly RenderScaleMode[] = ['true', 'presentation'];
const VISUAL_QUALITIES: readonly VisualQuality[] = ['low', 'medium', 'high', 'ultra'];
const VENUS_SURFACE_MODES: readonly VenusSurfaceMode[] = ['clouds', 'radar'];
const TRAIL_INTERVALS: readonly PersistedTrailInterval[] = ['previous', 'next'];

export function selectPersistedAppPreferences(
  source: AppPreferenceSource,
): PersistedAppPreferencesV1 {
  return {
    selectedBodyId: source.selectedBodyId,
    cameraMode: source.cameraMode,
    renderScaleMode: source.renderScaleMode,
    visualQuality: source.visualQuality,
    venusSurfaceMode: source.venusSurfaceMode,
    orbitLinesVisible: source.orbitLinesVisible,
    bodyLabelsVisible: source.bodyLabelsVisible,
    skyBackgroundVisible: source.skyBackgroundVisible,
    brightStarsVisible: source.brightStarsVisible,
    cometsVisible: source.cometsVisible,
    asteroidBeltVisible: source.asteroidBeltVisible,
    kuiperBeltVisible: source.kuiperBeltVisible,
    selectedTrailInterval: source.selectedTrailInterval,
    motionPreference: source.motionPreference,
    reduceFlashes: source.reduceFlashes,
  };
}

/** Validate each durable field independently and discard every unknown key. */
export function sanitizePersistedAppPreferences(
  candidate: unknown,
): PersistedAppPreferencesV1 {
  const source = isRecord(candidate) ? candidate : {};
  const defaults = DEFAULT_APP_PREFERENCES;
  return {
    selectedBodyId:
      typeof source.selectedBodyId === 'string' && isObservatoryBodyId(source.selectedBodyId)
        ? source.selectedBodyId
        : defaults.selectedBodyId,
    cameraMode: memberOrDefault(source.cameraMode, CAMERA_MODES, defaults.cameraMode),
    renderScaleMode: memberOrDefault(
      source.renderScaleMode,
      RENDER_SCALE_MODES,
      defaults.renderScaleMode,
    ),
    visualQuality: memberOrDefault(
      source.visualQuality,
      VISUAL_QUALITIES,
      defaults.visualQuality,
    ),
    venusSurfaceMode: memberOrDefault(
      source.venusSurfaceMode,
      VENUS_SURFACE_MODES,
      defaults.venusSurfaceMode,
    ),
    orbitLinesVisible: booleanOrDefault(
      source.orbitLinesVisible,
      defaults.orbitLinesVisible,
    ),
    bodyLabelsVisible: booleanOrDefault(
      source.bodyLabelsVisible,
      defaults.bodyLabelsVisible,
    ),
    skyBackgroundVisible: booleanOrDefault(
      source.skyBackgroundVisible,
      defaults.skyBackgroundVisible,
    ),
    brightStarsVisible: booleanOrDefault(
      source.brightStarsVisible,
      defaults.brightStarsVisible,
    ),
    cometsVisible: booleanOrDefault(source.cometsVisible, defaults.cometsVisible),
    asteroidBeltVisible: booleanOrDefault(
      source.asteroidBeltVisible,
      defaults.asteroidBeltVisible,
    ),
    kuiperBeltVisible: booleanOrDefault(
      source.kuiperBeltVisible,
      defaults.kuiperBeltVisible,
    ),
    selectedTrailInterval: memberOrDefault(
      source.selectedTrailInterval,
      TRAIL_INTERVALS,
      defaults.selectedTrailInterval,
    ),
    motionPreference: memberOrDefault(
      source.motionPreference,
      MOTION_PREFERENCES,
      defaults.motionPreference,
    ),
    reduceFlashes: booleanOrDefault(source.reduceFlashes, defaults.reduceFlashes),
  };
}

export function migrateAppPreferences(
  persistedState: unknown,
  persistedVersion: number,
): PersistedAppPreferencesV1 {
  if (!Number.isInteger(persistedVersion) || persistedVersion < 0) {
    return { ...DEFAULT_APP_PREFERENCES };
  }
  if (persistedVersion > APP_PREFERENCES_VERSION) {
    return { ...DEFAULT_APP_PREFERENCES };
  }
  return sanitizePersistedAppPreferences(persistedState);
}

/**
 * Synchronous, exception-safe JSON storage. If localStorage is unavailable or
 * starts throwing (privacy mode/quota/security), the session transparently
 * continues with an in-memory backend. Identical preference payloads are
 * deduplicated, so throttled simulation snapshot writes never touch storage.
 */
export function createSafeAppPreferencesStorage(
  suppliedBackend?: PreferenceStorageBackend,
): PersistStorage<PersistedAppPreferencesV1> {
  const memory = new Map<string, string>();
  let backendResolved = suppliedBackend !== undefined;
  let backend: PreferenceStorageBackend | null = suppliedBackend ?? null;
  let backendFailed = false;
  const lastSerialized = new Map<string, string>();

  const resolveBackend = (): PreferenceStorageBackend | null => {
    if (backendResolved) return backendFailed ? null : backend;
    backendResolved = true;
    try {
      backend = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      backend = null;
      backendFailed = true;
    }
    return backend;
  };

  const readRaw = (name: string): string | null => {
    const activeBackend = resolveBackend();
    if (activeBackend !== null && !backendFailed) {
      try {
        return activeBackend.getItem(name);
      } catch {
        backendFailed = true;
      }
    }
    return memory.get(name) ?? null;
  };

  const writeRaw = (name: string, value: string): void => {
    memory.set(name, value);
    const activeBackend = resolveBackend();
    if (activeBackend === null || backendFailed) return;
    try {
      activeBackend.setItem(name, value);
    } catch {
      backendFailed = true;
    }
  };

  return {
    getItem(name): StorageValue<PersistedAppPreferencesV1> | null {
      const raw = readRaw(name);
      if (raw === null) return null;
      try {
        const envelope: unknown = JSON.parse(raw);
        if (!isRecord(envelope) || !('state' in envelope)) return null;
        if (
          typeof envelope.version !== 'number' ||
          !Number.isInteger(envelope.version) ||
          envelope.version < 0
        ) {
          return null;
        }
        const normalized: StorageValue<PersistedAppPreferencesV1> = {
          state: sanitizePersistedAppPreferences(envelope.state),
          version: envelope.version,
        };
        lastSerialized.set(name, JSON.stringify(normalized));
        return normalized;
      } catch {
        return null;
      }
    },

    setItem(name, value): void {
      const normalized: StorageValue<PersistedAppPreferencesV1> = {
        state: sanitizePersistedAppPreferences(value.state),
        version: APP_PREFERENCES_VERSION,
      };
      const serialized = JSON.stringify(normalized);
      if (lastSerialized.get(name) === serialized) return;
      lastSerialized.set(name, serialized);
      writeRaw(name, serialized);
    },

    removeItem(name): void {
      memory.delete(name);
      lastSerialized.delete(name);
      const activeBackend = resolveBackend();
      if (activeBackend === null || backendFailed) return;
      try {
        activeBackend.removeItem(name);
      } catch {
        backendFailed = true;
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function memberOrDefault<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}
