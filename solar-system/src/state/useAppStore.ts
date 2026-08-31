import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

import type { RenderScaleMode } from '../rendering/RenderScaleModel';
import type {
  VenusSurfaceMode,
  VisualQuality,
} from '../rendering/bodies/VisualQuality';
import type { CameraMode } from '../rendering/camera';
import type { ObservatoryBodyId } from '../simulation/bodies/ObservatoryBodyCatalog';
import type { SimulationDirection } from '../simulation/core/TimePresets';
import {
  APP_PREFERENCES_STORAGE_KEY,
  APP_PREFERENCES_VERSION,
  DEFAULT_APP_PREFERENCES,
  createSafeAppPreferencesStorage,
  migrateAppPreferences,
  sanitizePersistedAppPreferences,
  selectPersistedAppPreferences,
  type MotionPreference,
  type PersistedAppPreferencesV1,
} from './AppPreferences';

export type { SimulationDirection } from '../simulation/core/TimePresets';
export type {
  VenusSurfaceMode,
  VisualQuality,
} from '../rendering/bodies/VisualQuality';
export type WebGLStatus = 'checking' | 'ready' | 'lost' | 'unavailable' | 'error';
export type ObservatoryCameraMode = CameraMode;
export type SelectedTrailInterval = 'previous' | 'next';
export type { MotionPreference } from './AppPreferences';

export interface SimulationUiSnapshot {
  readonly sequence: number;
  readonly publishedAtMs: number;
  readonly currentJdTdb: number;
  readonly currentUtcIso: string;
  readonly paused: boolean;
  readonly direction: SimulationDirection;
  readonly timeScale: number;
  readonly dtRealSeconds: number;
  readonly dtSimSeconds: number;
  readonly originRevision: number;
  readonly focusedBodyId: string;
  readonly originBodyId: string;
  readonly renderFps: number | null;
  readonly documentVisible: boolean;
}

export interface AppState {
  readonly snapshot: Readonly<SimulationUiSnapshot>;
  readonly webglStatus: WebGLStatus;
  readonly webglMessage: string | null;
  readonly reducedMotion: boolean;
  readonly motionPreference: MotionPreference;
  readonly reduceFlashes: boolean;
  readonly preferencesHydrated: boolean;
  readonly preferencesPersistenceSuspended: boolean;
  readonly selectedBodyId: ObservatoryBodyId;
  readonly cameraMode: ObservatoryCameraMode;
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
  readonly selectedTrailInterval: SelectedTrailInterval;
  setSnapshot(snapshot: Readonly<SimulationUiSnapshot>): void;
  setWebGLStatus(status: WebGLStatus, message?: string | null): void;
  setReducedMotion(reducedMotion: boolean): void;
  setMotionPreference(motionPreference: MotionPreference): void;
  setReduceFlashes(reduceFlashes: boolean): void;
  markPreferencesHydrated(): void;
  setPreferencesPersistenceSuspended(suspended: boolean): void;
  setSelectedBodyId(bodyId: ObservatoryBodyId): void;
  setCameraMode(cameraMode: ObservatoryCameraMode): void;
  setRenderScaleMode(renderScaleMode: RenderScaleMode): void;
  setVisualQuality(visualQuality: VisualQuality): void;
  setVenusSurfaceMode(venusSurfaceMode: VenusSurfaceMode): void;
  setOrbitLinesVisible(orbitLinesVisible: boolean): void;
  setBodyLabelsVisible(bodyLabelsVisible: boolean): void;
  setSkyBackgroundVisible(visible: boolean): void;
  setBrightStarsVisible(visible: boolean): void;
  setCometsVisible(visible: boolean): void;
  setAsteroidBeltVisible(visible: boolean): void;
  setKuiperBeltVisible(visible: boolean): void;
  setSelectedTrailInterval(selectedTrailInterval: SelectedTrailInterval): void;
}

export const INITIAL_SIMULATION_SNAPSHOT: Readonly<SimulationUiSnapshot> = Object.freeze({
  sequence: 0,
  publishedAtMs: 0,
  currentJdTdb: 2_451_545,
  currentUtcIso: '2000-01-01T12:00:00.000Z',
  paused: true,
  direction: 1,
  timeScale: 1,
  dtRealSeconds: 0,
  dtSimSeconds: 0,
  originRevision: 0,
  focusedBodyId: 'sun',
  originBodyId: 'sun',
  renderFps: null,
  documentVisible: true,
});

