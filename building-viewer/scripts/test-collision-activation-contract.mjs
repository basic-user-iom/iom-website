import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const HASH_COLLISION = 'a'.repeat(64)
const HASH_COVERAGE = 'b'.repeat(64)

const runtime = {
  triangles: 12_000,
  chunks: 18,
  boundsMin: [-50, -0.2, -40],
  boundsMax: [50, 12, 40],
  preferredColliderMeshes: 24,
}

const contract = {
  version: 1,
  modelId: 'contract-test',
  collision: {
    url: '/models/contract-test/collision.glb',
    sha256: HASH_COLLISION,
    bytes: 123_456,
    runtime,
  },
  coverageReport: {
    url: '/models/contract-test/collision-coverage-v1.json',
    sha256: HASH_COVERAGE,
    bytes: 4_096,
  },
  requirements: {
    spawnProbeId: 'spawn',
    minHorizontalCoverageRatio: 0.9,
    minHorizontalCoveredCells: 80,
    minElevationBands: 2,
    minElevationSeparationMeters: 3,
    requiredProbes: [
      { id: 'spawn', minUpDot: 0.7, maxVerticalErrorMeters: 0.2 },
      { id: 'foyer-landing', minUpDot: 0.7, maxVerticalErrorMeters: 0.2 },
    ],
    requiredStairs: [
      {
        id: 'MainStair',
        minHorizontalTriangles: 8,
        minSupportCoverageRatio: 0.82,
        minVerticalSpanMeters: 2.5,
      },
    ],
  },
}

const spawnProbe = {
  id: 'spawn',
  kind: 'spawn',
  point: [0, 1.7, 0],
  supported: true,
  hitPoint: [0, 0, 0],
  upDot: 1,
  verticalErrorMeters: 0.01,
}

const coverage = {
  version: 1,
  modelId: 'contract-test',
  collision: { sha256: HASH_COLLISION, bytes: 123_456, runtime },
  spawnSupport: spawnProbe,
  broadHorizontalCoverage: {
    requiredCells: 100,
    coveredCells: 95,
    missingCells: 5,
    ratio: 0.95,
    elevationBands: [
      { id: 'ground', minY: -0.2, maxY: 0.2, requiredCells: 60, coveredCells: 58 },
      { id: 'level-1', minY: 3.8, maxY: 4.2, requiredCells: 40, coveredCells: 37 },
    ],
  },
  probes: [
    spawnProbe,
    {
      id: 'foyer-landing',
      kind: 'landing',
      point: [4, 5.7, 3],
      supported: true,
      hitPoint: [4, 4, 3],
      upDot: 0.99,
      verticalErrorMeters: 0.02,
    },
  ],
  namedStairs: [
    {
      id: 'MainStair',
      present: true,
      horizontalTriangles: 64,
      supportCoverageRatio: 0.94,
      minY: 0,
      maxY: 4,
    },
  ],
}

const evidence = {
  collisionSha256: HASH_COLLISION,
  collisionBytes: 123_456,
  coverageReportSha256: HASH_COVERAGE,
  coverageReportBytes: 4_096,
  runtime,
}

