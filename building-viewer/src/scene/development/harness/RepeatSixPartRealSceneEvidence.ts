/**
 * Fail-closed evidence boundary for the development-only real-scene witness.
 *
 * This module deliberately grants no activation or source-ownership authority.
 * Its only job is to prove that the local witness is looking at the exact
 * production GLB and the exact dormant evidence reviewed for that GLB.
 */

export type PinnedDevelopmentAsset = Readonly<{
  url: string
  bytes: number
  sha256: string
}>

export const REPEAT_SIX_PART_REAL_SCENE_ASSETS = Object.freeze({
  manifest: Object.freeze({
    url: '/tmp/repeat-six-part-cohort-v4/manifest-v4.disabled.json',
    bytes: 378_244,
    sha256: '98a7d17634fd4bd524dfbf926eeb8aae23b7abeb93267f0a132adaedbf45fb4b',
  }),
  semanticAttestation: Object.freeze({
    url: '/tmp/repeat-six-part-cohort-v4/semantic-attestation-v1.disabled.json',
    bytes: 9_967,
    sha256: 'a604fa98464b6db69dc97105897c60d1a7fdfed91151a9e235335427d4caed56',
  }),
  exactGeometry: Object.freeze({
    url: '/tmp/repeat-six-part-exact-pilot/payloads/shared/exact-six-segment-geometry.glb',
    bytes: 1_877_420,
    sha256: '34fdf9c3ca0355b0f55dc531636cbde11705920042d3788c5ba2eb2086277417',
  }),
  productionModel: Object.freeze({
    url: '/models/icm-anim-2025/model-web.glb',
    bytes: 97_549_356,
    sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
  }),
} satisfies Readonly<Record<string, PinnedDevelopmentAsset>>)

export type DormantRealSceneEvidence = Readonly<{
  manifest: Readonly<Record<string, unknown>>
  semanticAttestation: Readonly<Record<string, unknown>>
  modelPin: PinnedDevelopmentAsset
  ownerName: 'Ground Floor._anim1'
  sourceRootSceneIndices: readonly [258, 259, 260, 261]
}>

