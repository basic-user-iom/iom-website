import { parseLocalePath } from '../i18n/routing'
import { isBlogPath } from '../blog/paths'
import { isCaseStudyPath } from '../case-studies/paths'
import { isLegalPath } from '../legal/paths'
import { isLegacyStartPath, isProjectCostsPath } from '../project-costs/paths'
import { readySeasonalTheme, type SeasonalThemeId } from './registry'

export const SEASONAL_PREVIEW_PARAM = 'iom-season'
export const SEASONAL_PREVIEW_KEY = 'iom:seasonal-preview:v1'

/** Allowlist: tools, CRM, recordings, demos, unknown routes and embeds stay untouched. */
export function isSeasonalSiteRoute(pathname: string, search = ''): boolean {
  if (new URLSearchParams(search).has('embed')) return false
  const { path } = parseLocalePath(pathname)
  return path === '/' || isBlogPath(path) || isCaseStudyPath(path) || isLegalPath(path)
    || isProjectCostsPath(path) || isLegacyStartPath(path)
}

export function resolveSeasonalTheme({
  pathname, search = '', configured, previewEnabled = false,
  storedPreview = null, embedded = false,
}: {
  pathname: string
  search?: string
  configured: string
  previewEnabled?: boolean
  storedPreview?: string | null
  embedded?: boolean
}): SeasonalThemeId | null {
  if (embedded || !isSeasonalSiteRoute(pathname, search)) return null
  const query = new URLSearchParams(search)
  const preview = previewEnabled
    ? (query.has(SEASONAL_PREVIEW_PARAM) ? query.get(SEASONAL_PREVIEW_PARAM) : storedPreview)
    : null
  return readySeasonalTheme(preview ?? configured)
}
