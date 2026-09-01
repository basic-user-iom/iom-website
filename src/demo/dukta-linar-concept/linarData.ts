import type {
  LinarConfig,
  LinarDataSource,
  LinarFeasibility,
  LinarMaterialId,
  LinarPattern,
  LinarPhysicalEvidence,
  LinarProductionClassification,
  LinarStatus,
} from './types'
import {
  CAD_CUT_AUTHORITY,
  LINAR_BOTTOM_OVER_CUT_MM,
  TOP_CUT_AUTHORITY,
  calculateBridgeHeightMm,
  calculateCadCutGeometryMm,
  calculateLinarOpenAreaResult,
  calculateTopCutDepthMm,
  clampLinarThicknessMm,
  deriveIncisedSpanMetrics,
  derivePatternCompatibleModule,
  resolveLinarPanelFormat,
  type LinarCadCutGeometry,
  type LinarDataAuthority,
  type LinarOpenAreaResult,
  type PatternCompatibleModule,
  type ResolvedLinarPanelFormat,
} from './linarGeometry'

export type LinarConfigurationRecord = {
  pattern: Extract<LinarPattern, 'regular'>
  material: LinarMaterialId
  thicknessMm: number
  cutWidthMm: number
  slatWidthMm: number
  minimumRadiusMm: number
  bridgeLengthMm: number
  incisionLengthMm: number
  approximateOpenAreaPercent: number
  openAreaBasis: 'incised-area'
  productionClassification: LinarProductionClassification
  physicalEvidence: LinarPhysicalEvidence
  feasibility: LinarFeasibility
  productionStandard: boolean
  source: 'latest-physical-samples-chart'
  sourceFilename: string
  sourcePage: number
  visualPosition: string
  boldFrame: boolean
  notes?: string
}

export type LinarSample = LinarConfigurationRecord

const NEWEST_SAMPLE_CHART = 'a6b00d1a-52a7-47d4-8368-9c7806b3596b.pdf'

const recordEvidence = (productionStandard: boolean) => ({
  productionClassification: (productionStandard
    ? 'standard'
    : 'possible') as LinarProductionClassification,
  physicalEvidence: 'physical-sample' as const,
  feasibility: 'allowed' as const,
  productionStandard,
  source: 'latest-physical-samples-chart' as const,
  sourceFilename: NEWEST_SAMPLE_CHART,
  boldFrame: productionStandard,
})

type RawChartRecord = Omit<
  LinarConfigurationRecord,
  | 'productionClassification'
  | 'physicalEvidence'
  | 'feasibility'
  | 'productionStandard'
  | 'source'
  | 'sourceFilename'
  | 'sourcePage'
  | 'visualPosition'
  | 'boldFrame'
  | 'notes'
> & { status: 'Standard' | 'Possible' }

const RAW_CONFIGURATION_VALUES: readonly RawChartRecord[] = [
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 4,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 15,
    bridgeLengthMm: 20,
    incisionLengthMm: 42,
    approximateOpenAreaPercent: 36,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 6,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 20,
    bridgeLengthMm: 42,
    incisionLengthMm: 68,
    approximateOpenAreaPercent: 34,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 4,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 20,
    bridgeLengthMm: 32,
    incisionLengthMm: 73,
    approximateOpenAreaPercent: 35,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 6,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 30,
    bridgeLengthMm: 32,
    incisionLengthMm: 45,
    approximateOpenAreaPercent: 30,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 6,
    cutWidthMm: 3,
    slatWidthMm: 3,
    minimumRadiusMm: 20,
    bridgeLengthMm: 45,
    incisionLengthMm: 89,
    approximateOpenAreaPercent: 32,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 9,
    cutWidthMm: 3,
    slatWidthMm: 3,
    minimumRadiusMm: 30,
    bridgeLengthMm: 62,
    incisionLengthMm: 72,
    approximateOpenAreaPercent: 28,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 10,
    cutWidthMm: 3,
    slatWidthMm: 3,
    minimumRadiusMm: 40,
    bridgeLengthMm: 67,
    incisionLengthMm: 67,
    approximateOpenAreaPercent: 25,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 9,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 50,
    bridgeLengthMm: 63,
    incisionLengthMm: 70,
    approximateOpenAreaPercent: 27,
    openAreaBasis: 'incised-area',
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 12,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 60,
    bridgeLengthMm: 63,
    incisionLengthMm: 70,
    approximateOpenAreaPercent: 27,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 8,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 60,
    bridgeLengthMm: 62,
    incisionLengthMm: 73,
    approximateOpenAreaPercent: 29,
    openAreaBasis: 'incised-area',
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 10,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 70,
    bridgeLengthMm: 66,
    incisionLengthMm: 66,
    approximateOpenAreaPercent: 25,
    openAreaBasis: 'incised-area',
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'three-layer-spruce',
    thicknessMm: 13,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 90,
    bridgeLengthMm: 65,
    incisionLengthMm: 70,
    approximateOpenAreaPercent: 26,
    openAreaBasis: 'incised-area',
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 8,
    cutWidthMm: 5,
    slatWidthMm: 5,
    minimumRadiusMm: 110,
    bridgeLengthMm: 55,
    incisionLengthMm: 60,
    approximateOpenAreaPercent: 26,
    openAreaBasis: 'incised-area',
    status: 'Possible',
  },
]

