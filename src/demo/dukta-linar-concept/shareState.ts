import {
  DEFAULT_LINAR_CONFIG,
  LINAR_APPLICATIONS,
  LINAR_BACKLIGHT_MODES,
  LINAR_MATERIALS,
  LINAR_SIDES,
  LINAR_VENEERS,
  LINAR_VIEWS,
  LINAR_VISIBLE_BACKINGS,
  DEFAULT_LINAR_LIGHT,
  cloneConfig,
  type LinarConfig,
  type LinarFeltColourId,
  type LinarLightState,
  type LinarSide,
  type LinarViewId,
} from './types'
import {
  LINAR_FLEECE_COLOURS,
  LINAR_FELT_COLOURS,
  LINAR_MDF_COLOURS,
  LINAR_MDF_VARIANTS,
  LINAR_PRESENTATION_LIMITS,
  clampLinarPanelCount,
} from './materialData'

export const LINAR_SHARE_VERSION = '3'
const LEGACY_LINAR_SHARE_VERSIONS = new Set(['1', '2'])

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

function descriptorValue<T extends string>(
  value: string,
  items: readonly { id: T }[],
  fallback: T,
): T {
  return items.some((item) => item.id === value) ? (value as T) : fallback
}

function migrateLegacyFeltColour(value: string | null): LinarFeltColourId {
  // Red is the only old provisional swatch with a known client-supplied
  // identity. Numbered/development colours must not be guessed into the new
  // nine-colour catalogue.
  return value === 'reference-red' ? 'ruby-red' : DEFAULT_LINAR_CONFIG.feltColour
}

function backingAllowsRearTransmission(config: Pick<LinarConfig, 'backing'>): boolean {
  // Wool felt is confirmed opaque. Acoustic fleece remains a visual
  // transmission study whose strength is resolved from its selected subtype.
  return config.backing !== 'felt'
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
    !LEGACY_LINAR_SHARE_VERSIONS.has(shareVersion ?? '')
  ) {
    return fallback
  }
  const isLegacyShare = shareVersion !== LINAR_SHARE_VERSION

  const config = cloneConfig(DEFAULT_LINAR_CONFIG)
  config.material = parseDescriptorId(
    params,
    'material',
    LINAR_MATERIALS,
    config.material,
  )
  config.veneer = parseDescriptorId(params, 'veneer', LINAR_VENEERS, config.veneer)
  if (isLegacyShare) {
    // Versions 1/2 stored provisional numbered MDF swatches without a Natural
    // versus Valchromat identity. Restore the safe neutral board instead of
    // inventing a catalogue mapping.
    config.mdfVariant = 'natural'
    config.mdfColour = DEFAULT_LINAR_CONFIG.mdfColour
    config.fleeceColour = DEFAULT_LINAR_CONFIG.fleeceColour
    config.feltColour = migrateLegacyFeltColour(params.get('felt'))
  } else {
    config.mdfVariant = parseDescriptorId(
      params,
      'mdfVariant',
      LINAR_MDF_VARIANTS,
      config.mdfVariant,
    )
    config.mdfColour = parseDescriptorId(
      params,
      'valchromat',
      LINAR_MDF_COLOURS,
      config.mdfColour,
    )
    config.fleeceColour = parseDescriptorId(
      params,
      'fleece',
      LINAR_FLEECE_COLOURS,
      config.fleeceColour,
    )
    config.feltColour = parseDescriptorId(
      params,
      'felt',
      LINAR_FELT_COLOURS,
      config.feltColour,
    )
  }
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
  config.backlightMode = parseDescriptorId(
    params,
    'backlight',
    LINAR_BACKLIGHT_MODES,
    config.backlightMode,
  )
  config.backlightIntensity = parseInteger(
    params,
    'bli',
    10,
    100,
    config.backlightIntensity,
  )
  if (config.application === 'freestanding' || !backingAllowsRearTransmission(config)) {
    config.backlightMode = 'off'
  }
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
    placement:
      config.application !== 'freestanding' &&
      backingAllowsRearTransmission(config) &&
      params.get('lp') === 'behind'
        ? 'behind'
        : 'room',
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
  const mdfVariant = descriptorValue(
    config.mdfVariant,
    LINAR_MDF_VARIANTS,
    DEFAULT_LINAR_CONFIG.mdfVariant,
  )
  const valchromatColour = descriptorValue(
    config.mdfColour,
    LINAR_MDF_COLOURS,
    DEFAULT_LINAR_CONFIG.mdfColour,
  )
  const fleeceColour = descriptorValue(
    config.fleeceColour,
    LINAR_FLEECE_COLOURS,
    DEFAULT_LINAR_CONFIG.fleeceColour,
  )
  const feltColour = descriptorValue(
    config.feltColour,
    LINAR_FELT_COLOURS,
    DEFAULT_LINAR_CONFIG.feltColour,
  )
  const secondaryCurveAmount = Number.isFinite(selection.secondaryCurveAmount)
    ? Math.max(0, Math.min(100, Math.round(selection.secondaryCurveAmount)))
    : 0

  url.search = ''
  url.hash = ''
  params.set('linar', LINAR_SHARE_VERSION)
  params.set('material', config.material)
  params.set('veneer', config.veneer)
  params.set('mdfVariant', mdfVariant)
  params.set('valchromat', valchromatColour)
  params.set('fleece', fleeceColour)
  params.set('felt', feltColour)
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
  const mountedBacklightEnabled =
    config.application !== 'freestanding' &&
    visibleBacking !== 'felt' &&
    config.backlightMode === 'on'
  if (mountedBacklightEnabled) {
    params.set('backlight', 'on')
    params.set(
      'bli',
      String(Math.max(10, Math.min(100, Math.round(config.backlightIntensity)))),
    )
  }
  params.set(
    'count',
    String(clampLinarPanelCount(config.panelCount)),
  )
  params.set('side', selection.side)
  params.set('view', selection.view)
  const safeLight = selection.light ?? DEFAULT_LINAR_LIGHT
  const lightPlacement =
    config.application !== 'freestanding' &&
    visibleBacking !== 'felt' &&
    safeLight.placement === 'behind'
      ? 'behind'
      : 'room'
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
  if (lightPlacement === 'behind') params.set('lp', 'behind')
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
