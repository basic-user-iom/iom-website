#!/usr/bin/env node

/**
 * Disabled, read-only sensitivity study over the finalized repeat-spatial-v2
 * payload bounds. Geometry, level selection, payload pins, and v2 evidence are
 * not modified. Only hypothetical exit/hysteresis envelopes are swept.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_INDEX = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2', 'index.json')
const DEFAULT_AUDIT = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2', 'physical-audit.json')
const DEFAULT_PROOF = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2', 'deterministic-rebuild-proof.json')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-reservation-what-if-v1')
const VARIANTS = ['web', 'quest']
const METRICS = ['triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes']
const GRID_STEP_METERS = 0.25
const RESERVATION = {
  web: { residentTriangles: 500_000, transitionPeakTriangles: 500_000 },
  quest: { residentTriangles: 250_000, transitionPeakTriangles: 250_000 },
}

function parseArgs(argv) {
  const args = {
    index: DEFAULT_INDEX,
    audit: DEFAULT_AUDIT,
    proof: DEFAULT_PROOF,
    out: DEFAULT_OUT,
    worker: false,
    variant: null,
    lod0Exit: null,
    hlodExit: null,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--index') args.index = resolve(argv[++index])
    else if (value === '--audit') args.audit = resolve(argv[++index])
    else if (value === '--proof') args.proof = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else if (value === '--worker') args.worker = true
    else if (value === '--variant') args.variant = argv[++index]
    else if (value === '--lod0-exit') args.lod0Exit = Number(argv[++index])
    else if (value === '--hlod-exit') args.hlodExit = Number(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

async function runPolicyWorkers(args, specs) {
  const script = fileURLToPath(import.meta.url)
  const results = new Array(specs.length)
  let nextIndex = 0
  const concurrency = Math.min(8, specs.length)
  const runOne = (spec, resultIndex) => new Promise((accept, reject) => {
    const childArgs = [
      script,
      '--worker',
      '--index', args.index,
      '--variant', spec.variant,
      '--lod0-exit', String(spec.lod0Exit),
    ]
    if (spec.hlodExit !== null) childArgs.push('--hlod-exit', String(spec.hlodExit))
    const child = spawn(process.execPath, childArgs, {
      cwd: VIEWER_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`margin worker exited ${code}: ${stderr.slice(-2000)}`))
        return
      }
      try {
        results[resultIndex] = JSON.parse(stdout)
        accept()
      } catch (error) {
        reject(new Error(`margin worker returned invalid JSON: ${error.message}\n${stdout.slice(-1000)}`))
      }
    })
  })
  const runners = Array.from({ length: concurrency }, async () => {
    while (nextIndex < specs.length) {
      const index = nextIndex
      nextIndex += 1
      await runOne(specs[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]))
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}
const stableStringify = (value) => JSON.stringify(stableValue(value))
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

function valuesBetween(min, max, step) {
  const count = Math.round((max - min) / step)
  return Array.from({ length: count + 1 }, (_, index) => Number((min + index * step).toFixed(6)))
}

function emptyEstimate() {
  return Object.fromEntries(METRICS.map((key) => [key, 0]))
}

function addEstimate(target, estimate) {
  for (const key of METRICS) target[key] += estimate[key]
}

function expandedBounds(bounds, margin) {
  return {
    min: bounds.min.map((value) => value - margin),
    max: bounds.max.map((value) => value + margin),
  }
}

function eventsFor(items, axis) {
  const events = new Map()
  const add = (coordinate, kind, item) => {
    const event = events.get(coordinate) ?? { coordinate, starts: [], ends: [] }
    event[kind].push(item)
    events.set(coordinate, event)
  }
  for (const item of items) {
    add(item.bounds.min[axis], 'starts', item)
    add(item.bounds.max[axis], 'ends', item)
  }
  return [...events.values()].sort((left, right) => left.coordinate - right.coordinate)
}

function compactWitness(record, key) {
  return {
    value: record.totals[key],
    focus: record.focus,
    packageCount: record.packages.length,
    packages: record.packages,
    simultaneousTotals: record.totals,
    transitionPackageId: record.transitionPackageId ?? null,
  }
}

function exactExitAndPeak(index, variant, { lod0Exit, hlodExit = null }) {
  const items = []
  for (const pkg of index.packages) {
    const variantRecord = pkg.variants[variant]
    items.push({
      id: `${pkg.id}:base:lod0`,
      packageId: pkg.id,
      kind: 'base',
      level: 'lod0',
      bounds: expandedBounds(variantRecord.selectionBounds, lod0Exit),
      estimate: variantRecord.levels.lod0.estimates,
    })
    if (variantRecord.levels.hlod && hlodExit !== null) {
      items.push({
        id: `${pkg.id}:base:hlod`,
        packageId: pkg.id,
        kind: 'base',
        level: 'hlod',
        bounds: expandedBounds(variantRecord.selectionBounds, hlodExit),
        estimate: variantRecord.levels.hlod.estimates,
      })
      items.push({
        id: `${pkg.id}:transition:hlod`,
        packageId: pkg.id,
        kind: 'transition',
        level: 'hlod',
        bounds: expandedBounds(variantRecord.selectionBounds, index.policy.marginsMeters.lod0Entry),
        estimate: variantRecord.levels.hlod.estimates,
      })
    }
  }

  const exitWorst = Object.fromEntries(METRICS.map((key) => [key, null]))
  const peakWorst = Object.fromEntries(METRICS.map((key) => [key, null]))
  let focusCount = 0
  const evaluate = (active, focus) => {
    focusCount += 1
    const selected = new Map()
    const transitions = []
    for (const item of active) {
      if (item.kind === 'transition') {
        transitions.push(item)
        continue
      }
      const previous = selected.get(item.packageId)
      if (!previous || item.level === 'lod0') selected.set(item.packageId, item)
    }
    const totals = emptyEstimate()
    for (const item of selected.values()) addEstimate(totals, item.estimate)
    const packages = [...selected.values()]
      .sort((left, right) => left.packageId.localeCompare(right.packageId))
      .map((item) => `${item.packageId}:${item.level}`)
    for (const key of METRICS) {
      const exitRecord = { focus: [...focus], totals: { ...totals }, packages }
      if (!exitWorst[key] || totals[key] > exitWorst[key].totals[key]) exitWorst[key] = exitRecord
      let extra = 0
      let transitionPackageId = null
      for (const item of transitions) {
        if (item.estimate[key] > extra ||
          (item.estimate[key] === extra && item.packageId.localeCompare(transitionPackageId ?? '') < 0)) {
          extra = item.estimate[key]
          transitionPackageId = item.packageId
        }
      }
      const peakTotals = { ...totals, [key]: totals[key] + extra }
      if (!peakWorst[key] || peakTotals[key] > peakWorst[key].totals[key]) {
        peakWorst[key] = { focus: [...focus], totals: peakTotals, packages, transitionPackageId }
      }
    }
  }
  const scanZ = (candidates, x, y) => {
    const active = new Set()
    for (const event of eventsFor(candidates, 2)) {
      for (const item of event.starts) active.add(item)
      evaluate(active, [x, y, event.coordinate])
      for (const item of event.ends) active.delete(item)
    }
  }
  const scanY = (candidates, x) => {
    const active = new Set()
    for (const event of eventsFor(candidates, 1)) {
      for (const item of event.starts) active.add(item)
      scanZ(active, x, event.coordinate)
      for (const item of event.ends) active.delete(item)
    }
  }
  const active = new Set()
  let xEvents = 0
  for (const event of eventsFor(items, 0)) {
    for (const item of event.starts) active.add(item)
    xEvents += 1
    scanY(active, event.coordinate)
    for (const item of event.ends) active.delete(item)
  }
  return {
    exact: true,
    closedBounds: true,
    mutuallyExclusivePerPackageLevels: true,
    loadBeforeRetire: variant === 'web'
      ? 'one retained HLOD payload added to the exit envelope during same-package HLOD-to-LOD0 replacement'
      : 'no alternate Quest level; peak equals exit',
    focusCount,
    xEvents,
    exit: { worstByMetric: Object.fromEntries(METRICS.map((key) => [key, compactWitness(exitWorst[key], key)])) },
    peak: { worstByMetric: Object.fromEntries(METRICS.map((key) => [key, compactWitness(peakWorst[key], key)])) },
  }
}

function decorate(index, variant, margins, analysis) {
  const hardResident = index.policy.hardBudgets.resident[variant].triangles
  const hardPeak = index.policy.hardBudgets.transitionPeak[variant].triangles
  const reservation = RESERVATION[variant]
  const exitTriangles = analysis.exit.worstByMetric.triangles.value
  const peakTriangles = analysis.peak.worstByMetric.triangles.value
  const residentHeadroom = hardResident - exitTriangles
  const peakHeadroom = hardPeak - peakTriangles
  const lod0Width = margins.lod0Exit - index.policy.marginsMeters.lod0Entry
  const hlodWidth = margins.hlodExit === null ? null : margins.hlodExit - index.policy.marginsMeters.hlodEntry
  return {
    marginsMeters: { ...margins, lod0HysteresisWidth: lod0Width, hlodHysteresisWidth: hlodWidth },
    exact: analysis,
    reservation: {
      requiredResidentTriangleHeadroom: reservation.residentTriangles,
      actualResidentTriangleHeadroom: residentHeadroom,
      residentPassed: residentHeadroom >= reservation.residentTriangles,
      requiredTransitionPeakTriangleHeadroom: reservation.transitionPeakTriangles,
      actualTransitionPeakTriangleHeadroom: peakHeadroom,
      transitionPeakPassed: peakHeadroom >= reservation.transitionPeakTriangles,
    },
    stabilityClasses: {
      preservesCurrentTwoMeterHysteresis: lod0Width >= 2 && (hlodWidth === null || hlodWidth >= 2),
      atLeastOneMeterHysteresis: lod0Width >= 1 && (hlodWidth === null || hlodWidth >= 1),
      positiveHysteresis: lod0Width > 0 && (hlodWidth === null || hlodWidth > 0),
    },
  }
}

function reservationPassed(record) {
  return record.reservation.residentPassed && record.reservation.transitionPeakPassed
}

function pareto(records) {
  return records.filter((candidate) => !records.some((other) =>
    other !== candidate &&
    other.marginsMeters.lod0Exit >= candidate.marginsMeters.lod0Exit &&
    (candidate.marginsMeters.hlodExit === null || other.marginsMeters.hlodExit >= candidate.marginsMeters.hlodExit) &&
    (other.marginsMeters.lod0Exit > candidate.marginsMeters.lod0Exit ||
      (candidate.marginsMeters.hlodExit !== null && other.marginsMeters.hlodExit > candidate.marginsMeters.hlodExit))))
}

function bestBalanced(records) {
  return [...records].sort((left, right) => {
    const leftWidths = [left.marginsMeters.lod0HysteresisWidth, left.marginsMeters.hlodHysteresisWidth]
      .filter((value) => value !== null)
    const rightWidths = [right.marginsMeters.lod0HysteresisWidth, right.marginsMeters.hlodHysteresisWidth]
      .filter((value) => value !== null)
    const leftMin = Math.min(...leftWidths)
    const rightMin = Math.min(...rightWidths)
    return rightMin - leftMin ||
      (rightWidths.reduce((sum, value) => sum + value, 0) - leftWidths.reduce((sum, value) => sum + value, 0)) ||
      right.marginsMeters.lod0Exit - left.marginsMeters.lod0Exit ||
      (right.marginsMeters.hlodExit ?? 0) - (left.marginsMeters.hlodExit ?? 0)
  })[0] ?? null
}

function compactRow(record) {
  return {
    marginsMeters: record.marginsMeters,
    exit: {
      triangles: record.exact.exit.worstByMetric.triangles.value,
      draws: record.exact.exit.worstByMetric.draws.value,
      bytes: record.exact.exit.worstByMetric.bytes.value,
      triangleWitness: record.exact.exit.worstByMetric.triangles,
    },
    peak: {
      triangles: record.exact.peak.worstByMetric.triangles.value,
      draws: record.exact.peak.worstByMetric.draws.value,
      bytes: record.exact.peak.worstByMetric.bytes.value,
      triangleWitness: record.exact.peak.worstByMetric.triangles,
    },
    reservation: record.reservation,
    stabilityClasses: record.stabilityClasses,
  }
}

function markdown(result) {
  const currentWeb = result.outcome.web.current
  const webBest = result.outcome.web.bestBalancedReservationPass
  const webPareto = result.outcome.web.paretoLargestReservationPassMargins
  const currentQuest = result.outcome.quest.current
  const stable = result.outcome.web.currentTwoMeterHysteresisFeasible
  const oneMeterStable = result.outcome.web.atLeastOneMeterHysteresisFeasible
  const hlodOnlyPositive = result.outcome.web.hlodExitOnlyPositiveHysteresisReservationPassingConfigurations
  const paretoRows = webPareto.map((record) =>
    `- LOD0 exit ${record.marginsMeters.lod0Exit} m / HLOD exit ${record.marginsMeters.hlodExit} m: ` +
    `${record.reservation.actualResidentTriangleHeadroom.toLocaleString('en-US')} resident / ` +
    `${record.reservation.actualTransitionPeakTriangleHeadroom.toLocaleString('en-US')} peak triangle headroom; ` +
    `hysteresis widths ${record.marginsMeters.lod0HysteresisWidth} m / ${record.marginsMeters.hlodHysteresisWidth} m.`).join('\n')
  return `# Repeat spatial v2 reservation-aware margin what-if\n\n` +
    `Status: **disabled analysis only; v2 unchanged**. \`ready=false\`, \`activationApproved=false\`.\n\n` +
    `The finalized repeat v2 physical bounds were swept at ${GRID_STEP_METERS} m increments. Geometry, visual LODs, package ownership, payload hashes, and production routing were not changed. The reservation target is 500,000 Web / 250,000 Quest triangles for the shell and other owners, applied to both the resident and transition-peak hard ceilings.\n\n` +
    `## Result\n\n` +
    `Current Web margins (LOD0 exit ${currentWeb.marginsMeters.lod0Exit} m, HLOD exit ${currentWeb.marginsMeters.hlodExit} m) leave only ${currentWeb.reservation.actualResidentTriangleHeadroom.toLocaleString('en-US')} resident triangles and ${currentWeb.reservation.actualTransitionPeakTriangleHeadroom.toLocaleString('en-US')} peak triangles. They fail the 500k reservation. Reducing only Web HLOD exit while retaining LOD0 exit at 3.5 m does not meet the reservation at any positive HLOD hysteresis width${hlodOnlyPositive === 0 ? '' : ` (${hlodOnlyPositive} positive-width exception(s) were found)`}. The sole HLOD-only mathematical pass is the 3.5 m endpoint, where HLOD exit equals its 3.5 m entry and hysteresis collapses to zero; it is not an operationally stable policy.\n\n` +
    `${stable ? 'A two-meter-hysteresis Web solution exists in the bounded grid.' : '**No Web configuration preserving the current two-meter hysteresis widths meets the reservation.**'} ` +
    `${oneMeterStable ? 'A Web solution retaining at least one meter of hysteresis also exists.' : 'No Web configuration retaining even one meter of hysteresis at both levels meets it.'} ` +
    `${webBest ? `The best-balanced positive-width mathematical grid point is LOD0 exit ${webBest.marginsMeters.lod0Exit} m / HLOD exit ${webBest.marginsMeters.hlodExit} m, with ${webBest.reservation.actualResidentTriangleHeadroom.toLocaleString('en-US')} resident and ${webBest.reservation.actualTransitionPeakTriangleHeadroom.toLocaleString('en-US')} peak headroom. Its hysteresis widths are only ${webBest.marginsMeters.lod0HysteresisWidth} m / ${webBest.marginsMeters.hlodHysteresisWidth} m, so this is not activation advice.` : 'No swept Web margin pair meets the reservation.'}\n\n` +
    `The exact Pareto-largest reservation-passing grid points are:\n\n${paretoRows}\n\n` +
    `Quest already succeeds at its current 3.5 m LOD0 exit: ${currentQuest.reservation.actualResidentTriangleHeadroom.toLocaleString('en-US')} resident and ${currentQuest.reservation.actualTransitionPeakTriangleHeadroom.toLocaleString('en-US')} transition-peak headroom.\n\n` +
    `## Mathematical blocker and next asset action\n\n` +
    `At the current visually and operationally proven Web margins, repeat v2 submits ${currentWeb.exit.triangles.toLocaleString('en-US')} triangles at the exit witness. A 500k reservation requires at most 1,500,000, so at least ${(currentWeb.exit.triangles - 1_500_000).toLocaleString('en-US')} submitted triangles (${(((currentWeb.exit.triangles - 1_500_000) / currentWeb.exit.triangles) * 100).toFixed(1)}%) must be removed at that witness without relying on reduced hysteresis.\n\n` +
    `The recommended next asset action is a separately authored and seven-view-approved lower-cost Web chair/table HLOD or cluster/impostor for the exit envelope, with floor-aware clusters so inactive floors do not share one selection bound. Shared buffers should also remove the 181.9 MB geometry duplication, but byte sharing alone cannot solve the triangle reservation. Keep the current v2 and production route disabled until the new asset passes the same identity, parity, visual, focus-churn, and combined-layer gates.\n\n` +
    `Evidence: \`tmp/repeat-spatial-reservation-what-if-v1/analysis.json\`. Rebuild with \`npm run model:analyze-repeat-reservation-what-if\`.\n`
}

const args = parseArgs(process.argv)
if (args.worker) {
  assert.ok(VARIANTS.includes(args.variant), 'worker variant must be web or quest')
  assert.ok(Number.isFinite(args.lod0Exit), 'worker lod0 exit is required')
  if (args.variant === 'web') assert.ok(Number.isFinite(args.hlodExit), 'Web worker HLOD exit is required')
  const index = await readJson(args.index)
  assert.equal(index.schema, 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2')
  assert.equal(index.ready, false)
  const analysis = exactExitAndPeak(index, args.variant, {
    lod0Exit: args.lod0Exit,
    hlodExit: args.variant === 'web' ? args.hlodExit : null,
  })
  process.stdout.write(JSON.stringify(analysis))
} else {
const [indexRaw, auditRaw, proofRaw] = await Promise.all([
  readFile(args.index),
  readFile(args.audit),
  readFile(args.proof),
])
const index = JSON.parse(indexRaw)
const audit = JSON.parse(auditRaw)
const proof = JSON.parse(proofRaw)
assert.equal(index.schema, 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2')
assert.equal(index.ready, false)
assert.equal(index.activationApproved, false)
assert.equal(audit.status, 'PASS')
assert.equal(audit.ready, false)
assert.equal(audit.index.bytes, indexRaw.length)
assert.equal(audit.index.sha256, sha256(indexRaw))
assert.equal(audit.index.reproducibilityDigestSha256, index.reproducibilityDigestSha256)
assert.equal(proof.status, 'PASS')
assert.equal(proof.exactMatch, true)

const lod0ExitValues = valuesBetween(index.policy.marginsMeters.lod0Entry, index.policy.marginsMeters.lod0Exit, GRID_STEP_METERS)
const hlodExitValues = valuesBetween(index.policy.marginsMeters.hlodEntry, index.policy.marginsMeters.hlodExit, GRID_STEP_METERS)
const webSpecs = lod0ExitValues.flatMap((lod0Exit) => hlodExitValues.map((hlodExit) => ({ variant: 'web', lod0Exit, hlodExit })))
const webAnalyses = await runPolicyWorkers(args, webSpecs)
const web = webSpecs.map((spec, indexValue) => decorate(index, 'web', {
  lod0Exit: spec.lod0Exit,
  hlodExit: spec.hlodExit,
}, webAnalyses[indexValue]))
const questSpecs = lod0ExitValues.map((lod0Exit) => ({ variant: 'quest', lod0Exit, hlodExit: null }))
const questAnalyses = await runPolicyWorkers(args, questSpecs)
const quest = questSpecs.map((spec, indexValue) => decorate(index, 'quest', {
  lod0Exit: spec.lod0Exit,
  hlodExit: null,
}, questAnalyses[indexValue]))

const currentWeb = web.find((record) =>
  record.marginsMeters.lod0Exit === index.policy.marginsMeters.lod0Exit &&
  record.marginsMeters.hlodExit === index.policy.marginsMeters.hlodExit)
const currentQuest = quest.find((record) => record.marginsMeters.lod0Exit === index.policy.marginsMeters.lod0Exit)
assert.ok(currentWeb && currentQuest)
assert.equal(currentWeb.exact.exit.worstByMetric.triangles.value, index.residentWindows.web.exitUpperEnvelope.budget.triangles.value)
assert.equal(currentWeb.exact.peak.worstByMetric.triangles.value, index.residentWindows.web.loadBeforeRetirePeak.budget.triangles.value)
assert.equal(currentQuest.exact.exit.worstByMetric.triangles.value, index.residentWindows.quest.exitUpperEnvelope.budget.triangles.value)

const feasibleWeb = web.filter(reservationPassed)
const feasibleQuest = quest.filter(reservationPassed)
const webCurrentStable = feasibleWeb.filter((record) => record.stabilityClasses.preservesCurrentTwoMeterHysteresis)
const webOneMeter = feasibleWeb.filter((record) => record.stabilityClasses.atLeastOneMeterHysteresis)
const webHlodOnly = web.filter((record) => record.marginsMeters.lod0Exit === index.policy.marginsMeters.lod0Exit)
const webHlodOnlyFeasible = webHlodOnly.filter(reservationPassed)
const webHlodOnlyPositiveFeasible = webHlodOnlyFeasible.filter((record) => record.stabilityClasses.positiveHysteresis)
const webPositive = feasibleWeb.filter((record) => record.stabilityClasses.positiveHysteresis)
const questCurrentStable = feasibleQuest.filter((record) => record.stabilityClasses.preservesCurrentTwoMeterHysteresis)

const result = {
  schema: 'IOM_GROUND_REPEAT_RESERVATION_WHAT_IF_V1',
  version: 1,
  disabled: true,
  enabled: false,
  ready: false,
  activationApproved: false,
  candidateMutated: false,
  productionChanged: false,
  source: {
    index: { path: relative(args.out, args.index).replaceAll('\\', '/'), bytes: indexRaw.length, sha256: sha256(indexRaw), reproducibilityDigestSha256: index.reproducibilityDigestSha256 },
    audit: { path: relative(args.out, args.audit).replaceAll('\\', '/'), bytes: auditRaw.length, sha256: sha256(auditRaw) },
    deterministicProof: { path: relative(args.out, args.proof).replaceAll('\\', '/'), bytes: proofRaw.length, sha256: sha256(proofRaw) },
  },
  policy: {
    gridStepMeters: GRID_STEP_METERS,
    fixedEntryMarginsMeters: {
      lod0: index.policy.marginsMeters.lod0Entry,
      webHlod: index.policy.marginsMeters.hlodEntry,
    },
    sweptExitMarginsMeters: {
      lod0: { min: lod0ExitValues[0], max: lod0ExitValues.at(-1) },
      webHlod: { min: hlodExitValues[0], max: hlodExitValues.at(-1) },
    },
    reservationTriangles: RESERVATION,
    stabilityDefinitions: {
      current: 'exit minus entry >= 2.0m for every available level',
      oneMeterDiagnostic: 'exit minus entry >= 1.0m for every available level; not production-approved without focus-churn QA',
      positiveOnly: 'exit greater than entry; mathematical feasibility only',
    },
  },
  sweep: {
    web: web.map(compactRow),
    quest: quest.map(compactRow),
  },
  outcome: {
    web: {
      current: compactRow(currentWeb),
      evaluatedConfigurations: web.length,
      reservationPassingConfigurations: feasibleWeb.length,
      hlodExitOnlyConfigurations: webHlodOnly.length,
      hlodExitOnlyReservationPassingConfigurations: webHlodOnlyFeasible.length,
      hlodExitOnlyPositiveHysteresisReservationPassingConfigurations: webHlodOnlyPositiveFeasible.length,
      largestHlodExitOnlyReservationPass: webHlodOnlyFeasible.length > 0
        ? compactRow([...webHlodOnlyFeasible].sort((left, right) => right.marginsMeters.hlodExit - left.marginsMeters.hlodExit)[0])
        : null,
      currentTwoMeterHysteresisFeasible: webCurrentStable.length > 0,
      atLeastOneMeterHysteresisFeasible: webOneMeter.length > 0,
      positiveHysteresisFeasible: webPositive.length > 0,
      paretoLargestReservationPassMargins: pareto(feasibleWeb).map(compactRow),
      paretoLargestOneMeterMargins: pareto(webOneMeter).map(compactRow),
      bestBalancedReservationPass: bestBalanced(webPositive) ? compactRow(bestBalanced(webPositive)) : null,
      bestBalancedOneMeter: bestBalanced(webOneMeter) ? compactRow(bestBalanced(webOneMeter)) : null,
      currentResidentTriangleShortfallToReservation: Math.max(0, RESERVATION.web.residentTriangles - currentWeb.reservation.actualResidentTriangleHeadroom),
      currentPeakTriangleShortfallToReservation: Math.max(0, RESERVATION.web.transitionPeakTriangles - currentWeb.reservation.actualTransitionPeakTriangleHeadroom),
      requiredCurrentWitnessTriangleReduction: Math.max(0,
        currentWeb.exact.exit.worstByMetric.triangles.value -
        (index.policy.hardBudgets.resident.web.triangles - RESERVATION.web.residentTriangles)),
    },
    quest: {
      current: compactRow(currentQuest),
      evaluatedConfigurations: quest.length,
      reservationPassingConfigurations: feasibleQuest.length,
      currentTwoMeterHysteresisFeasible: questCurrentStable.length > 0,
      largestReservationPassMargin: compactRow([...feasibleQuest].sort((left, right) => right.marginsMeters.lod0Exit - left.marginsMeters.lod0Exit)[0]),
    },
  },
  conclusion: {
    activationApproved: false,
    webUnchangedStabilityBlocker: webCurrentStable.length === 0,
    message: webCurrentStable.length === 0
      ? 'No swept Web configuration preserving the current two-meter hysteresis widths leaves the required 500k resident/peak triangle reservation. HLOD-exit reduction alone passes only by collapsing HLOD hysteresis to zero.'
      : 'A reservation-feasible current-stability Web configuration exists in the bounded grid, but remains disabled pending combined-layer and focus-churn proof.',
    recommendedNextAssetAction: 'Author and seven-view approve a lower-cost Web chair/table HLOD or floor-aware cluster/impostor that removes at least the recorded current-witness triangle shortfall at unchanged margins. Shared geometry should separately address encoded-byte duplication.',
  },
}
result.evidenceDigestSha256 = sha256(Buffer.from(stableStringify(result)))

await mkdir(args.out, { recursive: true })
await Promise.all([
  writeFile(resolve(args.out, 'analysis.json'), `${JSON.stringify(result, null, 2)}\n`),
  writeFile(resolve(args.out, 'README.md'), markdown(result)),
])
console.log('Repeat spatial reservation what-if: PASS (analysis only; candidate unchanged)')
console.log(`  Web configs ${web.length}; reservation-pass ${feasibleWeb.length}; current-stability-pass ${webCurrentStable.length}`)
console.log(`  HLOD-exit-only reservation-pass ${webHlodOnlyFeasible.length}/${webHlodOnly.length}`)
if (result.outcome.web.bestBalancedReservationPass) {
  const best = result.outcome.web.bestBalancedReservationPass
  console.log(`  best balanced math point: lod0Exit=${best.marginsMeters.lod0Exit}, hlodExit=${best.marginsMeters.hlodExit}, resident headroom=${best.reservation.actualResidentTriangleHeadroom}`)
}
console.log(`  Quest current resident headroom ${currentQuest.reservation.actualResidentTriangleHeadroom}`)
console.log(`  evidence=${relative(VIEWER_ROOT, resolve(args.out, 'analysis.json')).replaceAll('\\', '/')}`)
}
