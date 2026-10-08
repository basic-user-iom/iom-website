import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  REPEAT_SIX_PART_COHORT_COUNTS,
  REPEAT_SIX_PART_COHORT_HARD_LIMITS,
  REPEAT_SIX_PART_COHORT_MODE,
  REPEAT_SIX_PART_COHORT_SCHEMA_V4,
  assertRepeatSixPartCohortManifestV4,
  computeRepeatSixPartCohortDigests,
  reviewRepeatSixPartCohortManifestV4Activation,
  validateRepeatSixPartCohortManifestV4,
} from './validate-repeat-six-part-cohort-manifest-v4.mjs'
import { validateAnimationPackageManifestV3 } from './validate-animation-package-manifest-v3.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const MIRROR_X = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const SEGMENT_TRIANGLES = [10_537, 10_558, 10_596, 10_535, 10_353, 8_690]

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) out[column * 4 + row] += a[inner * 4 + row] * b[column * 4 + inner]
    }
  }
  return out
}

function transformBounds(bounds, matrix) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = [
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
          matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ]
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis])
          max[axis] = Math.max(max[axis], point[axis])
        }
      }
    }
  }
  return { space: 'owner-local', min, max }
}

function unionBounds(bounds) {
  return {
    space: 'owner-local',
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((entry) => entry.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((entry) => entry.max[axis]))),
  }
}

