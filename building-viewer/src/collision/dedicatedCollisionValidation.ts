import type { Object3D } from 'three'

import {
  buildCollisionChunks,
  type CollisionBuildReport,
  type CollisionChunkSource,
} from './buildCollisionChunks'
import {
  collisionRuntimeMetricsFromReport,
  validateCollisionRuntimeMetricPin,
  type CollisionRuntimeMetricPin,
} from './collisionActivationContract'

const MIN_DEDICATED_TRIANGLES = 1_000
const COARSE_DEDICATED_MAX_TRIANGLES = 500_000

export type ValidatedDedicatedCollision = {
  chunks: CollisionChunkSource[]
  report: CollisionBuildReport
  /** Exact post-build values that must match an approved activation pin. */
  runtimeMetrics: CollisionRuntimeMetricPin
}

export type DedicatedCollisionValidation = {
  valid: boolean
  collision: ValidatedDedicatedCollision | null
  report: CollisionBuildReport
  reason: string | null
}

export function disposeCollisionChunks(chunks: Iterable<CollisionChunkSource>): void {
  for (const chunk of chunks) chunk.geometry.dispose()
}

/**
 * Streaming may activate only after its independent, complete walk proxy has
 * passed the same validation used by the live collision world.
 */
export function validateDedicatedCollisionRoot(
  root: Object3D,
  layerId: string,
  verbose = true,
  expectedRuntimeMetrics?: CollisionRuntimeMetricPin,
): DedicatedCollisionValidation {
  const built = buildCollisionChunks(root, {
    layerId: `${layerId}:proxy`,
    verbose,
    ignoreVisibility: true,
    walkSurfacesOnly: true,
  })
  const triangles = built.chunks.reduce((sum, chunk) => sum + chunk.triangles, 0)
  const runtimeMetrics = collisionRuntimeMetricsFromReport(built.report)
  const metricErrors =
    expectedRuntimeMetrics && runtimeMetrics
      ? validateCollisionRuntimeMetricPin(built.report, expectedRuntimeMetrics)
      : []
  const baseReason =
    built.chunks.length === 0
      ? 'contains no usable walk chunks'
      : triangles < MIN_DEDICATED_TRIANGLES
        ? `contains only ${Math.round(triangles)} triangles (minimum ${MIN_DEDICATED_TRIANGLES})`
        : !built.report.preferredColliders
          ? 'does not contain authoritative collider geometry'
          : triangles > COARSE_DEDICATED_MAX_TRIANGLES
            ? `contains ${Math.round(triangles)} triangles (maximum ${COARSE_DEDICATED_MAX_TRIANGLES})`
            : null
  const reason = baseReason ??
    (!runtimeMetrics
      ? 'has no finite collision bounds'
      : metricErrors.length
        ? `does not match approved runtime metrics: ${metricErrors.join('; ')}`
        : null)

  if (reason) {
    disposeCollisionChunks(built.chunks)
    return { valid: false, collision: null, report: built.report, reason }
  }
  return {
    valid: true,
    collision: { chunks: built.chunks, report: built.report, runtimeMetrics: runtimeMetrics! },
    report: built.report,
    reason: null,
  }
}

/** A streamed shell/detail set is never a complete collision fallback. */
export function allowsVisualCollisionFallback(streaming: boolean | undefined): boolean {
  return streaming !== true
}