const createAppState = (
  set: (partial: Partial<AppState>) => void,
): AppState => ({
  snapshot: INITIAL_SIMULATION_SNAPSHOT,
  webglStatus: 'checking',
  webglMessage: null,
  reducedMotion: false,
  motionPreference: DEFAULT_APP_PREFERENCES.motionPreference,
  reduceFlashes: DEFAULT_APP_PREFERENCES.reduceFlashes,
  preferencesHydrated: false,
  preferencesPersistenceSuspended: false,
  selectedBodyId: DEFAULT_APP_PREFERENCES.selectedBodyId,
  cameraMode: DEFAULT_APP_PREFERENCES.cameraMode,
  renderScaleMode: DEFAULT_APP_PREFERENCES.renderScaleMode,
  visualQuality: DEFAULT_APP_PREFERENCES.visualQuality,
  venusSurfaceMode: DEFAULT_APP_PREFERENCES.venusSurfaceMode,
  orbitLinesVisible: DEFAULT_APP_PREFERENCES.orbitLinesVisible,
  bodyLabelsVisible: DEFAULT_APP_PREFERENCES.bodyLabelsVisible,
  skyBackgroundVisible: DEFAULT_APP_PREFERENCES.skyBackgroundVisible,
  brightStarsVisible: DEFAULT_APP_PREFERENCES.brightStarsVisible,
  cometsVisible: DEFAULT_APP_PREFERENCES.cometsVisible,
  asteroidBeltVisible: DEFAULT_APP_PREFERENCES.asteroidBeltVisible,
  kuiperBeltVisible: DEFAULT_APP_PREFERENCES.kuiperBeltVisible,
  selectedTrailInterval: DEFAULT_APP_PREFERENCES.selectedTrailInterval,
  setSnapshot: (snapshot) => set({ snapshot }),
  setWebGLStatus: (webglStatus, webglMessage = null) =>
    set({ webglStatus, webglMessage }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setMotionPreference: (motionPreference) => set({ motionPreference }),
  setReduceFlashes: (reduceFlashes) => set({ reduceFlashes }),
  markPreferencesHydrated: () => set({ preferencesHydrated: true }),
  setPreferencesPersistenceSuspended: (preferencesPersistenceSuspended) =>
    set({ preferencesPersistenceSuspended }),
  setSelectedBodyId: (selectedBodyId) => set({ selectedBodyId }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setRenderScaleMode: (renderScaleMode) => set({ renderScaleMode }),
  setVisualQuality: (visualQuality) => set({ visualQuality }),
  setVenusSurfaceMode: (venusSurfaceMode) => set({ venusSurfaceMode }),
  setOrbitLinesVisible: (orbitLinesVisible) => set({ orbitLinesVisible }),
  setBodyLabelsVisible: (bodyLabelsVisible) => set({ bodyLabelsVisible }),
  setSkyBackgroundVisible: (skyBackgroundVisible) => set({ skyBackgroundVisible }),
  setBrightStarsVisible: (brightStarsVisible) => set({ brightStarsVisible }),
  setCometsVisible: (cometsVisible) => set({ cometsVisible }),
  setAsteroidBeltVisible: (asteroidBeltVisible) => set({ asteroidBeltVisible }),
  setKuiperBeltVisible: (kuiperBeltVisible) => set({ kuiperBeltVisible }),
  setSelectedTrailInterval: (selectedTrailInterval) => set({ selectedTrailInterval }),
});

export function createAppStore(
  storage: PersistStorage<PersistedAppPreferencesV1> =
    createSafeAppPreferencesStorage(),
) {
  let durablePreferences: PersistedAppPreferencesV1 = {
    ...DEFAULT_APP_PREFERENCES,
  };

  return create<AppState>()(
    persist<AppState, [], [], PersistedAppPreferencesV1>(createAppState, {
      name: APP_PREFERENCES_STORAGE_KEY,
      version: APP_PREFERENCES_VERSION,
      storage,
      partialize: (state) => {
        const currentPreferences = selectPersistedAppPreferences(state);
        if (state.preferencesPersistenceSuspended) {
          return {
            ...currentPreferences,
            selectedBodyId: durablePreferences.selectedBodyId,
            cameraMode: durablePreferences.cameraMode,
          };
        }
        durablePreferences = currentPreferences;
        return currentPreferences;
      },
      migrate: migrateAppPreferences,
      merge: (persistedState, currentState) => {
        durablePreferences = sanitizePersistedAppPreferences(persistedState);
        return {
          ...currentState,
          ...durablePreferences,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.markPreferencesHydrated();
      },
    }),
  );
}

export const useAppStore = createAppStore();
