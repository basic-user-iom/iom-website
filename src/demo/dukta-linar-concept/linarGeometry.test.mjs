import assert from 'node:assert/strict'
import {
  LINAR_DOCUMENTED_PANEL_FORMATS,
  bridgePhaseForGlobalColumn,
  cadBridgeProfileHeightMm,
  calculateBridgeHeightMm,
  calculateCadCutGeometryMm,
  calculateExactClippedOpenArea,
  calculateFullCellsOnlyOpenArea,
  calculateLinarOpenAreaResult,
  calculateOpenAreaEdgeComparison,
  calculatePartialCellsAsFullOpenArea,
  calculateTopCutDepthMm,
  deriveIncisedSpanMetrics,
  derivePatternCompatibleModule,
  deriveSplitEdgeLamellaLayout,
  globalPatternColumnIndex,
  resolveLinarPanelFormat,
} from './linarGeometry.ts'

function approx(actual, expected, tolerance = 1e-6, label = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label || 'value'}: expected ${expected}, received ${actual}`,
  )
}

const topDepthCases = [
  [4, 1],
  [5, 1.1818181818181819],
  [10, 2.090909090909091],
  [15, 3],
]
for (const [thickness, expectedDepth] of topDepthCases) {
  approx(calculateTopCutDepthMm(thickness), expectedDepth, 1e-12, `top depth ${thickness}`)
  approx(
    calculateBridgeHeightMm(thickness),
    thickness - expectedDepth,
    1e-12,
    `bridge height ${thickness}`,
  )
}
approx(calculateTopCutDepthMm(-20), 1, 1e-12, 'lower clamp')
approx(calculateTopCutDepthMm(80), 3, 1e-12, 'upper clamp')

const cadCases = [
  [4, 38.2623],
  [5, 43.1763],
  [10, 63.8801],
  [15, 80.4812],
]
for (const [thickness, expectedSpan] of cadCases) {
  const geometry = calculateCadCutGeometryMm(thickness)
  approx(geometry.bridgeSpanMm, expectedSpan, 0.0001, `CAD span ${thickness}`)
  approx(cadBridgeProfileHeightMm(geometry, 0), 0, 1e-8, `CAD left entry ${thickness}`)
  approx(cadBridgeProfileHeightMm(geometry, 0.5), geometry.bridgeHeightMm, 1e-8, `CAD peak ${thickness}`)
  approx(cadBridgeProfileHeightMm(geometry, 1), 0, 1e-8, `CAD right entry ${thickness}`)
  // The spoil-board overcut is construction input only; remaining finished
  // wood is t - topDepth, never t - topDepth - 3.
  approx(
    geometry.bridgeHeightMm,
    thickness - calculateTopCutDepthMm(thickness),
    1e-12,
    `overcut exclusion ${thickness}`,
  )
}

assert.equal(LINAR_DOCUMENTED_PANEL_FORMATS.length, 5)
assert.equal(new Set(LINAR_DOCUMENTED_PANEL_FORMATS.map(({ id }) => id)).size, 5)
for (const format of LINAR_DOCUMENTED_PANEL_FORMATS) {
  assert.equal(format.manufacturer, 'CREATOP')
  assert.ok(format.fullLengthAmm > format.usableLengthCmm, `${format.id} length frame`)
  assert.ok(format.fullWidthBmm > format.usableWidthDmm, `${format.id} width frame`)
}
assert.equal(2800 * 1030, 2_884_000)
assert.equal(2750 * 892, 2_453_000)
assert.equal(2440 * 909, 2_217_960)
assert.equal(2390 * 764, 1_825_960)
assert.equal(2500 * 1250, 3_125_000)
assert.equal(2450 * 1148, 2_812_600)

const genericPlywood = resolveLinarPanelFormat({ material: 'plywood', thicknessMm: 9 })
assert.equal(genericPlywood.matchedDocumentedExample, false)
assert.equal(genericPlywood.format, null)
assert.equal(genericPlywood.targetUsableWidthMm, 1200)
assert.ok(genericPlywood.referenceFormats.some(({ id }) => id === 'birch-plywood-9'))

const modulationCases = [
  [4, 4, 1200],
  [5, 3, 1200],
  [2, 2, 1200],
  [2, 8, 1200],
  [8, 2, 1200],
  [8, 8, 1184],
]
for (const [cut, slat, expectedWidth] of modulationCases) {
  const module = derivePatternCompatibleModule(1200, cut, slat)
  assert.equal(module.widthMm, expectedWidth, `${cut}/${slat} module width`)
  assert.equal(module.columnCount % 2, 0, `${cut}/${slat} even phase columns`)
  assert.equal(module.phaseRepeatWidthMm, 2 * (cut + slat))
  const span = deriveIncisedSpanMetrics(module, cut, slat, 12)
  assert.equal(span.usesSplitEdgeLamellae, true)
  assert.equal(span.widthMm, module.widthMm)
  const lamellae = deriveSplitEdgeLamellaLayout(module, slat)
  assert.equal(lamellae.length, module.columnCount + 1)
  approx(lamellae[0].widthMm, slat / 2, 1e-12, `${cut}/${slat} left half`)
  approx(
    lamellae.at(-1).widthMm,
    slat / 2,
    1e-12,
    `${cut}/${slat} right half`,
  )
  for (let index = 0; index < lamellae.length - 1; index += 1) {
    const current = lamellae[index]
    const next = lamellae[index + 1]
    const currentRight = current.centreMm + current.widthMm * 0.5
    const nextLeft = next.centreMm - next.widthMm * 0.5
    approx(nextLeft - currentRight, cut, 1e-9, `${cut}/${slat} cut ${index}`)
  }

  // Translate a second module beside the first. The two boundary halves must
  // meet at exactly one plane and make a single full-width lamella: neither a
  // duplicate slat nor an omitted/solid seam cell can exist.
  const leftSeamHalf = lamellae.at(-1)
  const rightSeamHalf = lamellae[0]
  const leftHalfRight = leftSeamHalf.centreMm + leftSeamHalf.widthMm * 0.5
  const rightHalfLeft =
    module.widthMm + rightSeamHalf.centreMm - rightSeamHalf.widthMm * 0.5
  approx(leftHalfRight, module.widthMm * 0.5, 1e-9, `${cut}/${slat} seam left`)
  approx(rightHalfLeft, module.widthMm * 0.5, 1e-9, `${cut}/${slat} seam right`)
  approx(
    leftSeamHalf.widthMm + rightSeamHalf.widthMm,
    slat,
    1e-12,
    `${cut}/${slat} joined seam lamella`,
  )

  for (let count = 1; count <= 4; count += 1) {
    for (let moduleIndex = 0; moduleIndex < count - 1; moduleIndex += 1) {
      const finalColumn = globalPatternColumnIndex(
        moduleIndex,
        module.columnCount,
        module.columnCount - 1,
      )
      const nextColumn = globalPatternColumnIndex(
        moduleIndex + 1,
        module.columnCount,
        0,
      )
      assert.equal(nextColumn, finalColumn + 1, `${cut}/${slat} monotonic seam`)
      assert.notEqual(
        bridgePhaseForGlobalColumn(finalColumn),
        bridgePhaseForGlobalColumn(nextColumn),
        `${cut}/${slat} alternating seam phase`,
      )
    }
  }
}

// Final physical-sample seamless-modulation QA. The four Standard rows and
// the three explicitly requested non-4/4 samples are exercised as complete
// installed rows, not as isolated modules. Every case is checked at two and
// four panels so both a single join and a multi-join installation are covered.
const seamlessPhysicalSamples = [
  {
    label: 'Standard plywood 9 mm 4/4',
    cutWidthMm: 4,
    slatWidthMm: 4,
    incisionLengthMm: 70,
    bridgeLengthMm: 63,
  },
  {
    label: 'Standard MDF 8 mm 4/4',
    cutWidthMm: 4,
    slatWidthMm: 4,
    incisionLengthMm: 73,
    bridgeLengthMm: 62,
  },
  {
    label: 'Standard MDF 10 mm 4/4',
    cutWidthMm: 4,
    slatWidthMm: 4,
    incisionLengthMm: 66,
    bridgeLengthMm: 66,
  },
  {
    label: 'Standard 3-layer spruce 13 mm 4/4',
    cutWidthMm: 4,
    slatWidthMm: 4,
    incisionLengthMm: 70,
    bridgeLengthMm: 65,
  },
  {
    label: 'Physical sample plywood 4 mm 2/2',
    cutWidthMm: 2,
    slatWidthMm: 2,
    incisionLengthMm: 42,
    bridgeLengthMm: 20,
  },
  {
    label: 'Physical sample plywood 9 mm 3/3',
    cutWidthMm: 3,
    slatWidthMm: 3,
    incisionLengthMm: 72,
    bridgeLengthMm: 62,
  },
  {
    label: 'Physical sample MDF 8 mm 5/5',
    cutWidthMm: 5,
    slatWidthMm: 5,
    incisionLengthMm: 60,
    bridgeLengthMm: 55,
  },
]

function installedLamellaPieces(module, slatWidthMm, panelCount) {
  const local = deriveSplitEdgeLamellaLayout(module, slatWidthMm)
  return Array.from({ length: panelCount }, (_, moduleIndex) =>
    local.map((lamella) => ({
      moduleIndex,
      localIndex: lamella.index,
      leftMm:
        moduleIndex * module.widthMm + lamella.centreMm - lamella.widthMm * 0.5,
      rightMm:
        moduleIndex * module.widthMm + lamella.centreMm + lamella.widthMm * 0.5,
      widthMm: lamella.widthMm,
    })),
  )
    .flat()
    .sort((a, b) => a.leftMm - b.leftMm || a.rightMm - b.rightMm)
}

function mergeTouchingLamellaPieces(pieces, tolerance = 1e-9) {
  const merged = []
  for (const piece of pieces) {
    const previous = merged.at(-1)
    if (previous && Math.abs(piece.leftMm - previous.rightMm) <= tolerance) {
      previous.rightMm = piece.rightMm
      previous.pieceCount += 1
      continue
    }
    merged.push({
      leftMm: piece.leftMm,
      rightMm: piece.rightMm,
      pieceCount: 1,
    })
  }
  return merged
}

function assertSeamlessPhysicalInstallation(sample, panelCount) {
  const {
    label,
    cutWidthMm,
    slatWidthMm,
    incisionLengthMm,
    bridgeLengthMm,
  } = sample
  const caseLabel = `${label}, ${panelCount} panels`
  const module = derivePatternCompatibleModule(1200, cutWidthMm, slatWidthMm)
  const span = deriveIncisedSpanMetrics(
    module,
    cutWidthMm,
    slatWidthMm,
    12,
  )
  assert.equal(span.usesSplitEdgeLamellae, true, `${caseLabel}: split edges`)
  assert.equal(module.columnCount % 2, 0, `${caseLabel}: complete phase periods`)

  const localLamellae = deriveSplitEdgeLamellaLayout(module, slatWidthMm)
  const pieces = installedLamellaPieces(module, slatWidthMm, panelCount)

  // Adjacent module boundaries contain exactly two non-overlapping halves.
  // They meet on one plane and sum to one normal lamella, preventing both a
  // doubled slat and an omitted seam slat.
  for (let seamIndex = 1; seamIndex < panelCount; seamIndex += 1) {
    const seamMm = seamIndex * module.widthMm - module.widthMm * 0.5
    const leftHalf = pieces.find(
      (piece) =>
        piece.moduleIndex === seamIndex - 1 &&
        piece.localIndex === localLamellae.length - 1,
    )
    const rightHalf = pieces.find(
      (piece) => piece.moduleIndex === seamIndex && piece.localIndex === 0,
    )
    assert.ok(leftHalf, `${caseLabel}: seam ${seamIndex} left half exists`)
    assert.ok(rightHalf, `${caseLabel}: seam ${seamIndex} right half exists`)
    approx(leftHalf.rightMm, seamMm, 1e-9, `${caseLabel}: seam ${seamIndex} left plane`)
    approx(rightHalf.leftMm, seamMm, 1e-9, `${caseLabel}: seam ${seamIndex} right plane`)
    approx(leftHalf.widthMm, slatWidthMm * 0.5, 1e-12, `${caseLabel}: left half`)
    approx(rightHalf.widthMm, slatWidthMm * 0.5, 1e-12, `${caseLabel}: right half`)
    approx(
      leftHalf.widthMm + rightHalf.widthMm,
      slatWidthMm,
      1e-12,
      `${caseLabel}: joined seam lamella`,
    )
    assert.ok(
      rightHalf.leftMm >= leftHalf.rightMm - 1e-9,
      `${caseLabel}: seam ${seamIndex} has no lamella overlap`,
    )

    // The two cut cells adjacent to the seam continue the global column
    // sequence. Their bridge bands must take opposite vertical phases rather
    // than restarting the pattern at the new module.
    const leftGlobalColumn = globalPatternColumnIndex(
      seamIndex - 1,
      module.columnCount,
      module.columnCount - 1,
    )
    const rightGlobalColumn = globalPatternColumnIndex(
      seamIndex,
      module.columnCount,
      0,
    )
    assert.equal(
      rightGlobalColumn,
      leftGlobalColumn + 1,
      `${caseLabel}: seam ${seamIndex} has no omitted/double cut column`,
    )
    const leftPhase = bridgePhaseForGlobalColumn(leftGlobalColumn)
    const rightPhase = bridgePhaseForGlobalColumn(rightGlobalColumn)
    assert.notEqual(leftPhase, rightPhase, `${caseLabel}: seam ${seamIndex} phase`)
    const verticalRepeatMm = incisionLengthMm + bridgeLengthMm
    const leftPhaseOffsetMm = leftPhase * verticalRepeatMm * 0.5
    const rightPhaseOffsetMm = rightPhase * verticalRepeatMm * 0.5
    approx(
      Math.abs(rightPhaseOffsetMm - leftPhaseOffsetMm),
      verticalRepeatMm * 0.5,
      1e-12,
      `${caseLabel}: seam ${seamIndex} vertical step`,
    )
  }

  // Merge only the two touching edge halves at each seam. The resulting
  // installation must have one continuous lamella rhythm and one requested
  // cut width everywhere; a 2x gap would reveal a double cut and a zero gap
  // would reveal an omitted cut.
  const mergedLamellae = mergeTouchingLamellaPieces(pieces)
  assert.equal(
    mergedLamellae.length,
    panelCount * module.columnCount + 1,
    `${caseLabel}: unique lamella count`,
  )
  for (let index = 0; index < mergedLamellae.length; index += 1) {
    const lamella = mergedLamellae[index]
    const expectedWidthMm =
      index === 0 || index === mergedLamellae.length - 1
        ? slatWidthMm * 0.5
        : slatWidthMm
    approx(
      lamella.rightMm - lamella.leftMm,
      expectedWidthMm,
      1e-9,
      `${caseLabel}: lamella ${index} width`,
    )
    if (index > 0) {
      approx(
        lamella.leftMm - mergedLamellae[index - 1].rightMm,
        cutWidthMm,
        1e-9,
        `${caseLabel}: cut ${index - 1} width`,
      )
    }
  }
  assert.equal(
    mergedLamellae.filter(({ pieceCount }) => pieceCount === 2).length,
    panelCount - 1,
    `${caseLabel}: one joined lamella per seam`,
  )

  // The measured bridge bands for these requested QA samples are no taller
  // than half a vertical repeat. Opposing phase bands therefore do not overlap
  // across either a normal pitch or a panel seam (MDF 10 mm meets exactly).
  const halfVerticalRepeatMm = (incisionLengthMm + bridgeLengthMm) * 0.5
  const alternatingBridgeOverlapMm = Math.max(
    0,
    bridgeLengthMm - halfVerticalRepeatMm,
  )
  approx(
    alternatingBridgeOverlapMm,
    0,
    1e-12,
    `${caseLabel}: alternating vertical bridge overlap`,
  )

  // Every renderer column can be reconstructed as one monotonic global
  // sequence. This catches a phase jump anywhere in a four-panel row, not
  // only immediately around the seam planes.
  let previousGlobalColumn = null
  let previousPhase = null
  for (let moduleIndex = 0; moduleIndex < panelCount; moduleIndex += 1) {
    for (let localColumn = 0; localColumn < module.columnCount; localColumn += 1) {
      const globalColumn = globalPatternColumnIndex(
        moduleIndex,
        module.columnCount,
        localColumn,
      )
      const phase = bridgePhaseForGlobalColumn(globalColumn)
      if (previousGlobalColumn != null) {
        assert.equal(
          globalColumn,
          previousGlobalColumn + 1,
          `${caseLabel}: global pitch sequence`,
        )
        assert.notEqual(phase, previousPhase, `${caseLabel}: global phase sequence`)
      }
      previousGlobalColumn = globalColumn
      previousPhase = phase
    }
  }
}

for (const sample of seamlessPhysicalSamples) {
  for (const panelCount of [2, 4]) {
    assertSeamlessPhysicalInstallation(sample, panelCount)
  }
}

const openModule = derivePatternCompatibleModule(1200, 4, 4)
for (const twelfths of [1, 6, 12]) {
  const span = deriveIncisedSpanMetrics(openModule, 4, 4, twelfths)
  const result = calculateLinarOpenAreaResult({
    cutWidthMm: 4,
    slatWidthMm: 4,
    incisionLengthMm: 40,
    bridgeLengthMm: 60,
    incisedWidthMm: span.widthMm,
    moduleWidthMm: openModule.widthMm,
    moduleHeightMm: 2800,
  })
  approx(result.incisedAreaPercent, 20, 1e-12, `open incised ${twelfths}`)
  approx(
    result.installationModulePercent,
    20 * span.actualCoverageFraction,
    1e-12,
    `open module ${twelfths}`,
  )
  assert.equal(result.incisedDenominatorId, 'selected-incised-area')
  assert.equal(
    result.installationDenominatorId,
    'displayed-trimmed-installation-module',
  )
  assert.equal(result.edgeCellStatus, 'provisional')
}

const alignedEdgeInput = {
  cutWidthMm: 4,
  slatWidthMm: 4,
  incisionLengthMm: 40,
  bridgeLengthMm: 60,
  panelWidthMm: 16,
  panelHeightMm: 200,
  selectedArea: { xMm: 0, yMm: 0, widthMm: 16, heightMm: 200 },
  staggerOffsetMm: 0,
}
const alignedComparison = calculateOpenAreaEdgeComparison(alignedEdgeInput)
for (const result of Object.values(alignedComparison)) {
  assert.equal(result.completeCellCount, 4, `${result.mode} aligned complete cells`)
  assert.equal(result.partialCellCount, 0, `${result.mode} aligned partial cells`)
  assert.equal(result.openingAreaMm2, 640, `${result.mode} aligned opening area`)
  approx(result.openAreaWithinIncisedPercent, 20, 1e-12, `${result.mode} aligned incised`)
  approx(
    result.openAreaWithinCompletePanelPercent,
    20,
    1e-12,
    `${result.mode} aligned panel`,
  )
}

// A half-pitch horizontal boundary crosses one opening and one lamella-only
// portion. This is the compact regression witness for partial opening/lamella
// treatment without vertical staggering.
const halfPitchInput = {
  ...alignedEdgeInput,
  panelWidthMm: 16,
  panelHeightMm: 100,
  selectedArea: { xMm: 4, yMm: 0, widthMm: 8, heightMm: 100 },
}
const halfPitchExact = calculateExactClippedOpenArea(halfPitchInput)
const halfPitchFull = calculateFullCellsOnlyOpenArea(halfPitchInput)
const halfPitchInflated = calculatePartialCellsAsFullOpenArea(halfPitchInput)
assert.equal(halfPitchExact.completeCellCount, 0)
assert.equal(halfPitchExact.partialCellCount, 2)
assert.equal(halfPitchExact.openingAreaMm2, 160)
assert.equal(halfPitchFull.openingAreaMm2, 0)
assert.equal(halfPitchInflated.openingAreaMm2, 320)

// Shift a full-height selection through the opening itself. Both edge cells
// contribute clipped openings, while neither pitch cell is complete.
const partialOpening = calculateExactClippedOpenArea({
  ...halfPitchInput,
  selectedArea: { xMm: 6, yMm: 0, widthMm: 8, heightMm: 100 },
})
assert.equal(partialOpening.completeCellCount, 0)
assert.equal(partialOpening.partialCellCount, 2)
assert.deepEqual(
  partialOpening.cells.map(({ clippedOpeningAreaMm2 }) => clippedOpeningAreaMm2),
  [80, 80],
)

// A boundary through two bridge rows clips 30 mm from one opening and 10 mm
// from the next: (30 + 10) * 4 mm = 160 mm2.
const partialBridgeRows = calculateExactClippedOpenArea({
  ...halfPitchInput,
  panelHeightMm: 200,
  selectedArea: { xMm: 0, yMm: 70, widthMm: 8, heightMm: 100 },
})
assert.equal(partialBridgeRows.completeCellCount, 0)
assert.equal(partialBridgeRows.partialCellCount, 2)
assert.equal(partialBridgeRows.openingAreaMm2, 160)

// Deterministic client-review specimen: centred partial coverage over a
// staggered 4/4 pattern. These values are mirrored in the review document.
const clientReviewInput = {
  cutWidthMm: 4,
  slatWidthMm: 4,
  incisionLengthMm: 40,
  bridgeLengthMm: 60,
  panelWidthMm: 64,
  panelHeightMm: 200,
  selectedArea: { xMm: 9, yMm: 25, widthMm: 46, heightMm: 150 },
}
const clientReview = calculateOpenAreaEdgeComparison(clientReviewInput)
for (const result of Object.values(clientReview)) {
  assert.equal(result.completeCellCount, 2, `${result.mode} review complete cells`)
  assert.equal(result.partialCellCount, 13, `${result.mode} review partial cells`)
  assert.equal(result.intersectedCellCount, 15, `${result.mode} review intersected cells`)
  assert.equal(result.authority, 'development-comparison')
}
assert.equal(clientReview['exact-clipped'].countedCellCount, 12)
assert.equal(clientReview['exact-clipped'].openingAreaMm2, 1385)
approx(clientReview['exact-clipped'].openAreaWithinIncisedPercent, 20.0724637681, 1e-9)
approx(clientReview['exact-clipped'].openAreaWithinCompletePanelPercent, 10.8203125, 1e-9)
assert.equal(clientReview['full-cells-only'].countedCellCount, 2)
assert.equal(clientReview['full-cells-only'].openingAreaMm2, 320)
approx(clientReview['full-cells-only'].openAreaWithinIncisedPercent, 4.63768115942, 1e-9)
approx(clientReview['full-cells-only'].openAreaWithinCompletePanelPercent, 2.5, 1e-9)
assert.equal(clientReview['partial-counted-as-full'].countedCellCount, 15)
assert.equal(clientReview['partial-counted-as-full'].openingAreaMm2, 2400)
approx(
  clientReview['partial-counted-as-full'].openAreaWithinIncisedPercent,
  34.7826086957,
  1e-9,
)
approx(clientReview['partial-counted-as-full'].openAreaWithinCompletePanelPercent, 18.75, 1e-9)

assert.throws(
  () => calculateExactClippedOpenArea({ ...clientReviewInput, cutWidthMm: 0 }),
  /cutWidthMm must be greater than zero/,
)

console.log('LINAR geometry/data regression checks passed.')