function chartLocation(record: RawChartRecord): { sourcePage: number; visualPosition: string } {
  if (record.cutWidthMm === 4) {
    return { sourcePage: 2, visualPosition: 'top 4/4 section' }
  }
  if (record.cutWidthMm === 5) {
    return { sourcePage: 2, visualPosition: 'middle 5/5 section' }
  }
  return {
    sourcePage: 1,
    visualPosition: record.cutWidthMm === 2 ? 'upper 2/2 section' : 'middle 3/3 section',
  }
}

export const LINAR_CONFIGURATION_RECORDS: readonly LinarConfigurationRecord[] =
  RAW_CONFIGURATION_VALUES.map((record) => {
    const boldFrame = record.status === 'Standard'
    const { status: _status, ...values } = record
    return {
      ...values,
      ...recordEvidence(boldFrame),
      ...chartLocation(record),
      notes: boldFrame
        ? 'Bold-framed Standard physical sample verified in the newest chart.'
        : 'Populated non-bold physical-sample row; classified Possible rather than Standard.',
    }
  })

const SAMPLES = LINAR_CONFIGURATION_RECORDS

export const BOTTOM_OVERCUT_MM = LINAR_BOTTOM_OVER_CUT_MM
export const CONSERVATIVE_RADIUS_NOTE_MM = 120
export const PARTNER_CONFIRMATION_NOTE =
  'Effective dimensions, material availability and technical values must be confirmed with the responsible manufacturing partner.'
export const CONCEPT_DISCLAIMER =
  'Conceptual visualisation only. Panel behaviour, bending limits and manufacturability must be validated by dukta.'
export const JANUS_THICKNESS_NOTE = 'Panels above 15 mm require the double-sided Janus type.'
export const RADIUS_UNAVAILABLE_NOTE =
  'No physical-sample radius is currently available for this exact configuration.'

const PHYSICAL_SAMPLE_AUTHORITY: LinarDataAuthority = {
  authorities: ['physical-sample'],
  status: 'validated',
  label: 'Physical sample reference',
  source: NEWEST_SAMPLE_CHART,
}

const GEOMETRIC_OPEN_AREA_AUTHORITY: LinarDataAuthority = {
  authorities: ['provisional'],
  status: 'provisional',
  label: 'Whole-cycle geometric estimate',
  source: 'Configured cut, lamella, incision and bridge dimensions',
  note: 'Official treatment of clipped partial cells at installation edges is pending.',
}

const UNAVAILABLE_RADIUS_AUTHORITY: LinarDataAuthority = {
  authorities: ['not-tested'],
  status: 'unavailable',
  label: 'Unavailable',
  source: 'No matching physical sample',
}

export type LinarBlockedRule = {
  materialFamily: LinarMaterialId
  panelThicknessMm: number
  cutWidthMm: number
  lamellaWidthMm: number
  feasibility: Extract<LinarFeasibility, 'blocked'>
  blockedReason: string
  internalClientWording: string
  source: string
}

