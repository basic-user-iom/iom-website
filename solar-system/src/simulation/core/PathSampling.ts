/** Keep the current epoch as an exact vertex, including even-sized paths and coverage edges. */
export function sampleEpochsThroughCurrent(start: number, end: number, current: number, count: number): Float64Array {
  const epochs = new Float64Array(count);
  const anchor = Math.max(start, Math.min(end, current));
  const fraction = end > start ? (anchor - start) / (end - start) : 0;
  const pivot = fraction <= 0 ? 0 : fraction >= 1 ? count - 1
    : count === 2 ? 0 : Math.max(1, Math.min(count - 2, Math.round(fraction * (count - 1))));
  for (let i = 0; i < count; i += 1) {
    epochs[i] = i === pivot ? anchor : i < pivot
      ? start + (anchor - start) * i / pivot
      : anchor + (end - anchor) * (i - pivot) / (count - 1 - pivot);
  }
  return epochs;
}
