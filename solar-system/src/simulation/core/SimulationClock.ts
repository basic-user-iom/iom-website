import {
  approximateTdbToDateUtc,
  dateUtcToApproximateTdb,
  J2000_JD_TDB,
} from './JulianDate';
import type { SimulationDirection, TimePreset } from './TimePresets';
import { clampTimeScale } from './TimePresets';
import { SECONDS_PER_DAY } from './Units';

export interface SimulationClockOptions {
  readonly initialJdTdb?: number;
  readonly paused?: boolean;
  readonly direction?: SimulationDirection;
  readonly timeScale?: number;
  readonly maximumRealDeltaSeconds?: number;
}

export interface SimulationClockTick {
  readonly currentJdTdb: number;
  readonly dtRealSeconds: number;
  readonly dtSimSeconds: number;
  readonly rawRealDeltaSeconds: number;
  readonly scrubApplied: boolean;
}

export interface SimulationClockSnapshot {
  readonly currentJdTdb: number;
  readonly paused: boolean;
  readonly direction: SimulationDirection;
  readonly timeScale: number;
  readonly scrubTargetJdTdb: number | null;
}

export class SimulationClock {
  private jdTdb: number;
  private isPaused: boolean;
  private playbackDirection: SimulationDirection;
  private secondsPerRealSecond: number;
  private previousNowMs: number | null = null;
  private pendingScrubJdTdb: number | null = null;
  public readonly maximumRealDeltaSeconds: number;

  public constructor(options: SimulationClockOptions = {}) {
    this.jdTdb = finiteJulianDate(options.initialJdTdb ?? J2000_JD_TDB);
    this.isPaused = options.paused ?? true;
    this.playbackDirection = validateDirection(options.direction ?? 1);
    this.secondsPerRealSecond = clampTimeScale(options.timeScale ?? 1);
    const maximumDelta = options.maximumRealDeltaSeconds ?? 0.1;
    if (!Number.isFinite(maximumDelta) || maximumDelta <= 0) {
      throw new RangeError('Maximum real-frame delta must be finite and positive.');
    }
    this.maximumRealDeltaSeconds = maximumDelta;
  }

  public get currentJdTdb(): number {
    return this.jdTdb;
  }

  public get paused(): boolean {
    return this.isPaused;
  }

  public get direction(): SimulationDirection {
    return this.playbackDirection;
  }

  public get timeScale(): number {
    return this.secondsPerRealSecond;
  }

  public get scrubTargetJdTdb(): number | null {
    return this.pendingScrubJdTdb;
  }

  public tick(nowMs: number): SimulationClockTick {
    if (!Number.isFinite(nowMs)) {
      throw new RangeError('Clock timestamp must be finite.');
    }

    let rawRealDeltaSeconds = 0;
    if (this.previousNowMs !== null) {
      rawRealDeltaSeconds = Math.max(0, (nowMs - this.previousNowMs) / 1_000);
    }
    this.previousNowMs = nowMs;

    const dtRealSeconds = Math.min(rawRealDeltaSeconds, this.maximumRealDeltaSeconds);
    const scrubApplied = this.pendingScrubJdTdb !== null;
    if (this.pendingScrubJdTdb !== null) {
      this.jdTdb = this.pendingScrubJdTdb;
      this.pendingScrubJdTdb = null;
    }

    const dtSimSeconds = this.isPaused || scrubApplied
      ? 0
      : dtRealSeconds * this.secondsPerRealSecond * this.playbackDirection;
    this.jdTdb += dtSimSeconds / SECONDS_PER_DAY;

    return {
      currentJdTdb: this.jdTdb,
      dtRealSeconds,
      dtSimSeconds,
      rawRealDeltaSeconds,
      scrubApplied,
    };
  }

  public resetRealTimeAnchor(nowMs: number | null = null): void {
    if (nowMs !== null && !Number.isFinite(nowMs)) {
      throw new RangeError('Clock timestamp must be finite.');
    }
    this.previousNowMs = nowMs;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public togglePaused(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public setDirection(direction: SimulationDirection): void {
    this.playbackDirection = validateDirection(direction);
  }

  public reverse(): SimulationDirection {
    this.playbackDirection = this.playbackDirection === 1 ? -1 : 1;
    return this.playbackDirection;
  }

  public setTimeScale(timeScale: number): void {
    this.secondsPerRealSecond = clampTimeScale(timeScale);
  }

  public applyPreset(preset: TimePreset): void {
    this.setDirection(preset.direction);
    this.setTimeScale(preset.timeScale);
    this.setPaused(preset.paused);
  }

  public setCurrentJdTdb(jdTdb: number): void {
    this.jdTdb = finiteJulianDate(jdTdb);
    this.pendingScrubJdTdb = null;
  }

  public setExactDateUtc(date: Date): void {
    this.setCurrentJdTdb(dateUtcToApproximateTdb(date));
  }

  public getApproximateUtcDate(): Date {
    return approximateTdbToDateUtc(this.jdTdb);
  }

  public setScrubTargetJdTdb(jdTdb: number): void {
    this.pendingScrubJdTdb = finiteJulianDate(jdTdb);
  }

  public clearScrubTarget(): void {
    this.pendingScrubJdTdb = null;
  }

  public snapshot(): SimulationClockSnapshot {
    return Object.freeze({
      currentJdTdb: this.jdTdb,
      paused: this.isPaused,
      direction: this.playbackDirection,
      timeScale: this.secondsPerRealSecond,
      scrubTargetJdTdb: this.pendingScrubJdTdb,
    });
  }
}

function validateDirection(direction: SimulationDirection): SimulationDirection {
  if (direction !== -1 && direction !== 1) {
    throw new RangeError('Simulation direction must be -1 or +1.');
  }
  return direction;
}

function finiteJulianDate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Julian Date must be finite.');
  }
  return value;
}