export const LINAR_BLOCKED_RULES: readonly LinarBlockedRule[] = [
  {
    materialFamily: 'mdf',
    panelThicknessMm: 4,
    cutWidthMm: 8,
    lamellaWidthMm: 2,
    feasibility: 'blocked',
    blockedReason: 'This combination is not recommended according to dukta.',
    internalClientWording: 'not possible / not recommended',
    source: 'Latest direct client response, 1 September 2026',
  },
]

export const LINAR_SAMPLE_MATCH_TOLERANCE_MM = {
  thickness: 0.01,
  width: 0.01,
  length: 0.01,
} as const

function nearlyEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance
}

export function findBlockedRule(config: Pick<
  LinarConfig,
  'material' | 'thicknessMm' | 'cutWidthMm' | 'slatWidthMm'
>): LinarBlockedRule | null {
  return (
    LINAR_BLOCKED_RULES.find(
      (rule) =>
        rule.materialFamily === config.material &&
        nearlyEqual(
          rule.panelThicknessMm,
          config.thicknessMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.thickness,
        ) &&
        nearlyEqual(
          rule.cutWidthMm,
          config.cutWidthMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.width,
        ) &&
        nearlyEqual(
          rule.lamellaWidthMm,
          config.slatWidthMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.width,
        ),
    ) ?? null
  )
}

export function clampThicknessMm(thicknessMm: number): number {
  return clampLinarThicknessMm(thicknessMm)
}

/** Top-side cutting depth into the finished panel, measured from its front face. */
export function getTopCutDepthMm(thicknessMm: number): number {
  return calculateTopCutDepthMm(thicknessMm)
}

/** Over-cut into the spoil board below the finished rear face. */
export function getBottomOvercutMm(): number {
  return BOTTOM_OVERCUT_MM
}

/** Incised area width = circumference / 2 = pi x bending radius. */
export function getIncisedWidthForRadiusMm(radiusMm: number): number {
  return Math.PI * radiusMm
}

export function incisedAreaCoverageFraction(twelfths: number): number {
  return Math.min(12, Math.max(1, twelfths)) / 12
}

export function findExactSample(config: LinarConfig): LinarSample | null {
  if (config.pattern !== 'regular') return null
  // The newest chart names generic MDF samples but does not identify them as
  // Valchromat. A coloured-fibre appearance choice must therefore not inherit
  // Natural MDF's physical-sample evidence or permitted radius silently.
  if (config.material === 'mdf' && config.mdfVariant === 'valchromat') return null
  return (
    SAMPLES.find(
      (sample) =>
        sample.material === config.material &&
        nearlyEqual(
          sample.thicknessMm,
          config.thicknessMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.thickness,
        ) &&
        nearlyEqual(
          sample.cutWidthMm,
          config.cutWidthMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.width,
        ) &&
        nearlyEqual(
          sample.slatWidthMm,
          config.slatWidthMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.width,
        ) &&
        nearlyEqual(
          sample.incisionLengthMm,
          config.incisionLengthMm,
          LINAR_SAMPLE_MATCH_TOLERANCE_MM.length,
        ),
    ) ?? null
  )
}

type BridgeInput = Pick<
  LinarConfig,
  | 'material'
  | 'thicknessMm'
  | 'cutWidthMm'
  | 'slatWidthMm'
  | 'incisionLengthMm'
  | 'pattern'
>

/** The rendered bridge follows the CAD cut model, never a chart-value override. */
export function calculateBridgeLengthMm(config: BridgeInput): {
  valueMm: number
  source: LinarDataSource
  sampleOverride: boolean
  authority: LinarDataAuthority
} {
  const cad = calculateCadCutGeometryMm(config.thicknessMm)
  return {
    valueMm: cad.bridgeSpanMm,
    source: 'CAD-derived geometry',
    sampleOverride: false,
    authority: CAD_CUT_AUTHORITY,
  }
}