const SHA256 = /^[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`)
  return value
}

function exact(value: unknown, expected: unknown, path: string): void {
  if (!Object.is(value, expected)) {
    throw new Error(`${path} must equal ${JSON.stringify(expected)}`)
  }
}

function assertPin(value: unknown, expected: PinnedDevelopmentAsset, path: string): void {
  const pin = record(value, path)
  exact(pin.bytes, expected.bytes, `${path}.bytes`)
  exact(pin.sha256, expected.sha256, `${path}.sha256`)
}

function validateManifest(value: unknown): Readonly<Record<string, unknown>> {
  const manifest = record(value, 'manifest')
  const capabilities = record(manifest.capabilities, 'manifest.capabilities')
  const owner = record(manifest.owner, 'manifest.owner')
  const sourcePins = record(manifest.sourcePins, 'manifest.sourcePins')
  const productionModel = record(sourcePins.productionModel, 'manifest.sourcePins.productionModel')
  const sourceOwner = record(sourcePins.owner, 'manifest.sourcePins.owner')
  const payloads = record(manifest.payloads, 'manifest.payloads')
  const exactGeometry = record(payloads.geometry, 'manifest.payloads.geometry')
  const geometry = record(manifest.geometry, 'manifest.geometry')
  const parity = record(manifest.parity, 'manifest.parity')
  const catalog = record(manifest.catalog, 'manifest.catalog')
  const proof = record(manifest.proof, 'manifest.proof')
  const transition = record(proof.transition, 'manifest.proof.transition')
  const gates = record(manifest.gates, 'manifest.gates')

  exact(manifest.schema, 'IOM_REPEAT_SIX_PART_EXACT_COHORT_MANIFEST_V4', 'manifest.schema')
  exact(manifest.version, 4, 'manifest.version')
  exact(manifest.enabled, false, 'manifest.enabled')
  exact(manifest.modelId, 'icm-anim-2025', 'manifest.modelId')
  exact(manifest.platform, 'web', 'manifest.platform')
  exact(manifest.mode, 'persistent-single-resolution-active-culled-exact-catalog', 'manifest.mode')

  exact(capabilities.persistentCatalog, true, 'manifest.capabilities.persistentCatalog')
  exact(capabilities.exactGeometry, true, 'manifest.capabilities.exactGeometry')
  exact(capabilities.stableLogicalIdentity, true, 'manifest.capabilities.stableLogicalIdentity')
  exact(capabilities.compactInstancing, true, 'manifest.capabilities.compactInstancing')
  exact(capabilities.hlodSwaps, false, 'manifest.capabilities.hlodSwaps')
  exact(capabilities.quest, false, 'manifest.capabilities.quest')

  exact(owner.id, 'ground-floor-anim1', 'manifest.owner.id')
  exact(owner.nodeName, 'Ground Floor._anim1', 'manifest.owner.nodeName')
  exact(sourcePins.modelId, 'icm-anim-2025', 'manifest.sourcePins.modelId')
  exact(productionModel.relativePath, '../public/models/icm-anim-2025/model-web.glb', 'manifest.sourcePins.productionModel.relativePath')
  assertPin(productionModel, REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel, 'manifest.sourcePins.productionModel')
  exact(sourceOwner.nodeName, 'Ground Floor._anim1', 'manifest.sourcePins.owner.nodeName')
  exact(sourceOwner.activeScenePath, 'scene/0/400', 'manifest.sourcePins.owner.activeScenePath')
  exact(sourceOwner.attachmentSpace, 'owner-local', 'manifest.sourcePins.owner.attachmentSpace')
  exact(sourceOwner.sceneRoot, true, 'manifest.sourcePins.owner.sceneRoot')
  exact(sourceOwner.identityRestMatrix, true, 'manifest.sourcePins.owner.identityRestMatrix')
  exact(sourceOwner.animationChannels, 0, 'manifest.sourcePins.owner.animationChannels')
  exact(exactGeometry.order, 0, 'manifest.payloads.geometry.order')
  exact(exactGeometry.role, 'exact-six-segment-geometry', 'manifest.payloads.geometry.role')
  exact(exactGeometry.mediaType, 'model/gltf-binary', 'manifest.payloads.geometry.mediaType')
  exact(exactGeometry.url, REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry.url, 'manifest.payloads.geometry.url')
  assertPin(exactGeometry, REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry, 'manifest.payloads.geometry')

  exact(geometry.materialSlots, 4, 'manifest.geometry.materialSlots')
  if (!Array.isArray(geometry.segments) || geometry.segments.length !== 6) {
    throw new Error('manifest.geometry.segments must contain six records')
  }
  const parityHosts = record(parity.hosts, 'manifest.parity.hosts')
  record(parityHosts.positive, 'manifest.parity.hosts.positive')
  record(parityHosts.mirrored, 'manifest.parity.hosts.mirrored')
  if (!Array.isArray(catalog.sources) || catalog.sources.length !== 78) {
    throw new Error('manifest.catalog.sources must contain 78 records')
  }
  if (!Array.isArray(catalog.units) || catalog.units.length !== 468) {
    throw new Error('manifest.catalog.units must contain 468 records')
  }

  exact(transition.arbitraryConcurrentOverlapProven, false, 'manifest.proof.transition.arbitraryConcurrentOverlapProven')
  exact(transition.runtimeOrderingEnforced, false, 'manifest.proof.transition.runtimeOrderingEnforced')

  exact(gates.exactGeometryPassed, true, 'manifest.gates.exactGeometryPassed')
  exact(gates.identityAndParityPassed, true, 'manifest.gates.identityAndParityPassed')
  exact(gates.physicalBoundsPassed, true, 'manifest.gates.physicalBoundsPassed')
  exact(gates.residentBudgetPassed, true, 'manifest.gates.residentBudgetPassed')
  exact(gates.transitionBudgetPassed, false, 'manifest.gates.transitionBudgetPassed')
  exact(gates.runtimeIntegrationPassed, false, 'manifest.gates.runtimeIntegrationPassed')
  exact(gates.runtimeConcurrencyPassed, false, 'manifest.gates.runtimeConcurrencyPassed')
  exact(gates.browserVisualWitnessPassed, false, 'manifest.gates.browserVisualWitnessPassed')
  exact(gates.measuredPerformancePassed, false, 'manifest.gates.measuredPerformancePassed')
  exact(gates.activationApproved, false, 'manifest.gates.activationApproved')
  return Object.freeze(manifest)
}

function validateSemanticAttestation(value: unknown): Readonly<Record<string, unknown>> {
  const attestation = record(value, 'semanticAttestation')
  const inputs = record(attestation.inputs, 'semanticAttestation.inputs')
  const limitations = record(attestation.limitations, 'semanticAttestation.limitations')

  exact(attestation.schema, 'IOM_REPEAT_SIX_PART_COHORT_V4_SEMANTIC_ATTESTATION', 'semanticAttestation.schema')
  exact(attestation.version, 1, 'semanticAttestation.version')
  exact(attestation.status, 'pass-dormant-semantic-evidence-only', 'semanticAttestation.status')
  exact(attestation.enabled, false, 'semanticAttestation.enabled')
  exact(attestation.runtimeIntegrated, false, 'semanticAttestation.runtimeIntegrated')
  exact(attestation.productionRoutingChanged, false, 'semanticAttestation.productionRoutingChanged')
  exact(attestation.activationValidatorIntegrated, false, 'semanticAttestation.activationValidatorIntegrated')
  exact(attestation.activationAuthorityEstablished, false, 'semanticAttestation.activationAuthorityEstablished')
  assertPin(inputs.manifest, REPEAT_SIX_PART_REAL_SCENE_ASSETS.manifest, 'semanticAttestation.inputs.manifest')
  assertPin(inputs.geometry, REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry, 'semanticAttestation.inputs.geometry')
  assertPin(inputs.productionModel, REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel, 'semanticAttestation.inputs.productionModel')

  exact(limitations.logicalIdentityRuntimeObserverPresent, false, 'semanticAttestation.limitations.logicalIdentityRuntimeObserverPresent')
  exact(limitations.transitionRuntimeOrderingProven, false, 'semanticAttestation.limitations.transitionRuntimeOrderingProven')
  exact(limitations.browserVisualWitnessPresent, false, 'semanticAttestation.limitations.browserVisualWitnessPresent')
  exact(limitations.measuredRuntimePerformancePresent, false, 'semanticAttestation.limitations.measuredRuntimePerformancePresent')
  exact(limitations.activationValidatorAcceptanceEvaluated, false, 'semanticAttestation.limitations.activationValidatorAcceptanceEvaluated')
  exact(limitations.semanticEvidenceWiredIntoActivationReview, false, 'semanticAttestation.limitations.semanticEvidenceWiredIntoActivationReview')
  return Object.freeze(attestation)
}

async function digestHex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function fetchPinnedBytes(pin: PinnedDevelopmentAsset, label: string): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 2 || !SHA256.test(pin.sha256)) {
    throw new Error(`${label} has an invalid compiled pin`)
  }
  const response = await fetch(pin.url, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
  const contentLength = response.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) !== pin.bytes) {
    await response.body?.cancel()
    throw new Error(`${label} Content-Length does not match its pin`)
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== pin.bytes) throw new Error(`${label} byte length does not match its pin`)
  const sha256 = await digestHex(bytes)
  if (sha256 !== pin.sha256) throw new Error(`${label} SHA-256 does not match its pin`)
  return bytes
}

async function fetchPinnedJson(pin: PinnedDevelopmentAsset, label: string): Promise<unknown> {
  const bytes = await fetchPinnedBytes(pin, label)
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON`, { cause: error })
  }
}

export function assertLocalDevelopmentHost(hostname: string): void {
  if (!new Set(['localhost', '127.0.0.1', '::1', '[::1]']).has(hostname.toLowerCase())) {
    throw new Error('This development-only witness refuses to run on a non-local host')
  }
}

export async function loadDormantRealSceneEvidence(): Promise<DormantRealSceneEvidence> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is required to verify development evidence')
  const [rawManifest, rawAttestation] = await Promise.all([
    fetchPinnedJson(REPEAT_SIX_PART_REAL_SCENE_ASSETS.manifest, 'disabled v4 manifest'),
    fetchPinnedJson(REPEAT_SIX_PART_REAL_SCENE_ASSETS.semanticAttestation, 'disabled semantic attestation'),
    fetchPinnedBytes(REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry, 'exact six-segment geometry'),
  ])
  const manifest = validateManifest(rawManifest)
  const semanticAttestation = validateSemanticAttestation(rawAttestation)
  return Object.freeze({
    manifest,
    semanticAttestation,
    modelPin: REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel,
    ownerName: 'Ground Floor._anim1',
    sourceRootSceneIndices: Object.freeze([258, 259, 260, 261]) as readonly [258, 259, 260, 261],
  })
}
