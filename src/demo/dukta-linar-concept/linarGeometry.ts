import type { LinarMaterialId } from './types'

/**
 * Pure LINAR geometry/data helpers.
 *
 * This module intentionally has no Three.js or browser dependency. It is the
 * single numerical authority shared by the renderer, information panel and
 * regression tests. Confidential source CAD is never bundled with the demo.
 */

export const LINAR_SAW_BLADE_DIAMETER_MM = 125
export const LINAR_SAW_BLADE_RADIUS_MM = LINAR_SAW_BLADE_DIAMETER_MM / 2
export const LINAR_BOTTOM_OVER_CUT_MM = 3

export const REPRESENTATIVE_PANEL_HEIGHT_MM = 2800
export const REPRESENTATIVE_PANEL_WIDTH_MM = 1200

export type LinarAuthorityStatus = 'validated' | 'provisional' | 'unavailable'
export type LinarAuthorityKind =
  | 'client-confirmed'
  | 'cad-derived'
  | 'physical-sample'
  | 'manufacturer-price-list'
  | 'application-manual'
  | 'brochure-reference'
  | 'simulator-interpolation'
  | 'provisional'
  | 'not-tested'

export type LinarDataAuthority = {
  authorities: readonly LinarAuthorityKind[]
  status: LinarAuthorityStatus
  label: string
  source: string
  note?: string
}

export const TOP_CUT_AUTHORITY: LinarDataAuthority = {
  authorities: ['client-confirmed', 'simulator-interpolation'],
  status: 'validated',
  label: 'Approved interpolation',
  source: 'Client data addendum, 1 September 2026',
}

export const CAD_CUT_AUTHORITY: LinarDataAuthority = {
  authorities: ['cad-derived'],
  status: 'validated',
  label: 'CAD-derived cutting curve',
  source: 'Confidential LINAR DXF/STEP supplied 1 September 2026',
  note: 'Numerical derivatives only; source CAD is not distributed with the demo.',
}

export const PANEL_FORMAT_AUTHORITY: LinarDataAuthority = {
  authorities: ['manufacturer-price-list'],
  status: 'validated',
  label: 'Documented example format',
  source: 'CREATOP 2025 manufacturer price list',
  note: 'Example format only; LINAR has no universal panel size.',
}

export const REPRESENTATIVE_FORMAT_AUTHORITY: LinarDataAuthority = {
  authorities: ['provisional'],
  status: 'provisional',
  label: 'Representative visualisation format',
  source: 'Existing LINAR configurator presentation size',
  note: 'Actual full and usable dimensions vary by material and production order.',
}

export function clampLinarThicknessMm(thicknessMm: number): number {
  return Math.min(15, Math.max(4, thicknessMm))
}

/** Approved global interpolation: 4 mm -> 1 mm and 15 mm -> 3 mm. */
export function calculateTopCutDepthMm(thicknessMm: number): number {
  const t = clampLinarThicknessMm(thicknessMm)
  return 1 + ((t - 4) / 11) * 2
}

/** Remaining finished wood between the rear face and deepest top-side cut. */
export function calculateBridgeHeightMm(thicknessMm: number): number {
  const t = clampLinarThicknessMm(thicknessMm)
  return Math.max(0, t - calculateTopCutDepthMm(t))
}

export type LinarCadCutGeometry = {
  thicknessMm: number
  topCutDepthMm: number
  bridgeHeightMm: number
  bottomOverCutMm: number
  bladeRadiusMm: number
  /** Distance between two neighbouring lower/perforating-cut circle centres. */
  centrePitchMm: number
  /** Rear-face entry measured from either lower-circle centre. */
  rearEntryOffsetMm: number
  /** Remaining bridge span between the two rear-face entry points. */
  bridgeSpanMm: number
  leftEntryXmm: number
  leftTangencyXmm: number
  middlePeakXmm: number
  rightTangencyXmm: number
  rightEntryXmm: number
  lowerCircleCentreYmm: number
  upperCircleCentreYmm: number
}

/**
 * Reconstruct the exact three-arc section encoded by the supplied 125 mm CAD.
 * Coordinates use the finished rear face as y=0 and the front face as y=t.
 * The 3 mm value is an over-cut into the spoil board, not removed thickness.
 */
