/** Deterministic validator for the disabled Ground Floor instancing pilot. */
import { resolve } from 'node:path'
import { validatePilot } from './build-ground-floor-repeat-instancing-pilot.mjs'

const args = {
  input: resolve('tmp/icm-anim-2025-cleaned.glb'),
  web: resolve('../public/models/icm-anim-2025/model-web.glb'),
  quest: resolve('../public/models/icm-anim-2025/model-quest.glb'),
  exteriorWeb: resolve('../public/models/icm-ext/model-web.glb'),
  exteriorQuest: resolve('../public/models/icm-ext/model-quest.glb'),
  out: resolve('tmp/repeat-instancing-ground-floor'),
  validateOnly: true,
}

for (let i = 2; i < process.argv.length; i += 1) {
  const value = process.argv[i]
  if (value === '--input') args.input = resolve(process.argv[++i])
  else if (value === '--web') args.web = resolve(process.argv[++i])
  else if (value === '--quest') args.quest = resolve(process.argv[++i])
  else if (value === '--exterior-web') args.exteriorWeb = resolve(process.argv[++i])
  else if (value === '--exterior-quest') args.exteriorQuest = resolve(process.argv[++i])
  else if (value === '--out') args.out = resolve(process.argv[++i])
  else throw new Error(`Unknown argument: ${value}`)
}

await validatePilot(args)
