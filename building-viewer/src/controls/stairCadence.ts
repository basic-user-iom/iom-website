import { Vector3 } from 'three'
import type { FootGroundQuery } from './CharacterFootIK'

/** Measure repeated risers along the actual direction of travel, in metres.
 * A slope or a single curb cannot define a stair cadence. */
export function measureTreadDepth(feet: Vector3, direction: Vector3, ground: FootGroundQuery): number | null {
  const edges: number[] = [], signs: number[] = []
  const origin = new Vector3()
  let previous: number | null = null
  for (let i = 0; i <= 32; i++) {
    const distance = i * .04
    origin.copy(feet).addScaledVector(direction, distance)
    origin.y = feet.y + 1
    const height = ground(origin, 2)
    if (height !== null && previous !== null) {
      const rise = height - previous
      if (Math.abs(rise) >= .065 && Math.abs(rise) <= .3) {
        edges.push(distance); signs.push(Math.sign(rise))
      }
    }
    previous = height
  }
  const gaps: number[] = []
  for (let i = 1; i < edges.length; i++) {
    const gap = edges[i]! - edges[i - 1]!
    if (signs[i] === signs[i - 1] && gap >= .18 && gap <= .52) gaps.push(gap)
  }
  if (!gaps.length) return null
  gaps.sort((a, b) => a - b)
  const middle = gaps[Math.floor(gaps.length / 2)]!
  return gaps.every(gap => Math.abs(gap - middle) < .065)
    ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null
}
