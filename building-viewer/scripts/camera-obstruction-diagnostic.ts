import assert from 'node:assert/strict'
import { FrontSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three'
import { CameraObstructionProbe } from '../src/controls/CameraObstructionProbe'
const root = new Group()
const layer = new Group()
root.add(layer)
const wall = new Mesh(new PlaneGeometry(8, 8), new MeshBasicMaterial({ side: FrontSide }))
wall.position.z = 2
layer.add(wall)
root.updateMatrixWorld(true)
const probe = new CameraObstructionProbe(root)
assert.equal(probe.distance(new Vector3(), new Vector3(0, 0, 4)), 2, 'Single-sided wall must block a boom from its back face')
assert.equal(probe.distance(new Vector3(0, 0, 4), new Vector3()), 2, 'Front face must also block')
layer.visible = false
assert.equal(probe.distance(new Vector3(0, 0, 4), new Vector3()), null, 'Hidden model must not shorten camera')
layer.visible = true
wall.material.opacity = .3
assert.equal(probe.distance(new Vector3(), new Vector3(0, 0, 4)), null, 'Transparent glass must not block the camera')
wall.material.opacity = 1
assert.equal(probe.distance(new Vector3(0, .1, 0), new Vector3(0, .1, 4)), 2)
assert.equal(probe.distance(new Vector3(), new Vector3()), null)
assert.equal(probe.distance(new Vector3(), new Vector3()), null, 'Zero-length probe must not retain stale obstruction')
wall.geometry.dispose(); wall.material.dispose()
console.info('Camera obstruction: front/back faces, hidden layer, glass, zero-length cache PASS')
