import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'

import {
  emitDisabledManifestV3Candidate,
  reviewDisabledManifestV3Candidate,
} from './lib/disabled-manifest-v3-candidate.mjs'
import { createGltfIO } from './lib/gltf-io.mjs'
import { inspectStreamPayload } from './lib/inspect-stream-payload.mjs'
import { validateAnimationPackageManifestV3File } from './validate-animation-package-manifest-v3.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const PUBLIC_MANIFEST = resolve(REPOSITORY_ROOT, 'public', 'models', 'manifest.json')
const COLLISION_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')
const COLLISION = join(COLLISION_ROOT, 'collision.glb')
const COLLISION_CONTRACT = join(COLLISION_ROOT, 'collision-activation-v1.json')
const COLLISION_COVERAGE = join(COLLISION_ROOT, 'collision-coverage-v1.json')
const TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const IMAGE_SHA256 = createHash('sha256').update(ONE_PIXEL_PNG).digest('hex')
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const REQUIRED_VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing']

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function pathsSha256(values) {
  return sha256(Buffer.from(JSON.stringify([...values].sort())))
}

async function pinned(path, requestDirectory, url) {
  const bytes = await readFile(path)
  return {
    path: relative(requestDirectory, path).replaceAll('\\', '/'),
    ...(url ? { url } : {}),
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function writePayload(io, path, sourcePath, { annotate = true } = {}) {
  const document = new Document()
  const buffer = document.createBuffer('fixture-buffer')
  const position = document.createAccessor('POSITION')
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]))
    .setBuffer(buffer)
  const normal = document.createAccessor('NORMAL')
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer)
  const uv = document.createAccessor('TEXCOORD_0')
    .setType('VEC2')
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer)
  const texture = document.createTexture('shared-one-pixel')
    .setImage(ONE_PIXEL_PNG)
    .setMimeType('image/png')
  if (annotate) {
    texture.setExtras({
      iomSharedTexture: {
        version: 1,
        contentSha256: IMAGE_SHA256,
        encodedBytes: ONE_PIXEL_PNG.byteLength,
      },
    })
  }
  const material = document.createMaterial('fixture-material').setBaseColorTexture(texture)
  const primitive = document.createPrimitive()
    .setMode(4)
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setAttribute('TEXCOORD_0', uv)
    .setMaterial(material)
  const node = document.createNode(sourcePath)
    .setMesh(document.createMesh(`${sourcePath}-mesh`).addPrimitive(primitive))
    .setExtras({ iomPackageSourcePath: sourcePath })
  document.createScene('fixture-scene').addChild(node)
  await io.write(path, document)
  return inspectStreamPayload(path, { baseDirectory: dirname(path) })
}

function metricsFromInspection(inspection) {
  return {
    sha256: inspection.file.sha256,
    triangles: inspection.geometry.expandedTriangles,
    draws: inspection.geometry.primitiveDraws,
    bytes: inspection.file.bytes,
    encodedTextureBytes: inspection.textures.summary.encodedBytes,
    gpuTextureBytes: inspection.textures.summary.conservativeGpuBytesWithFullMips,
    textureCount: inspection.textures.summary.textureCount,
    sourcePathCount: inspection.sourceOwnership.pathCount,
    sourcePathsSha256: inspection.sourceOwnership.sortedOccurrencesSha256,
    bounds: inspection.geometry.ownerLocalBounds,
  }
}

function payloadRecord(url, inspection) {
  const metrics = metricsFromInspection(inspection)
  return {
    url,
    sha256: metrics.sha256,
    bounds: { space: 'owner-local', ...metrics.bounds },
    metrics,
  }
}

function evidenceRecord(label, url, inspection, annotatedImages = 1) {
  return {
    label,
    url,
    sourceSha256: inspection.file.sha256,
    candidateSha256: inspection.file.sha256,
    sourceBytes: inspection.file.bytes,
    candidateBytes: inspection.file.bytes,
    annotatedImages,
    textureDefinitions: 1,
    imageContentSha256: [IMAGE_SHA256],
    uniqueImages: 1,
    binSha256: 'a'.repeat(64),
  }
}