const vite = await createServer({
  root: PROJECT_DIR,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const activation = await vite.ssrLoadModule('/src/collision/collisionActivationContract.ts')
  const dedicated = await vite.ssrLoadModule('/src/collision/dedicatedCollisionValidation.ts')

  const valid = activation.validateCollisionActivationEvidence(contract, coverage, evidence)
  assert.equal(valid.valid, true, valid.errors.join('\n'))
  assert.deepEqual(valid.summary, {
    triangles: 12_000,
    chunks: 18,
    horizontalCoverageRatio: 0.95,
    coveredElevationBands: 2,
    validatedProbes: 2,
    validatedStairs: 1,
  })

  for (const [name, mutate, expected] of [
    ['triangles', (value) => { value.runtime.triangles += 1 }, /triangles: exact pin mismatch/],
    ['chunks', (value) => { value.runtime.chunks += 1 }, /chunks: exact pin mismatch/],
    ['bounds', (value) => { value.runtime.boundsMax[0] += 0.001 }, /boundsMax\[0\]: exact pin mismatch/],
    ['preferred colliders', (value) => { value.runtime.preferredColliderMeshes -= 1 }, /preferredColliderMeshes: exact pin mismatch/],
  ]) {
    const changedEvidence = structuredClone(evidence)
    mutate(changedEvidence)
    const result = activation.validateCollisionActivationEvidence(contract, coverage, changedEvidence)
    assert.equal(result.valid, false, `${name} pin unexpectedly passed`)
    assert.match(result.errors.join('\n'), expected, name)
  }

  const staleCoverage = structuredClone(coverage)
  staleCoverage.collision.sha256 = 'c'.repeat(64)
  const staleResult = activation.validateCollisionActivationEvidence(contract, staleCoverage, evidence)
  assert.equal(staleResult.valid, false)
  assert.match(staleResult.errors.join('\n'), /report is tied to a different collision GLB/)

  // A tessellated flat plane passes the intentionally cheap geometry gate.
  // Full activation still fails because it cannot prove another elevation,
  // an independent support probe, or a named stair with vertical span.
  const flatRoot = new Group()
  const flatGeometry = new PlaneGeometry(100, 100, 32, 32)
  const flatMaterial = new MeshBasicMaterial()
  const flat = new Mesh(flatGeometry, flatMaterial)
  flat.name = 'COLLIDER_Floor'
  flat.rotateX(-Math.PI / 2)
  flatRoot.add(flat)
  const cheap = dedicated.validateDedicatedCollisionRoot(flatRoot, 'flat-plane-test', false)
  assert.equal(cheap.valid, true, cheap.reason ?? 'flat cheap gate should pass')
  assert.ok(cheap.collision)

  const flatMetrics = cheap.collision.runtimeMetrics
  const flatContract = structuredClone(contract)
  flatContract.collision.runtime = flatMetrics
  const flatCoverage = structuredClone(coverage)
  flatCoverage.collision.runtime = flatMetrics
  flatCoverage.broadHorizontalCoverage = {
    requiredCells: 100,
    coveredCells: 100,
    missingCells: 0,
    ratio: 1,
    elevationBands: [
      { id: 'flat', minY: 0, maxY: 0, requiredCells: 100, coveredCells: 100 },
    ],
  }
  flatCoverage.probes = [spawnProbe]
  flatCoverage.namedStairs = []
  const flatEvidence = { ...evidence, runtime: flatMetrics }
  const flatActivation = activation.validateCollisionActivationEvidence(
    flatContract,
    flatCoverage,
    flatEvidence,
  )
  assert.equal(flatActivation.valid, false, 'flat plane must never satisfy full activation')
  assert.match(flatActivation.errors.join('\n'), /2 required/)
  assert.match(flatActivation.errors.join('\n'), /required probe "foyer-landing" is missing/)
  assert.match(flatActivation.errors.join('\n'), /required stair "MainStair" is missing/)

  // Weakening stair/probe/elevation requirements in the contract is rejected,
  // so packaging cannot accidentally opt out of the full proof.
  const weakened = structuredClone(flatContract)
  weakened.requirements.minElevationBands = 1
  weakened.requirements.requiredProbes = [weakened.requirements.requiredProbes[0]]
  weakened.requirements.requiredStairs = []
  const weakenedResult = activation.validateCollisionActivationEvidence(
    weakened,
    flatCoverage,
    flatEvidence,
  )
  assert.equal(weakenedResult.valid, false)
  assert.match(weakenedResult.errors.join('\n'), /single plane is not activation-safe/)
  assert.match(weakenedResult.errors.join('\n'), /at least spawn plus one independent/)
  assert.match(weakenedResult.errors.join('\n'), /flat plane cannot satisfy full activation/)

  assert.deepEqual(
    activation.validateCollisionRuntimeMetricPin(cheap.collision.report, flatMetrics),
    [],
  )
  const wrongPin = structuredClone(flatMetrics)
  wrongPin.chunks += 1
  assert.match(
    activation.validateCollisionRuntimeMetricPin(cheap.collision.report, wrongPin).join('\n'),
    /chunks: exact pin mismatch/,
  )
  const strictPass = dedicated.validateDedicatedCollisionRoot(
    flatRoot,
    'flat-plane-exact-pin-test',
    false,
    flatMetrics,
  )
  assert.equal(strictPass.valid, true, strictPass.reason ?? 'exact runtime pin should pass')
  dedicated.disposeCollisionChunks(strictPass.collision.chunks)
  const strictFailure = dedicated.validateDedicatedCollisionRoot(
    flatRoot,
    'flat-plane-wrong-pin-test',
    false,
    wrongPin,
  )
  assert.equal(strictFailure.valid, false)
  assert.match(strictFailure.reason, /does not match approved runtime metrics/)

  dedicated.disposeCollisionChunks(cheap.collision.chunks)
  flatGeometry.dispose()
  flatMaterial.dispose()

  console.log(
    'Collision activation contract: PASS (exact runtime pins, SHA-bound coverage, spawn/probes, multi-level coverage, named stairs, flat-plane rejection)',
  )
} finally {
  await vite.close()
}
