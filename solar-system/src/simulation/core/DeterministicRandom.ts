const UINT32_RANGE = 0x1_0000_0000;

/** Mulberry32 with serializable state for deterministic procedural work/replays. */
export class DeterministicRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }

  public nextUint32(): number {
    this.state = (this.state + 0x6d2b_79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  public nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  public range(minimum: number, maximum: number): number {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
      throw new RangeError('Random range must have finite ordered bounds.');
    }
    return minimum + (maximum - minimum) * this.nextFloat();
  }

  public getState(): number {
    return this.state;
  }

  public setState(state: number): void {
    this.state = normalizeSeed(state);
  }
}
function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new RangeError('Deterministic seed/state must be a finite integer.');
  }
  return seed >>> 0;
}