function makeFixture() {
  const segments = SEGMENT_TRIANGLES.map((triangles, index) => ({
    index,
    id: `segment-${String(index).padStart(2, '0')}`,
    triangles,
    materialPrimitiveCount: 4,
    bounds: {
      space: 'source-row-local',
      min: [index * 1.25, -0.5, -0.25],
      max: [index * 1.25 + 1, 0.5, 0.25],
    },
  }))
  const sources = []
  const units = []
  for (let sourceIndex = 0; sourceIndex < REPEAT_SIX_PART_COHORT_COUNTS.logicalSources; sourceIndex += 1) {
    const parity = sourceIndex < 40 ? 'positive' : 'mirrored'
    const renderLocal = [...IDENTITY]
    renderLocal[12] = parity === 'positive'
      ? sourceIndex * 20
      : -((sourceIndex - 40) * 20 + 7.25)
    renderLocal[13] = (sourceIndex % 3) * 2
    renderLocal[14] = (sourceIndex % 5) * -3
    const host = parity === 'positive' ? IDENTITY : MIRROR_X
    const canonical = multiplyMatrices(host, renderLocal)
    const sourceUnits = segments.map((segment, segmentIndex) => {
      const index = sourceIndex * REPEAT_SIX_PART_COHORT_COUNTS.exactSegments + segmentIndex
      const unit = {
        index,
        id: `source-${String(sourceIndex).padStart(2, '0')}:segment-${String(segmentIndex).padStart(2, '0')}`,
        sourceIndex,
        sourceId: `source-${String(sourceIndex).padStart(2, '0')}`,
        segmentIndex,
        segmentId: segment.id,
        bounds: transformBounds(segment.bounds, canonical),
        triangles: segment.triangles,
      }
      units.push(unit)
      return unit
    })
    sources.push({
      index: sourceIndex,
      id: `source-${String(sourceIndex).padStart(2, '0')}`,
      path: `Ground Floor._anim1/Mesh.13786/source-${String(sourceIndex).padStart(2, '0')}`,
      parity,
      canonicalMatrix: { space: 'owner-local', matrix: canonical },
      renderLocalMatrix: { space: 'parity-host-local', matrix: renderLocal },
      bounds: unionBounds(sourceUnits.map((unit) => unit.bounds)),
    })
  }

  const manifest = {
    schema: REPEAT_SIX_PART_COHORT_SCHEMA_V4,
    version: 4,
    enabled: false,
    modelId: 'icm-anim-2025',
    platform: 'web',
    units: 'meters',
    mode: REPEAT_SIX_PART_COHORT_MODE,
    capabilities: {
      persistentCatalog: true,
      singleResolution: true,
      activeCulledStates: true,
      exactGeometry: true,
      parityHostFactorization: true,
      ownerLocalSelectionBounds: true,
      stableLogicalIdentity: true,
      compactInstancing: true,
      hlodSwaps: false,
      quest: false,
    },
    owner: { id: 'ground-floor-anim1', nodeName: 'Ground Floor._anim1' },
    sourcePins: {
      modelId: 'icm-anim-2025',
      productionModel: {
        relativePath: '../public/models/icm-anim-2025/model-web.glb',
        bytes: 97_549_356,
        sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
      },
      directProductionGeometry: {
        path: 'production-source/exact-six-segment-production-source.glb',
        bytes: 1_877_420,
        sha256: '34fdf9c3ca0355b0f55dc531636cbde11705920042d3788c5ba2eb2086277417',
      },
      directProductionSourceMap: {
        path: 'production-source/production-source-map.json',
        bytes: 47_291,
        sha256: '3a245fc584c57a9cc1229d078e4e895f9e5255a55a670bb4678e471a793b8747',
        transformSetSha256: 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
      },
      directProductionPhysicalAudit: {
        path: 'production-source/physical-audit.json',
        bytes: 37_460,
        sha256: '5715c6acad90ccf3240f015a4d4be4515122b74d6c995c4172ce6f03e8631740',
      },
      owner: {
        nodeName: 'Ground Floor._anim1',
        descendantPath: 'Ground Floor.BT_3',
        activeScenePath: 'scene/0/400',
        attachmentSpace: 'owner-local',
        sceneRoot: true,
        identityRestMatrix: true,
        animationChannels: 0,
        matrix: [...IDENTITY],
      },
    },
    payloads: {
      geometry: {
        order: 0,
        role: 'exact-six-segment-geometry',
        mediaType: 'model/gltf-binary',
        url: 'payloads/shared/exact-six-segment-geometry.glb',
        bytes: 1_877_420,
        sha256: '34fdf9c3ca0355b0f55dc531636cbde11705920042d3788c5ba2eb2086277417',
      },
      cohortTable: {
        order: 1,
        role: 'exact-six-segment-cohort-table',
        mediaType: 'application/octet-stream',
        url: 'payloads/web/exact-six-segment-cohort.bin',
        bytes: 46_256,
        sha256: '7a35e372ddaece22863e8b306769b9ce2999aa5be3b9a5f0c932ec167a12b6f8',
      },
      ownership: {
        order: 2,
        role: 'exact-six-segment-ownership',
        mediaType: 'application/json',
        url: 'payloads/web/exact-six-segment-ownership.json',
        bytes: 33_799,
        sha256: '62d9a33441e42fd7213a79546cd50ab387f4f30cd924a5b2dd17ce4e16a8c2d7',
      },
    },
    geometry: {
      sourceRowTriangles: 61_269,
      materialSlots: 4,
      physicalPrimitiveCount: 24,
      canonicalGeometryDigestSha256: '4'.repeat(64),
      exactTriangleMaterialBijection: true,
      exactPositionBits: true,
      exactNormalBits: true,
      exactWinding: true,
      segments,
    },
    parity: {
      canonicalMatrixSpace: 'owner-local',
      renderLocalMatrixSpace: 'parity-host-local',
      composition: 'host-times-render-local',
      requirePositiveRenderLocalDeterminant: true,
      epsilon: 1e-8,
      hosts: {
        positive: { space: 'owner-local', matrix: [...IDENTITY] },
        mirrored: { space: 'owner-local', matrix: [...MIRROR_X] },
      },
      materialDrawsPerActiveGroup: 4,
      possibleGroupCount: 12,
      persistentRendererTemplates: 48,
    },
    selector: {
      boundsSpace: 'owner-local',
      boundsType: 'closed-aabb',
      distanceMetric: 'linf-point-to-closed-aabb',
      enterMarginMeters: 3.5,
      exitMarginMeters: 5.5,
      states: ['active', 'culled'],
      defaultState: 'culled',
    },
    catalog: {
      order: 'source-major-segment-major',
      defaultState: 'culled',
      sources,
      units,
    },
    digests: {},
    budgets: {
      repeatFamilyResidentTriangles: 1_500_000,
      repeatFamilyTransitionTriangles: 1_500_000,
      totalResidentTriangles: 2_000_000,
      totalTransitionTriangles: 2_000_000,
      allOtherOwnerReservationTriangles: 500_000,
      maxActiveDraws: 48,
      maxPersistentRendererTemplates: 48,
      maxRuntimePayloadRequests: 3,
      maxRuntimePayloadBytes: 3_000_000,
      maxManifestBytes: 1_048_576,
      maxColdContractRequests: 4,
      maxColdContractBytes: 4_048_576,
    },
    proof: {
      residentSweep: {
        method: 'exact-closed-aabb-endpoint-sweep',
        marginMeters: 5.5,
        maxSelectedTriangles: 122_538,
        totalWithReservationTriangles: 622_538,
        selectedUnitCount: 12,
        activeDraws: 48,
        witness: [1, 0, 0],
      },
      activeDrawSweep: {
        method: 'exact-closed-aabb-endpoint-sweep',
        maxActiveDraws: 48,
        activeParitySegmentGroups: 12,
        witness: [1, 0, 0],
      },
      transition: {
        model: 'ordered-one-row-or-unordered-double-buffer',
        oneRowArithmeticRepeatTriangles: 183_807,
        oneRowArithmeticTotalWithReservationTriangles: 683_807,
        unorderedDoubleBufferRepeatTriangles: 245_076,
        unorderedDoubleBufferTotalWithReservationTriangles: 745_076,
        arbitraryConcurrentOverlapProven: false,
        runtimeOrderingEnforced: false,
      },
      persistentRendererTemplates: 48,
      payloadOnlyRequests: 3,
      payloadOnlyBytes: 1_957_475,
      manifestRequests: 1,
      manifestBytes: 1,
      coldContractRequests: 4,
      coldContractBytes: 1_957_476,
    },
    gates: {
      exactGeometryPassed: true,
      identityAndParityPassed: true,
      physicalBoundsPassed: true,
      residentBudgetPassed: true,
      transitionBudgetPassed: false,
      runtimeIntegrationPassed: false,
      runtimeConcurrencyPassed: false,
      browserVisualWitnessPassed: false,
      measuredPerformancePassed: false,
      activationApproved: false,
    },
  }
  manifest.digests = computeRepeatSixPartCohortDigests(manifest)
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const manifestBytes = Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`)
    if (manifest.proof.manifestBytes === manifestBytes && manifest.proof.coldContractBytes === manifest.proof.payloadOnlyBytes + manifestBytes) break
    manifest.proof.manifestBytes = manifestBytes
    manifest.proof.coldContractBytes = manifest.proof.payloadOnlyBytes + manifestBytes
  }
  return manifest
}

function observedPayloads(manifest) {
  return Object.fromEntries(Object.values(manifest.payloads).map((payload) => [payload.url, { bytes: payload.bytes, sha256: payload.sha256 }]))
}

function expectInvalid(name, mutate, expected, { refreshDigests = false, options } = {}) {
  const candidate = makeFixture()
  mutate(candidate)
  if (refreshDigests) candidate.digests = computeRepeatSixPartCohortDigests(candidate)
  const result = validateRepeatSixPartCohortManifestV4(candidate, options)
  assert.equal(result.valid, false, `${name} unexpectedly passed`)
  assert.match(result.errors.join('\n'), expected, name)
}

const fixture = makeFixture()
const valid = validateRepeatSixPartCohortManifestV4(fixture)
assert.deepEqual(valid.errors, [])
assert.equal(valid.valid, true)
assert.equal(valid.summary.logicalSourceCount, 78)
assert.equal(valid.summary.exactSegmentCount, 6)
assert.equal(valid.summary.selectionUnitCount, 468)
assert.equal(valid.summary.sourceRowTriangles, 61_269)
assert.equal(valid.summary.runtimePayloadCount, 3)
assert.equal(valid.summary.runtimePayloadBytes, 1_957_475)
assert.equal(valid.summary.maxResidentTriangles, 122_538)
assert.equal(valid.summary.maxActiveDraws, 48)
assert.equal(valid.summary.spatialProofRecomputed, true)
assert.equal(valid.summary.physicalPayloadPinsVerified, false)
assert.equal(valid.summary.dormant, true)
assert.deepEqual(assertRepeatSixPartCohortManifestV4(fixture), valid.summary)

// Structural review is intentionally separate from activation eligibility.
const dormantReview = reviewRepeatSixPartCohortManifestV4Activation(fixture)
assert.equal(dormantReview.contractValid, true)
assert.equal(dormantReview.activationEligible, false)
assert.ok(dormantReview.blockers.some((entry) => entry.code === 'MANIFEST_DISABLED'))
assert.ok(dormantReview.blockers.some((entry) => entry.code === 'PHYSICAL_PAYLOAD_PIN_UNVERIFIED'))
assert.ok(dormantReview.blockers.some((entry) => entry.code === 'TRANSITION_CONCURRENCY_UNPROVEN'))

// The independent physical-pin option passes only with all three exact bytes.
const observed = observedPayloads(fixture)
const observedManifest = { bytes: fixture.proof.manifestBytes }
const physicallyPinned = validateRepeatSixPartCohortManifestV4(fixture, {
  observedPayloads: observed,
  observedManifest,
  requirePhysicalPins: true,
})
assert.equal(physicallyPinned.valid, true)
assert.equal(physicallyPinned.summary.physicalPayloadPinsVerified, true)
assert.equal(physicallyPinned.summary.physicalManifestBytesVerified, true)

// Even a synthetically enabled document with every self-asserted gate true,
// exact byte pins, and matching source/owner pins remains fail-closed. Hashes
// cannot prove that independently decoded GLB/BIN/ownership semantics agree.
const activationFixture = makeFixture()
activationFixture.enabled = true
for (const key of Object.keys(activationFixture.gates)) activationFixture.gates[key] = true
activationFixture.proof.transition.runtimeOrderingEnforced = true
const syntheticManifestObservation = { bytes: activationFixture.proof.manifestBytes, sha256: 'a'.repeat(64) }
const syntheticAuthoritativeManifestPin = { ...syntheticManifestObservation }
const activationReview = reviewRepeatSixPartCohortManifestV4Activation(activationFixture, {
  observedPayloads: observedPayloads(activationFixture),
  observedManifest: syntheticManifestObservation,
  authoritativeManifestPin: syntheticAuthoritativeManifestPin,
  observedRuntimeSourcePins: structuredClone(activationFixture.sourcePins),
})
assert.equal(activationReview.contractValid, true)
assert.equal(activationReview.physicalPayloadPinsVerified, true)
assert.equal(activationReview.physicalManifestBytesVerified, true)
assert.equal(activationReview.authoritativeManifestIntegrityVerified, true)
assert.equal(activationReview.runtimeSourceOwnerPinsVerified, true)
assert.equal(activationReview.authoritativePhysicalSemanticsVerified, false)
assert.equal(activationReview.activationEligible, false)
assert.deepEqual(
  activationReview.blockers.map((entry) => entry.code),
  ['AUTHORITATIVE_PHYSICAL_SEMANTIC_GATE_MISSING'],
)

const missingRuntimePinsReview = reviewRepeatSixPartCohortManifestV4Activation(activationFixture, {
  observedPayloads: observedPayloads(activationFixture),
  observedManifest: syntheticManifestObservation,
  authoritativeManifestPin: syntheticAuthoritativeManifestPin,
})
assert.ok(missingRuntimePinsReview.blockers.some((entry) => entry.code === 'AUTHORITATIVE_RUNTIME_SOURCE_OWNER_EQUALITY_MISSING'))
const missingManifestIntegrityPinReview = reviewRepeatSixPartCohortManifestV4Activation(activationFixture, {
  observedPayloads: observedPayloads(activationFixture),
  observedManifest: syntheticManifestObservation,
  observedRuntimeSourcePins: structuredClone(activationFixture.sourcePins),
})
assert.equal(missingManifestIntegrityPinReview.authoritativeManifestIntegrityVerified, false)
assert.ok(missingManifestIntegrityPinReview.blockers.some((entry) => entry.code === 'AUTHORITATIVE_MANIFEST_INTEGRITY_PIN_MISSING'))
const mismatchedManifestIntegrityPinReview = reviewRepeatSixPartCohortManifestV4Activation(activationFixture, {
  observedPayloads: observedPayloads(activationFixture),
  observedManifest: syntheticManifestObservation,
  authoritativeManifestPin: { ...syntheticAuthoritativeManifestPin, sha256: 'b'.repeat(64) },
  observedRuntimeSourcePins: structuredClone(activationFixture.sourcePins),
})
assert.equal(mismatchedManifestIntegrityPinReview.authoritativeManifestIntegrityVerified, false)
assert.ok(mismatchedManifestIntegrityPinReview.blockers.some((entry) => entry.code === 'AUTHORITATIVE_MANIFEST_INTEGRITY_PIN_MISMATCH'))
const mismatchedRuntimePins = structuredClone(activationFixture.sourcePins)
mismatchedRuntimePins.directProductionSourceMap.sha256 = 'a'.repeat(64)
const mismatchedRuntimePinsReview = reviewRepeatSixPartCohortManifestV4Activation(activationFixture, {
  observedPayloads: observedPayloads(activationFixture),
  observedManifest: syntheticManifestObservation,
  authoritativeManifestPin: syntheticAuthoritativeManifestPin,
  observedRuntimeSourcePins: mismatchedRuntimePins,
})
assert.equal(mismatchedRuntimePinsReview.runtimeSourceOwnerPinsVerified, false)
assert.ok(mismatchedRuntimePinsReview.blockers.some((entry) => entry.code === 'RUNTIME_SOURCE_OWNER_PIN_MISMATCH'))

// One focused negative mutation for every major rejection boundary.
expectInvalid('schema/version boundary', (value) => { value.version = 3 }, /version: must equal 4/)
expectInvalid('strict top-level keys', (value) => { value.hlod = {} }, /manifest\.hlod: unknown key/)
expectInvalid('strict capability set', (value) => { value.capabilities.hlodSwaps = true }, /capabilities\.hlodSwaps: must equal false/)
expectInvalid('target runtime layer', (value) => {
  value.modelId = 'some-other-layer'
  value.sourcePins.modelId = 'some-other-layer'
}, /modelId: must equal icm-anim-2025/)
expectInvalid('source target model pin', (value) => { value.sourcePins.modelId = 'some-other-layer' }, /must equal the manifest modelId/)
expectInvalid('pinned production model bytes', (value) => { value.sourcePins.productionModel.bytes += 1 }, /must equal pinned production bytes/)
expectInvalid('removed ignored source row pin', (value) => {
  value.sourcePins.sourceRow = { bytes: 1, sha256: 'f'.repeat(64) }
}, /sourcePins\.sourceRow: unknown key/)
expectInvalid('direct-production source-map transform pin', (value) => {
  value.sourcePins.directProductionSourceMap.transformSetSha256 = 'not-a-sha'
}, /sourcePins\.directProductionSourceMap\.transformSetSha256/)
expectInvalid('target owner node', (value) => {
  value.owner.nodeName = 'Some Other Owner'
  value.sourcePins.owner.nodeName = 'Some Other Owner'
}, /owner\.nodeName: must equal Ground Floor\._anim1/)
expectInvalid('exact owner active-scene basis', (value) => {
  value.sourcePins.owner.activeScenePath = 'scene/0/399'
}, /must equal scene\/0\/400/)
expectInvalid('unknown capability', (value) => { value.capabilities.experimentalSwap = true }, /capabilities\.experimentalSwap: unknown key/)
expectInvalid('exact geometry proof', (value) => { value.geometry.exactWinding = false }, /geometry\.exactWinding: must equal true/)
expectInvalid('six-segment inventory', (value) => { value.geometry.segments.pop() }, /must contain exactly 6 exact segments/)
expectInvalid('payload role and cardinality', (value) => { delete value.payloads.ownership }, /payloads\.ownership: required key is missing/)
expectInvalid('payload format', (value) => { value.payloads.geometry.url = 'geometry.bin' }, /must be a non-empty \.glb path/)
expectInvalid('runtime geometry differs from direct-production source', (value) => {
  value.payloads.geometry.sha256 = 'f'.repeat(64)
}, /must equal the direct-production geometry source pin/)
expectInvalid('physical payload bytes', () => {}, /physical byte count/, {
  options: {
    observedPayloads: {
      ...observed,
      [fixture.payloads.geometry.url]: { ...observed[fixture.payloads.geometry.url], bytes: fixture.payloads.geometry.bytes + 1 },
    },
    requirePhysicalPins: true,
  },
})
expectInvalid('stable source catalog size', (value) => { value.catalog.sources.pop() }, /must contain exactly 78 logical sources/)
expectInvalid('stable unit order', (value) => {
  const first = value.catalog.units[0]
  value.catalog.units[0] = value.catalog.units[1]
  value.catalog.units[1] = first
}, /violates source-major\/segment-major order/)
expectInvalid('positive render-local determinant', (value) => {
  value.catalog.sources[0].renderLocalMatrix.matrix[0] = -1
}, /determinant must be positive/)
expectInvalid('parity host recomposition', (value) => {
  value.catalog.sources[0].canonicalMatrix.matrix[12] += 0.5
}, /must exactly recompose canonicalMatrix/)
expectInvalid('fixed mirrored host', (value) => {
  value.parity.hosts.mirrored.matrix[5] = -1
}, /fixed X-reflection host/)
expectInvalid('unit bound validity', (value) => {
  value.catalog.units[0].bounds.max[0] = value.catalog.units[0].bounds.min[0]
}, /max\[0\] must be greater/)
expectInvalid('transformed exact bound', (value) => {
  value.catalog.units[0].bounds.max[0] += 0.25
}, /must equal the exact segment bounds transformed/)
expectInvalid('stale stable digest', (value) => {
  value.digests.unitBoundsSha256 = 'f'.repeat(64)
}, /digests\.unitBoundsSha256: stale/)
expectInvalid('selector hysteresis', (value) => {
  value.selector.exitMarginMeters = 2
}, /must be finite and >= enterMarginMeters/)
expectInvalid('selector distance metric', (value) => {
  value.selector.distanceMetric = 'euclidean-point-to-aabb'
}, /must equal linf-point-to-closed-aabb/)
expectInvalid('hard resident budget', (value) => {
  value.budgets.repeatFamilyResidentTriangles = REPEAT_SIX_PART_COHORT_HARD_LIMITS.repeatFamilyResidentTriangles + 1
}, /exceeds hard limit/)
expectInvalid('resident proof budget', (value) => {
  value.proof.residentSweep.maxSelectedTriangles = value.budgets.repeatFamilyResidentTriangles + 1
  value.proof.residentSweep.totalWithReservationTriangles = value.proof.residentSweep.maxSelectedTriangles + value.budgets.allOtherOwnerReservationTriangles
}, /maxSelectedTriangles: exceeds repeat resident budget/)
expectInvalid('false resident maximum below budget', (value) => {
  value.proof.residentSweep.maxSelectedTriangles -= 1
  value.proof.residentSweep.totalWithReservationTriangles -= 1
}, /does not equal recomputed exact maximum/)
expectInvalid('false resident witness', (value) => {
  value.proof.residentSweep.witness = [1_000_000, 1_000_000, 1_000_000]
}, /witness: selects 0 triangles/)
expectInvalid('false resident witness unit count', (value) => {
  value.proof.residentSweep.selectedUnitCount -= 1
}, /witness selects 12 units/)
expectInvalid('draw proof budget', (value) => {
  value.proof.activeDrawSweep.maxActiveDraws = 52
}, /maxActiveDraws: exceeds draw budget/)
expectInvalid('false active draw maximum below budget', (value) => {
  value.proof.activeDrawSweep.maxActiveDraws = 44
  value.proof.activeDrawSweep.activeParitySegmentGroups = 11
}, /does not equal recomputed exact maximum/)
expectInvalid('false active draw witness', (value) => {
  value.proof.activeDrawSweep.witness = [1_000_000, 1_000_000, 1_000_000]
}, /witness: activates 0 parity\/segment groups/)
expectInvalid('false one-row transition arithmetic', (value) => {
  value.proof.transition.oneRowArithmeticRepeatTriangles += 1
  value.proof.transition.oneRowArithmeticTotalWithReservationTriangles += 1
}, /must equal the exact resident maximum plus one source row/)
expectInvalid('false unordered double-buffer bound', (value) => {
  value.proof.transition.unorderedDoubleBufferRepeatTriangles -= 1
  value.proof.transition.unorderedDoubleBufferTotalWithReservationTriangles -= 1
}, /must equal twice the exact resident maximum/)
expectInvalid('unsupported transition gate', (value) => {
  value.gates.transitionBudgetPassed = true
}, /must equal false for the declared transition evidence/)
expectInvalid('payload request proof', (value) => {
  value.proof.payloadOnlyRequests = 4
}, /must equal the three pinned payloads/)
expectInvalid('cold request accounting', (value) => {
  value.proof.coldContractRequests = 3
}, /must equal manifest plus payload-only requests/)
expectInvalid('cold byte accounting', (value) => {
  value.proof.coldContractBytes += 1
}, /must equal manifest plus payload-only bytes/)
expectInvalid('physical manifest byte pin', () => {}, /physical manifest byte count/, {
  options: {
    observedManifest: { bytes: fixture.proof.manifestBytes + 1 },
    requirePhysicalPins: true,
    observedPayloads: observed,
  },
})
expectInvalid('inconsistent activation approval', (value) => {
  value.gates.activationApproved = true
}, /gates\.activationApproved: requires/)

// A v4 document must fail both existing v3 boundaries. This protects against
// accidental interpretation as the package/HLOD swap format.
const v3Offline = validateAnimationPackageManifestV3(fixture)
assert.equal(v3Offline.valid, false)
assert.match(v3Offline.errors.join('\n'), /version: must equal 3/)

const vite = await createServer({
  root: PROJECT_DIR,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true },
})
try {
  const runtime = await vite.ssrLoadModule('/src/scene/AnimationPackageStreamLoader.ts')
  const v3Runtime = runtime.validateAnimationPackageRuntimeManifest(fixture, 'web', {
    modelId: fixture.modelId,
    sourceSha256: 'a'.repeat(64),
    rigSha256: 'b'.repeat(64),
  })
  assert.equal(v3Runtime.valid, false)
  assert.match(v3Runtime.errors.join('\n'), /version: must equal 3/)
} finally {
  await vite.close()
}

console.log('Repeat six-part cohort manifest v4: PASS')
console.log('  strict contract: 78 sources / 6 segments / 468 ordered exact units')
console.log('  parity factorization, transformed bounds, stable digests, three payload pins, budgets and draw limits: PASS')
console.log('  disabled offline fixture: valid; activation gate: ineligible and fail-closed')
console.log('  existing manifest-v3 offline validator and runtime validator reject version 4: PASS')
console.log('  physical file-byte validation is supported by the CLI but intentionally not exercised by this in-memory suite')
