import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

class FakeClassList {
  values = new Set()
  toggle(name, force) {
    if (force) this.values.add(name)
    else this.values.delete(name)
  }
  remove(name) {
    this.values.delete(name)
  }
}

class FakeDom {
  classList = new FakeClassList()
  listeners = new Map()
  addEventListener(name, listener) {
    this.listeners.set(name, listener)
  }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name)
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 }
  }
}

Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { classList: new FakeClassList() } },
  configurable: true,
})

const vite = await createServer({
  root: join(SCRIPT_DIR, '..'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

const translation = (x, y = 0, z = 0) => new Matrix4().makeTranslation(x, y, z)

function matrixAt(mesh, instanceId) {
  const matrix = new Matrix4()
  mesh.getMatrixAt(instanceId, matrix)
  return matrix
}

function assertMatrixEquals(actual, expected, message) {
  assert.deepEqual(
    actual.elements.map((value) => Number(value.toFixed(6))),
    expected.elements.map((value) => Number(value.toFixed(6))),
    message,
  )
}

function createIdentityBatch(geometry, material, name, materialSlot) {
  const mesh = new InstancedMesh(geometry, material, 3)
  mesh.name = name
  mesh.setMatrixAt(0, translation(0))
  mesh.setMatrixAt(1, translation(2))
  mesh.setMatrixAt(2, translation(4))
  mesh.instanceMatrix.needsUpdate = true
  mesh.userData = {
    prepartitionedRepeatBatch: true,
    animationOwner: 'Ground Floor',
    repeatVariant: 'web',
    instanceParity: 'positive',
    spatialPartition: '1|2|3',
    materialSlot,
    sourceIds: [10, 20, 30],
  }
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  return mesh
}

try {
  const {
    InspectPicker,
    formatInspectCopy,
    inspectPickInfo,
    resolveInspectSourceId,
  } = await vite.ssrLoadModule('/src/controls/InspectPicker.ts')
  const { DetailLodController } = await vite.ssrLoadModule(
    '/src/performance/DetailLodController.ts',
  )

  // Imported EXT_mesh_gpu_instancing must use its complete per-instance bounds,
  // not the base primitive's origin/radius, and must never enter geometric LOD.
  {
    const root = new Group()
    const owner = new Group()
    root.add(owner)
    const imported = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
      2,
    )
    imported.name = 'ImportedRepeatBatch'
    imported.setMatrixAt(0, translation(0))
    imported.setMatrixAt(1, translation(1000))
    imported.instanceMatrix.needsUpdate = true
    owner.add(imported)

    const lod = new DetailLodController()
    lod.rebuild(root, 2000)
    const stats = lod.getStats()
    assert.equal(stats.tracked, 0)
    assert.equal(stats.packed, 1)
    assert.equal(imported.userData.detailLodPacked, true)
    assert.equal(imported.userData.detailLodTracked, undefined)

    const entry = lod.packed[0]
    assert.ok(Math.abs(entry.localCenter.x - 500) < 0.001)
    assert.ok(entry.localRadius > 500, 'packed radius must cover both distant instances')
    assert.ok(Math.abs(entry.center.x - 500) < 0.001)

    owner.position.x = 200
    root.updateMatrixWorld(true)
    const camera = new PerspectiveCamera(60, 1, 0.1, 5000)
    camera.position.set(700, 0, 10)
    camera.updateMatrixWorld(true)
    lod.update(camera, 1000)
    assert.ok(
      Math.abs(entry.center.x - 700) < 0.001,
      'animated parent transforms must retain the packed local bound offset',
    )
    assert.equal(imported.visible, true)
    lod.dispose()
  }

  // Existing ordinary Mesh classification remains unchanged.
  {
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()))
    const lod = new DetailLodController()
    lod.rebuild(root, 10)
    assert.equal(lod.getStats().tracked, 1)
    assert.equal(lod.getStats().packed, 0)
    lod.dispose()
  }

  // Per-instance inspection resolves a stable authored source ID, reports the
  // selected primitive rather than the whole batch, and performs logical
  // hide/isolate across all material-slot siblings in the identity cohort.
  {
    const scene = new Scene()
    const model = new Group()
    model.name = 'Model:test-layer'
    const owner = new Group()
    owner.name = 'Ground Floor'
    model.add(owner)
    scene.add(model)

    const geometry = new BoxGeometry(1, 1, 1)
    const slots = Array.from({ length: 4 }, (_, slot) => {
      const mesh = createIdentityBatch(
        geometry,
        new MeshBasicMaterial({ name: `slot-${slot}` }),
        `Repeat_M${slot}`,
        slot,
      )
      owner.add(mesh)
      return mesh
    })
    const ordinary = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
    ordinary.name = 'OrdinaryMesh'
    owner.add(ordinary)
    const permanentlyHidden = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
    permanentlyHidden.name = 'PermanentHidden'
    permanentlyHidden.visible = false
    permanentlyHidden.userData.inspectHidden = 'permanent-owner'
    owner.add(permanentlyHidden)

    const camera = new PerspectiveCamera(60, 1, 0.1, 100)
    const picks = []
    const picker = new InspectPicker(
      camera,
      new FakeDom(),
      scene,
      () => model,
      (info) => picks.push(info),
      () => false,
    )

    const hit = {
      object: slots[0],
      instanceId: 1,
      distance: 0,
      point: new Vector3(),
    }
    const info = inspectPickInfo(hit)
    assert.equal(resolveInspectSourceId(slots[0], 1), 20)
    assert.equal(info.instanceId, 1)
    assert.equal(info.sourceId, 20)
    assert.equal(info.triangles, 12, 'inspection must report one instance, not the batch aggregate')
    assert.deepEqual(info.sizeM, { x: 1, y: 1, z: 1 })
    assert.ok(info.flags.includes('imported-instanced'))
    assert.ok(info.flags.includes('source-ids'))
    assert.match(formatInspectCopy(info), /source: 20/)

    picker.selected = slots[0]
    picker.selectedInstanceId = 1
    const hiddenInfo = picker.hideSelected()
    assert.equal(hiddenInfo.instanceId, 1)
    assert.equal(hiddenInfo.sourceId, 20)
    assert.equal(hiddenInfo.visible, false)
    for (const slot of slots) {
      assert.equal(matrixAt(slot, 1).determinant(), 0, 'all material slots must hide source 20')
      assert.equal(matrixAt(slot, 0).determinant(), 1)
      assert.equal(matrixAt(slot, 2).determinant(), 1)
      assert.equal(slot.visible, true, 'hiding one source must not hide its complete batch')
      assert.deepEqual(slot.userData.sourceIds, [10, 20, 30])
    }
    assert.equal(ordinary.visible, true)

    picker.restoreHidden()
    for (const slot of slots) assertMatrixEquals(matrixAt(slot, 1), translation(2))

    picker.selected = slots[0]
    picker.selectedInstanceId = 1
    const isolatedInfo = picker.isolateSelected()
    assert.equal(isolatedInfo.visible, true)
    for (const slot of slots) {
      assert.equal(matrixAt(slot, 0).determinant(), 0)
      assert.equal(matrixAt(slot, 1).determinant(), 1)
      assert.equal(matrixAt(slot, 2).determinant(), 0)
      assert.equal(slot.visible, true)
    }
    assert.equal(ordinary.visible, false)
    picker.restoreHidden()
    assert.equal(ordinary.visible, true)
    assert.equal(permanentlyHidden.visible, false)
    assert.equal(permanentlyHidden.userData.inspectHidden, 'permanent-owner')
    for (const slot of slots) {
      assertMatrixEquals(matrixAt(slot, 0), translation(0))
      assertMatrixEquals(matrixAt(slot, 1), translation(2))
      assertMatrixEquals(matrixAt(slot, 2), translation(4))
    }

    // Unscoped sourceIds are useful for diagnostics, but are not enough to
    // prove multi-material cohort ownership. Fall back to the existing safe,
    // coarse whole-mesh action instead of partially hiding one logical object.
    const unscoped = new InstancedMesh(geometry, new MeshBasicMaterial(), 2)
    unscoped.setMatrixAt(0, translation(0))
    unscoped.setMatrixAt(1, translation(2))
    unscoped.userData.sourceIds = [7, 8]
    owner.add(unscoped)
    picker.selected = unscoped
    picker.selectedInstanceId = 0
    picker.hideSelected()
    assert.equal(unscoped.visible, false)
    assert.equal(matrixAt(unscoped, 0).determinant(), 1)
    picker.restoreHidden()
    assert.equal(unscoped.visible, true)

    // Ordinary non-instanced hide/restore behavior remains unchanged.
    picker.selected = ordinary
    picker.selectedInstanceId = null
    picker.hideSelected()
    assert.equal(ordinary.visible, false)
    picker.restoreHidden()
    assert.equal(ordinary.visible, true)
    picker.dispose()
  }

  console.log('Instancing runtime prerequisite tests passed')
} finally {
  await vite.close()
}