export function calculateIncisedOpenAreaPercent(input: {
  cutWidthMm: number
  slatWidthMm: number
  incisionLengthMm: number
  bridgeLengthMm: number
}): number {
  const widthRatio = input.cutWidthMm / (input.cutWidthMm + input.slatWidthMm)
  const lengthRatio = input.incisionLengthMm / (input.incisionLengthMm + input.bridgeLengthMm)
  return widthRatio * lengthRatio * 100
}

export function calculateFullPanelOpenAreaPercent(
  incisedOpenAreaPercent: number,
  coverageFraction: number,
): number {
  return incisedOpenAreaPercent * coverageFraction
}

export type LinarTech = {
  status: LinarStatus
  productionClassification: LinarProductionClassification
  physicalEvidence: LinarPhysicalEvidence
  feasibility: LinarFeasibility
  blockedReason: string | null
  isConfigurationValid: boolean
  sourceRecord: LinarConfigurationRecord | null
  topCutDepthMm: number
  topCutDepthSource: 'Approved interpolation'
  topCutAuthority: LinarDataAuthority
  bridgeHeightMm: number
  bridgeHeightAuthority: LinarDataAuthority
  bottomOvercutMm: number
  cadGeometry: LinarCadCutGeometry
  cadAuthority: LinarDataAuthority
  /** CAD-derived bridge span used by both rendered geometry and its estimate. */
  previewBridgeLengthMm: number
  displayedBridgeLengthMm: number
  physicalSampleBridgeLengthMm: number | null
  physicalSampleBridgeDifferenceFromCadMm: number | null
  physicalSampleBridgeDifferenceFromGeneratedMm: number | null
  bridgeSource: LinarDataSource
  bridgeAuthority: LinarDataAuthority
  bridgeUsesSampleOverride: boolean
  geometricIncisedOpenAreaPercent: number
  geometricFullPanelOpenAreaPercent: number
  referenceOpenAreaPercent: number | null
  openAreaDifferenceGeneratedMinusReferencePoints: number | null
  displayedIncisedOpenAreaPercent: number
  displayedFullPanelOpenAreaPercent: number
  openAreaLabel:
    | 'Physical-sample reference'
    | 'Client chart reference'
    | 'Whole-cycle geometric estimate'
  openAreaAuthority: LinarDataAuthority
  openAreaResult: LinarOpenAreaResult
  referenceMinimumRadiusMm: number | null
  radiusAuthority: LinarDataAuthority
  radiusNote: string | null
  previewStatus:
    | 'Standard physical sample'
    | 'Possible physical sample'
    | 'CAD geometry / Not tested'
    | 'Blocked / Not recommended'
  requestedCoverageFraction: number
  coverageFraction: number
  panelFormat: ResolvedLinarPanelFormat
  module: PatternCompatibleModule
  moduleAuthority: LinarDataAuthority
  partialCellTreatment: 'Pending official edge-cell method'
}

