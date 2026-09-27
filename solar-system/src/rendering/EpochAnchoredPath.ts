import type { PhysicalPosition } from './RenderContext';

/** Keep a cached provider path attached to the live state without changing its
 * reference frame or extrapolating an orbit beyond its supplied coverage.
 * The caller provides capacity for one additional xyz point.
 */
export function writeEpochAnchoredPath(
  output: Float64Array, source: Float64Array, epochs: Float64Array | undefined,
  now: number, currentRelativeM: PhysicalPosition, direction?: 'previous' | 'next',
): number {
  if (epochs === undefined || epochs.length !== source.length / 3) {
    output.set(source);
    return source.length / 3;
  }
  let count = 0;
  let inserted = false;
  const insert = (): void => {
    output[count * 3] = currentRelativeM.x;
    output[count * 3 + 1] = currentRelativeM.y;
    output[count * 3 + 2] = currentRelativeM.z;
    count += 1;
    inserted = true;
  };
  const withinCoverage = now >= epochs[0]! && now <= epochs[epochs.length - 1]!;
  if (direction === 'next') insert();
  for (let i = 0; i < epochs.length; i += 1) {
    const epoch = epochs[i]!;
    if (direction === 'previous' && epoch >= now) break;
    if (direction === 'next' && epoch <= now) continue;
    if (direction === undefined && !inserted && withinCoverage && epoch >= now) insert();
    if (epoch === now) continue;
    output[count * 3] = source[i * 3]!;
    output[count * 3 + 1] = source[i * 3 + 1]!;
    output[count * 3 + 2] = source[i * 3 + 2]!;
    count += 1;
  }
  if (direction === 'previous') insert();
  return count;
}
