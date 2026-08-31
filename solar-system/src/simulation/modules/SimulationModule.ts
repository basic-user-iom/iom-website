import type { RenderContext } from '../../rendering/RenderContext';
import type { SimulationContext } from '../core/SimulationContext';

export interface SimulationModule {
  readonly id: string;
  init(context: SimulationContext): Promise<void> | void;
  onTick(context: SimulationContext, dtSimSeconds: number): void;
  onRender(context: RenderContext, dtRealSeconds: number): void;
  reset?(context: SimulationContext): void;
  dispose(): void;
}
