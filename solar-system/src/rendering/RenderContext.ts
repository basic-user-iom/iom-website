import type { Vec3d } from '../simulation/core/Vec3d';

export type PhysicalPosition = Readonly<Vec3d>;

export interface DebugBodyRenderState {
  readonly bodyId: string;
  readonly displayName: string;
  readonly kind: 'star' | 'planet' | 'moon' | 'comet';
  readonly meanRadiusM: number;
  readonly positionM: PhysicalPosition;
  readonly velocityMps: PhysicalPosition;
  readonly visible: boolean;
}

/** Absolute heliocentric SI positions sampled from the generated provider. */
export interface DebugOrbitTrailRenderState {
  readonly bodyId: string;
  readonly centerBodyId?: string | null;
  readonly kind?: 'orbit' | 'trail';
  /** Interleaved x/y/z values in metres. */
  readonly positionsM: Float64Array;
}

export interface DebugRenderFrame {
  readonly currentJdTdb: number;
  readonly originM: PhysicalPosition;
  readonly originRevision: number;
  readonly bodies: readonly DebugBodyRenderState[];
  readonly trails: readonly DebugOrbitTrailRenderState[];
}

export interface RenderContext {
  readonly frame: DebugRenderFrame;
  readonly realDeltaSeconds: number;
}
