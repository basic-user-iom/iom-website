import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  PerspectiveCamera,
  PlaneGeometry,
  Texture,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const pilot = JSON.parse(
  await readFile(join(SCRIPT_DIR, 'fixtures', 'animation-package-manifest-v3-disabled-pilot.json'), 'utf8'),
)

const enabledManifest = () => {
  const manifest = structuredClone(pilot)
  manifest.enabled = true
  manifest.modelId = 'runtime-pilot'
  manifest.packages.forEach((pkg) => {
    pkg.sourcePaths = {
      web: [`source/${pkg.id}`],
      quest: [`source/${pkg.id}`],
    }
  })
  for (const variant of ['web', 'quest']) {
    const paths = manifest.packages.flatMap((pkg) => pkg.sourcePaths[variant]).sort()
    manifest.source.ownership[variant] = {
      mode: 'disjoint-additive',
      pathCount: paths.length,
      pathsSha256: createHash('sha256').update(JSON.stringify(paths)).digest('hex'),
    }
  }
  return manifest
}
const pins = {
  modelId: 'runtime-pilot',
  sourceSha256: pilot.source.variants.web.sha256,
  rigSha256: pilot.rig.sha256,
}

const collisionRuntime = {
  triangles: 1250,
  chunks: 1,
  boundsMin: [-10, 0, -10],
  boundsMax: [10, 0, 10],
  preferredColliderMeshes: 1,
}

function pinnedJson(value) {
  const text = JSON.stringify(value)
  const bytes = new TextEncoder().encode(text)
  return {
    text,
    integrity: {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    },
  }
}

const syntheticSpawn = {
  id: 'spawn', kind: 'spawn', point: [0, 0.1, 0], supported: true,
  hitPoint: [0, 0, 0], upDot: 1, verticalErrorMeters: 0.1,
}
const syntheticLanding = {
  id: 'landing', kind: 'landing', point: [2, 4.1, 2], supported: true,
  hitPoint: [2, 4, 2], upDot: 1, verticalErrorMeters: 0.1,
}
const activationCoverageValue = {
  version: 1,
  modelId: 'runtime-pilot',
  collision: { sha256: 'c'.repeat(64), bytes: 200, runtime: collisionRuntime },
  spawnSupport: syntheticSpawn,
  broadHorizontalCoverage: {
    requiredCells: 4,
    coveredCells: 4,
    missingCells: 0,
    ratio: 1,
    elevationBands: [
      { id: 'lower', minY: 0, maxY: 1, requiredCells: 2, coveredCells: 2 },
      { id: 'upper', minY: 4, maxY: 5, requiredCells: 2, coveredCells: 2 },
    ],
  },
  probes: [syntheticSpawn, syntheticLanding],
  namedStairs: [{
    id: 'synthetic-stair', present: true, horizontalTriangles: 20,
    supportCoverageRatio: 1, minY: 0, maxY: 4,
  }],
}
const activationCoverage = pinnedJson(activationCoverageValue)
const activationContractValue = {
  version: 1,
  modelId: 'runtime-pilot',
  collision: { url: '/collision.glb', sha256: 'c'.repeat(64), bytes: 200, runtime: collisionRuntime },
  coverageReport: {
    url: '/collision-coverage.json',
    ...activationCoverage.integrity,
  },
  requirements: {
    spawnProbeId: 'spawn',
    minHorizontalCoverageRatio: 1,
    minHorizontalCoveredCells: 4,
    minElevationBands: 2,
    minElevationSeparationMeters: 3,
    requiredProbes: [
      { id: 'spawn', minUpDot: 0.7, maxVerticalErrorMeters: 0.2 },
      { id: 'landing', minUpDot: 0.7, maxVerticalErrorMeters: 0.2 },
    ],
    requiredStairs: [{
      id: 'synthetic-stair', minHorizontalTriangles: 2,
      minSupportCoverageRatio: 0.5, minVerticalSpanMeters: 1,
    }],
  },
}
const activationContract = pinnedJson(activationContractValue)
const collisionActivation = {
  contract: {
    url: '/collision-activation.json',
    ...activationContract.integrity,
  },
  coverageReport: {
    url: '/collision-coverage.json',
    ...activationCoverage.integrity,
  },
}

const streamingEntry = (overrides = {}) => ({
  id: 'runtime-pilot',
  name: 'Runtime pilot',
  web: '/mono.glb',
  collision: '/collision.glb',
  hlodStreaming: {
    enabled: true,
    web: '/pilot/manifest.json',
    sourceSha256: { web: pins.sourceSha256, quest: pilot.source.variants.quest.sha256 },
    rigSha256: pins.rigSha256,
    manifestSha256: {
      web: currentManifestIntegrity().sha256,
      quest: currentManifestIntegrity().sha256,
    },
    manifestBytes: {
      web: currentManifestIntegrity().bytes,
      quest: currentManifestIntegrity().bytes,
    },
    collisionSha256: 'c'.repeat(64),
    collisionBytes: 200,
    collisionActivation: structuredClone(collisionActivation),
  },
  ...overrides,
})