async function buildFixture(root, options = {}) {
  const input = join(root, 'input')
  await mkdir(input, { recursive: true })
  const io = await createGltfIO()
  const payloadSpecs = [
    ['web-shell.glb', 'Shell-web', options.missingAnnotation === 'shell-web'],
    ['quest-shell.glb', 'Shell-quest', options.missingAnnotation === 'shell-quest'],
    ['web-detail.glb', 'Detail-web', options.missingAnnotation === 'detail-web'],
    ['quest-detail.glb', 'Detail-quest', options.missingAnnotation === 'detail-quest'],
  ]
  const inspections = {}
  for (const [name, sourcePath, missingAnnotation] of payloadSpecs) {
    inspections[name] = await writePayload(io, join(input, name), sourcePath, { annotate: !missingAnnotation })
    assert.equal(inspections[name].ok, true, `${name} fixture must pass offline geometry checks`)
  }

  const shellPaths = { web: ['Shell-web'], quest: ['Shell-quest'] }
  const detailPaths = {
    web: [options.overlap ? 'Shell-web' : 'Detail-web'],
    quest: [options.overlap ? 'Shell-quest' : 'Detail-quest'],
  }
  const shellPayloads = {
    web: payloadRecord('web-shell.glb', inspections['web-shell.glb']),
    quest: payloadRecord('quest-shell.glb', inspections['quest-shell.glb']),
  }
  const detailPayloads = {
    web: payloadRecord('web-detail.glb', inspections['web-detail.glb']),
    quest: payloadRecord('quest-detail.glb', inspections['quest-detail.glb']),
  }
  if (options.staleMetrics) detailPayloads.web.metrics.triangles += 1

  const completePaths = {
    web: [...new Set([...shellPaths.web, ...detailPaths.web])].sort(),
    quest: [...new Set([...shellPaths.quest, ...detailPaths.quest])].sort(),
  }
  const shell = {
    id: 'first-floor-shell',
    kind: 'always-resident-shell',
    residency: 'persistent-lossless',
    ownerId: 'rig-owner:first-floor-anim1',
    transform: { space: 'owner-local', matrix: IDENTITY },
    semanticRoles: ['architectural-shell', 'structural-envelope'],
    requiredAttributes: ['POSITION', 'NORMAL'],
    sourcePaths: shellPaths,
    content: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      ownershipStage: 'lossless-source-subset',
      sourcePathCount: shellPaths[variant].length,
      sourcePathsSha256: pathsSha256(shellPaths[variant]),
    }])),
    selectionBounds: Object.fromEntries(['web', 'quest'].map((variant) => [variant, shellPayloads[variant].bounds])),
    variants: shellPayloads,
    maxTriangles: 10,
    sourceOwnership: 'synthetic-test',
    requiresDetailOwnershipRepartition: false,
    outputs: { web: 'web-shell.glb', quest: 'quest-shell.glb' },
  }
  const detail = {
    id: 'first-floor-detail',
    kind: 'detail',
    residency: 'streamed',
    streaming: { lod0MarginMeters: 2 },
    ownerId: 'rig-owner:first-floor-anim1',
    transform: { space: 'owner-local', matrix: IDENTITY },
    selectionBounds: Object.fromEntries(['web', 'quest'].map((variant) => [variant, detailPayloads[variant].bounds])),
    semanticRoles: ['architectural-detail', 'interior'],
    sourcePaths: detailPaths,
    requiredAttributes: ['POSITION', 'NORMAL'],
    content: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      ownershipStage: 'dcc-source',
      sourcePathCount: detailPaths[variant].length,
      sourcePathsSha256: pathsSha256(detailPaths[variant]),
    }])),
    variants: {
      web: { lod0: detailPayloads.web },
      quest: { lod0: detailPayloads.quest },
    },
  }

  const streamRigPath = join(input, 'stream-rig.glb')
  const productionAnimationPath = join(input, 'production-animation.glb')
  await copyFile(join(input, 'web-detail.glb'), streamRigPath)
  await copyFile(join(input, 'quest-detail.glb'), productionAnimationPath)
  const sourceWebPath = join(input, 'source-web.glb')
  const sourceQuestPath = join(input, 'source-quest.glb')
  await copyFile(join(input, 'web-shell.glb'), sourceWebPath)
  await copyFile(join(input, 'quest-shell.glb'), sourceQuestPath)
  const [sourceWebBytes, sourceQuestBytes, streamRigBytes] = await Promise.all([
    readFile(sourceWebPath), readFile(sourceQuestPath), readFile(streamRigPath),
  ])

  const ownership = Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
    mode: 'disjoint-additive',
    pathCount: completePaths[variant].length,
    pathsSha256: pathsSha256(completePaths[variant]),
    components: ['first-floor-shell', 'detail-packages'],
  }]))
  const index = {
    schema: 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT',
    version: 1,
    contractTarget: 3,
    enabled: false,
    status: 'synthetic-disabled-candidate',
    modelId: 'synthetic-first-floor',
    units: 'meters',
    source: {
      animationDurationSeconds: 2,
      rigSourceVariant: 'web',
      web: {
        url: 'source-web.glb',
        sha256: sha256(sourceWebBytes),
        animationDurationSeconds: 2,
        animation: { clips: [{ name: 'Fixture', durationSeconds: 2 }] },
        owner: { meshNodes: options.overlap ? 2 : completePaths.web.length },
      },
      quest: {
        url: 'source-quest.glb',
        sha256: sha256(sourceQuestBytes),
        animationDurationSeconds: 2,
        animation: { clips: [{ name: 'Fixture', durationSeconds: 2 }] },
        owner: { meshNodes: options.overlap ? 2 : completePaths.quest.length },
      },
    },
    rig: {
      url: 'stream-rig.glb',
      sha256: sha256(streamRigBytes),
      bytes: streamRigBytes.byteLength,
      animationDurationSeconds: 2,
      clipCount: 1,
      transformSampleMatch: true,
      owners: [{ id: 'rig-owner:first-floor-anim1', nodeName: '1st Floor._anim1', persistent: true }],
    },
    packages: [detail],
    completeOwnership: ownership,
    shellCompletion: {
      ready: options.shellReady !== false,
      candidateBuilt: true,
      ownershipRepartitioned: true,
      requiredAlwaysResidentShell: shell,
    },
  }
  const indexPath = join(input, 'detail-package-index.json')
  await writeJson(indexPath, index)
  const indexBytes = await readFile(indexPath)
  const indexSha256 = sha256(indexBytes)

  const audit = {
    schema: 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT',
    version: 1,
    indexSha256,
    requireShell: true,
    detailPayloadStatus: 'passed',
    activationStatus: 'blocked',
    failures: [],
    blockers: ['synthetic evidence is intentionally disabled'],
    missingShellVariants: [],
    visualApprovalRequired: true,
    sourceCoverage: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      completeMeshPaths: completePaths[variant].length,
      completePathsSha256: pathsSha256(completePaths[variant]),
    }])),
    shell: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      sha256: shellPayloads[variant].sha256,
      bytes: shellPayloads[variant].metrics.bytes,
    }])),
  }
  const auditPath = join(input, 'shell-package-audit.json')
  await writeJson(auditPath, audit)
  const auditBytes = await readFile(auditPath)

  const evidencePayloads = [
    evidenceRecord('first-floor-shell/web/hlod', 'web-shell.glb', inspections['web-shell.glb'], options.missingAnnotation === 'shell-web' ? 0 : 1),
    evidenceRecord('first-floor-shell/quest/hlod', 'quest-shell.glb', inspections['quest-shell.glb'], options.missingAnnotation === 'shell-quest' ? 0 : 1),
    evidenceRecord('first-floor-detail/web/lod0', 'web-detail.glb', inspections['web-detail.glb'], options.missingAnnotation === 'detail-web' ? 0 : 1),
    evidenceRecord('first-floor-detail/quest/lod0', 'quest-detail.glb', inspections['quest-detail.glb'], options.missingAnnotation === 'detail-quest' ? 0 : 1),
  ]
  const sharedEvidence = {
    schema: 'IOM_SHARED_TEXTURE_RELEASE_EVIDENCE',
    version: 1,
    enabled: true,
    productionReferenced: false,
    candidateIndexSha256: indexSha256,
    identity: 'exact-embedded-image-sha256',
    compatibility: 'runtime-texture-state-plus-content-hash',
    networkExternalization: false,
    payloadCount: evidencePayloads.length,
    annotatedImageDefinitions: evidencePayloads.reduce((sum, item) => sum + item.annotatedImages, 0),
    textureDefinitions: evidencePayloads.length,
    payloads: evidencePayloads,
  }
  const sharedEvidencePath = join(input, 'shared-texture-release-evidence.json')
  await writeJson(sharedEvidencePath, sharedEvidence)

  const browserQa = {
    schema: 'IOM_SHARED_TEXTURE_BROWSER_QA',
    version: 1,
    passed: options.browserPass !== false,
    productionReferenced: false,
    selected: [
      { packageId: 'first-floor-shell', sha256: shellPayloads.web.sha256, bytes: shellPayloads.web.metrics.bytes },
      { packageId: 'first-floor-detail', sha256: detailPayloads.web.sha256, bytes: inspections['web-detail.glb'].file.bytes },
    ],
    result: {
      metadataCounts: [{ textureObjects: 1, annotated: 1 }, { textureObjects: 1, annotated: 1 }],
      acquisitions: [{ sharedTextures: 0 }, { sharedTextures: 1 }],
      registry: { roots: 2, entries: 1, references: 2 },
    },
  }
  const browserQaPath = join(input, 'shared-texture-browser-qa.json')
  await writeJson(browserQaPath, browserQa)

  const shellApproval = {
    schema: 'IOM_SHELL_VISUAL_APPROVAL',
    version: 1,
    approved: true,
    productionReferenced: false,
    packageIndexSha256: indexSha256,
    packageAuditSha256: sha256(auditBytes),
    variants: {
      web: { approved: true, views: REQUIRED_VIEWS },
      quest: { approved: true, views: REQUIRED_VIEWS },
    },
  }
  const shellApprovalPath = join(input, 'shell-visual-approval.json')
  await writeJson(shellApprovalPath, shellApproval)

  let coveragePath = COLLISION_COVERAGE
  if (options.collisionMismatch) {
    const coverage = JSON.parse(await readFile(COLLISION_COVERAGE, 'utf8'))
    coverage.broadHorizontalCoverage.ratio = Math.max(0, coverage.broadHorizontalCoverage.ratio - 0.01)
    coveragePath = join(input, 'stale-collision-coverage.json')
    await writeJson(coveragePath, coverage)
  }
  const contract = JSON.parse(await readFile(COLLISION_CONTRACT, 'utf8'))
  const productionManifest = {
    version: 2,
    models: [{
      id: contract.modelId,
      name: 'Synthetic pinned production snapshot',
      web: '/synthetic/source-web.glb',
      quest: '/synthetic/source-quest.glb',
      animation: '/synthetic/production-animation.glb',
      collision: contract.collision.url,
    }],
  }
  const productionManifestPath = join(input, 'production-manifest-snapshot.json')
  await writeJson(productionManifestPath, productionManifest)

  const requestPath = join(input, 'disabled-manifest-v3-request.json')
  const request = {
    schema: 'IOM_DISABLED_MANIFEST_V3_CANDIDATE_REQUEST',
    version: 1,
    enabled: false,
    modelId: contract.modelId,
    packageIndex: await pinned(indexPath, input),
    packageAudit: await pinned(auditPath, input),
    shellVisualApproval: await pinned(shellApprovalPath, input),
    production: {
      manifest: await pinned(productionManifestPath, input),
      sources: {
        web: await pinned(sourceWebPath, input, productionManifest.models[0].web),
        quest: await pinned(sourceQuestPath, input, productionManifest.models[0].quest),
      },
      animationRig: await pinned(productionAnimationPath, input, productionManifest.models[0].animation),
      collision: await pinned(COLLISION, input, contract.collision.url),
    },
    streamRig: await pinned(streamRigPath, input),
    collisionEvidence: {
      contract: await pinned(COLLISION_CONTRACT, input, contract.coverageReport.url.replace('collision-coverage', 'collision-activation')),
      coverageReport: await pinned(coveragePath, input, contract.coverageReport.url),
    },
    sharedTextures: {
      evidence: await pinned(sharedEvidencePath, input),
      browserQa: await pinned(browserQaPath, input),
    },
    budgets: {
      maxDetailTriangles: 10,
      maxAlwaysResidentShellTriangles: 10,
      maxResident: {
        web: { triangles: 10, draws: 10, bytes: 100000, encodedTextureBytes: 100000, gpuTextureBytes: 100000 },
        quest: { triangles: 10, draws: 10, bytes: 100000, encodedTextureBytes: 100000, gpuTextureBytes: 100000 },
      },
      maxTransitionPeak: {
        web: { triangles: 20, draws: 20, bytes: 200000, encodedTextureBytes: 200000, gpuTextureBytes: 200000 },
        quest: { triangles: 20, draws: 20, bytes: 200000, encodedTextureBytes: 200000, gpuTextureBytes: 200000 },
      },
    },
  }
  await writeJson(requestPath, request)
  return { requestPath, input, indexPath }
}

