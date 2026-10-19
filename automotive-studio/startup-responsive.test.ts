import assert from 'node:assert/strict'
import { bundledDefaultIomcarUrl } from './src/persistence/bundledDefault'
import { isPhoneViewport } from './src/runtime/deviceProfile'
import { preferredVehicleQuality, inferQualityRoleFromFilename, assetRoleForImport } from './src/vehicle/qualityVariants'

for (const base of ['/demos/automotive-studio/', '/demos/automotive-studio']) {
  assert.equal(bundledDefaultIomcarUrl(base, 'https://iobjectm.com/demos/automotive-studio/presentation.html?project=x'), 'https://iobjectm.com/demos/automotive-studio/defaults/starter.iomcar')
}
assert.equal(bundledDefaultIomcarUrl('https://cdn.example.test/studio/', 'http://localhost:5191/'), 'https://cdn.example.test/studio/defaults/starter.iomcar')
assert.equal(bundledDefaultIomcarUrl('./', 'http://localhost:5191/demos/automotive-studio/?revision=test'), 'http://localhost:5191/demos/automotive-studio/defaults/starter.iomcar')
assert.equal(isPhoneViewport(390, 844, true), true)
assert.equal(isPhoneViewport(844, 390, true), true)
assert.equal(isPhoneViewport(390, 1000, false), true)
assert.equal(isPhoneViewport(1440, 1000, false), false)
assert.equal(isPhoneViewport(1024, 768, true), false)
assert.equal(preferredVehicleQuality(['vehicle-high', 'vehicle-balanced', 'vehicle-mobile'], true), 'vehicle-balanced')
assert.equal(preferredVehicleQuality(['vehicle-high', 'vehicle-balanced', 'vehicle-mobile'], false), 'vehicle-high')
assert.equal(preferredVehicleQuality(['vehicle-high'], true), 'vehicle-high')
assert.equal(preferredVehicleQuality(['vehicle-balanced'], true), 'vehicle-balanced')
assert.equal(preferredVehicleQuality([], true), null)
assert.equal(inferQualityRoleFromFilename('lixiang-mobile-rigged.glb'), 'vehicle-mobile')
assert.equal(inferQualityRoleFromFilename('lixiang-balanced-rigged.glb'), 'vehicle-balanced')
assert.equal(assetRoleForImport('vehicle-mobile', 'car.glb', false), 'vehicle-mobile')
assert.equal(assetRoleForImport('vehicle-high', 'car.glb', true), 'prop')
console.log('PASS: startup URL, phone classification, existing LOD selection, fallbacks and explicit import slots')
