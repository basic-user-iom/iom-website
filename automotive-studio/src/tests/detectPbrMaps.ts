/**
 * PBR pack filename → stage slot mapping (ambientCG / Poly Haven).
 * Run: npx tsx src/tests/detectPbrMaps.ts
 */
import assert from 'node:assert/strict'
import { detectPbrMapsFromFiles, summarizeDetectedPbrMaps } from '../stage/detectPbrMaps'

function fake(name: string): File {
  return { name, size: 1 } as File
}

const asphalt = detectPbrMapsFromFiles([
  fake('Asphalt011_1K-JPG_Color.jpg'),
  fake('Asphalt011_1K-JPG_Displacement.jpg'),
  fake('Asphalt011_1K-JPG_NormalDX.jpg'),
  fake('Asphalt011_1K-JPG_NormalGL.jpg'),
  fake('Asphalt011_1K-JPG_Opacity.jpg'),
  fake('Asphalt011_1K-JPG_Roughness.jpg'),
  fake('Asphalt011_1K-JPG_AmbientOcclusion.jpg'),
  fake('Asphalt011_1K-JPG_Preview.jpg'),
  fake('readme.txt'),
])

assert.equal(asphalt.files.map?.name, 'Asphalt011_1K-JPG_Color.jpg')
assert.equal(asphalt.files.normal?.name, 'Asphalt011_1K-JPG_NormalGL.jpg', 'prefer NormalGL')
assert.equal(asphalt.normalYFlip, false)
assert.equal(asphalt.files.roughness?.name, 'Asphalt011_1K-JPG_Roughness.jpg')
assert.equal(asphalt.files.displacement?.name, 'Asphalt011_1K-JPG_Displacement.jpg')
assert.equal(asphalt.files.ao?.name, 'Asphalt011_1K-JPG_AmbientOcclusion.jpg')
assert.ok(!asphalt.files.metalness)
assert.ok(asphalt.skipped.some((s) => s.includes('Opacity')))
assert.ok(asphalt.skipped.some((s) => s.includes('Preview')))
assert.ok(summarizeDetectedPbrMaps(asphalt).includes('NormalGL'))

const metal = detectPbrMapsFromFiles([
  fake('Metal042A_2K-JPG_Color.jpg'),
  fake('Metal042A_2K-JPG_Metalness.jpg'),
  fake('Metal042A_2K-JPG_Roughness.jpg'),
  fake('Metal042A_2K-JPG_NormalGL.jpg'),
])
assert.equal(metal.files.metalness?.name, 'Metal042A_2K-JPG_Metalness.jpg')

const dxOnly = detectPbrMapsFromFiles([
  fake('Road_Color.png'),
  fake('Road_NormalDX.png'),
])
assert.equal(dxOnly.files.normal?.name, 'Road_NormalDX.png')
assert.equal(dxOnly.normalYFlip, true, 'NormalDX flips Y')

const orm = detectPbrMapsFromFiles([fake('Concrete_ORM.jpg'), fake('Concrete_Color.jpg')])
assert.equal(orm.files.map?.name, 'Concrete_Color.jpg')
assert.equal(orm.files.ao?.name, 'Concrete_ORM.jpg')
assert.equal(orm.files.roughness?.name, 'Concrete_ORM.jpg')
assert.equal(orm.files.metalness?.name, 'Concrete_ORM.jpg')

// Discrete maps win over ORM when both exist.
const discreteWins = detectPbrMapsFromFiles([
  fake('Rock_Color.jpg'),
  fake('Rock_Roughness.jpg'),
  fake('Rock_ORM.jpg'),
])
assert.equal(discreteWins.files.roughness?.name, 'Rock_Roughness.jpg')
assert.equal(discreteWins.files.ao?.name, 'Rock_ORM.jpg')
assert.equal(discreteWins.files.metalness?.name, 'Rock_ORM.jpg')

// Poly Haven CDN-style: type before resolution.
const ph = detectPbrMapsFromFiles([
  fake('rock_diff_1k.jpg'),
  fake('rock_nor_gl_1k.jpg'),
  fake('rock_rough_1k.jpg'),
  fake('rock_disp_1k.jpg'),
  fake('rock_arm_1k.jpg'),
])
assert.equal(ph.files.map?.name, 'rock_diff_1k.jpg')
assert.equal(ph.files.normal?.name, 'rock_nor_gl_1k.jpg')
assert.equal(ph.normalYFlip, false)
assert.equal(ph.files.roughness?.name, 'rock_rough_1k.jpg')
assert.equal(ph.files.displacement?.name, 'rock_disp_1k.jpg')
assert.equal(ph.files.ao?.name, 'rock_arm_1k.jpg')
assert.equal(ph.files.metalness?.name, 'rock_arm_1k.jpg')

const exr = detectPbrMapsFromFiles([fake('Rock_Color.exr')])
assert.ok(exr.skipped.some((s) => /EXR/i.test(s)))

console.log('detectPbrMaps: ok')
