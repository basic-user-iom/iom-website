import type { DebugSolarSystemRenderer } from '../rendering/DebugSolarSystemRenderer';
import { useAppStore } from '../state/useAppStore';
import type { SharedView } from './SharedView';

export function applyViewLayers(renderer: DebugSolarSystemRenderer | null, layers: SharedView['layers']): void {
  const ui = useAppStore.getState();
  ui.setOrbitLinesVisible(layers.orbitLinesVisible); renderer?.setOrbitLinesVisible(layers.orbitLinesVisible);
  ui.setBodyLabelsVisible(layers.bodyLabelsVisible); renderer?.setBodyLabelsVisible(layers.bodyLabelsVisible);
  ui.setSkyBackgroundVisible(layers.skyBackgroundVisible); renderer?.setSkyBackgroundVisible(layers.skyBackgroundVisible);
  ui.setBrightStarsVisible(layers.brightStarsVisible); renderer?.setBrightStarsVisible(layers.brightStarsVisible);
  ui.setCometsVisible(layers.cometsVisible); renderer?.setCometsVisible(layers.cometsVisible);
  ui.setAsteroidBeltVisible(layers.asteroidBeltVisible); renderer?.setStatisticalBeltVisible('asteroid-belt', layers.asteroidBeltVisible);
  ui.setKuiperBeltVisible(layers.kuiperBeltVisible); renderer?.setStatisticalBeltVisible('kuiper-belt', layers.kuiperBeltVisible);
}