export function calculateCadCutGeometryMm(thicknessMm: number): LinarCadCutGeometry {
  const thickness = clampLinarThicknessMm(thicknessMm)
  const topCutDepthMm = calculateTopCutDepthMm(thickness)
  const bridgeHeightMm = thickness - topCutDepthMm
  const radius = LINAR_SAW_BLADE_RADIUS_MM
  const bottomOverCutMm = LINAR_BOTTOM_OVER_CUT_MM
  const lowerCircleCentreYmm = radius - bottomOverCutMm
  const upperCircleCentreYmm = bridgeHeightMm - radius
  const centreSeparationYmm = lowerCircleCentreYmm - upperCircleCentreYmm
  const centrePitchMm = Math.sqrt(
    Math.max(0, (radius * 2) ** 2 - centreSeparationYmm ** 2),
  )
  const rearEntryOffsetMm = Math.sqrt(
    Math.max(0, radius ** 2 - lowerCircleCentreYmm ** 2),
  )
  const bridgeSpanMm = Math.max(0, centrePitchMm * 2 - rearEntryOffsetMm * 2)

  return {
    thicknessMm: thickness,
    topCutDepthMm,
    bridgeHeightMm,
    bottomOverCutMm,
    bladeRadiusMm: radius,
    centrePitchMm,
    rearEntryOffsetMm,
    bridgeSpanMm,
    leftEntryXmm: rearEntryOffsetMm,
    leftTangencyXmm: centrePitchMm * 0.5,
    middlePeakXmm: centrePitchMm,
    rightTangencyXmm: centrePitchMm * 1.5,
    rightEntryXmm: centrePitchMm * 2 - rearEntryOffsetMm,
    lowerCircleCentreYmm,
    upperCircleCentreYmm,
  }
}

/**
 * Remaining wood height on the CAD bridge face at a normalised span position.
 * The result is continuous and tangent-continuous at both circle handovers.
 */
export function cadBridgeProfileHeightMm(
  geometry: LinarCadCutGeometry,
  normalisedPosition: number,
): number {
  const u = Math.min(1, Math.max(0, normalisedPosition))
  const x = geometry.leftEntryXmm + geometry.bridgeSpanMm * u
  const r = geometry.bladeRadiusMm
  const lowerY = geometry.lowerCircleCentreYmm
  const upperY = geometry.upperCircleCentreYmm
  const pitch = geometry.centrePitchMm

  if (x <= geometry.leftTangencyXmm) {
    return Math.max(0, lowerY - Math.sqrt(Math.max(0, r ** 2 - x ** 2)))
  }
  if (x <= geometry.rightTangencyXmm) {
    return Math.max(
      0,
      upperY + Math.sqrt(Math.max(0, r ** 2 - (x - pitch) ** 2)),
    )
  }
  return Math.max(
    0,
    lowerY - Math.sqrt(Math.max(0, r ** 2 - (x - pitch * 2) ** 2)),
  )
}

export type LinarPanelFormat = {
  id: string
  label: string
  manufacturer: 'CREATOP'
  material: LinarMaterialId
  thicknessMm: number
  /** Untrimmed production blank, including the cutting frame. */
  fullLengthAmm: number
  fullWidthBmm: number
  /** Trimmed, incised installation area before repeat-period reconciliation. */
  usableLengthCmm: number
  usableWidthDmm: number
  note?: string
}

