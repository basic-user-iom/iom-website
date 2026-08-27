import {
  DEFAULT_LINAR_CONFIG,
  LINAR_APPLICATIONS,
  LINAR_MATERIALS,
  LINAR_SIDES,
  LINAR_VENEERS,
  LINAR_VIEWS,
  LINAR_VISIBLE_BACKINGS,
  DEFAULT_LINAR_LIGHT,
  cloneConfig,
  type LinarConfig,
  type LinarLightState,
  type LinarSide,
  type LinarViewId,
} from './types'
import {
  LINAR_FELT_COLOURS,
  LINAR_MDF_COLOURS,
  LINAR_PRESENTATION_LIMITS,
  clampLinarPanelCount,
} from './materialData'

export const LINAR_SHARE_VERSION = '2'
const LEGACY_LINAR_SHARE_VERSION = '1'

export type LinarShareState = {
  config: LinarConfig
  bend: number
  secondaryCurveAmount: number
  side: LinarSide
  view: LinarViewId
  light: LinarLightState
  isShared: boolean
}

export type LinarShareSelection = Omit<LinarShareState, 'isShared'>

function parseDescriptorId<T extends string>(
  params: URLSearchParams,
  key: string,
  items: readonly { id: T }[],
  fallback: T,
): T {
  const value = params.get(key)
  return value != null && items.some((item) => item.id === value) ? (value as T) : fallback
}

