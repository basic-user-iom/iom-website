/** Only reviewed, ready themes can be selected. Planned holidays never activate. */
export const SEASONAL_THEMES = {
  halloween: { name: 'Halloween', status: 'ready' },
  christmas: { name: 'Christmas', status: 'planned' },
  easter: { name: 'Easter', status: 'planned' },
  'lunar-new-year': { name: 'Chinese / Lunar New Year', status: 'planned' },
  hanukkah: { name: 'Hanukkah', status: 'planned' },
} as const

export type SeasonalThemeId = keyof typeof SEASONAL_THEMES
export type SeasonalThemeSelection = SeasonalThemeId | 'off'

export function readySeasonalTheme(value: string | null): SeasonalThemeId | null {
  if (!value || !Object.prototype.hasOwnProperty.call(SEASONAL_THEMES, value)) return null
  const id = value as SeasonalThemeId
  return SEASONAL_THEMES[id].status === 'ready' ? id : null
}
