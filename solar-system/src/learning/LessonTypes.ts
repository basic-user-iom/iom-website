import type { LessonFraming } from '../rendering/camera/LessonCamera';
import type { RenderScaleMode } from '../rendering/RenderScaleModel';
import type { ObservatoryBodyId } from '../simulation/bodies/ObservatoryBodyCatalog';

export type LessonId = 'sizes' | 'seasons' | 'moon';
export interface LessonStep {
  readonly framing?: LessonFraming;
  readonly framingCaption?: string;
  readonly title: string;
  readonly action: string;
  readonly explanation: string;
  readonly scale: RenderScaleMode;
  readonly body: ObservatoryBodyId | null;
  readonly camera?: 'earth-moon-system';
  readonly utc?: string;
  readonly detail?: 'seasons' | 'moon-phase' | 'eclipses';
}
export interface LessonDefinition {
  readonly id: LessonId;
  readonly title: string;
  readonly goal: string;
  readonly description: string;
  readonly steps: readonly LessonStep[];
  readonly questions: readonly {
    readonly prompt: string;
    readonly choices: readonly string[];
    readonly correct: number;
    readonly feedback: string;
  }[];
  readonly sources: readonly { readonly title: string; readonly url: string }[];
  readonly limits: string;
}
