import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const GENERATION = 88_501

function makeTemplates() {
  const templates = []
  const resources = []
  for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
    for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ], 3))
      geometry.setIndex([0, 1, 2])
      const material = new MeshBasicMaterial({ color: 0xffffff })
      templates.push({ segmentIndex, materialIndex, geometry, material })
      resources.push(geometry, material)
    }
  }
  return { templates, resources }
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen)
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
})

let adapter = null
let resources = []
try {
  const [adapterModule, portModule, evidenceModule, exactHarnessModule, witnessModule] = await Promise.all([
    vite.ssrLoadModule('/src/scene/development/DevelopmentRepeatSixPartPersistentCatalogRendererAdapter.ts'),
    vite.ssrLoadModule('/src/scene/development/DevelopmentRepeatSixPartThreeRendererPort.ts'),
    vite.ssrLoadModule('/src/scene/development/harness/RepeatSixPartRealSceneEvidence.ts'),
    vite.ssrLoadModule('/src/scene/development/harness/RepeatSixPartExactGeometryHarness.ts'),
    vite.ssrLoadModule('/src/scene/development/harness/RepeatSixPartBoundaryRollbackWitness.ts'),
  ])
  const pin = evidenceModule.REPEAT_SIX_PART_REAL_SCENE_ASSETS.manifest
  const manifestPath = join(PROJECT_DIR, pin.url.replace(/^\/+/, ''))
  const manifestBytes = await readFile(manifestPath)
  assert.equal(manifestBytes.byteLength, pin.bytes)
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), pin.sha256)
  const manifest = exactHarnessModule.exactCatalogManifest({
    manifest: JSON.parse(manifestBytes.toString('utf8')),
  })

  const parent = new Group()
  const made = makeTemplates()
  resources = made.resources
  const port = new portModule.DevelopmentRepeatSixPartThreeRendererPort({
    generation: GENERATION,
    parent,
    parityHostMatrices: {
      positive: manifest.parity.hosts.positive.matrix,
      mirrored: manifest.parity.hosts.mirrored.matrix,
    },
    templates: made.templates,
  })
  const fallbackReasons = []
  adapter = new adapterModule.DevelopmentRepeatSixPartPersistentCatalogRendererAdapter({
    generation: GENERATION,
    domainId: 'development-boundary-rollback-witness-test',
    manifest,
    renderer: port,
    monolithicFallback: {
      activateMonolithicFallback: (reason) => fallbackReasons.push(reason),
    },
  })

  await assert.rejects(
    () => witnessModule.runDevelopmentRepeatSixPartBoundaryRollbackWitness({
      generation: GENERATION,
      manifest,
      adapter,
      rendererPort: {},
    }),
    /authentic issued adapter-to-Three-port pair is required/,
  )

  const evidence = await witnessModule.runDevelopmentRepeatSixPartBoundaryRollbackWitness({
    generation: GENERATION,
    manifest,
    adapter,
    rendererPort: port,
  })
  assert.equal(evidence.kind, 'development-repeat-six-part-boundary-rollback-witness')
  assert.equal(evidence.developmentOnly, true)
  assert.equal(evidence.target.unitKey, 'source-37:segment-05')
  assert.equal(evidence.target.unitIndex, 227)
  assert.equal(evidence.target.parity, 'positive')
  assert.equal(evidence.target.verifiedMaterialHandles, 4)
  assert.deepEqual(evidence.selector, {
    boundsType: 'closed-aabb',
    distanceMetric: 'linf-point-to-closed-aabb',
    enterMarginMeters: 3.5,
    exitMarginMeters: 5.5,
    epsilonMeters: 0.000001,
  })
  assert.deepEqual(
    evidence.boundarySteps.map(({ name, result, targetState }) => [name, result, targetState]),
    [
      ['entry-epsilon-outside-from-culled', 'no-op', 'culled'],
      ['entry-exact-closed-boundary', 'committed', 'active'],
      ['entry-epsilon-inside-while-active', 'no-op', 'active'],
      ['deadband-outbound-retains-active', 'no-op', 'active'],
      ['exit-exact-closed-boundary', 'no-op', 'active'],
      ['exit-epsilon-outside-culls', 'committed', 'culled'],
      ['deadband-inbound-retains-culled', 'no-op', 'culled'],
      ['entry-epsilon-outside-retains-culled', 'no-op', 'culled'],
      ['entry-exact-reactivates', 'committed', 'active'],
    ],
  )
  assert.ok(evidence.boundarySteps.every((step) => step.verifiedMaterialHandles === 4))
  assert.deepEqual(evidence.rapidSequentialChurn, {
    cycles: 4,
    updates: 16,
    committed: 8,
    noOp: 8,
    finalTargetState: 'active',
  })
  assert.equal(evidence.afterPublishCancellation.result, 'cancelled')
  assert.equal(evidence.afterPublishCancellation.cancellationStage, 'after-publish')
  assert.equal(evidence.afterPublishCancellation.transientPublicationObserved, true)
  assert.equal(evidence.afterPublishCancellation.all48PhysicalListsRestored, true)
  assert.equal(evidence.afterPublishCancellation.persistentMeshIdentitiesRetained, true)
  assert.equal(evidence.afterPublishCancellation.plannerRevisionRestored, true)
  assert.equal(evidence.afterPublishCancellation.registryRevisionRestored, true)
  assert.equal(evidence.afterPublishCancellation.activeStateRestored, true)
  assert.equal(evidence.afterPublishCancellation.verifiedMaterialHandles, 4)
  assert.equal(evidence.afterPublishCancellation.rendererRevisionAdvance, 2)
  assert.equal(
    evidence.afterPublishCancellation.transientRendererRevision,
    evidence.afterPublishCancellation.rendererRevisionBefore + 1,
  )
  assert.equal(
    evidence.afterPublishCancellation.rendererRevisionAfter,
    evidence.afterPublishCancellation.rendererRevisionBefore + 2,
  )
  assert.equal(evidence.finalRequestedFocus.result, 'no-op')
  assert.equal(evidence.finalRequestedFocus.targetState, 'active')
  assert.equal(evidence.finalRequestedFocus.appliedAfterRollback, true)
  assert.equal(evidence.activationAuthorized, false)
  assert.equal(evidence.activationCapability, null)
  assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'adapter'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'rendererPort'), false)
  assertDeepFrozen(evidence)

  const final = adapter.getSnapshot()
  assert.equal(final.state, 'ready')
  assert.equal(final.transactionPhase, 'idle')
  assert.equal(final.counters.activeUnits, 1)
  assert.equal(final.counters.activeLists, 4)
  assert.equal(final.counters.rendererRollbackAttempts, 1)
  assert.equal(final.counters.verifiedAtomicRollbacks, 1)
  assert.equal(final.counters.cancelledUpdates, 1)
  assert.equal(fallbackReasons.length, 0)

  console.log('Development repeat-six-part exact boundary/rollback witness: PASS')
  console.log(JSON.stringify({
    target: evidence.target.unitKey,
    boundarySteps: evidence.boundarySteps.length,
    rapidSequentialUpdates: evidence.rapidSequentialChurn.updates,
    verifiedMaterialHandles: evidence.target.verifiedMaterialHandles,
    all48PhysicalListsRestored: evidence.afterPublishCancellation.all48PhysicalListsRestored,
    rendererRevisionAdvance: evidence.afterPublishCancellation.rendererRevisionAdvance,
    activationAuthorized: evidence.activationAuthorized,
  }, null, 2))
} finally {
  if (adapter) await adapter.dispose()
  for (const resource of resources) resource.dispose()
  await vite.close()
}
