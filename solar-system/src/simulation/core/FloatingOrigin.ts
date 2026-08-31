import {
  copyVec3d,
  createVec3d,
  distanceSquaredVec3d,
  setVec3d,
  subtractVec3d,
  type Vec3d,
} from './Vec3d';

export interface FloatingOriginSnapshot {
  readonly originM: Readonly<Vec3d>;
  readonly revision: number;
}
export class FloatingOrigin {
  private readonly origin = createVec3d();
  private revisionValue = 0;
  private readonly thresholdSquaredM: number;

  public constructor(public readonly rebaseThresholdM = 1_000_000_000) {
    if (!Number.isFinite(rebaseThresholdM) || rebaseThresholdM <= 0) {
      throw new RangeError('Floating-origin threshold must be finite and positive.');
    }
    this.thresholdSquaredM = rebaseThresholdM * rebaseThresholdM;
  }

  public get revision(): number {
    return this.revisionValue;
  }

  public getOrigin(out: Vec3d): Vec3d {
    return copyVec3d(out, this.origin);
  }

  public rebaseTo(nextOriginM: Readonly<Vec3d>, outOldMinusNewM: Vec3d): boolean {
    if (
      nextOriginM.x === this.origin.x &&
      nextOriginM.y === this.origin.y &&
      nextOriginM.z === this.origin.z
    ) {
      return false;
    }
    subtractVec3d(outOldMinusNewM, this.origin, nextOriginM);
    copyVec3d(this.origin, nextOriginM);
    this.revisionValue += 1;
    return true;
  }

  public rebaseIfNeeded(anchorM: Readonly<Vec3d>, outOldMinusNewM: Vec3d): boolean {
    if (distanceSquaredVec3d(anchorM, this.origin) <= this.thresholdSquaredM) {
      return false;
    }
    return this.rebaseTo(anchorM, outOldMinusNewM);
  }

  public physicalToLocalMeters(out: Vec3d, physicalPositionM: Readonly<Vec3d>): Vec3d {
    return subtractVec3d(out, physicalPositionM, this.origin);
  }

  public localToPhysicalMeters(out: Vec3d, localPositionM: Readonly<Vec3d>): Vec3d {
    return setVec3d(
      out,
      localPositionM.x + this.origin.x,
      localPositionM.y + this.origin.y,
      localPositionM.z + this.origin.z,
    );
  }

  public snapshot(): FloatingOriginSnapshot {
    return Object.freeze({
      originM: Object.freeze({ ...this.origin }),
      revision: this.revisionValue,
    });
  }
}
