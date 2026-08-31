import type { CinematicInfallParameters } from './BlackHoleTypes';

export interface CinematicForceStateView {
  readonly bodyCount: number;
  readonly blackHoleIndex: number;
  readonly positionsM: Float64Array;
  readonly velocitiesMps: Float64Array;
  readonly outcomeCodes: Uint8Array;
}
/**
 * Deliberately nonphysical force provider. It is constructed only by the
 * Complete Consumption kernel configuration and is never registered globally.
 */
export class CinematicInfallForceProvider {
  readonly #parameters: Readonly<CinematicInfallParameters>;

  public constructor(parameters: Readonly<CinematicInfallParameters>) {
    this.#parameters = Object.freeze({ ...parameters });
  }

  public serialize(): string {
    return JSON.stringify({
      angularMomentumDampingPerPhysicalSecond:
        this.#parameters.angularMomentumDampingPerPhysicalSecond,
      inwardBiasMps2: this.#parameters.inwardBiasMps2,
      stagingStartSeconds: this.#parameters.stagingStartSeconds,
      stagingIntervalSeconds: this.#parameters.stagingIntervalSeconds,
    });
  }

  public addAccelerations(
    state: CinematicForceStateView,
    accelerationsMps2: Float64Array,
  ): void {
    const blackHoleOffset = state.blackHoleIndex * 3;
    const bhX = state.positionsM[blackHoleOffset] ?? 0;
    const bhY = state.positionsM[blackHoleOffset + 1] ?? 0;
    const bhZ = state.positionsM[blackHoleOffset + 2] ?? 0;
    const bhVx = state.velocitiesMps[blackHoleOffset] ?? 0;
    const bhVy = state.velocitiesMps[blackHoleOffset + 1] ?? 0;
    const bhVz = state.velocitiesMps[blackHoleOffset + 2] ?? 0;

    for (let bodyIndex = 0; bodyIndex < state.bodyCount; bodyIndex += 1) {
      if ((state.outcomeCodes[bodyIndex] ?? 0) === 4) continue;
      const offset = bodyIndex * 3;
      const rx = bhX - (state.positionsM[offset] ?? 0);
      const ry = bhY - (state.positionsM[offset + 1] ?? 0);
      const rz = bhZ - (state.positionsM[offset + 2] ?? 0);
      const distance = Math.hypot(rx, ry, rz);
      if (distance <= 0) continue;
      const nx = rx / distance;
      const ny = ry / distance;
      const nz = rz / distance;
      const relativeVx = (state.velocitiesMps[offset] ?? 0) - bhVx;
      const relativeVy = (state.velocitiesMps[offset + 1] ?? 0) - bhVy;
      const relativeVz = (state.velocitiesMps[offset + 2] ?? 0) - bhVz;
      const radialSpeed = relativeVx * nx + relativeVy * ny + relativeVz * nz;
      const tangentialVx = relativeVx - radialSpeed * nx;
      const tangentialVy = relativeVy - radialSpeed * ny;
      const tangentialVz = relativeVz - radialSpeed * nz;
      const damping = this.#parameters.angularMomentumDampingPerPhysicalSecond;
      const inwardBias = this.#parameters.inwardBiasMps2;
      accelerationsMps2[offset] =
        (accelerationsMps2[offset] ?? 0) - tangentialVx * damping + nx * inwardBias;
      accelerationsMps2[offset + 1] =
        (accelerationsMps2[offset + 1] ?? 0) - tangentialVy * damping + ny * inwardBias;
      accelerationsMps2[offset + 2] =
        (accelerationsMps2[offset + 2] ?? 0) - tangentialVz * damping + nz * inwardBias;
    }
  }
}
