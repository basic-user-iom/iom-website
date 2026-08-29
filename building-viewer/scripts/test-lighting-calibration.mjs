import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { DAYLIGHT_PRESETS, resolveEffectiveDaylight } = await vite.ssrLoadModule(
    '/src/lighting/DaylightPresets.ts',
  )
  const { getQualityProfile } = await vite.ssrLoadModule('/src/performance/QualityManager.ts')

  assert.deepEqual(Object.keys(DAYLIGHT_PRESETS), ['daylight', 'overcast', 'goldenHour', 'studio'])

  const balanced = getQualityProfile('DESKTOP_BALANCED')
  const high = getQualityProfile('DESKTOP_HIGH')
  const quest = getQualityProfile('QUEST')
  const daylight = DAYLIGHT_PRESETS.daylight

  assert.deepEqual(resolveEffectiveDaylight(daylight, balanced.environmentIntensity), {
    sunIntensity: 2.94,
    hemisphereIntensity: 0.196,
    ambientIntensity: 0.013999999999999999,
    exposure: 0.95,
    environmentIntensity: 0.504,
    backgroundBlurriness: 0.02,
    backgroundIntensity: 1,
  })
  assert.deepEqual(resolveEffectiveDaylight(daylight, high.environmentIntensity), {
    sunIntensity: 3.57,
    hemisphereIntensity: 0.23800000000000002,
    ambientIntensity: 0.017,
    exposure: 0.95,
    environmentIntensity: 0.612,
    backgroundBlurriness: 0.02,
    backgroundIntensity: 1,
  })
  assert.deepEqual(resolveEffectiveDaylight(daylight, quest.environmentIntensity), {
    sunIntensity: 2.7300000000000004,
    hemisphereIntensity: 0.15400000000000003,
    ambientIntensity: 0.011000000000000001,
    exposure: 0.95,
    environmentIntensity: 0.396,
    backgroundBlurriness: 0.02,
    backgroundIntensity: 1,
  })

  // Every user-selectable preset must resolve to finite, non-negative values
  // under every fixed quality profile. Quality may reduce fill/IBL but never
  // changes the artistic exposure selected by the preset.
  for (const preset of Object.values(DAYLIGHT_PRESETS)) {
    for (const profile of [high, balanced, quest]) {
      const effective = resolveEffectiveDaylight(preset, profile.environmentIntensity)
      for (const [key, value] of Object.entries(effective)) {
        assert.equal(Number.isFinite(value), true, `${preset.id}/${profile.id}/${key} is not finite`)
        assert.equal(value >= 0, true, `${preset.id}/${profile.id}/${key} is negative`)
      }
      assert.equal(effective.exposure, preset.exposure)
    }
  }

  assert.equal(high.toneMapping, 'agx')
  assert.equal(balanced.toneMapping, 'agx')
  assert.equal(quest.toneMapping, 'aces')
  assert.equal(quest.cheapEnvironment, true)
  assert.equal(high.cheapEnvironment, false)
  assert.equal(resolveEffectiveDaylight(daylight, Number.NaN).environmentIntensity, 0.72)
  assert.equal(resolveEffectiveDaylight(daylight, -1).environmentIntensity, 0)

  console.log('Lighting calibration regression: PASS')
  console.log('  presets: daylight, overcast, goldenHour, studio')
  console.log('  profiles: desktop high/balanced AgX, Quest ACES + cheap environment')
  console.log('  balanced daylight: exposure 0.95, sun 2.94, IBL 0.504')
} finally {
  await vite.close()
}
