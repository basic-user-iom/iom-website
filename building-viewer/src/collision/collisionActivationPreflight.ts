import {
  assertCollisionActivationEvidence,
  type CollisionActivationEvidence,
  type CollisionActivationValidation,
} from './collisionActivationContract'
import type { ValidatedDedicatedCollision } from './dedicatedCollisionValidation'
import {
  verifyModelAssetIntegrity,
  type ModelAssetIntegrity,
} from '../scene/ModelLoader'

export type CollisionActivationPinnedJson = ModelAssetIntegrity & { url: string }

export type CollisionActivationPreflightConfig = {
  contract: CollisionActivationPinnedJson
  coverageReport: CollisionActivationPinnedJson
}

const MAX_EVIDENCE_JSON_BYTES = 1024 * 1024

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Model load was superseded', 'AbortError')
}

function assertPinnedJson(asset: CollisionActivationPinnedJson, label: string): void {
  if (!asset || typeof asset.url !== 'string' || asset.url.trim().length === 0) {
    throw new Error(`${label} URL is missing`)
  }
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 2 || asset.bytes > MAX_EVIDENCE_JSON_BYTES) {
    throw new Error(`${label} byte pin must be within 2..${MAX_EVIDENCE_JSON_BYTES}`)
  }
}

async function readExactlyPinnedBytes(
  response: Response,
  expectedBytes: number,
  label: string,
): Promise<ArrayBuffer> {
  if (!response.body) {
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength !== expectedBytes) {
      throw new Error(`${label} byte-length mismatch (${bytes.byteLength} != ${expectedBytes})`)
    }
    return bytes
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > expectedBytes) {
        await reader.cancel()
        throw new Error(`${label} exceeded its ${expectedBytes}-byte pin`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (total !== expectedBytes) {
    throw new Error(`${label} byte-length mismatch (${total} != ${expectedBytes})`)
  }
  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined.buffer
}

async function loadVerifiedJson(
  asset: CollisionActivationPinnedJson,
  label: string,
  signal?: AbortSignal,
): Promise<unknown> {
  assertPinnedJson(asset, label)
  throwIfAborted(signal)
  const response = await fetch(asset.url, { signal })
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}: ${asset.url}`)
  const contentLength = response.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength)) {
    const observed = Number(contentLength)
    if (observed !== asset.bytes) {
      throw new Error(`${label} Content-Length mismatch (${observed} != ${asset.bytes})`)
    }
  }
  const bytes = await readExactlyPinnedBytes(response, asset.bytes, label)
  await verifyModelAssetIntegrity(bytes, asset, asset.url)
  throwIfAborted(signal)
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    throw new Error(
      `${label} is not valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Full fail-closed streaming collision preflight. Both JSON documents are
 * verified before parsing, their inner collision/report pins must agree with
 * the exact downloaded GLB, and the live post-build metrics must match.
 */
export async function assertCollisionActivationPreflight(
  modelId: string,
  collisionUrl: string,
  collisionIntegrity: ModelAssetIntegrity,
  collision: ValidatedDedicatedCollision,
  config: CollisionActivationPreflightConfig | undefined,
  signal?: AbortSignal,
): Promise<CollisionActivationValidation['summary']> {
  if (!config) throw new Error(`Streaming collision activation evidence is missing for ${modelId}`)
  const [contract, coverageReport] = await Promise.all([
    loadVerifiedJson(config.contract, 'Collision activation contract', signal),
    loadVerifiedJson(config.coverageReport, 'Collision coverage report', signal),
  ])
  throwIfAborted(signal)

  const contractRecord = record(contract)
  const pinnedCollision = record(contractRecord?.collision)
  const pinnedCoverage = record(contractRecord?.coverageReport)
  if (contractRecord?.modelId !== modelId) {
    throw new Error('Collision activation contract modelId does not match the streamed layer')
  }
  if (pinnedCollision?.url !== collisionUrl) {
    throw new Error('Collision activation contract URL does not match the streamed collision route')
  }
  if (pinnedCoverage?.url !== config.coverageReport.url) {
    throw new Error('Collision activation contract coverage URL does not match the verified report route')
  }

  const evidence: CollisionActivationEvidence = {
    collisionSha256: collisionIntegrity.sha256,
    collisionBytes: collisionIntegrity.bytes,
    coverageReportSha256: config.coverageReport.sha256,
    coverageReportBytes: config.coverageReport.bytes,
    runtime: collision.runtimeMetrics,
  }
  return assertCollisionActivationEvidence(contract, coverageReport, evidence)
}