export const LINAR_DOCUMENTED_PANEL_FORMATS: readonly LinarPanelFormat[] = [
  {
    id: 'mdf-10',
    label: 'MDF 10 mm example',
    manufacturer: 'CREATOP',
    material: 'mdf',
    thicknessMm: 10,
    fullLengthAmm: 2800,
    fullWidthBmm: 1030,
    usableLengthCmm: 2750,
    usableWidthDmm: 892,
  },
  {
    id: 'mdf-valchromat-8',
    label: 'MDF Valchromat 8 mm example',
    manufacturer: 'CREATOP',
    material: 'mdf',
    thicknessMm: 8,
    fullLengthAmm: 2440,
    fullWidthBmm: 909,
    usableLengthCmm: 2390,
    usableWidthDmm: 764,
    note: 'Valchromat identity is not represented by the current generic MDF selector.',
  },
  {
    id: 'birch-plywood-9',
    label: 'Birch plywood 9 mm example',
    manufacturer: 'CREATOP',
    material: 'plywood',
    thicknessMm: 9,
    fullLengthAmm: 2500,
    fullWidthBmm: 1250,
    usableLengthCmm: 2450,
    usableWidthDmm: 1148,
  },
  {
    id: 'birch-plywood-10',
    label: 'Birch plywood 10 mm example',
    manufacturer: 'CREATOP',
    material: 'plywood',
    thicknessMm: 10,
    fullLengthAmm: 2500,
    fullWidthBmm: 1250,
    usableLengthCmm: 2450,
    usableWidthDmm: 1148,
  },
  {
    id: 'three-layer-spruce-13',
    label: '3-layer spruce 13 mm example',
    manufacturer: 'CREATOP',
    material: 'three-layer-spruce',
    thicknessMm: 13,
    fullLengthAmm: 2500,
    fullWidthBmm: 1250,
    usableLengthCmm: 2450,
    usableWidthDmm: 1148,
  },
]

export type ResolvedLinarPanelFormat = {
  format: LinarPanelFormat | null
  matchedDocumentedExample: boolean
  referenceFormats: readonly LinarPanelFormat[]
  renderHeightMm: number
  targetUsableWidthMm: number
  authority: LinarDataAuthority
}

export function resolveLinarPanelFormat(input: {
  material: LinarMaterialId
  thicknessMm: number
}): ResolvedLinarPanelFormat {
  const referenceFormats = LINAR_DOCUMENTED_PANEL_FORMATS.filter(
    (format) =>
      format.material === input.material &&
      format.thicknessMm === input.thicknessMm,
  )
  // The price-list rows are examples, not a declared mapping from the generic
  // configurator material selector to one current production format. Keep the
  // simulator representative until an exact product/format choice exists.
  return {
    format: null,
    matchedDocumentedExample: false,
    referenceFormats,
    renderHeightMm: REPRESENTATIVE_PANEL_HEIGHT_MM,
    targetUsableWidthMm: REPRESENTATIVE_PANEL_WIDTH_MM,
    authority: REPRESENTATIVE_FORMAT_AUTHORITY,
  }
}

export type PatternCompatibleModule = {
  targetWidthMm: number
  widthMm: number
  deviationMm: number
  basePitchMm: number
  phaseRepeatColumns: number
  phaseRepeatWidthMm: number
  phaseRepeatCount: number
  columnCount: number
}

export type IncisedSpanMetrics = {
  requestedCoverageFraction: number
  actualCoverageFraction: number
  widthMm: number
  slatCount: number
  columnCount: number
  usesSplitEdgeLamellae: boolean
}

export type SplitEdgeLamella = {
  centreMm: number
  widthMm: number
  index: number
}

export type LinarOpenAreaResult = {
  actualOpeningAreaMm2: number
  incisedAreaMm2: number
  installationModuleAreaMm2: number
  incisedAreaPercent: number
  installationModulePercent: number
  incisedDenominatorId: 'selected-incised-area'
  installationDenominatorId: 'displayed-trimmed-installation-module'
  method: 'whole-cells'
  edgeCellStatus: 'provisional'
}

/**
 * Development-only alternatives for reviewing how pitch cells intersecting an
 * incised-area boundary affect open-area figures. None of these modes is a
 * manufacturer-approved edge convention yet.
 */
export type OpenAreaEdgeMode =
  | 'exact-clipped'
  | 'full-cells-only'
  | 'partial-counted-as-full'

