import type { AppState, SimulationUiSnapshot } from './useAppStore';

export const selectSimulationSnapshot = (
  state: AppState,
): Readonly<SimulationUiSnapshot> => state.snapshot;

export const selectWebGLStatus = (state: AppState) => state.webglStatus;
export const selectWebGLMessage = (state: AppState) => state.webglMessage;
export const selectReducedMotion = (state: AppState) => state.reducedMotion;
export const selectMotionPreference = (state: AppState) => state.motionPreference;
export const selectReduceFlashes = (state: AppState) => state.reduceFlashes;
export const selectPreferencesHydrated = (state: AppState) => state.preferencesHydrated;
export const selectPreferencesPersistenceSuspended = (state: AppState) =>
  state.preferencesPersistenceSuspended;
export const selectSelectedBodyId = (state: AppState) => state.selectedBodyId;
export const selectCameraMode = (state: AppState) => state.cameraMode;
export const selectRenderScaleMode = (state: AppState) => state.renderScaleMode;
export const selectVisualQuality = (state: AppState) => state.visualQuality;
export const selectVenusSurfaceMode = (state: AppState) => state.venusSurfaceMode;
export const selectOrbitLinesVisible = (state: AppState) => state.orbitLinesVisible;
export const selectBodyLabelsVisible = (state: AppState) => state.bodyLabelsVisible;
export const selectSkyBackgroundVisible = (state: AppState) => state.skyBackgroundVisible;
export const selectBrightStarsVisible = (state: AppState) => state.brightStarsVisible;
export const selectCometsVisible = (state: AppState) => state.cometsVisible;
export const selectAsteroidBeltVisible = (state: AppState) => state.asteroidBeltVisible;
export const selectKuiperBeltVisible = (state: AppState) => state.kuiperBeltVisible;
export const selectSelectedTrailInterval = (state: AppState) =>
  state.selectedTrailInterval;

export const selectSetSnapshot = (state: AppState) => state.setSnapshot;
export const selectSetWebGLStatus = (state: AppState) => state.setWebGLStatus;
export const selectSetReducedMotion = (state: AppState) => state.setReducedMotion;
export const selectSetMotionPreference = (state: AppState) => state.setMotionPreference;
export const selectSetReduceFlashes = (state: AppState) => state.setReduceFlashes;
export const selectSetPreferencesPersistenceSuspended = (state: AppState) =>
  state.setPreferencesPersistenceSuspended;
export const selectSetSelectedBodyId = (state: AppState) => state.setSelectedBodyId;
export const selectSetCameraMode = (state: AppState) => state.setCameraMode;
export const selectSetRenderScaleMode = (state: AppState) => state.setRenderScaleMode;
export const selectSetVisualQuality = (state: AppState) => state.setVisualQuality;
export const selectSetVenusSurfaceMode = (state: AppState) => state.setVenusSurfaceMode;
export const selectSetOrbitLinesVisible = (state: AppState) => state.setOrbitLinesVisible;
export const selectSetBodyLabelsVisible = (state: AppState) => state.setBodyLabelsVisible;
export const selectSetSkyBackgroundVisible = (state: AppState) => state.setSkyBackgroundVisible;
export const selectSetBrightStarsVisible = (state: AppState) => state.setBrightStarsVisible;
export const selectSetCometsVisible = (state: AppState) => state.setCometsVisible;
export const selectSetAsteroidBeltVisible = (state: AppState) => state.setAsteroidBeltVisible;
export const selectSetKuiperBeltVisible = (state: AppState) => state.setKuiperBeltVisible;
export const selectSetSelectedTrailInterval = (state: AppState) =>
  state.setSelectedTrailInterval;
