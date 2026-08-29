import { CAMERA_VIEWS, OPTIONS } from '../config/productConfig.js'

const BOOLEAN_TRUE = new Set(['1', 'true', 'on', 'yes'])

function parseValue(option, raw) {
  if (raw == null || raw === '') return null
  if (option.type === 'boolean') return BOOLEAN_TRUE.has(String(raw).toLowerCase())
  const allowed = option.choices?.map((choice) => choice.id)
  if (allowed && !allowed.includes(raw)) return null
  return raw
}

export function configFromSearch(search = window.location.search) {
  const params = new URLSearchParams(search)
  const values = {}
  for (const option of Object.values(OPTIONS)) {
    const parsed = parseValue(option, params.get(option.urlKey))
    if (parsed != null) values[option.id] = parsed
  }
  return values
}

export function searchFromConfig(values) {
  const params = new URLSearchParams()
  for (const option of Object.values(OPTIONS)) {
    const value = values[option.id]
    if (option.type === 'boolean') {
      params.set(option.urlKey, value ? '1' : '0')
    } else if (value != null) {
      params.set(option.urlKey, String(value))
    }
  }
  return params.toString()
}

export function writeConfigToUrl(values) {
  const query = searchFromConfig(values)
  const next = `${window.location.pathname}?${query}${window.location.hash}`
  window.history.replaceState(null, '', next)
  return `${window.location.origin}${window.location.pathname}?${query}`
}

export function getShareUrl(values) {
  const query = searchFromConfig(values)
  return `${window.location.origin}${window.location.pathname}?${query}`
}

export function isCameraView(id) {
  return CAMERA_VIEWS.some((view) => view.id === id)
}