export type LinarPlanRectangle = {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export type LinarOpenAreaEdgeComparisonInput = {
  cutWidthMm: number
  slatWidthMm: number
  incisionLengthMm: number
  bridgeLengthMm: number
  panelWidthMm: number
  panelHeightMm: number
  selectedArea: LinarPlanRectangle
  /** Left edge of pitch column zero. The lamella occupies the first part. */
  patternOriginXmm?: number
  /** Start of the bridge portion in row zero for even pitch columns. */
  patternOriginYmm?: number
  /** Defaults to half the incision/bridge period, matching LINAR staggering. */
  staggerOffsetMm?: number
}

export type LinarOpenAreaEdgeCell = {
  columnIndex: number
  rowIndex: number
  classification: 'complete' | 'partial'
  cell: LinarPlanRectangle
  opening: LinarPlanRectangle
  clippedOpeningAreaMm2: number
}

export type LinarOpenAreaEdgeResult = {
  mode: OpenAreaEdgeMode
  selectedArea: LinarPlanRectangle
  completeCellCount: number
  partialCellCount: number
  intersectedCellCount: number
  countedCellCount: number
  fullOpeningAreaPerCellMm2: number
  openingAreaMm2: number
  selectedIncisedAreaMm2: number
  completePanelAreaMm2: number
  openAreaWithinIncisedPercent: number
  openAreaWithinCompletePanelPercent: number
  cells: readonly LinarOpenAreaEdgeCell[]
  authority: 'development-comparison'
}

const OPEN_AREA_EDGE_EPSILON = 1e-9

function requireFinite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`)
  return value
}

function requirePositive(name: string, value: number): number {
  const finiteValue = requireFinite(name, value)
  if (finiteValue <= 0) throw new RangeError(`${name} must be greater than zero.`)
  return finiteValue
}

function rectangleIntersection(
  a: LinarPlanRectangle,
  b: LinarPlanRectangle,
): LinarPlanRectangle | null {
  const left = Math.max(a.xMm, b.xMm)
  const top = Math.max(a.yMm, b.yMm)
  const right = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm)
  const bottom = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm)
  if (right - left <= OPEN_AREA_EDGE_EPSILON || bottom - top <= OPEN_AREA_EDGE_EPSILON) {
    return null
  }
  return { xMm: left, yMm: top, widthMm: right - left, heightMm: bottom - top }
}

function rectangleArea(rectangle: LinarPlanRectangle | null): number {
  return rectangle == null ? 0 : rectangle.widthMm * rectangle.heightMm
}

function containsRectangle(
  outer: LinarPlanRectangle,
  inner: LinarPlanRectangle,
): boolean {
  return (
    inner.xMm >= outer.xMm - OPEN_AREA_EDGE_EPSILON &&
    inner.yMm >= outer.yMm - OPEN_AREA_EDGE_EPSILON &&
    inner.xMm + inner.widthMm <= outer.xMm + outer.widthMm + OPEN_AREA_EDGE_EPSILON &&
    inner.yMm + inner.heightMm <= outer.yMm + outer.heightMm + OPEN_AREA_EDGE_EPSILON
  )
}

function analyseOpenAreaEdgeCells(input: LinarOpenAreaEdgeComparisonInput): {
  selectedArea: LinarPlanRectangle
  cells: LinarOpenAreaEdgeCell[]
  fullOpeningAreaPerCellMm2: number
  selectedIncisedAreaMm2: number
  completePanelAreaMm2: number
} {
  const cutWidthMm = requirePositive('cutWidthMm', input.cutWidthMm)
  const slatWidthMm = requirePositive('slatWidthMm', input.slatWidthMm)
  const incisionLengthMm = requirePositive('incisionLengthMm', input.incisionLengthMm)
  const bridgeLengthMm = requirePositive('bridgeLengthMm', input.bridgeLengthMm)
  const panelWidthMm = requirePositive('panelWidthMm', input.panelWidthMm)
  const panelHeightMm = requirePositive('panelHeightMm', input.panelHeightMm)
  const requestedArea: LinarPlanRectangle = {
    xMm: requireFinite('selectedArea.xMm', input.selectedArea.xMm),
    yMm: requireFinite('selectedArea.yMm', input.selectedArea.yMm),
    widthMm: requirePositive('selectedArea.widthMm', input.selectedArea.widthMm),
    heightMm: requirePositive('selectedArea.heightMm', input.selectedArea.heightMm),
  }
  const panelArea: LinarPlanRectangle = {
    xMm: 0,
    yMm: 0,
    widthMm: panelWidthMm,
    heightMm: panelHeightMm,
  }
  const selectedArea = rectangleIntersection(requestedArea, panelArea) ?? {
    xMm: Math.min(panelWidthMm, Math.max(0, requestedArea.xMm)),
    yMm: Math.min(panelHeightMm, Math.max(0, requestedArea.yMm)),
    widthMm: 0,
    heightMm: 0,
  }
  const selectedIncisedAreaMm2 = rectangleArea(selectedArea)
  const completePanelAreaMm2 = panelWidthMm * panelHeightMm
  const fullOpeningAreaPerCellMm2 = cutWidthMm * incisionLengthMm
  if (selectedIncisedAreaMm2 === 0) {
    return {
      selectedArea,
      cells: [],
      fullOpeningAreaPerCellMm2,
      selectedIncisedAreaMm2,
      completePanelAreaMm2,
    }
  }

  const pitchXmm = cutWidthMm + slatWidthMm
  const pitchYmm = incisionLengthMm + bridgeLengthMm
  const patternOriginXmm = requireFinite(
    'patternOriginXmm',
    input.patternOriginXmm ?? 0,
  )
  const patternOriginYmm = requireFinite(
    'patternOriginYmm',
    input.patternOriginYmm ?? 0,
  )
  const staggerOffsetMm = requireFinite(
    'staggerOffsetMm',
    input.staggerOffsetMm ?? pitchYmm * 0.5,
  )
  const selectedRight = selectedArea.xMm + selectedArea.widthMm
  const selectedBottom = selectedArea.yMm + selectedArea.heightMm
  const firstColumn = Math.floor((selectedArea.xMm - patternOriginXmm) / pitchXmm) - 1
  const lastColumn = Math.ceil((selectedRight - patternOriginXmm) / pitchXmm) + 1
  const cells: LinarOpenAreaEdgeCell[] = []

  for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
    const cellXmm = patternOriginXmm + columnIndex * pitchXmm
    const phaseIndex = Math.abs(columnIndex) % 2
    const columnOriginYmm = patternOriginYmm + phaseIndex * staggerOffsetMm
    const firstRow = Math.floor((selectedArea.yMm - columnOriginYmm) / pitchYmm) - 1
    const lastRow = Math.ceil((selectedBottom - columnOriginYmm) / pitchYmm) + 1

    for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
      const cell: LinarPlanRectangle = {
        xMm: cellXmm,
        yMm: columnOriginYmm + rowIndex * pitchYmm,
        widthMm: pitchXmm,
        heightMm: pitchYmm,
      }
      if (rectangleIntersection(cell, selectedArea) == null) continue
      const opening: LinarPlanRectangle = {
        xMm: cell.xMm + slatWidthMm,
        yMm: cell.yMm + bridgeLengthMm,
        widthMm: cutWidthMm,
        heightMm: incisionLengthMm,
      }
      cells.push({
        columnIndex,
        rowIndex,
        classification: containsRectangle(selectedArea, cell) ? 'complete' : 'partial',
        cell,
        opening,
        clippedOpeningAreaMm2: rectangleArea(rectangleIntersection(opening, selectedArea)),
      })
    }
  }

  cells.sort(
    (a, b) => a.columnIndex - b.columnIndex || a.rowIndex - b.rowIndex,
  )
  return {
    selectedArea,
    cells,
    fullOpeningAreaPerCellMm2,
    selectedIncisedAreaMm2,
    completePanelAreaMm2,
  }
}

/** Actual visible opening area after clipping every generated opening. */
export function calculateExactClippedOpenArea(
  input: LinarOpenAreaEdgeComparisonInput,
): LinarOpenAreaEdgeResult {
  return calculateOpenAreaEdgeMode(input, 'exact-clipped')
}

/** Opening area from only pitch cells wholly contained by the selected area. */
export function calculateFullCellsOnlyOpenArea(
  input: LinarOpenAreaEdgeComparisonInput,
): LinarOpenAreaEdgeResult {
  return calculateOpenAreaEdgeMode(input, 'full-cells-only')
}

/** Comparison-only overestimate: every intersected pitch cell counts in full. */
export function calculatePartialCellsAsFullOpenArea(
  input: LinarOpenAreaEdgeComparisonInput,
): LinarOpenAreaEdgeResult {
  return calculateOpenAreaEdgeMode(input, 'partial-counted-as-full')
}

export function calculateOpenAreaEdgeMode(
  input: LinarOpenAreaEdgeComparisonInput,
  mode: OpenAreaEdgeMode,
): LinarOpenAreaEdgeResult {
  const analysis = analyseOpenAreaEdgeCells(input)
  const completeCellCount = analysis.cells.filter(
    (cell) => cell.classification === 'complete',
  ).length
  const partialCellCount = analysis.cells.length - completeCellCount
  const clippedOpeningAreaMm2 = analysis.cells.reduce(
    (total, cell) => total + cell.clippedOpeningAreaMm2,
    0,
  )
  const countedCellCount =
    mode === 'full-cells-only'
      ? completeCellCount
      : mode === 'partial-counted-as-full'
        ? analysis.cells.length
        : analysis.cells.filter(
            (cell) => cell.clippedOpeningAreaMm2 > OPEN_AREA_EDGE_EPSILON,
          ).length
  const openingAreaMm2 =
    mode === 'exact-clipped'
      ? clippedOpeningAreaMm2
      : countedCellCount * analysis.fullOpeningAreaPerCellMm2

  return {
    mode,
    selectedArea: analysis.selectedArea,
    completeCellCount,
    partialCellCount,
    intersectedCellCount: analysis.cells.length,
    countedCellCount,
    fullOpeningAreaPerCellMm2: analysis.fullOpeningAreaPerCellMm2,
    openingAreaMm2,
    selectedIncisedAreaMm2: analysis.selectedIncisedAreaMm2,
    completePanelAreaMm2: analysis.completePanelAreaMm2,
    openAreaWithinIncisedPercent:
      analysis.selectedIncisedAreaMm2 > 0
        ? (openingAreaMm2 / analysis.selectedIncisedAreaMm2) * 100
        : 0,
    openAreaWithinCompletePanelPercent:
      analysis.completePanelAreaMm2 > 0
        ? (openingAreaMm2 / analysis.completePanelAreaMm2) * 100
        : 0,
    cells: analysis.cells,
    authority: 'development-comparison',
  }
}

export function calculateOpenAreaEdgeComparison(
  input: LinarOpenAreaEdgeComparisonInput,
): Record<OpenAreaEdgeMode, LinarOpenAreaEdgeResult> {
  return {
    'exact-clipped': calculateExactClippedOpenArea(input),
    'full-cells-only': calculateFullCellsOnlyOpenArea(input),
    'partial-counted-as-full': calculatePartialCellsAsFullOpenArea(input),
  }
}

/**
 * Reconcile a target usable width to complete bridge-phase periods. The
 * official alternating bridge layout repeats after two incision columns.
 */
export function derivePatternCompatibleModule(
  targetWidthMm: number,
  cutWidthMm: number,
  slatWidthMm: number,
  phaseRepeatColumns = 2,
): PatternCompatibleModule {
  const basePitchMm = Math.max(0.001, cutWidthMm + slatWidthMm)
  const columnsPerPhase = Math.max(1, Math.round(phaseRepeatColumns))
  const phaseRepeatWidthMm = basePitchMm * columnsPerPhase
  // A documented usable width is an available trimmed area, not a request to
  // grow beyond the production blank. Keep the closest complete phase count
  // that fits inside it. This also resolves equal-distance ties by trimming.
  const phaseRepeatCount = Math.max(1, Math.floor(targetWidthMm / phaseRepeatWidthMm))
  const columnCount = phaseRepeatCount * columnsPerPhase
  const widthMm = columnCount * basePitchMm
  return {
    targetWidthMm,
    widthMm,
    deviationMm: widthMm - targetWidthMm,
    basePitchMm,
    phaseRepeatColumns: columnsPerPhase,
    phaseRepeatWidthMm,
    phaseRepeatCount,
    columnCount,
  }
}

export function globalPatternColumnIndex(
  moduleIndex: number,
  columnsPerModule: number,
  localColumn: number,
): number {
  return Math.max(0, Math.round(moduleIndex)) * Math.max(1, Math.round(columnsPerModule)) +
    Math.max(0, Math.round(localColumn))
}

export function bridgePhaseForGlobalColumn(globalColumn: number): 0 | 1 {
  return Math.abs(Math.round(globalColumn)) % 2 === 0 ? 0 : 1
}

/**
 * Resolve the centred incised strip independently from the production cutting
 * frame. A fully incised installed module uses split edge lamellae so adjacent
 * modules join into one continuous lamella; partial coverage retains explicit
 * solid side zones and therefore uses complete boundary lamellae.
 */
export function deriveIncisedSpanMetrics(
  module: PatternCompatibleModule,
  cutWidthMm: number,
  slatWidthMm: number,
  incisedTwelfths: number,
): IncisedSpanMetrics {
  const requestedCoverageFraction = Math.min(12, Math.max(1, incisedTwelfths)) / 12
  if (incisedTwelfths >= 12) {
    return {
      requestedCoverageFraction: 1,
      actualCoverageFraction: 1,
      widthMm: module.widthMm,
      slatCount: module.columnCount + 1,
      columnCount: module.columnCount,
      usesSplitEdgeLamellae: true,
    }
  }

  const pitchMm = Math.max(0.001, cutWidthMm + slatWidthMm)
  const requestedWidthMm = module.widthMm * requestedCoverageFraction
  const maxSlatCount = Math.max(2, Math.floor((module.widthMm + cutWidthMm) / pitchMm))
  const slatCount = Math.max(
    2,
    Math.min(maxSlatCount, Math.round((requestedWidthMm + cutWidthMm) / pitchMm)),
  )
  const widthMm = Math.max(slatWidthMm, slatCount * pitchMm - cutWidthMm)
  return {
    requestedCoverageFraction,
    actualCoverageFraction: widthMm / module.widthMm,
    widthMm,
    slatCount,
    columnCount: slatCount - 1,
    usesSplitEdgeLamellae: false,
  }
}

/**
 * Return the exact full-coverage lamella layout used by the renderer.
 *
 * The installed-module boundary runs through the centre of a lamella. Each
 * module therefore owns one half-width lamella at either edge. Two adjacent
 * modules meet without overlap or a gap and their two halves read as one
 * normal lamella; all incision cells between lamellae retain the requested
 * cut width.
 */
export function deriveSplitEdgeLamellaLayout(
  module: PatternCompatibleModule,
  slatWidthMm: number,
): SplitEdgeLamella[] {
  const widthMm = Math.max(0.001, module.widthMm)
  const lamellaWidthMm = Math.max(0.001, slatWidthMm)
  const left = -widthMm * 0.5
  const right = widthMm * 0.5
  const count = module.columnCount + 1

  return Array.from({ length: count }, (_, index) => {
    const first = index === 0
    const last = index === count - 1
    return {
      centreMm: first
        ? left + lamellaWidthMm * 0.25
        : last
          ? right - lamellaWidthMm * 0.25
          : left + index * module.basePitchMm,
      widthMm: first || last ? lamellaWidthMm * 0.5 : lamellaWidthMm,
      index,
    }
  })
}

/**
 * Whole-cycle open-area architecture with explicit denominators. The official
 * clipped-edge-cell convention is unresolved, so this result is deliberately
 * marked provisional instead of presenting generated edge fragments as fact.
 */
export function calculateLinarOpenAreaResult(input: {
  cutWidthMm: number
  slatWidthMm: number
  incisionLengthMm: number
  bridgeLengthMm: number
  incisedWidthMm: number
  moduleWidthMm: number
  moduleHeightMm: number
}): LinarOpenAreaResult {
  const widthRatio =
    input.cutWidthMm / Math.max(0.001, input.cutWidthMm + input.slatWidthMm)
  const lengthRatio =
    input.incisionLengthMm /
    Math.max(0.001, input.incisionLengthMm + input.bridgeLengthMm)
  const incisedAreaPercent = widthRatio * lengthRatio * 100
  const incisedAreaMm2 = Math.max(0, input.incisedWidthMm * input.moduleHeightMm)
  const installationModuleAreaMm2 = Math.max(
    0,
    input.moduleWidthMm * input.moduleHeightMm,
  )
  const actualOpeningAreaMm2 = incisedAreaMm2 * (incisedAreaPercent / 100)
  const installationModulePercent =
    installationModuleAreaMm2 > 0
      ? (actualOpeningAreaMm2 / installationModuleAreaMm2) * 100
      : 0
  return {
    actualOpeningAreaMm2,
    incisedAreaMm2,
    installationModuleAreaMm2,
    incisedAreaPercent,
    installationModulePercent,
    incisedDenominatorId: 'selected-incised-area',
    installationDenominatorId: 'displayed-trimmed-installation-module',
    method: 'whole-cells',
    edgeCellStatus: 'provisional',
  }
}
