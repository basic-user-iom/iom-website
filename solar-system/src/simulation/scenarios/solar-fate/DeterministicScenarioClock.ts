import {
  SOLAR_FATE_FIXED_STEP_SECONDS,
  validateSolarFatePlaybackRate,
} from './SolarFateTypes';

/** Allocation-free fixed-step clock shared only as playback machinery. */
export class DeterministicScenarioClock {
  readonly #durationTicks: number;
  #cursorTicks = 0;
  #remainderSeconds = 0;
  #playbackRate: number;

  public constructor(durationSeconds: number, playbackRate = 1) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError('Scenario duration must be finite and positive.');
    }
    this.#durationTicks = Math.max(
      1,
      Math.ceil(durationSeconds / SOLAR_FATE_FIXED_STEP_SECONDS),
    );
    this.#playbackRate = validateSolarFatePlaybackRate(playbackRate);
  }

  public get timeSeconds(): number {
    return this.#cursorTicks * SOLAR_FATE_FIXED_STEP_SECONDS;
  }

  public get totalDurationSeconds(): number {
    return this.#durationTicks * SOLAR_FATE_FIXED_STEP_SECONDS;
  }

  public get progress(): number {
    return this.#cursorTicks / this.#durationTicks;
  }

  public get playbackRate(): number {
    return this.#playbackRate;
  }

  public get complete(): boolean {
    return this.#cursorTicks >= this.#durationTicks;
  }

  public setPlaybackRate(playbackRate: number): void {
    this.#playbackRate = validateSolarFatePlaybackRate(playbackRate);
  }

  public advanceRealTime(realDeltaSeconds: number): boolean {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Scenario delta must be finite and non-negative.');
    }
    if (realDeltaSeconds === 0 || this.complete) return false;
    const accumulated =
      this.#remainderSeconds + realDeltaSeconds * this.#playbackRate;
    const ticks = Math.floor(
      (accumulated + SOLAR_FATE_FIXED_STEP_SECONDS * 1e-9) /
        SOLAR_FATE_FIXED_STEP_SECONDS,
    );
    this.#remainderSeconds = accumulated - ticks * SOLAR_FATE_FIXED_STEP_SECONDS;
    if (Math.abs(this.#remainderSeconds) < 1e-12) this.#remainderSeconds = 0;
    if (ticks === 0) return false;
    return this.advanceTicks(ticks);
  }

  public frameStep(stepSeconds = SOLAR_FATE_FIXED_STEP_SECONDS): boolean {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError('Scenario frame-step duration must be finite and positive.');
    }
    const ticks = Math.max(
      1,
      Math.round(stepSeconds / SOLAR_FATE_FIXED_STEP_SECONDS),
    );
    return this.advanceTicks(ticks);
  }

  public seek(timeSeconds: number): void {
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
      throw new RangeError('Scenario seek time must be finite and non-negative.');
    }
    this.#cursorTicks = Math.min(
      this.#durationTicks,
      Math.round(timeSeconds / SOLAR_FATE_FIXED_STEP_SECONDS),
    );
    this.#remainderSeconds = 0;
  }

  public restart(): void {
    this.#cursorTicks = 0;
    this.#remainderSeconds = 0;
  }

  private advanceTicks(ticks: number): boolean {
    const previous = this.#cursorTicks;
    this.#cursorTicks = Math.min(this.#durationTicks, this.#cursorTicks + ticks);
    if (this.complete) this.#remainderSeconds = 0;
    return this.#cursorTicks !== previous;
  }
}
