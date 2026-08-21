/**
 * Lamp lenses must not get window-glass transmission polish.
 * Run: npx tsx src/tests/polishLampGlass.ts
 */
import assert from 'node:assert/strict'
import { Group, Mesh, MeshPhysicalMaterial, BoxGeometry } from 'three'
import { polishVehicleMaterials } from '../renderer/polishVehicleMaterials'

const root = new Group()
const red = new MeshPhysicalMaterial({ name: 'RedGlass', color: 0x330000 })
const orange = new MeshPhysicalMaterial({ name: 'Orange', color: 0x442200 })
const windowGlass = new MeshPhysicalMaterial({ name: 'Glass', color: 0x88aacc })
root.add(new Mesh(new BoxGeometry(0.2, 0.1, 0.05), red))
root.add(new Mesh(new BoxGeometry(0.1, 0.08, 0.05), orange))
root.add(new Mesh(new BoxGeometry(1, 0.8, 0.02), windowGlass))

polishVehicleMaterials(root)

assert.ok((red.transmission ?? 0) < 0.1, 'RedGlass must not get window transmission')
assert.equal(red.transparent, false, 'RedGlass stays opaque for emissive lamps')
assert.ok((orange.transmission ?? 0) < 0.1, 'Orange must not get window transmission')
assert.ok((windowGlass.transmission ?? 0) >= 0.85, 'cabin Glass still gets transmission polish')
assert.ok(windowGlass.opacity <= 0.55, 'cabin Glass opacity is reduced')

console.log('polish lamp glass: ok')