function parseInteger(
  params: URLSearchParams,
  key: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const raw = params.get(key)
  if (raw == null || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback
}

function defaultShareState(): LinarShareState {
  return {
    config: cloneConfig(DEFAULT_LINAR_CONFIG),
    bend: 0,
    secondaryCurveAmount: 0,
    side: 'front',
    view: 'hero',
    light: { ...DEFAULT_LINAR_LIGHT },
    isShared: false,
  }
}

/**
 * Reads only versioned LINAR parameters. Unknown, malformed and out-of-range
 * values fall back independently, so a shared link cannot create unsupported
 * manufacturing selections.
 */
export function parseLinarShareState(fragment: string): LinarShareState {
  const fallback = defaultShareState()
  let params: URLSearchParams

  try {
    params = new URLSearchParams(fragment.startsWith('#') ? fragment.slice(1) : fragment)
  } catch {
    return fallback
  }

  const shareVersion = params.get('linar')
  if (
    shareVersion !== LINAR_SHARE_VERSION &&
    shareVersion !== LEGACY_LINAR_SHARE_VERSION
  ) {
    return fallback
  }

  const config = cloneConfig(DEFAULT_LINAR_CONFIG)
  config.material = parseDescriptorId(
    params,
    'material',
    LINAR_MATERIALS,
    config.material,
  )
  config.veneer = parseDescriptorId(params, 'veneer', LINAR_VENEERS, config.veneer)
  config.mdfColour = parseDescriptorId(
    params,
    'mdf',
    LINAR_MDF_COLOURS,
    config.mdfColour,
  )
  config.feltColour = parseDescriptorId(
    params,
    'felt',
    LINAR_FELT_COLOURS,
    config.feltColour,
  )
  config.thicknessMm = parseInteger(params, 'thickness', 4, 15, config.thicknessMm)
  config.incisionLengthMm = parseInteger(
    params,
    'incision',
    40,
    400,
    config.incisionLengthMm,
  )
  config.cutWidthMm = parseInteger(params, 'spacing', 2, 8, config.cutWidthMm)
  config.slatWidthMm = parseInteger(params, 'lamella', 2, 8, config.slatWidthMm)
  config.incisedTwelfths = parseInteger(
    params,
    'coverage',
    1,
    12,
    config.incisedTwelfths,
  )
  config.application = parseDescriptorId(
    params,
    'application',
    LINAR_APPLICATIONS,
    config.application,
  )
  config.backing = parseDescriptorId(
    params,
    'backing',
    LINAR_VISIBLE_BACKINGS,
    config.backing,
  )
  config.panelCount = parseInteger(
    params,
    'count',
    LINAR_PRESENTATION_LIMITS.minimumPanelCount,
    LINAR_PRESENTATION_LIMITS.maximumPanelCount,
    config.panelCount,
  )

  const bend = parseInteger(params, 'bend', -100, 100, 0)
  const secondaryCurveAmount = parseInteger(params, 'secondary', 0, 100, 0)
  config.bendDirection = bend < 0 ? 'left' : bend > 0 ? 'right' : 'flat'
  config.bendRadiusMm = null

  let side = parseDescriptorId(params, 'side', LINAR_SIDES, fallback.side)
  const view = parseDescriptorId(params, 'view', LINAR_VIEWS, fallback.view)
  if (view === 'hero') side = 'front'
  if (view === 'reverse') side = 'back'

  const lightEnabled = params.get('light') === '1'
  const parseLightCoordinate = (key: string, fallbackValue: number) => {
    const raw = params.get(key)
    if (raw == null || raw.trim() === '') return fallbackValue
    const value = Number(raw)
    return Number.isFinite(value)
      ? Math.max(-1, Math.min(1, value / 100))
      : fallbackValue
  }
  const light: LinarLightState = {
    enabled: lightEnabled,
    u: parseLightCoordinate('lu', DEFAULT_LINAR_LIGHT.u),
    v: parseLightCoordinate('lv', DEFAULT_LINAR_LIGHT.v),
    // Version 1 links have no radius. They intentionally restore the current
    // safe default rather than guessing an absolute legacy world distance.
    radius: parseLightCoordinate('lr', DEFAULT_LINAR_LIGHT.radius),
  }

  return { config, bend, secondaryCurveAmount, side, view, light, isShared: true }
}

/** Builds a clean URL and deliberately excludes password/session/embed data. */
export function buildLinarShareUrl(baseHref: string, selection: LinarShareSelection): string {
  const url = new URL(baseHref)
  const { config } = selection
  const params = new URLSearchParams()
  const visibleBacking = LINAR_VISIBLE_BACKINGS.some((item) => item.id === config.backing)
    ? config.backing
    : DEFAULT_LINAR_CONFIG.backing
  const secondaryCurveAmount = Number.isFinite(selection.secondaryCurveAmount)
    ? Math.max(0, Math.min(100, Math.round(selection.secondaryCurveAmount)))
    : 0

  url.search = ''
  url.hash = ''
  params.set('linar', LINAR_SHARE_VERSION)
  params.set('material', config.material)
  params.set('veneer', config.veneer)
  params.set('mdf', config.mdfColour)
  params.set('felt', config.feltColour)
  params.set('thickness', String(Math.round(config.thicknessMm)))
  params.set('incision', String(Math.round(config.incisionLengthMm)))
  params.set('spacing', String(Math.round(config.cutWidthMm)))
  params.set('lamella', String(Math.round(config.slatWidthMm)))
  params.set('coverage', String(Math.round(config.incisedTwelfths)))
  params.set('bend', String(Math.round(selection.bend)))
  if (secondaryCurveAmount > 0) {
    params.set('secondary', String(secondaryCurveAmount))
  }
  params.set('application', config.application)
  params.set('backing', visibleBacking)
  params.set(
    'count',
    String(clampLinarPanelCount(config.panelCount)),
  )
  params.set('side', selection.side)
  params.set('view', selection.view)
  const safeLight = selection.light ?? DEFAULT_LINAR_LIGHT
  const lightU = Number.isFinite(safeLight.u)
    ? Math.max(-1, Math.min(1, safeLight.u))
    : DEFAULT_LINAR_LIGHT.u
  const lightV = Number.isFinite(safeLight.v)
    ? Math.max(-1, Math.min(1, safeLight.v))
    : DEFAULT_LINAR_LIGHT.v
  const lightRadius = Number.isFinite(safeLight.radius)
    ? Math.max(-1, Math.min(1, safeLight.radius))
    : DEFAULT_LINAR_LIGHT.radius
  if (safeLight.enabled) params.set('light', '1')
  if (
    safeLight.enabled ||
    Math.abs(lightU - DEFAULT_LINAR_LIGHT.u) > 0.005 ||
    Math.abs(lightV - DEFAULT_LINAR_LIGHT.v) > 0.005 ||
    Math.abs(lightRadius - DEFAULT_LINAR_LIGHT.radius) > 0.005
  ) {
    params.set('lu', String(Math.round(lightU * 100)))
    params.set('lv', String(Math.round(lightV * 100)))
    params.set('lr', String(Math.round(lightRadius * 100)))
  }
  url.hash = params.toString()
  return url.toString()
}