const originalFetch = globalThis.fetch
let fetchedManifest = enabledManifest()
let manifestFetches = 0
function currentManifestIntegrity() {
  const bytes = new TextEncoder().encode(JSON.stringify(fetchedManifest))
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  }
}
globalThis.fetch = async (input) => {
  const url = String(input)
  if (url === '/collision-activation.json') {
    return new Response(activationContract.text, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (url === '/collision-coverage.json') {
    return new Response(activationCoverage.text, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  manifestFetches += 1
  return new Response(JSON.stringify(fetchedManifest), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const vite = await createServer({
  root: join(SCRIPT_DIR, '..'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

function modelResult(root, url, bytes, animations = []) {
  return {
    root,
    url,
    transferredBytes: bytes,
    downloadMs: 1,
    parseMs: 1,
    fileSizeBytes: bytes,
    animations,
  }
}

class FakeLoader {
  calls = []
  integrityCalls = []
  rigDuration = pilot.rig.animationDurationSeconds
  deferred = null
  monolithDeferred = null
  sharedGeometry = new BoxGeometry(1, 1, 1)
  packageGeometry = this.sharedGeometry
  sharedTexture = new Texture()
  sharedMaterial = new MeshBasicMaterial({ map: this.sharedTexture })
  packageRoots = []
  rejectIntegrityFor = null
  throwFor = null
  rigRenderable = false
  packageDecorator = null
  collisionMode = 'valid'

  makeRig(url, bytes) {
    const root = new Group()
    const owner = new Group()
    owner.name = '1st Floor._anim1'
    root.add(owner)
    if (this.rigRenderable) root.add(new Mesh(this.sharedGeometry, this.sharedMaterial))
    const clip = new AnimationClip('Pilot floor motion', this.rigDuration, [
      new NumberKeyframeTrack('1st Floor._anim1.position[x]', [0, this.rigDuration], [0, 1]),
    ])
    return modelResult(root, url, bytes, [clip])
  }

  makePackage(url, bytes) {
    const root = new Group()
    const contract = fetchedManifest.packages.find((pkg) =>
      Object.values(pkg.variants).some((variant) =>
        Object.values(variant).some((payload) => payload?.url && url.endsWith(payload.url.replace(/^__DISABLED_PILOT__\//, ''))),
      ),
    )
    if (contract) root.userData.iomPackageSourcePaths = [...contract.sourcePaths.web]
    const count = /detail(?:2)?-(?:lod0|hlod)/.test(url) && !/critical/.test(url) ? 3 : 1
    for (let index = 0; index < count; index += 1) {
      const mesh = new Mesh(this.packageGeometry, this.sharedMaterial)
      mesh.name = `PackageMesh${index}`
      mesh.position.x = index * 2
      root.add(mesh)
    }
    this.packageDecorator?.(root)
    this.packageRoots.push({ url, root })
    return modelResult(root, url, bytes)
  }

  makeCollision(url, bytes = 200) {
    if (this.collisionMode === 'throw') throw new Error('Synthetic collision download failure')
    const root = new Group()
    if (this.collisionMode === 'valid') {
      const geometry = new PlaneGeometry(20, 20, 25, 25)
      const positions = geometry.getAttribute('position')
      for (let index = 0; index < positions.count; index += 1) {
        const z = positions.getY(index)
        positions.setXYZ(index, positions.getX(index), 0, z)
      }
      positions.needsUpdate = true
      const mesh = new Mesh(geometry, new MeshBasicMaterial())
      mesh.name = 'COLLIDER_Ground'
      root.add(mesh)
    }
    return modelResult(root, url, bytes)
  }

  deferNext(match) {
    let finish
    let markStarted
    const promise = new Promise((resolve) => { finish = resolve })
    const started = new Promise((resolve) => { markStarted = resolve })
    this.deferred = { match, promise, finish, started, markStarted }
    return this.deferred
  }

  deferMonolith() {
    let finish
    let markStarted
    const promise = new Promise((resolve) => { finish = resolve })
    const started = new Promise((resolve) => { markStarted = resolve })
    this.monolithDeferred = { promise, finish, started, markStarted }
    return this.monolithDeferred
  }

  async loadUrlVerified(url, integrity, _progress, _signal) {
    this.calls.push(url)
    this.integrityCalls.push({ url, integrity })
    if (this.rejectIntegrityFor?.(url)) throw new Error(`Asset SHA-256 mismatch for ${url}`)
    if (this.throwFor?.(url)) throw new Error(`Synthetic package failure: ${url}`)
    if (url.includes('/rig/animations.glb')) return this.makeRig(url, integrity.bytes)
    if (url === '/collision.glb') return this.makeCollision(url, integrity.bytes)
    const deferred = this.deferred
    if (deferred?.match(url)) {
      this.deferred = null
      deferred.markStarted()
      await deferred.promise
    }
    return this.makePackage(url, integrity.bytes)
  }

  async loadUrl(url) {
    this.calls.push(url)
    if (url === '/mono.glb') {
      const deferred = this.monolithDeferred
      if (deferred) {
        this.monolithDeferred = null
        deferred.markStarted()
        await deferred.promise
      }
      return modelResult(new Group(), url, 100)
    }
    if (url === '/collision.glb') {
      return this.makeCollision(url)
    }
    throw new Error(`Unexpected unverified load: ${url}`)
  }

  dispose() {}
}

function addOptionalDetailHlod(manifest) {
  const detail = manifest.packages.find((pkg) => pkg.id === 'floor-01-detail-pilot')
  for (const variant of ['web', 'quest']) {
    detail.variants[variant].hlod = {
      url: `__DISABLED_PILOT__/${variant}/floor-01-detail-hlod.glb`,
      sha256: '9'.repeat(64),
      bounds: structuredClone(detail.selectionBounds[variant]),
      estimates: { triangles: 36, draws: 3, bytes: 104, encodedTextureBytes: 0, gpuTextureBytes: 0 },
    }
  }
  detail.streaming.hlodMarginMeters = 20
}

try {
  const [runtimeModule, playerModule, managerModule, proceduralModule, loaderModule, collisionPolicyModule] = await Promise.all([
    vite.ssrLoadModule('/src/scene/AnimationPackageStreamLoader.ts'),
    vite.ssrLoadModule('/src/scene/ModelAnimationPlayer.ts'),
    vite.ssrLoadModule('/src/scene/ModelManager.ts'),
    vite.ssrLoadModule('/src/scene/ProceduralInstancing.ts'),
    vite.ssrLoadModule('/src/scene/ModelLoader.ts'),
    vite.ssrLoadModule('/src/collision/dedicatedCollisionValidation.ts'),
  ])
  const { AnimationPackageStreamLoader, validateAnimationPackageRuntimeManifest } = runtimeModule
  const { ModelAnimationPlayer } = playerModule
  const { ModelManager } = managerModule
  const { applyProceduralInstancing } = proceduralModule
  const { verifyModelAssetIntegrity } = loaderModule
  const { allowsVisualCollisionFallback } = collisionPolicyModule

  // The actual ModelLoader integrity primitive rejects before parsing.
  {
    const buffer = new TextEncoder().encode('verified bytes').buffer
    const sha256 = createHash('sha256').update(new Uint8Array(buffer)).digest('hex')
    await verifyModelAssetIntegrity(buffer, { sha256, bytes: buffer.byteLength }, '/verified.glb')
    await assert.rejects(
      verifyModelAssetIntegrity(buffer, { sha256: '0'.repeat(64), bytes: buffer.byteLength }, '/bad.glb'),
      /SHA-256 mismatch/,
    )
    await assert.rejects(
      verifyModelAssetIntegrity(buffer, { sha256, bytes: buffer.byteLength + 1 }, '/bad-bytes.glb'),
      /byte-length mismatch/,
    )
  }

  // Runtime repeats dormant schema guards, including affine and LOD ordering.
  {
    assert.equal(validateAnimationPackageRuntimeManifest(enabledManifest(), 'web', pins).valid, true)
    const disabled = enabledManifest()
    disabled.enabled = false
    assert.match(validateAnimationPackageRuntimeManifest(disabled, 'web', pins).errors.join('\n'), /enabled: must explicitly equal true/)
    const projective = enabledManifest()
    projective.packages[2].transform.matrix[3] = 0.25
    assert.match(validateAnimationPackageRuntimeManifest(projective, 'web', pins).errors.join('\n'), /affine column-major/)
    const heavier = enabledManifest()
    addOptionalDetailHlod(heavier)
    heavier.packages[2].variants.web.hlod.estimates.triangles = 37
    assert.match(validateAnimationPackageRuntimeManifest(heavier, 'web', pins).errors.join('\n'), /must not exceed LOD0/)
    const missingHash = enabledManifest()
    delete missingHash.packages[2].variants.web.lod0.sha256
    assert.match(validateAnimationPackageRuntimeManifest(missingHash, 'web', pins).errors.join('\n'), /lod0\.sha256/)
  }

  // The manifest itself is the root of trust for every payload pin and must be
  // verified before JSON parsing. Payloads may not escape its model directory.
  {
    fetchedManifest = enabledManifest()
    const stream = new AnimationPackageStreamLoader(new FakeLoader(), 'web')
    const integrity = currentManifestIntegrity()
    await assert.rejects(
      stream.loadManifest('/pilot/manifest.json', pins, { ...integrity, sha256: '0'.repeat(64) }),
      /SHA-256 mismatch/,
    )
    stream.dispose()
  }

  {
    fetchedManifest = enabledManifest()
    fetchedManifest.source.ownership.web.pathsSha256 = 'f'.repeat(64)
    const stream = new AnimationPackageStreamLoader(new FakeLoader(), 'web')
    await assert.rejects(
      stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity()),
      /pathsSha256 does not match declared package sourcePaths/,
    )
    stream.dispose()
  }

  {
    fetchedManifest = enabledManifest()
    fetchedManifest.packages[0].variants.web.hlod.url = '../escape.glb'
    const stream = new AnimationPackageStreamLoader(new FakeLoader(), 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Escaping payload', web: '/mono.glb' }, new Group())
    await assert.rejects(stream.initialize(), /escapes its approved model directory/)
    stream.dispose()
  }

  // Initial focus is applied after the resident shell/critical set. Loaded
  // state expands the exit threshold, preventing boundary-jitter churn.
  {
    fetchedManifest = enabledManifest()
    const loader = new FakeLoader()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Initial focus pilot', web: '/mono.glb' }, new Group())
    const initial = await stream.initialize({ x: 8, y: 0, z: 0 })
    assert.ok(initial.loaded.includes('floor-01-detail-pilot:lod0'))
    await stream.syncFocus({ x: 14, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'lod0', 'exit hysteresis must retain LOD0')
    await stream.syncFocus({ x: 16, y: 0, z: 0 })
    assert.equal(stream.getLoadedPackageRoot('floor-01-detail-pilot'), null)
    await stream.syncFocus({ x: 14, y: 0, z: 0 })
    assert.equal(stream.getLoadedPackageRoot('floor-01-detail-pilot'), null, 'enter threshold must remain narrower')
    await stream.syncFocus({ x: 12, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'lod0')
    stream.dispose()
  }

  {
    fetchedManifest = enabledManifest()
    const loader = new FakeLoader()
    loader.packageDecorator = (root) => root.add(new PerspectiveCamera())
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Camera payload', web: '/mono.glb' }, new Group())
    await assert.rejects(stream.initialize(), /cameras and lights are forbidden/)
    stream.dispose()
  }

  // UVs are usage-driven: a textureless lit mesh with POSITION+NORMAL is
  // valid, while the same geometry with a bound base-color texture is not.
  {
    fetchedManifest = enabledManifest()
    const loader = new FakeLoader()
    loader.packageGeometry = new BoxGeometry(1, 1, 1)
    loader.packageGeometry.deleteAttribute('uv')
    loader.sharedMaterial = new MeshBasicMaterial()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Textureless pilot', web: '/mono.glb' }, new Group())
    await stream.initialize({ x: 8, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'lod0')
    stream.dispose()
  }

  {
    fetchedManifest = enabledManifest()
    const loader = new FakeLoader()
    loader.packageGeometry = new BoxGeometry(1, 1, 1)
    loader.packageGeometry.deleteAttribute('uv')
    loader.sharedMaterial = new MeshBasicMaterial({ map: new Texture() })
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Broken textured pilot', web: '/mono.glb' }, new Group())
    await assert.rejects(stream.initialize(), /missing TEXCOORD_0/)
    stream.dispose()
  }

  // Startup honors residentSets: shell + persistent critical only. Far detail
  // is absent, and no per-detail HLOD request is made.
  {
    fetchedManifest = enabledManifest()
    manifestFetches = 0
    const loader = new FakeLoader()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    const layerRoot = new Group()
    stream.attachLayer({ id: 'runtime-pilot', name: 'Pilot', web: '/mono.glb' }, layerRoot)
    const prepared = []
    const transitions = []
    stream.setPrepareIncoming((root, pkg, level) => {
      assert.equal(root.visible, false, 'incoming package must remain hidden during preparation')
      root.userData.prepared = true
      prepared.push(`${pkg.id}:${level}`)
    })
    stream.setOnChange((event) => transitions.push(event))
    const initial = await stream.initialize({ x: 500, y: 0, z: 500 })
    assert.deepEqual(initial.loaded, [
      'floor-01-shell-pilot:hlod',
      'floor-01-critical-pilot:lod0',
    ])
    assert.deepEqual(stream.getState().levels, {
      'floor-01-shell-pilot': 'hlod',
      'floor-01-critical-pilot': 'lod0',
    })
    assert.equal(stream.getState().residentTriangles, 24)
    assert.equal(stream.getState().residentDraws, 2)
    assert.equal(loader.calls.filter((url) => !url.includes('/rig/')).length, 2)
    assert.equal(loader.calls.some((url) => url.includes('detail-hlod')), false)
    assert.deepEqual(prepared, initial.loaded)
    assert.equal(transitions.length, 2, 'each successful package must emit immediately')
    assert.equal(manifestFetches, 1)

    const owner = stream.getOwner('rig-owner:first-floor-anim1')
    const criticalRoot = stream.getLoadedPackageRoot('floor-01-critical-pilot')
    assert.equal(criticalRoot.parent, owner)
    assert.equal(criticalRoot.userData.prepared, true)

    // Near focus loads LOD0 only after startup and keeps it owner-local.
    const near = await stream.syncFocus({ x: 8, y: 0, z: 0 })
    assert.deepEqual(near.loaded, ['floor-01-detail-pilot:lod0'])
    const detailRoot = stream.getLoadedPackageRoot('floor-01-detail-pilot')
    assert.equal(detailRoot.parent, owner)
    assert.equal(detailRoot.matrixAutoUpdate, false)
    assert.equal(detailRoot.matrix.elements[12], 7)
    assert.equal(stream.getState().residentTriangles, 60)

    const packageMeshCount = detailRoot.children.length
    const packing = applyProceduralInstancing(layerRoot, { minInstances: 2, minBatchSize: 4 })
    assert.equal(packing.scannedMeshes, 0)
    assert.equal(packing.groupsConverted, 0)
    assert.equal(detailRoot.children.length, packageMeshCount)

    const player = new ModelAnimationPlayer()
    const persistentRig = stream.getAnimationBindRoot()
    player.bind(persistentRig, stream.collectAnimations(), {
      stateKey: 'runtime-pilot', preserveState: true,
    })
    player.seek(1.2)
    player.play()
    player.update(0.1)
    const animationTime = player.getTime()

    // Far focus unloads detail entirely; shell and critical remain.
    const far = await stream.syncFocus({ x: 500, y: 0, z: 500 })
    assert.deepEqual(far.loaded, [])
    assert.deepEqual(far.unloaded, ['floor-01-detail-pilot:lod0'])
    assert.equal(stream.getLoadedPackageRoot('floor-01-detail-pilot'), null)
    assert.equal(stream.getLoadedPackageRoot('floor-01-critical-pilot'), criticalRoot)
    assert.equal(stream.getAnimationBindRoot(), persistentRig)
    assert.ok(Math.abs(player.getTime() - animationTime) < 1e-6)

    let textureDisposeCount = 0
    loader.sharedTexture.addEventListener('dispose', () => { textureDisposeCount += 1 })
    stream.dispose()
    assert.equal(textureDisposeCount, 1)
    player.dispose()
  }

  // Optional HLOD supplies a mid-range replacement, and a newer target aborts
  // stale detail work while retaining the already-visible HLOD.
  {
    fetchedManifest = enabledManifest()
    addOptionalDetailHlod(fetchedManifest)
    const loader = new FakeLoader()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Pilot', web: '/mono.glb' }, new Group())
    await stream.initialize()
    await stream.syncFocus({ x: 20, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'hlod')

    const deferred = loader.deferNext((url) => url.includes('detail-lod0.glb'))
    const staleNear = stream.syncFocus({ x: 8, y: 0, z: 0 })
    await deferred.started
    const staleRejected = assert.rejects(staleNear, (error) => error?.name === 'AbortError')
    let currentSettled = false
    const currentMid = stream.syncFocus({ x: 20, y: 0, z: 0 })
    void currentMid.finally(() => { currentSettled = true })
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(currentSettled, false, 'superseding parse must wait for the non-cancellable parse to settle')
    deferred.finish()
    await currentMid
    await staleRejected
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'hlod')

    loader.rejectIntegrityFor = (url) => url.includes('detail-lod0.glb')
    await assert.rejects(stream.syncFocus({ x: 8, y: 0, z: 0 }), /SHA-256 mismatch/)
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'hlod')
    stream.dispose()
  }

  // Peak budget includes old + replacement. Optional detail stays on HLOD if
  // the swap would exceed peak even though its steady result would fit.
  {
    fetchedManifest = enabledManifest()
    addOptionalDetailHlod(fetchedManifest)
    fetchedManifest.budgets.maxResident.web = {
      triangles: 60,
      draws: 5,
      bytes: 1000,
      encodedTextureBytes: 1024,
      gpuTextureBytes: 4096,
    }
    fetchedManifest.budgets.maxTransitionPeak.web = {
      triangles: 65,
      draws: 6,
      bytes: 2000,
      encodedTextureBytes: 2048,
      gpuTextureBytes: 8192,
    }
    const loader = new FakeLoader()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Peak pilot', web: '/mono.glb' }, new Group())
    await stream.initialize()
    await stream.syncFocus({ x: 20, y: 0, z: 0 })
    await stream.syncFocus({ x: 8, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'hlod')
    assert.equal(loader.calls.filter((url) => url.includes('detail-lod0.glb')).length, 0)
    stream.dispose()
  }

  // Package declaration order cannot let a farther coarse payload consume the
  // budget needed by the closest LOD0 surface.
  {
    fetchedManifest = enabledManifest()
    addOptionalDetailHlod(fetchedManifest)
    const near = fetchedManifest.packages.find((pkg) => pkg.id === 'floor-01-detail-pilot')
    const farther = structuredClone(near)
    farther.id = 'floor-01-farther-pilot'
    farther.sourcePaths = {
      web: ['source/floor-01-farther-pilot'],
      quest: ['source/floor-01-farther-pilot'],
    }
    farther.transform.matrix[12] = 25
    for (const variant of ['web', 'quest']) {
      farther.selectionBounds[variant] = {
        space: 'owner-local', min: [24.5, -0.5, -0.5], max: [29.5, 0.5, 0.5],
      }
      farther.variants[variant].lod0.url = `__DISABLED_PILOT__/${variant}/farther-detail-lod0.glb`
      farther.variants[variant].lod0.bounds = structuredClone(farther.selectionBounds[variant])
      farther.variants[variant].hlod.url = `__DISABLED_PILOT__/${variant}/farther-coarse-hlod.glb`
      farther.variants[variant].hlod.bounds = {
        space: 'owner-local', min: [24.5, -0.5, -0.5], max: [25.5, 0.5, 0.5],
      }
      farther.variants[variant].hlod.estimates = {
        triangles: 12, draws: 1, bytes: 104, encodedTextureBytes: 0, gpuTextureBytes: 0,
      }
    }
    const nearIndex = fetchedManifest.packages.indexOf(near)
    fetchedManifest.packages.splice(nearIndex, 1, farther, near)
    for (const variant of ['web', 'quest']) {
      const paths = fetchedManifest.packages.flatMap((pkg) => pkg.sourcePaths[variant]).sort()
      fetchedManifest.source.ownership[variant].pathCount = paths.length
      fetchedManifest.source.ownership[variant].pathsSha256 = createHash('sha256').update(JSON.stringify(paths)).digest('hex')
    }
    fetchedManifest.budgets.maxResident.web = {
      triangles: 60, draws: 5, bytes: 1000, encodedTextureBytes: 128, gpuTextureBytes: 1024,
    }
    const loader = new FakeLoader()
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Nearest-first pilot', web: '/mono.glb' }, new Group())
    await stream.initialize()
    await stream.syncFocus({ x: 8, y: 0, z: 0 })
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'lod0')
    assert.equal(stream.getState().levels['floor-01-farther-pilot'], undefined)
    assert.equal(loader.calls.some((url) => url.includes('farther-coarse-hlod')), false)
    stream.dispose()
  }

  // A later package failure cannot suppress notification/preparation for an
  // earlier successful package in the same focus transaction.
  {
    fetchedManifest = enabledManifest()
    const second = structuredClone(fetchedManifest.packages[2])
    second.id = 'floor-01-detail2-pilot'
    second.sourcePaths = {
      web: ['source/floor-01-detail2-pilot'],
      quest: ['source/floor-01-detail2-pilot'],
    }
    second.variants.web.lod0.url = second.variants.web.lod0.url.replace('detail-lod0', 'detail2-lod0')
    second.variants.quest.lod0.url = second.variants.quest.lod0.url.replace('detail-lod0', 'detail2-lod0')
    fetchedManifest.packages.push(second)
    for (const variant of ['web', 'quest']) {
      const paths = fetchedManifest.packages.flatMap((pkg) => pkg.sourcePaths[variant]).sort()
      fetchedManifest.source.ownership[variant].pathCount = paths.length
      fetchedManifest.source.ownership[variant].pathsSha256 = createHash('sha256').update(JSON.stringify(paths)).digest('hex')
    }
    const loader = new FakeLoader()
    loader.throwFor = (url) => url.includes('detail2-lod0.glb')
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Partial pilot', web: '/mono.glb' }, new Group())
    const transitions = []
    stream.setOnChange((event) => transitions.push(event))
    await stream.initialize()
    await assert.rejects(stream.syncFocus({ x: 8, y: 0, z: 0 }), /Synthetic package failure/)
    assert.equal(stream.getState().levels['floor-01-detail-pilot'], 'lod0')
    assert.ok(transitions.some((event) => event.loaded.includes('floor-01-detail-pilot:lod0')))
    stream.dispose()
  }

  // Render geometry in the rig violates the exact persistent-rig contract.
  {
    fetchedManifest = enabledManifest()
    const loader = new FakeLoader()
    loader.rigRenderable = true
    const stream = new AnimationPackageStreamLoader(loader, 'web')
    await stream.loadManifest('/pilot/manifest.json', pins, currentManifestIntegrity())
    stream.attachLayer({ id: 'runtime-pilot', name: 'Bad rig', web: '/mono.glb' }, new Group())
    await assert.rejects(stream.initialize(), /render-mesh-free/)
    stream.dispose()
  }

  // ModelManager requires dedicated collision before activating streaming and
  // preserves monolithic fallback for guard/integrity/rig failures.
  {
    fetchedManifest = enabledManifest()
    const manager = new ModelManager(() => null)
    const loader = new FakeLoader()
    manager.loader = loader
    const layer = await manager.addLayer({
      id: 'runtime-pilot', name: 'No collision', web: '/mono.glb',
      hlodStreaming: {
        enabled: true, web: '/pilot/manifest.json',
        sourceSha256: pins.sourceSha256, rigSha256: pins.rigSha256,
      },
    }, 'web')
    assert.equal(layer.streaming, false)
    assert.deepEqual(loader.calls, ['/mono.glb'])
    manager.dispose()
  }

  {
    fetchedManifest = enabledManifest()
    const manager = new ModelManager(() => null)
    const loader = new FakeLoader()
    manager.loader = loader
    const fetchesBefore = manifestFetches
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args.join(' '))
    try {
      const layer = await manager.addLayer({
        ...streamingEntry(),
        lightmap: '/unpinned-lightmap.ktx2',
      }, 'web')
      assert.equal(layer.streaming, false)
      assert.deepEqual(loader.calls, ['/mono.glb'])
      assert.equal(manifestFetches, fetchesBefore)
      assert.ok(warnings.some((line) => line.includes('no verified package-lightmap contract')))
    } finally {
      console.warn = originalWarn
      manager.dispose()
    }
  }

  {
    fetchedManifest = enabledManifest()
    const manager = new ModelManager(() => null)
    const loader = new FakeLoader()
    loader.rigDuration = 2.5
    manager.loader = loader
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args.join(' '))
    try {
      const layer = await manager.addLayer({
        id: 'runtime-pilot', name: 'Fallback pilot', web: '/mono.glb', collision: '/collision.glb',
        hlodStreaming: {
          enabled: true, web: '/pilot/manifest.json',
          sourceSha256: pins.sourceSha256, rigSha256: pins.rigSha256,
        },
      }, 'web')
      assert.equal(layer.streaming, false)
      assert.equal(layer.result.url, '/mono.glb')
      assert.ok(warnings.some((line) => line.includes('using monolithic GLB')))
    } finally {
      console.warn = originalWarn
      manager.dispose()
    }
  }

  // A collision URL is not sufficient: download and geometry validation both
  // happen before a streamed layer can commit. Either failure selects the
  // complete monolith, and streamed visuals are never a collision fallback.
  {
    assert.equal(allowsVisualCollisionFallback(true), false)
    assert.equal(allowsVisualCollisionFallback(false), true)
    for (const collisionMode of ['throw', 'invalid']) {
      fetchedManifest = enabledManifest()
      const manager = new ModelManager(() => null)
      const loader = new FakeLoader()
      loader.collisionMode = collisionMode
      manager.loader = loader
      const layer = await manager.addLayer(streamingEntry({ name: `Collision ${collisionMode}` }), 'web')
      assert.equal(layer.streaming, false, `${collisionMode} collision must select monolithic fallback`)
      assert.equal(layer.result.url, '/mono.glb')
      assert.equal(manager.getStreamLoader(layer.id), null)
      assert.equal(manager.takePreparedStreamingCollision(layer.id), null)
      assert.ok(loader.calls.includes('/collision.glb'))
      assert.ok(loader.calls.includes('/mono.glb'))
      manager.dispose()
    }
  }

  // Exact collision geometry is still insufficient without both verified
  // activation documents. Missing or tampered evidence fails before rig or
  // render-package initialization and selects the complete monolith.
  {
    for (const evidenceMode of ['missing', 'tampered']) {
      fetchedManifest = enabledManifest()
      const manager = new ModelManager(() => null)
      const loader = new FakeLoader()
      manager.loader = loader
      const entry = streamingEntry({ name: `Evidence ${evidenceMode}` })
      if (evidenceMode === 'missing') delete entry.hlodStreaming.collisionActivation
      else entry.hlodStreaming.collisionActivation.contract.sha256 = '0'.repeat(64)
      const layer = await manager.addLayer(entry, 'web')
      assert.equal(layer.streaming, false, `${evidenceMode} evidence must select monolithic fallback`)
      assert.equal(layer.result.url, '/mono.glb')
      assert.ok(loader.calls.includes('/collision.glb'))
      assert.equal(loader.calls.some((url) => url.includes('/rig/animations.glb')), false)
      assert.equal(manager.takePreparedStreamingCollision(layer.id), null)
      manager.dispose()
    }
  }

  // Later package failures receive a bounded three-attempt sequence. Only
  // after it is exhausted is streaming blocked and a host-requested monolith
  // prepared; the live streamed root remains mounted until that atomic commit.
  {
    fetchedManifest = enabledManifest()
    const manager = new ModelManager(() => null, undefined, { streamRetryDelaysMs: [0, 0] })
    const loader = new FakeLoader()
    manager.loader = loader
    const entry = streamingEntry({ name: 'Retry/failover pilot' })
    const streamed = await manager.addLayer(entry, 'web')
    assert.equal(streamed.streaming, true)
    const streamedRoot = streamed.root
    let failoverCalls = 0
    let visibleDuringFailover = false
    let visibleDuringMonolithLoad = false
    let reportedAttempts = 0
    const monolithDeferred = loader.deferMonolith()
    manager.setStreamingFailoverHandler(async (request) => {
      failoverCalls += 1
      reportedAttempts = request.attempts
      visibleDuringFailover =
        manager.getLayer(request.layerId) === streamed &&
        streamedRoot.parent === manager.root &&
        streamedRoot.visible
      const replacement = manager.addLayer(request.entry, 'web')
      await monolithDeferred.started
      visibleDuringMonolithLoad =
        manager.getLayer(request.layerId) === streamed &&
        streamedRoot.parent === manager.root &&
        streamedRoot.visible
      monolithDeferred.finish()
      await replacement
    })
    loader.throwFor = (url) => url.includes('detail-lod0.glb')
    await manager.updateStreamingFocus({ x: 8, y: 0, z: 0 })
    assert.equal(loader.calls.filter((url) => url.includes('detail-lod0.glb')).length, 3)
    assert.equal(failoverCalls, 1)
    assert.equal(reportedAttempts, 3)
    assert.equal(visibleDuringFailover, true)
    assert.equal(visibleDuringMonolithLoad, true)
    assert.equal(manager.getLayer(entry.id)?.streaming, false)
    assert.equal(manager.getLayer(entry.id)?.result.url, '/mono.glb')
    assert.notEqual(manager.getLayer(entry.id)?.root, streamedRoot)
    manager.dispose()
  }

  // Caller cancellation during backoff is terminal for that stale operation:
  // no retry and no monolithic failover request may escape it.
  {
    fetchedManifest = enabledManifest()
    let releaseWait
    let signalWaitStarted
    const waitStarted = new Promise((resolve) => { signalWaitStarted = resolve })
    const manager = new ModelManager(() => null, undefined, {
      streamRetryDelaysMs: [100, 200],
      waitForRetry: (_delay, signal) => {
        signalWaitStarted()
        return new Promise((resolve, reject) => {
          releaseWait = resolve
          if (signal?.aborted) {
            reject(new DOMException('cancelled', 'AbortError'))
            return
          }
          signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
        })
      },
    })
    const loader = new FakeLoader()
    manager.loader = loader
    await manager.addLayer(streamingEntry({ name: 'Cancelled retry pilot' }), 'web')
    loader.throwFor = (url) => url.includes('detail-lod0.glb')
    let failoverCalls = 0
    manager.setStreamingFailoverHandler(() => { failoverCalls += 1 })
    const controller = new AbortController()
    const pending = manager.updateStreamingFocus({ x: 8, y: 0, z: 0 }, undefined, controller.signal)
    await waitStarted
    controller.abort()
    await assert.rejects(pending, (error) => error?.name === 'AbortError')
    releaseWait?.()
    assert.equal(loader.calls.filter((url) => url.includes('detail-lod0.glb')).length, 1)
    assert.equal(failoverCalls, 0)
    assert.equal(manager.getLayer('runtime-pilot')?.streaming, true)
    manager.dispose()
  }

  // A package result completing after its stream was atomically replaced is
  // stale. It may neither attach to the replacement nor request failover.
  {
    fetchedManifest = enabledManifest()
    const manager = new ModelManager(() => null, undefined, { streamRetryDelaysMs: [0, 0] })
    const loader = new FakeLoader()
    manager.loader = loader
    const entry = streamingEntry({ name: 'Stale package pilot' })
    await manager.addLayer(entry, 'web')
    let failoverCalls = 0
    manager.setStreamingFailoverHandler(() => { failoverCalls += 1 })
    const deferred = loader.deferNext((url) => url.includes('detail-lod0.glb'))
    const stale = manager.updateStreamingFocus({ x: 8, y: 0, z: 0 })
    await deferred.started
    const monolithicEntry = { ...entry, hlodStreaming: undefined }
    const replacement = await manager.addLayer(monolithicEntry, 'web')
    deferred.finish()
    await assert.rejects(stale, (error) => error?.name === 'AbortError')
    assert.equal(manager.getLayer(entry.id), replacement)
    assert.equal(replacement.streaming, false)
    assert.equal(failoverCalls, 0)
    manager.dispose()
  }

  console.log(
    'Animation package runtime: PASS (verified bytes, shell/unloaded detail, persistent critical, nearest-detail priority, hidden prep, exact rig/geometry, peak budgets, cancellation, collision preflight, bounded retry, atomic failover, stale-race guards)',
  )
} finally {
  globalThis.fetch = originalFetch
  await vite.close()
}
