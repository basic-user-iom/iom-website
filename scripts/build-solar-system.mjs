/**
 * Build Solar System: Living Observatory -> public/demos/solar-system/
 *
 * This helper deliberately never installs dependencies. Install the nested
 * package first, then run this script to typecheck and build the committed demo.
 */
import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(scriptDirectory, '..')
const appDirectory = join(repositoryRoot, 'solar-system')
const outputDirectory = join(repositoryRoot, 'public', 'demos', 'solar-system')
const generatedDataDirectory = join(appDirectory, 'src', 'data', 'generated')
const requiredBodyIds = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]
const requiredCometIds = [
  '1p-halley',
  '2p-encke',
  '67p-churyumov-gerasimenko',
  'c-1995-o1-hale-bopp',
  'c-2020-f3-neowise',
]

function nestedNpmEnvironment() {
  const environment = { ...process.env }
  for (const key of Object.keys(environment)) {
    if (/^npm_/i.test(key)) delete environment[key]
  }
  return environment
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: nestedNpmEnvironment(),
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function requireExactlyOneHashedAsset(directory, assetNames, pattern, label) {
  const matches = assetNames.filter((assetName) => pattern.test(assetName)).sort()
  if (matches.length !== 1) {
    throw new Error(
      `Built ${label} must have exactly one hashed asset; found ${matches.length}: ` +
        (matches.length === 0 ? '(none)' : matches.join(', ')),
    )
  }
  return join(directory, matches[0])
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashJson(value) {
  return sha256(JSON.stringify(value))
}

async function main() {
  const packagePath = join(appDirectory, 'package.json')
  if (!(await exists(packagePath))) {
    throw new Error(`Missing Solar System package: ${packagePath}`)
  }

  const appPackage = JSON.parse(await readFile(packagePath, 'utf8'))
  if (appPackage.name !== 'iom-solar-system') {
    throw new Error(`Unexpected Solar System package name: ${appPackage.name || '(missing)'}`)
  }

  const packageNames = [
    ...Object.keys(appPackage.dependencies ?? {}),
    ...Object.keys(appPackage.devDependencies ?? {}),
  ]
  const missingPackages = []
  for (const packageName of packageNames) {
    const installedManifest = join(appDirectory, 'node_modules', packageName, 'package.json')
    if (!(await exists(installedManifest))) missingPackages.push(packageName)
  }

  if (missingPackages.length > 0) {
    console.error(`Missing solar-system dependencies: ${missingPackages.join(', ')}`)
    console.error('Install the nested package before building; this script will not modify dependencies.')
    process.exit(1)
  }

  const manifestPath = join(generatedDataDirectory, 'solar-system-ephemeris.manifest.json')
  const validationPath = join(generatedDataDirectory, 'solar-system-ephemeris.validation.json')
  const referencesPath = join(generatedDataDirectory, 'validation-references.json')
  for (const requiredPath of [manifestPath, validationPath, referencesPath]) {
    if (!(await exists(requiredPath))) {
      throw new Error(`Missing generated Phase 2 ephemeris artifact: ${requiredPath}`)
    }
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const validation = JSON.parse(await readFile(validationPath, 'utf8'))
  const binaryPath = join(generatedDataDirectory, manifest.binaryFile ?? '')
  if (!(await exists(binaryPath))) {
    throw new Error(`Missing generated ephemeris binary: ${binaryPath}`)
  }
  const binary = await readFile(binaryPath)
  const binarySha256 = createHash('sha256').update(binary).digest('hex')
  if (binarySha256 !== manifest.binarySha256) {
    throw new Error('Generated ephemeris binary SHA-256 does not match its manifest.')
  }
  const manifestBodyIds = manifest.bodies?.map((body) => body.bodyId)
  if (JSON.stringify(manifestBodyIds) !== JSON.stringify(requiredBodyIds)) {
    throw new Error('Generated ephemeris manifest does not contain the required ordered body catalog.')
  }
  if (
    validation.passed !== true ||
    validation.structuralPassed !== true ||
    validation.independentValidationPerformed !== true ||
    validation.datasetId !== manifest.datasetId ||
    validation.binarySha256 !== manifest.binarySha256
  ) {
    throw new Error('Generated ephemeris has no passing independent validation report.')
  }

  const smallManifestPath = join(generatedDataDirectory, 'small-body-ephemeris.manifest.json')
  const smallRoutingPath = join(generatedDataDirectory, 'small-body-segments.json')
  const smallValidationPath = join(generatedDataDirectory, 'small-body-ephemeris.validation.json')
  for (const requiredPath of [smallManifestPath, smallRoutingPath, smallValidationPath]) {
    if (!(await exists(requiredPath))) {
      throw new Error(`Missing generated Phase 6 small-body artifact: ${requiredPath}`)
    }
  }
  const smallManifest = JSON.parse(await readFile(smallManifestPath, 'utf8'))
  const smallRouting = JSON.parse(await readFile(smallRoutingPath, 'utf8'))
  const smallValidation = JSON.parse(await readFile(smallValidationPath, 'utf8'))
  const smallBinaryPath = join(generatedDataDirectory, smallManifest.binaryFile ?? '')
  if (!(await exists(smallBinaryPath))) {
    throw new Error(`Missing generated small-body ephemeris binary: ${smallBinaryPath}`)
  }
  const smallBinary = await readFile(smallBinaryPath)
  const smallBinarySha256 = createHash('sha256').update(smallBinary).digest('hex')
  const routedCometIds = smallRouting.bodies?.map((body) => body.bodyId)
  const routedSeriesIds = smallRouting.bodies?.flatMap((body) =>
    body.segments?.map((segment) => segment.seriesBodyId) ?? [],
  )
  const manifestedSeriesIds = smallManifest.bodies?.map((body) => body.bodyId)
  if (
    smallManifest.binaryFile !== 'small-body-ephemeris.v1.bin' ||
    smallBinarySha256 !== smallManifest.binarySha256 ||
    smallRouting.datasetId !== smallManifest.datasetId ||
    smallRouting.binarySha256 !== smallManifest.binarySha256 ||
    JSON.stringify(routedCometIds) !== JSON.stringify(requiredCometIds) ||
    JSON.stringify(routedSeriesIds) !== JSON.stringify(manifestedSeriesIds) ||
    !smallRouting.bodies?.every((body) =>
      body.segments?.length > 0 && body.segments.some((segment) => segment.kind === 'baseline'),
    )
  ) {
    throw new Error('Generated Phase 6 small-body manifest/routing contract is invalid.')
  }
  if (
    smallValidation.passed !== true ||
    smallValidation.structuralPassed !== true ||
    smallValidation.independentValidationPerformed !== true ||
    smallValidation.datasetId !== smallManifest.datasetId ||
    smallValidation.binarySha256 !== smallManifest.binarySha256 ||
    !Array.isArray(smallValidation.referenceChecks) ||
    smallValidation.referenceChecks.length < requiredCometIds.length * 3
  ) {
    throw new Error('Generated small-body ephemeris has no passing independent validation report.')
  }

  console.log('Building Solar System: Living Observatory...')
  run('npm', ['run', 'build'], appDirectory)

  const outputIndex = join(outputDirectory, 'index.html')
  if (!(await exists(outputIndex))) {
    throw new Error(`Build output is missing: ${outputIndex}`)
  }

  const outputAssetsDirectory = join(outputDirectory, 'assets')
  const outputAssetNames = (await readdir(outputAssetsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  const builtManifestPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^solar-system-ephemeris\.manifest-[A-Za-z0-9_-]+\.json$/,
    'core ephemeris manifest',
  )
  const builtBinaryPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^solar-system-ephemeris\.v1-[A-Za-z0-9_-]+\.bin$/,
    'core ephemeris binary',
  )
  const builtSmallManifestPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^small-body-ephemeris\.manifest-[A-Za-z0-9_-]+\.json$/,
    'small-body ephemeris manifest',
  )
  const builtSmallBinaryPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^small-body-ephemeris\.v1-[A-Za-z0-9_-]+\.bin$/,
    'small-body ephemeris binary',
  )
  const builtSmallRoutingPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^small-body-segments-[A-Za-z0-9_-]+\.json$/,
    'small-body segment routing',
  )
  const builtSmallValidationPath = requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^small-body-ephemeris\.validation-[A-Za-z0-9_-]+\.json$/,
    'small-body ephemeris validation report',
  )
  requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^spacecraft-data-[A-Za-z0-9_-]+\.js$/,
    'spacecraft Horizons data chunk',
  )
  requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^moon-anchor-data-[A-Za-z0-9_-]+\.js$/,
    'major-moon Horizons anchor chunk',
  )
  requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^orbital-propagation-[A-Za-z0-9_-]+\.js$/,
    'SGP4/SDP4 runtime chunk',
  )
  requireExactlyOneHashedAsset(
    outputAssetsDirectory,
    outputAssetNames,
    /^spaceObjectPropagation\.worker-[A-Za-z0-9_-]+\.js$/,
    'space-object propagation worker',
  )
  const [
    builtManifest,
    builtBinary,
    builtSmallManifest,
    builtSmallBinary,
    builtSmallRouting,
    builtSmallValidation,
  ] = await Promise.all([
    readFile(builtManifestPath, 'utf8').then(JSON.parse),
    readFile(builtBinaryPath),
    readFile(builtSmallManifestPath, 'utf8').then(JSON.parse),
    readFile(builtSmallBinaryPath),
    readFile(builtSmallRoutingPath, 'utf8').then(JSON.parse),
    readFile(builtSmallValidationPath, 'utf8').then(JSON.parse),
  ])
  const builtBinarySha256 = sha256(builtBinary)
  if (
    builtManifest.binaryFile !== 'solar-system-ephemeris.v1.bin' ||
    builtManifest.binarySha256 !== builtBinarySha256 ||
    builtManifest.datasetId !== manifest.datasetId ||
    builtManifest.binarySha256 !== manifest.binarySha256
  ) {
    throw new Error('Built core ephemeris manifest/binary does not match the verified source dataset.')
  }

  const builtSmallBinarySha256 = sha256(builtSmallBinary)
  if (
    builtSmallManifest.binaryFile !== 'small-body-ephemeris.v1.bin' ||
    builtSmallManifest.binarySha256 !== builtSmallBinarySha256 ||
    builtSmallManifest.datasetId !== smallManifest.datasetId ||
    builtSmallManifest.binarySha256 !== smallManifest.binarySha256 ||
    builtSmallRouting.datasetId !== builtSmallManifest.datasetId ||
    builtSmallRouting.binaryFile !== builtSmallManifest.binaryFile ||
    builtSmallRouting.binarySha256 !== builtSmallManifest.binarySha256 ||
    builtSmallValidation.passed !== true ||
    builtSmallValidation.structuralPassed !== true ||
    builtSmallValidation.independentValidationPerformed !== true ||
    builtSmallValidation.datasetId !== builtSmallManifest.datasetId ||
    builtSmallValidation.binarySha256 !== builtSmallManifest.binarySha256 ||
    builtSmallValidation.routingSha256 !== hashJson(builtSmallRouting) ||
    builtSmallValidation.routingSha256 !== smallValidation.routingSha256
  ) {
    throw new Error(
      'Built small-body manifest/binary/routing/validation does not match the verified source dataset.',
    )
  }

  for (const phaseSixAsset of [
    'milky-way-4k.webp',
    'milky-way-8k.webp',
    'bright-stars.bsc5p.v1.json',
    'bright-stars.bsc5p.v1.bin',
    'sky-manifest.json',
  ]) {
    const assetPath = join(outputDirectory, 'assets', 'phase6', phaseSixAsset)
    if (!(await exists(assetPath))) {
      throw new Error(`Built Phase 6 sky output is missing: ${assetPath}`)
    }
  }

  console.log('Done. Solar System -> /demos/solar-system/')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
