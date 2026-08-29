/**
 * Headless-browser QA for the disabled Ground Floor repeat release candidate.
 * Loads the actual verified GLBs through the production ModelLoader, exercises
 * InspectPicker source identity/hide/isolate/restore on real imported
 * InstancedMesh objects, and proves a persistent rig owns animation endpoints.
 * SwiftShader timings are diagnostic only and are never hardware acceptance.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate')
const RIG = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-shell-candidate', 'rig.glb')

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function pin(path) {
  const bytes = await readFile(path)
  return { sha256: sha256Bytes(bytes), bytes: bytes.length }
}

function addressUrl(server) {
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP address')
  return `http://127.0.0.1:${address.port}`
}

const manifest = JSON.parse(await readFile(resolve(OUT, 'manifest.disabled.json'), 'utf8'))
const reportPath = resolve(OUT, 'report.json')
const report = JSON.parse(await readFile(reportPath, 'utf8'))
assert.equal(manifest.enabled, false)
assert.equal(manifest.runtimeIntegrated, false)
assert.equal(report.productionManifestChanged, false)

const payloads = []
for (const variant of ['web', 'quest']) {
  for (const [level, payload] of Object.entries(manifest.variants[variant])) {
    payloads.push({
      variant,
      level,
      url: `/tmp/repeat-geometry-release-candidate/${payload.url.replaceAll('\\', '/')}`,
      sha256: payload.sha256,
      bytes: payload.bytes,
      expectedTriangles: payload.triangles,
      expectedDraws: payload.draws,
    })
  }
}
const rigPin = await pin(RIG)
const vite = await createServer({
  root: VIEWER_ROOT,
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  logLevel: 'silent',
})

let browser
try {
  await vite.listen()
  const baseUrl = addressUrl(vite)
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--disable-gpu-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async ({ payloads, rigPin }) => {
    const [{ ModelLoader }, inspectModule, THREE] = await Promise.all([
      import('/src/scene/ModelLoader.ts'),
      import('/src/controls/InspectPicker.ts'),
      import('/node_modules/three/build/three.module.js'),
    ])
    const { InspectPicker, inspectPickInfo, resolveInspectSourceId } = inspectModule
    const loader = new ModelLoader(() => null)
    const matrix = new THREE.Matrix4()
    const matrixRecord = (mesh, instanceId) => {
      mesh.getMatrixAt(instanceId, matrix)
      return matrix.elements.map((value) => Number(value.toPrecision(9)))
    }
    const determinantAt = (mesh, instanceId) => {
      mesh.getMatrixAt(instanceId, matrix)
      return matrix.determinant()
    }
    const imported = []
    for (const payload of payloads) {
      const loaded = await loader.loadUrlVerified(payload.url, {
        sha256: payload.sha256,
        bytes: payload.bytes,
      })
      loaded.root.updateMatrixWorld(true)
      const meshes = []
      const ownerDuplicates = []
      loaded.root.traverse((object) => {
        if (object.name === 'Ground Floor._anim1') ownerDuplicates.push(object.name)
        if (object.isInstancedMesh && object.userData?.disabledReleaseCandidate === true) meshes.push(object)
      })
      if (loaded.animations.length !== 0) throw new Error(`${payload.variant}:${payload.level} contains clips`)
      if (ownerDuplicates.length !== 0) throw new Error(`${payload.variant}:${payload.level} duplicates the rig owner`)
      if (meshes.length !== payload.expectedDraws) throw new Error(`${payload.variant}:${payload.level} draw count mismatch`)
      const triangles = meshes.reduce((sum, mesh) => {
        const indices = mesh.geometry.getIndex()
        const position = mesh.geometry.getAttribute('position')
        const perInstance = Math.round((indices ? indices.count : position.count) / 3)
        return sum + perInstance * mesh.count
      }, 0)
      if (triangles !== payload.expectedTriangles) throw new Error(`${payload.variant}:${payload.level} triangles mismatch`)
      for (const mesh of meshes) {
        if (!Array.isArray(mesh.userData.sourceIds) || mesh.userData.sourceIds.length !== mesh.count) {
          throw new Error(`${payload.variant}:${payload.level}:${mesh.name} lost source IDs`)
        }
        for (let index = 0; index < mesh.count; index += 1) {
          if (!(determinantAt(mesh, index) > 0)) throw new Error(`${mesh.name}:${index} has unsafe local parity`)
        }
      }
      imported.push({ payload, loaded, meshes, triangles })
    }

    const pickerChecks = []
    for (const entry of imported.filter(({ payload }) => payload.level === 'lod0')) {
      const scene = new THREE.Scene()
      const model = new THREE.Group()
      model.name = `Model:repeat-${entry.payload.variant}`
      model.add(entry.loaded.root)
      scene.add(model)
      const selected = entry.meshes.find((mesh) => mesh.count > 1)
      if (!selected) throw new Error(`${entry.payload.variant}: no multi-instance batch found`)
      const selectedInstanceId = 0
      const sourceId = resolveInspectSourceId(selected, selectedInstanceId)
      if (!Number.isSafeInteger(sourceId)) throw new Error(`${entry.payload.variant}: source ID did not resolve`)
      const cohort = entry.meshes.filter((mesh) =>
        mesh.parent === selected.parent &&
        mesh.userData.instanceIdentityGroup === selected.userData.instanceIdentityGroup)
      if (cohort.length !== 4) throw new Error(`${entry.payload.variant}: logical material cohort is not four draws`)
      const cohortInstanceIds = cohort.map((mesh) => mesh.userData.sourceIds.indexOf(sourceId))
      if (cohortInstanceIds.some((value) => value < 0)) throw new Error(`${entry.payload.variant}: cohort source ID missing`)
      const originals = cohort.map((mesh, index) => matrixRecord(mesh, cohortInstanceIds[index]))

      const canvas = document.createElement('canvas')
      document.body.appendChild(canvas)
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
      const picker = new InspectPicker(camera, canvas, scene, () => model, () => {}, () => false)
      picker.selected = selected
      picker.selectedInstanceId = selectedInstanceId
      const info = inspectPickInfo({
        object: selected,
        instanceId: selectedInstanceId,
        distance: 0,
        point: new THREE.Vector3(),
      })
      if (info?.sourceId !== sourceId || info.instanceId !== selectedInstanceId) {
        throw new Error(`${entry.payload.variant}: inspect result lost logical identity`)
      }
      const hidden = picker.hideSelected()
      if (hidden?.sourceId !== sourceId || hidden.visible !== false) throw new Error(`${entry.payload.variant}: hide result invalid`)
      cohort.forEach((mesh, index) => {
        if (determinantAt(mesh, cohortInstanceIds[index]) !== 0) throw new Error(`${entry.payload.variant}: cohort member was not hidden`)
      })
      picker.restoreHidden()
      cohort.forEach((mesh, index) => {
        if (JSON.stringify(matrixRecord(mesh, cohortInstanceIds[index])) !== JSON.stringify(originals[index])) {
          throw new Error(`${entry.payload.variant}: hide/restore matrix drift`)
        }
      })
      picker.selected = selected
      picker.selectedInstanceId = selectedInstanceId
      picker.isolateSelected()
      cohort.forEach((mesh, index) => {
        if (determinantAt(mesh, cohortInstanceIds[index]) === 0) throw new Error(`${entry.payload.variant}: selected cohort was collapsed`)
        for (let instanceId = 0; instanceId < mesh.count; instanceId += 1) {
          if (instanceId !== cohortInstanceIds[index] && determinantAt(mesh, instanceId) !== 0) {
            throw new Error(`${entry.payload.variant}: isolate left another logical instance visible`)
          }
        }
      })
      picker.restoreHidden()
      picker.dispose()
      canvas.remove()
      pickerChecks.push({
        variant: entry.payload.variant,
        sourceId,
        materialCohortDraws: cohort.length,
        hideRestore: 'passed',
        isolateRestore: 'passed',
        perInstancePick: 'passed',
      })
    }

    const rig = await loader.loadUrlVerified(
      '/tmp/hlod-pilot-first-floor-shell-candidate/rig.glb',
      rigPin,
    )
    if (!rig.animations.length) throw new Error('Persistent rig did not load animation clips')
    const rigObjects = []
    rig.root.traverse((object) => {
      if (object !== rig.root) rigObjects.push(object)
    })
    const groundOwner = new THREE.Group()
    groundOwner.name = 'Ground Floor._anim1'
    rig.root.add(groundOwner)
    const webLod0 = imported.find(({ payload }) => payload.variant === 'web' && payload.level === 'lod0')
    groundOwner.add(webLod0.loaded.root)
    rig.root.updateMatrixWorld(true)
    const witness = webLod0.meshes[0]
    const witnessBefore = witness.matrixWorld.elements.map((value) => Number(value.toPrecision(9)))
    const mixer = new THREE.AnimationMixer(rig.root)
    const actions = rig.animations.map((clip) => {
      const action = mixer.clipAction(clip)
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      return action
    })
    mixer.setTime(0)
    rig.root.updateMatrixWorld(true)
    const rigStart = new Map(rigObjects.map((object) => [
      object.uuid,
      object.matrixWorld.elements.map((value) => Number(value.toPrecision(9))),
    ]))
    const duration = Math.max(...rig.animations.map((clip) => clip.duration))
    mixer.setTime(duration)
    rig.root.updateMatrixWorld(true)
    const animatedOwner = rigObjects.find((object) =>
      JSON.stringify(rigStart.get(object.uuid)) !==
      JSON.stringify(object.matrixWorld.elements.map((value) => Number(value.toPrecision(9)))))
    if (!animatedOwner) throw new Error('Persistent rig endpoint witness did not animate')
    const animatedStart = rigStart.get(animatedOwner.uuid)
    const animatedEnd = animatedOwner.matrixWorld.elements.map((value) => Number(value.toPrecision(9)))
    const witnessAfter = witness.matrixWorld.elements.map((value) => Number(value.toPrecision(9)))
    if (JSON.stringify(witnessBefore) !== JSON.stringify(witnessAfter)) throw new Error('Static Ground Floor payload drifted across rig endpoints')
    actions.forEach((action) => action.stop())
    mixer.uncacheRoot(rig.root)
    loader.dispose()

    return {
      userAgent: navigator.userAgent,
      payloads: imported.map(({ payload, loaded, meshes, triangles }) => ({
        variant: payload.variant,
        level: payload.level,
        bytes: loaded.transferredBytes,
        parseMs: loaded.parseMs,
        animations: loaded.animations.length,
        instancedDraws: meshes.length,
        submittedTriangles: triangles,
        sourceIdentityBatches: meshes.filter((mesh) => Array.isArray(mesh.userData.sourceIds)).length,
      })),
      pickerChecks,
      animationEndpoint: {
        durationSeconds: duration,
        animatedOwner: animatedOwner.name,
        animatedStart,
        animatedEnd,
        groundFloorPayloadWorldTransformStable: true,
        persistentRigIsSoleAnimationSource: true,
      },
    }
  }, { payloads, rigPin })

  const qa = {
    schema: 'iom-ground-floor-repeat-release-browser-qa-v1',
    generatedAt: new Date().toISOString(),
    status: 'passed',
    acceptanceEvidence: false,
    environment: 'Playwright Chromium headless with SwiftShader; functional evidence, not physical GPU performance acceptance.',
    ...result,
  }
  await writeFile(resolve(OUT, 'browser-runtime-qa.json'), `${JSON.stringify(qa, null, 2)}\n`)
  report.gates.actualPayloadBrowserRuntime = 'passed'
  report.gates.pickingHideIsolate = 'passed-web-and-quest-lod0'
  report.gates.animationEndpoints = 'passed-persistent-rig-owns-clips-payload-transform-stable'
  report.browserRuntimeQa = {
    file: 'browser-runtime-qa.json',
    status: qa.status,
    acceptanceEvidence: qa.acceptanceEvidence,
  }
  report.status = 'disabled-automated-asset-and-browser-runtime-gates-passed'
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `Repeat release browser QA: PASS (${result.payloads.length} verified payloads; ` +
    `${result.pickerChecks.length} Web/Quest picker cohorts; persistent-rig endpoints passed)`,
  )
} finally {
  await browser?.close()
  await vite.close()
}