export function resolveLinarTech(config: LinarConfig): LinarTech {
  const exact = findExactSample(config)
  const blockedRule = findBlockedRule(config)
  const bridge = calculateBridgeLengthMm(config)
  const panelFormat = resolveLinarPanelFormat(config)
  const module = derivePatternCompatibleModule(
    panelFormat.targetUsableWidthMm,
    config.cutWidthMm,
    config.slatWidthMm,
  )
  const incisedSpan = deriveIncisedSpanMetrics(
    module,
    config.cutWidthMm,
    config.slatWidthMm,
    config.incisedTwelfths,
  )
  const openAreaResult = calculateLinarOpenAreaResult({
    cutWidthMm: config.cutWidthMm,
    slatWidthMm: config.slatWidthMm,
    incisionLengthMm: config.incisionLengthMm,
    bridgeLengthMm: bridge.valueMm,
    incisedWidthMm: incisedSpan.widthMm,
    moduleWidthMm: module.widthMm,
    moduleHeightMm: panelFormat.renderHeightMm,
  })
  const geometricIncised = openAreaResult.incisedAreaPercent
  const geometricFull = openAreaResult.installationModulePercent
  const referenceOpen = blockedRule ? null : exact?.approximateOpenAreaPercent ?? null
  const referenceRadius = blockedRule ? null : exact?.minimumRadiusMm ?? null
  const physicalSampleBridge = blockedRule ? null : exact?.bridgeLengthMm ?? null
  const productionClassification = exact?.productionClassification ?? 'not-tested'
  const physicalEvidence = exact?.physicalEvidence ?? 'unknown'
  const feasibility: LinarFeasibility = blockedRule
    ? 'blocked'
    : exact?.feasibility ?? 'unknown'
  const status: LinarStatus = blockedRule
    ? 'Not recommended'
    : productionClassification === 'standard'
      ? 'Standard'
      : productionClassification === 'possible'
        ? 'Possible'
        : 'Not tested'
  const cadGeometry = calculateCadCutGeometryMm(config.thicknessMm)

  return {
    status,
    productionClassification,
    physicalEvidence,
    feasibility,
    blockedReason: blockedRule?.blockedReason ?? null,
    isConfigurationValid: feasibility !== 'blocked',
    sourceRecord: exact,
    topCutDepthMm: calculateTopCutDepthMm(config.thicknessMm),
    topCutDepthSource: 'Approved interpolation',
    topCutAuthority: TOP_CUT_AUTHORITY,
    bridgeHeightMm: calculateBridgeHeightMm(config.thicknessMm),
    bridgeHeightAuthority: TOP_CUT_AUTHORITY,
    bottomOvercutMm: getBottomOvercutMm(),
    cadGeometry,
    cadAuthority: CAD_CUT_AUTHORITY,
    previewBridgeLengthMm: bridge.valueMm,
    displayedBridgeLengthMm: bridge.valueMm,
    physicalSampleBridgeLengthMm: physicalSampleBridge,
    physicalSampleBridgeDifferenceFromCadMm:
      physicalSampleBridge == null ? null : physicalSampleBridge - cadGeometry.bridgeSpanMm,
    physicalSampleBridgeDifferenceFromGeneratedMm:
      physicalSampleBridge == null ? null : physicalSampleBridge - bridge.valueMm,
    bridgeSource: bridge.source,
    bridgeAuthority: bridge.authority,
    bridgeUsesSampleOverride: bridge.sampleOverride,
    geometricIncisedOpenAreaPercent: geometricIncised,
    geometricFullPanelOpenAreaPercent: geometricFull,
    referenceOpenAreaPercent: referenceOpen,
    openAreaDifferenceGeneratedMinusReferencePoints:
      referenceOpen == null ? null : geometricIncised - referenceOpen,
    displayedIncisedOpenAreaPercent: referenceOpen ?? geometricIncised,
    displayedFullPanelOpenAreaPercent:
      referenceOpen != null
        ? calculateFullPanelOpenAreaPercent(
            referenceOpen,
            incisedSpan.actualCoverageFraction,
          )
        : geometricFull,
    openAreaLabel:
      referenceOpen == null
        ? 'Whole-cycle geometric estimate'
        : physicalEvidence === 'physical-sample'
          ? 'Physical-sample reference'
          : 'Client chart reference',
    openAreaAuthority:
      referenceOpen != null ? PHYSICAL_SAMPLE_AUTHORITY : GEOMETRIC_OPEN_AREA_AUTHORITY,
    openAreaResult,
    referenceMinimumRadiusMm: referenceRadius,
    radiusAuthority:
      referenceRadius != null ? PHYSICAL_SAMPLE_AUTHORITY : UNAVAILABLE_RADIUS_AUTHORITY,
    radiusNote:
      blockedRule?.blockedReason ??
      (referenceRadius == null ? RADIUS_UNAVAILABLE_NOTE : null),
    previewStatus: blockedRule
      ? 'Blocked / Not recommended'
      : exact == null
        ? 'CAD geometry / Not tested'
        : productionClassification === 'standard'
          ? 'Standard physical sample'
          : 'Possible physical sample',
    requestedCoverageFraction: incisedSpan.requestedCoverageFraction,
    coverageFraction: incisedSpan.actualCoverageFraction,
    panelFormat,
    module,
    moduleAuthority: panelFormat.authority,
    partialCellTreatment: 'Pending official edge-cell method',
  }
}