async function expectRejected(root, name, options, expected) {
  const fixture = await buildFixture(join(root, name), options)
  const output = join(root, name, 'output')
  let collisionCalls = 0
  await assert.rejects(
    () => emitDisabledManifestV3Candidate(fixture.requestPath, output, {
      collisionGate: async () => { collisionCalls += 1 },
    }),
    expected,
    name,
  )
  assert.equal(await stat(output).then(() => true, () => false), false, `${name}: failed gate left output behind`)
  return collisionCalls
}

await mkdir(TMP_ROOT, { recursive: true })
const testRoot = await mkdtemp(join(TMP_ROOT, 'disabled-manifest-v3-emitter-test-'))
const publicManifestHashBefore = sha256(await readFile(PUBLIC_MANIFEST))
try {
  const validFixture = await buildFixture(join(testRoot, 'valid'))
  const validOutput = join(testRoot, 'valid', 'output')
  let collisionCalls = 0
  const emitted = await emitDisabledManifestV3Candidate(validFixture.requestPath, validOutput, {
    collisionGate: async ({ contract, coverage, collision }) => {
      collisionCalls += 1
      assert.equal(resolve(contract), COLLISION_CONTRACT)
      assert.equal(resolve(coverage), COLLISION_COVERAGE)
      assert.equal(resolve(collision), COLLISION)
    },
  })
  assert.equal(collisionCalls, 1)
  assert.equal(emitted.report.enabled, false)
  assert.equal(emitted.report.productionReferenced, false)
  assert.equal(emitted.report.packageCount, 2)
  assert.equal(emitted.report.payloadCount, 4)

  for (const variant of ['web', 'quest']) {
    const path = join(validOutput, `manifest-v3-${variant}.json`)
    const manifest = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(manifest.enabled, false)
    assert.equal(manifest.releaseCandidate.targetVariant, variant)
    assert.equal(manifest.packages.filter((pkg) => pkg.kind === 'always-resident-shell').length, 1)
    const validation = await validateAnimationPackageManifestV3File(path)
    assert.equal(validation.valid, true, validation.errors.join('\n'))
  }
  const entry = JSON.parse(await readFile(join(validOutput, 'disabled-hlod-streaming-entry.json'), 'utf8'))
  assert.equal(entry.enabled, false)
  assert.equal(entry.hlodStreaming.enabled, false)
  assert.equal(entry.productionReferenced, false)

  let reviewCollisionCalls = 0
  const readyReview = await reviewDisabledManifestV3Candidate(validFixture.requestPath, {
    collisionGate: async () => { reviewCollisionCalls += 1 },
  })
  assert.equal(reviewCollisionCalls, 1)
  assert.equal(readyReview.status, 'ready-for-disabled-candidate-emission')
  assert.equal(readyReview.checks.collisionActivation.status, 'passed')
  assert.equal(readyReview.safety.manifestsEmitted, false)

  assert.equal(
    await expectRejected(testRoot, 'shell-not-approved', { shellReady: false }, /shellCompletion\.ready/),
    0,
  )
  assert.equal(
    await expectRejected(testRoot, 'ownership-overlap', { overlap: true }, /global ownership overlap/),
    0,
  )
  assert.equal(
    await expectRejected(testRoot, 'stale-metrics', { staleMetrics: true }, /offline payload validation failed/),
    1,
  )
  assert.equal(
    await expectRejected(testRoot, 'missing-image-annotation', { missingAnnotation: 'detail-web' }, /missing iomSharedTexture/),
    1,
  )
  assert.equal(
    await expectRejected(testRoot, 'browser-qa-failed', { browserPass: false }, /browserQa\.passed/),
    1,
  )
  assert.equal(
    await expectRejected(testRoot, 'collision-evidence-mismatch', { collisionMismatch: true }, /collision contract: coverage SHA mismatch/),
    0,
  )

  assert.equal(sha256(await readFile(PUBLIC_MANIFEST)), publicManifestHashBefore, 'production manifest changed')
  console.log('Disabled manifest-v3 candidate emitter: PASS')
  console.log('  exact pins, shell/disjoint ownership, payload metrics/bounds, image annotations, browser QA, collision evidence')
  console.log('  Web/Quest manifests and entry candidate remain enabled=false; production manifest unchanged')
} finally {
  await rm(testRoot, { recursive: true, force: true })
}
